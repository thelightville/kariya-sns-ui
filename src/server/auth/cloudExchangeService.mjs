import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  calculateSessionCookieMaxAge,
  canonical32,
  regionalTuple,
  validatePreauthorizationResult,
  validateRedemptionResult,
} from "./cloudExchangeFoundation.mjs";
import {
  TRANSACTION_SCHEMA_VERSION,
  TRANSACTION_TOMBSTONE_SECONDS,
  canonicalTransactionAad,
  safeTransactionReturnPath,
  validateTransactionRecord,
} from "./transactionCustody.mjs";
import { sha256Base64url } from "./transactionCrypto.mjs";
import {
  PREAUTHORIZATION_TENANT_SCOPE,
  TRANSACTION_WRAP_PURPOSE,
} from "./regionalEnvelopeKeyProvider.mjs";

const AUTHORIZATION_PATH = "/auth/exchange/authorize";
const RESERVATION_SECONDS = 30;

function fail(message) {
  throw new TypeError(message);
}

function nowSeconds(clock) {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 1) fail("clock must return epoch seconds");
  return value;
}

function canonicalRandom(random) {
  const value = random();
  canonical32(value, "generated value");
  return value;
}

function terminalFields(now, reason) {
  return {
    terminal_at: now,
    terminal_reason: reason,
    purge_after: now + TRANSACTION_TOMBSTONE_SECONDS,
  };
}

export function createCloudExchangeService({
  store,
  cipher,
  cloud,
  clock = () => Math.floor(Date.now() / 1000),
  random = () => randomBytes(32).toString("base64url"),
  uuid = randomUUID,
}) {
  if (!store || !cipher || !cloud) fail("store, cipher and Cloud client are required");

  return Object.freeze({
    async start({ region, normalized_return_path }) {
      const tuple = regionalTuple(region);
      if (!safeTransactionReturnPath(normalized_return_path)) {
        fail("return path violates cloud.same-origin-safe-path.v1");
      }
      const createdAt = nowSeconds(clock);
      const id = uuid();
      const state = canonicalRandom(random);
      const nonce = canonicalRandom(random);
      const verifier = canonicalRandom(random);
      const stateDigest = sha256Base64url(state);
      const nonceDigest = sha256Base64url(nonce);
      const challenge = createHash("sha256")
        .update(verifier, "ascii")
        .digest("base64url");

      const aadSource = {
        id,
        region,
        state_digest: stateDigest,
        created_at: createdAt,
      };
      const envelope = await cipher.seal(
        { nonce, verifier },
        canonicalTransactionAad(aadSource),
        {
          tenant: PREAUTHORIZATION_TENANT_SCOPE,
          region,
          purpose: TRANSACTION_WRAP_PURPOSE,
        }
      );
      const created = validateTransactionRecord({
        schema_version: TRANSACTION_SCHEMA_VERSION,
        id,
        region,
        state_digest: stateDigest,
        cloud_request_id_digest: null,
        normalized_return_path,
        envelope,
        state: "created",
        state_version: 1,
        cloud_issued_at: null,
        cloud_expires_at: null,
        reservation_id_digest: null,
        reservation_expires_at: null,
        terminal_at: null,
        terminal_reason: null,
        purge_after: null,
        created_at: createdAt,
        updated_at: createdAt,
      });
      await store.create(created);

      let registration;
      try {
        registration = validatePreauthorizationResult(
          await cloud.register({
            contract_version: "cloud.exchange-preauthorization.v1",
            region,
            issuer: tuple.issuer,
            audience: tuple.audience,
            redirect_uri: tuple.redirect_uri,
            state_sha256: stateDigest,
            nonce_sha256: nonceDigest,
            code_challenge: challenge,
            code_challenge_method: "S256",
            normalized_return_path,
          }),
          region
        );
      } catch {
        await store.failTerminal(
          id,
          1,
          { ...terminalFields(nowSeconds(clock), "registration_unavailable") }
        );
        throw new Error("cloud_authority_unavailable");
      }

      await store.markRegistered(id, 1, {
        cloud_request_id_digest: sha256Base64url(registration.request_id),
        cloud_issued_at: registration.issued_at,
        cloud_expires_at: registration.expires_at,
        updated_at: registration.server_time,
      });

      const authorize = new URL(AUTHORIZATION_PATH, tuple.issuer);
      authorize.searchParams.set("request_id", registration.request_id);
      authorize.searchParams.set("state", state);
      return Object.freeze({
        authorization_url: authorize.toString(),
        transaction_id: id,
      });
    },

    async callback({ region, code, state }) {
      const tuple = regionalTuple(region);
      canonical32(code, "code");
      canonical32(state, "state");
      const reservationId = canonicalRandom(random);
      const reservationDigest = sha256Base64url(reservationId);
      const callbackAt = nowSeconds(clock);

      const reserved = validateTransactionRecord(
        await store.reserveCallback(sha256Base64url(state), {
          region,
          reservation_id_digest: reservationDigest,
          reservation_expires_at: callbackAt + RESERVATION_SECONDS,
          now: callbackAt,
        })
      );
      if (reserved.region !== region || reserved.state !== "callback_reserved") {
        fail("callback reservation crossed region or state");
      }
      if (callbackAt >= reserved.cloud_expires_at) {
        await store.expire(reserved.id, reserved.state_version, {
          ...terminalFields(callbackAt, "preauthorization_expired"),
        });
        throw new Error("authorization_failed");
      }

      const secrets = await cipher.open(
        reserved.envelope,
        canonicalTransactionAad(reserved),
        {
          tenant: PREAUTHORIZATION_TENANT_SCOPE,
          region,
          purpose: TRANSACTION_WRAP_PURPOSE,
        }
      );
      canonical32(secrets.nonce, "nonce");
      canonical32(secrets.verifier, "verifier");

      const redeemSent = validateTransactionRecord(
        await store.markRedeemSent(
          reserved.id,
          reserved.state_version,
          reservationDigest,
          { updated_at: callbackAt }
        )
      );

      try {
        const result = validateRedemptionResult(
          await cloud.redeem({
            contract_version: "cloud.authorization-code-redemption.v1",
            grant_type: "authorization_code",
            region,
            issuer: tuple.issuer,
            audience: tuple.audience,
            redirect_uri: tuple.redirect_uri,
            code,
            state,
            code_verifier: secrets.verifier,
            nonce: secrets.nonce,
          }),
          region,
          secrets.nonce
        );
        const maxAge = calculateSessionCookieMaxAge(result);
        await store.complete(redeemSent.id, redeemSent.state_version, {
          ...terminalFields(result.server_time, "redeemed"),
        });
        return Object.freeze({
          session_handle: result.session_handle,
          max_age: maxAge,
          normalized_return_path: redeemSent.normalized_return_path,
        });
      } catch {
        await store.failTerminal(redeemSent.id, redeemSent.state_version, {
          ...terminalFields(nowSeconds(clock), "redeem_ambiguous_or_rejected"),
        });
        throw new Error("authorization_failed");
      }
    },
  });
}
