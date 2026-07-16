import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildBffContext } from "../src/server/backend/bffContext.mjs";
import { createCloudExchangeService } from "../src/server/auth/cloudExchangeService.mjs";
import { createSessionAuthority } from "../src/server/auth/sessionAuthority.mjs";
import { createAesGcmTransactionCipher } from "../src/server/auth/transactionCrypto.mjs";
import {
  hostLocalSessionCookie,
} from "../src/server/auth/runtimeComposition.mjs";
import {
  createSyntheticKeyProvider,
  createSyntheticTransactionStore,
  fixed32,
} from "./fixtures/cloudExchangeTestAdapters.mjs";

const STATE = fixed32(1);
const NONCE = fixed32(2);
const VERIFIER = fixed32(3);
const RESERVATION = fixed32(4);
const REQUEST_ID = fixed32(5);
const CODE = fixed32(6);
const HANDLE = fixed32(7);
const UUID = "123e4567-e89b-42d3-a456-426614174000";

function active(region = "ng") {
  const ng = region === "ng";
  return {
    contract_version: "cloud.session-authority.v1",
    active: true,
    issuer: ng ? "https://console.kariya.ng" : "https://console.kariya.ca",
    audience: ng ? "https://sns.kariya.ng" : "https://sns.kariya.ca",
    destination_host: ng ? "sns.kariya.ng" : "sns.kariya.ca",
    region,
    subject: "founder-user",
    tenant_id: "founder-tenant",
    current_role: "owner",
    mfa_authenticated: true,
    issued_at: 1100,
    expires_at: 1999,
  };
}

function harness({ redeemThrows = false } = {}) {
  let now = 1000;
  const randomValues = [
    STATE,
    NONCE,
    VERIFIER,
    RESERVATION,
    fixed32(9),
    fixed32(10),
  ];
  const store = createSyntheticTransactionStore();
  let registerRequest;
  let redeemRequest;
  const cloud = {
    async register(request) {
      registerRequest = request;
      return {
        contract_version: "cloud.exchange-preauthorization.v1",
        request_id: REQUEST_ID,
        issued_at: 1000,
        expires_at: 1300,
        server_time: 1000,
      };
    },
    async redeem(request) {
      redeemRequest = request;
      if (redeemThrows) throw new Error("lost_response");
      return {
        contract_version: "cloud.authorization-code-redemption.v1",
        issuer: "https://console.kariya.ng",
        audience: "https://sns.kariya.ng",
        region: "ng",
        nonce: NONCE,
        subject: "founder-user",
        tenant_id: "founder-tenant",
        session_handle: HANDLE,
        issued_at: 1100,
        expires_at: 1999,
        server_time: 1101,
      };
    },
    async logout() {},
  };
  const service = createCloudExchangeService({
    store,
    cipher: createAesGcmTransactionCipher(createSyntheticKeyProvider()),
    cloud,
    clock: () => now,
    random: () => randomValues.shift(),
    uuid: () => UUID,
  });
  return {
    service,
    store,
    cloud,
    setNow(value) {
      now = value;
    },
    get registerRequest() {
      return registerRequest;
    },
    get redeemRequest() {
      return redeemRequest;
    },
  };
}

test("synthetic start and callback preserve exact regional contract and bounded cookie", async () => {
  const value = harness();
  const started = await value.service.start({
    region: "ng",
    normalized_return_path: "/workflow",
  });
  const url = new URL(started.authorization_url);
  assert.equal(url.origin, "https://console.kariya.ng");
  assert.equal(url.pathname, "/api/auth/exchange/authorize");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["request_id", "state"]);
  assert.equal(value.registerRequest.state_sha256.length, 43);
  assert.equal(value.registerRequest.code_challenge_method, "S256");

  value.setNow(1100);
  const result = await value.service.callback({
    region: "ng",
    code: CODE,
    state: STATE,
  });
  assert.equal(result.session_handle, HANDLE);
  assert.equal(result.max_age, 898);
  assert.equal(result.normalized_return_path, "/workflow");
  assert.equal(value.redeemRequest.nonce, NONCE);
  assert.equal(value.redeemRequest.code_verifier, VERIFIER);
  assert.equal(value.store.records.get(UUID).state, "completed");
  assert.equal(value.store.records.get(UUID).envelope, null);
});

