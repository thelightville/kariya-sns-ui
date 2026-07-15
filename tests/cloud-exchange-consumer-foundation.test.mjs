import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConsumerTransactionTransition,
  calculateSessionCookieMaxAge,
  canTransitionConsumerTransaction,
  canonical32,
  regionalTuple,
  validateIntrospectionResult,
  validatePreauthorizationResult,
  validateRedemptionResult,
} from "../src/server/auth/cloudExchangeFoundation.mjs";
import {
  FOUNDATION_UNAVAILABLE_CODE,
  unavailableCloudExchangeClient,
  unavailableSessionIntrospector,
  unavailableTransactionStore,
} from "../src/server/auth/ports.mjs";

const STATE = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const NONCE = "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM";
const REQUEST_ID = "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY";
const SESSION = "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg";

function redemption(region = "ng") {
  const tuple = regionalTuple(region);
  return {
    contract_version: "cloud.authorization-code-redemption.v1",
    region,
    issuer: tuple.issuer,
    audience: tuple.audience,
    nonce: NONCE,
    subject: "user-0001",
    tenant_id: "tenant-0001",
    session_handle: SESSION,
    issued_at: 2_000_000_000,
    expires_at: 2_000_000_899,
    server_time: 2_000_000_000,
  };
}

function activeIntrospection(region = "ng") {
  const tuple = regionalTuple(region);
  return {
    contract_version: "cloud.session-authority.v1",
    active: true,
    issuer: tuple.issuer,
    audience: tuple.audience,
    destination_host: tuple.destination_host,
    region,
    subject: "user-0001",
    tenant_id: "tenant-0001",
    current_role: "analyst",
    mfa_authenticated: true,
    issued_at: 2_000_000_000,
    expires_at: 2_000_000_899,
  };
}

test("regional tuples are exact and country-paired", () => {
  assert.deepEqual(regionalTuple("ng"), {
    region: "ng",
    issuer: "https://console.kariya.ng",
    audience: "https://sns.kariya.ng",
    destination_host: "sns.kariya.ng",
    redirect_uri: "https://sns.kariya.ng/api/auth/exchange/callback",
    client_id: "ksns-ui-ng",
    client_uri_san: "spiffe://kariya/services/ksns/ng",
  });
  assert.deepEqual(regionalTuple("ca"), {
    region: "ca",
    issuer: "https://console.kariya.ca",
    audience: "https://sns.kariya.ca",
    destination_host: "sns.kariya.ca",
    redirect_uri: "https://sns.kariya.ca/api/auth/exchange/callback",
    client_id: "ksns-ui-ca",
    client_uri_san: "spiffe://kariya/services/ksns/ca",
  });
  assert.throws(() => regionalTuple("us"), /exactly ng or ca/);
});

test("canonical values decode to exactly 32 bytes and reject aliases", () => {
  for (const value of [STATE, NONCE, REQUEST_ID, SESSION]) {
    assert.equal(canonical32(value), value);
  }
  for (const value of [
    `${STATE}=`,
    STATE.slice(0, -1),
    `${STATE.slice(0, -1)}F`,
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA",
  ]) {
    assert.throws(() => canonical32(value), /base64url|canonically/);
  }
});

test("Cloud preauthorization timestamps are authoritative and exactly 300 seconds", () => {
  const valid = {
    contract_version: "cloud.exchange-preauthorization.v1",
    request_id: REQUEST_ID,
    issued_at: 2_000_000_000,
    expires_at: 2_000_000_300,
    server_time: 2_000_000_000,
  };
  assert.equal(validatePreauthorizationResult(valid, "ng").region, "ng");
  assert.throws(
    () => validatePreauthorizationResult({ ...valid, expires_at: 2_000_000_299 }, "ng"),
    /exact TTL/
  );
  assert.throws(
    () => validatePreauthorizationResult({ ...valid, expires_at: 2_000_000_301 }, "ng"),
    /exact TTL/
  );
  assert.throws(
    () => validatePreauthorizationResult({ ...valid, server_time: 2_000_000_001 }, "ng"),
    /time authority/
  );
});

