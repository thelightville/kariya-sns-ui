import { randomBytes } from "node:crypto";

import { canonical32, regionalTuple } from "./cloudExchangeFoundation.mjs";

export const SYNTHETIC_REVIEW_MODE = "explicit-loopback-only";

const SYNTHETIC_STATE = Symbol.for("kariya.ksns.synthetic-review-runtime.v1");

function exactLoopbackOrigin(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port !== "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function syntheticConfig(env) {
  if (
    env.NODE_ENV !== "development" ||
    env.K_SNS_AUTH_RUNTIME === "production" ||
    env.K_SNS_SYNTHETIC_REVIEW !== SYNTHETIC_REVIEW_MODE ||
    env.KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN !== "1" ||
    !["ng", "ca"].includes(env.K_SNS_SYNTHETIC_REVIEW_REGION) ||
    !exactLoopbackOrigin(env.KARIYA_SNS_PUBLIC_ORIGIN)
  ) {
    throw new Error("synthetic_review_runtime_unavailable");
  }
  return Object.freeze({
    origin: env.KARIYA_SNS_PUBLIC_ORIGIN,
    region: env.K_SNS_SYNTHETIC_REVIEW_REGION,
  });
}

function stateFor(config) {
  const existing = globalThis[SYNTHETIC_STATE];
  if (existing) {
    if (existing.origin !== config.origin || existing.region !== config.region) {
      throw new Error("synthetic_review_runtime_conflict");
    }
    return existing;
  }
  const created = {
    origin: config.origin,
    region: config.region,
    pending: new Map(),
    sessions: new Map(),
  };
  globalThis[SYNTHETIC_STATE] = created;
  return created;
}

function randomCanonical32() {
  return randomBytes(32).toString("base64url");
}

function currentSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function syntheticReviewRuntimeRequested(env = process.env) {
  return env.K_SNS_SYNTHETIC_REVIEW === SYNTHETIC_REVIEW_MODE;
}

export function syntheticReviewRegion(configuredOrigin, env = process.env) {
  if (!syntheticReviewRuntimeRequested(env)) return null;
  const config = syntheticConfig(env);
  if (configuredOrigin !== config.origin) {
    throw new Error("synthetic_review_runtime_origin_mismatch");
  }
  return config.region;
}

export function createSyntheticReviewRuntime(env = process.env) {
  const config = syntheticConfig(env);
  const state = stateFor(config);
  const tuple = regionalTuple(config.region);

  return Object.freeze({
    exchange: Object.freeze({
      async start({ region, normalized_return_path }) {
        if (
          region !== config.region ||
          typeof normalized_return_path !== "string" ||
          !normalized_return_path.startsWith("/")
        ) {
          throw new Error("synthetic_review_authorization_failed");
        }
        const browserState = randomCanonical32();
        const code = randomCanonical32();
        state.pending.set(browserState, {
          code,
          normalized_return_path,
          expires_at: currentSeconds() + 300,
        });
        const callback = new URL("/api/auth/exchange/callback", config.origin);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", browserState);
        return Object.freeze({
          authorization_url: callback.toString(),
          transaction_id: randomCanonical32(),
        });
      },

      async callback({ region, code, state: browserState }) {
        canonical32(code, "code");
        canonical32(browserState, "state");
        const pending = state.pending.get(browserState);
        state.pending.delete(browserState);
        if (
          region !== config.region ||
          !pending ||
          pending.code !== code ||
          currentSeconds() >= pending.expires_at
        ) {
          throw new Error("synthetic_review_authorization_failed");
        }
        const sessionHandle = randomCanonical32();
        const issuedAt = currentSeconds();
        state.sessions.set(sessionHandle, {
          issued_at: issuedAt,
          expires_at: issuedAt + 899,
        });
        return Object.freeze({
          session_handle: sessionHandle,
          max_age: 899,
          normalized_return_path: pending.normalized_return_path,
        });
      },
    }),

    sessions: Object.freeze({
      async authorize(sessionHandle, expectedRegion) {
        canonical32(sessionHandle, "session_handle");
        const session = state.sessions.get(sessionHandle);
        if (
          expectedRegion !== config.region ||
          !session ||
          currentSeconds() >= session.expires_at
        ) {
          throw new Error("session_inactive");
        }
        return Object.freeze({
          contract_version: "cloud.session-authority.v1",
          active: true,
          issuer: tuple.issuer,
          audience: tuple.audience,
          destination_host: tuple.destination_host,
          region: config.region,
          subject: "synthetic-founder",
          tenant_id: "synthetic-founder-tenant",
          current_role: "owner",
          mfa_authenticated: true,
          issued_at: session.issued_at,
          expires_at: session.expires_at,
        });
      },

      async logout(sessionHandle, expectedRegion) {
        canonical32(sessionHandle, "session_handle");
        if (expectedRegion !== config.region || !state.sessions.delete(sessionHandle)) {
          throw new Error("session_authority_unavailable");
        }
      },
    }),
  });
}
