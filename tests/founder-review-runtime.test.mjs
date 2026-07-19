import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSyntheticReviewRuntime,
  SYNTHETIC_REVIEW_MODE,
} from "../src/server/auth/syntheticReviewRuntime.mjs";
import {
  configuredRegion,
  selectAuthRuntime,
} from "../src/server/auth/runtimeComposition.mjs";

const ORIGIN = "http://127.0.0.1:3010";

function reviewEnv(overrides = {}) {
  return {
    NODE_ENV: "development",
    K_SNS_SYNTHETIC_REVIEW: SYNTHETIC_REVIEW_MODE,
    K_SNS_SYNTHETIC_REVIEW_REGION: "ng",
    KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN: "1",
    KARIYA_SNS_PUBLIC_ORIGIN: ORIGIN,
    ...overrides,
  };
}

test("synthetic review runtime requires the exact development loopback gate", () => {
  for (const env of [
    reviewEnv({ NODE_ENV: "production" }),
    reviewEnv({ K_SNS_AUTH_RUNTIME: "production" }),
    reviewEnv({ K_SNS_SYNTHETIC_REVIEW: "1" }),
    reviewEnv({ K_SNS_SYNTHETIC_REVIEW_REGION: "us" }),
    reviewEnv({ KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN: "0" }),
    reviewEnv({ KARIYA_SNS_PUBLIC_ORIGIN: "http://localhost:3010" }),
    reviewEnv({ KARIYA_SNS_PUBLIC_ORIGIN: "https://sns.kariya.ng" }),
    reviewEnv({ KARIYA_SNS_PUBLIC_ORIGIN: "http://127.0.0.1" }),
  ]) {
    assert.throws(
      () => createSyntheticReviewRuntime(env),
      /synthetic_review_runtime_unavailable/
    );
  }
  assert.equal(configuredRegion(ORIGIN, reviewEnv()), "ng");
  assert.throws(
    () => configuredRegion("http://127.0.0.1:3011", reviewEnv()),
    /origin_mismatch/
  );
});

test("synthetic review exchange is one-time, regional, expiring, and logout revokes", async () => {
  const runtime = createSyntheticReviewRuntime(reviewEnv());
  const started = await runtime.exchange.start({
    region: "ng",
    normalized_return_path: "/workflow",
  });
  const callback = new URL(started.authorization_url);
  assert.equal(callback.origin, ORIGIN);
  assert.equal(callback.pathname, "/api/auth/exchange/callback");

  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  const completed = await runtime.exchange.callback({ region: "ng", code, state });
  assert.equal(completed.max_age, 899);
  assert.equal(completed.normalized_return_path, "/workflow");

  await assert.rejects(
    runtime.exchange.callback({ region: "ng", code, state }),
    /synthetic_review_authorization_failed/
  );
  await assert.rejects(
    runtime.sessions.authorize(completed.session_handle, "ca"),
    /session_inactive/
  );

  const authority = await runtime.sessions.authorize(
    completed.session_handle,
    "ng"
  );
  assert.deepEqual(
    {
      contract_version: authority.contract_version,
      active: authority.active,
      region: authority.region,
      tenant_id: authority.tenant_id,
      current_role: authority.current_role,
      mfa_authenticated: authority.mfa_authenticated,
    },
    {
      contract_version: "cloud.session-authority.v1",
      active: true,
      region: "ng",
      tenant_id: "synthetic-founder-tenant",
      current_role: "owner",
      mfa_authenticated: true,
    }
  );

  await runtime.sessions.logout(completed.session_handle, "ng");
  await assert.rejects(
    runtime.sessions.authorize(completed.session_handle, "ng"),
    /session_inactive/
  );
});

test("invalid synthetic request stays on the unavailable runtime", async () => {
  const selected = selectAuthRuntime(
    reviewEnv({ KARIYA_SNS_PUBLIC_ORIGIN: "https://sns.kariya.ng" })
  );
  assert.equal(selected.composition, null);
  await assert.rejects(
    selected.runtime.exchange.start({
      region: "ng",
      normalized_return_path: "/workflow",
    }),
    /unavailable in the source-only consumer foundation/
  );
});