test("redemption accepts delayed observation and rejects crossover or time drift", () => {
  assert.equal(validateRedemptionResult(redemption(), "ng", NONCE).region, "ng");
  assert.equal(
    validateRedemptionResult(
      { ...redemption(), server_time: 2_000_000_001 },
      "ng",
      NONCE
    ).server_time,
    2_000_000_001
  );
  assert.throws(
    () =>
      validateRedemptionResult(
        { ...redemption(), issuer: "https://console.kariya.ca" },
        "ng",
        NONCE
      ),
    /crosses/
  );
  assert.throws(
    () => validateRedemptionResult(redemption(), "ca", NONCE),
    /crosses/
  );
  for (const changed of [
    { expires_at: 2_000_000_898 },
    { expires_at: 2_000_000_900 },
    { server_time: 1_999_999_999 },
    { server_time: 2_000_000_899 },
    { server_time: 2_000_000_900 },
  ]) {
    assert.throws(
      () => validateRedemptionResult({ ...redemption(), ...changed }, "ng", NONCE),
      /time authority/
    );
  }

  assert.equal(validateIntrospectionResult(activeIntrospection(), "ng").active, true);
  assert.throws(
    () =>
      validateIntrospectionResult(
        { ...activeIntrospection(), destination_host: "sns.kariya.ca" },
        "ng"
      ),
    /crosses/
  );
  assert.deepEqual(
    validateIntrospectionResult(
      { contract_version: "cloud.session-authority.v1", active: false },
      "ng"
    ),
    { contract_version: "cloud.session-authority.v1", active: false }
  );
});

test("cookie lifetime is positive min(899, expires_at - server_time)", () => {
  const at = 2_000_000_000;
  assert.equal(
    calculateSessionCookieMaxAge({ issued_at: at, server_time: at, expires_at: at + 899 }),
    899
  );
  assert.equal(
    calculateSessionCookieMaxAge({ issued_at: at, server_time: at + 1, expires_at: at + 899 }),
    898
  );
  assert.equal(
    calculateSessionCookieMaxAge({ issued_at: at, server_time: at + 898, expires_at: at + 899 }),
    1
  );
  for (const invalid of [
    { issued_at: at, server_time: at, expires_at: at + 898 },
    { issued_at: at, server_time: at, expires_at: at + 900 },
    { issued_at: at, server_time: at - 1, expires_at: at + 899 },
    { issued_at: at, server_time: at + 899, expires_at: at + 899 },
  ]) {
    assert.throws(() => calculateSessionCookieMaxAge(invalid), /time profile/);
  }
  assert.throws(
    () =>
      calculateSessionCookieMaxAge({
        issued_at: String(at),
        server_time: at,
        expires_at: at + 899,
      }),
    /safe integer/
  );
});

test("consumer transaction transitions are explicit and terminal states stay terminal", () => {
  for (const [from, to] of [
    ["created", "registered"],
    ["registered", "callback_reserved"],
    ["callback_reserved", "registered"],
    ["callback_reserved", "redeem_sent"],
    ["redeem_sent", "completed"],
  ]) {
    assert.equal(canTransitionConsumerTransaction(from, to), true);
    assert.equal(assertConsumerTransactionTransition(from, to), to);
  }
  for (const [from, to] of [
    ["created", "completed"],
    ["registered", "redeem_sent"],
    ["redeem_sent", "registered"],
    ["completed", "registered"],
    ["terminal_failed", "created"],
    ["expired", "created"],
  ]) {
    assert.equal(canTransitionConsumerTransaction(from, to), false);
    assert.throws(() => assertConsumerTransactionTransition(from, to), /illegal/);
  }
});

test("all source-only adapters fail closed without a success path", async () => {
  const calls = [
    () => unavailableTransactionStore().create({}),
    () => unavailableTransactionStore().reserveCallback(STATE),
    () => unavailableCloudExchangeClient().register({}),
    () => unavailableCloudExchangeClient().redeem({}),
    () => unavailableSessionIntrospector().introspect(SESSION),
  ];
  for (const call of calls) {
    await assert.rejects(call, (error) => error.code === FOUNDATION_UNAVAILABLE_CODE);
  }
});