test("callback replay and wrong region fail before a second redemption", async () => {
  const value = harness();
  await value.service.start({ region: "ng", normalized_return_path: "/overview" });
  value.setNow(1100);
  await assert.rejects(
    value.service.callback({ region: "ca", code: CODE, state: STATE })
  );
  await value.service.callback({ region: "ng", code: CODE, state: STATE });
  await assert.rejects(
    value.service.callback({ region: "ng", code: CODE, state: STATE })
  );
  assert.equal(value.store.signingAttempts, 1);
});

test("ambiguous redemption is terminal and cannot replay", async () => {
  const value = harness({ redeemThrows: true });
  await value.service.start({ region: "ng", normalized_return_path: "/actions" });
  value.setNow(1100);
  await assert.rejects(
    value.service.callback({ region: "ng", code: CODE, state: STATE }),
    /authorization_failed/
  );
  assert.equal(value.store.records.get(UUID).state, "terminal_failed");
  assert.equal(value.store.records.get(UUID).envelope, null);
  await assert.rejects(
    value.service.callback({ region: "ng", code: CODE, state: STATE })
  );
  assert.equal(value.store.signingAttempts, 1);
});

test("expired pre-redemption reservation can recover without replaying redemption", async () => {
  const value = harness();
  await value.service.start({ region: "ng", normalized_return_path: "/workflow" });
  const digest = value.registerRequest.state_sha256;
  await value.store.reserveCallback(digest, {
    region: "ng",
    reservation_id_digest: fixed32(11),
    reservation_expires_at: 1130,
    now: 1100,
  });
  await assert.rejects(
    value.store.reserveCallback(digest, {
      region: "ng",
      reservation_id_digest: fixed32(12),
      reservation_expires_at: 1159,
      now: 1129,
    })
  );
  const recovered = await value.store.reserveCallback(digest, {
    region: "ng",
    reservation_id_digest: fixed32(12),
    reservation_expires_at: 1160,
    now: 1130,
  });
  assert.equal(recovered.state, "callback_reserved");
  assert.equal(recovered.state_version, 5);
  assert.equal(value.store.signingAttempts, 0);
});

test("session authority introspects every request and fails closed", async () => {
  let calls = 0;
  const sessions = createSessionAuthority({
    introspector: {
      async introspect() {
        calls += 1;
        return active("ng");
      },
    },
    cloud: { async logout() {} },
  });
  assert.equal((await sessions.authorize(HANDLE, "ng")).active, true);
  assert.equal((await sessions.authorize(HANDLE, "ng")).active, true);
  assert.equal(calls, 2);
  await assert.rejects(sessions.authorize(HANDLE, "ca"), /unavailable/);

  const unavailable = createSessionAuthority({
    introspector: { async introspect() { throw new Error("down"); } },
    cloud: { async logout() { throw new Error("down"); } },
  });
  await assert.rejects(unavailable.authorize(HANDLE, "ng"), /unavailable/);
  await assert.rejects(unavailable.logout(HANDLE, "ng"), /unavailable/);
});

test("host-local cookie and BFF context never expose the opaque handle", () => {
  const cookie = hostLocalSessionCookie(HANDLE, 899);
  assert.deepEqual(cookie.options, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 899,
  });
  assert.equal("domain" in cookie.options, false);

  const context = buildBffContext(active("ng"), "ng", fixed32(8));
  assert.equal(context["x-kariya-tenant-id"], "founder-tenant");
  assert.equal(context["x-kariya-role"], "admin");
  assert.equal(JSON.stringify(context).includes(HANDLE), false);
});

test("migration fixes PostgreSQL authority, TTL and terminal cleanup invariants", async () => {
  const sql = await readFile(
    new URL("../migrations/0001_create_ksns_auth_transactions.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /state_digest varchar\(43\) NOT NULL UNIQUE/u);
  assert.match(sql, /cloud_expires_at - cloud_issued_at = 300/u);
  assert.match(sql, /purge_after = terminal_at \+ 86400/u);
  assert.doesNotMatch(sql, /redis|create_all|access_token/iu);
});
