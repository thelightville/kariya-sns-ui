import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import {
  TRANSACTION_ENVELOPE_PROFILE,
  validateTransactionEnvelope,
} from "./transactionCustody.mjs";

function fail(message) {
  throw new TypeError(message);
}

function canonicalJsonSecrets(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "nonce,verifier"
  ) {
    fail("transaction secrets must contain exactly nonce and verifier");
  }
  return JSON.stringify({ nonce: value.nonce, verifier: value.verifier });
}

export function sha256Base64url(value) {
  if (typeof value !== "string") fail("digest input must be a string");
  return createHash("sha256").update(value, "ascii").digest("base64url");
}

export function createAesGcmTransactionCipher(keyProvider) {
  if (
    !keyProvider ||
    typeof keyProvider.currentKeyReference !== "function" ||
    typeof keyProvider.wrapKey !== "function" ||
    typeof keyProvider.unwrapKey !== "function"
  ) {
    fail("a key provider is required");
  }

  return Object.freeze({
    async seal(plaintext, aad, wrappingContext) {
      const keyReference = await keyProvider.currentKeyReference();
      const dataKey = randomBytes(32);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
      cipher.setAAD(Buffer.from(aad, "utf8"));
      const ciphertext = Buffer.concat([
        cipher.update(canonicalJsonSecrets(plaintext), "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      let wrapped;
      try {
        wrapped = await keyProvider.wrapKey(dataKey, keyReference, {
          ...wrappingContext,
          aad_sha256: sha256Base64url(aad),
        });
      } finally {
        dataKey.fill(0);
      }

      return validateTransactionEnvelope({
        crypto_profile: TRANSACTION_ENVELOPE_PROFILE,
        kek_key_id: keyReference.key_id,
        kek_key_version: keyReference.key_version,
        wrapped_dek_b64url: Buffer.from(wrapped).toString("base64url"),
        iv_b64url: iv.toString("base64url"),
        tag_b64url: tag.toString("base64url"),
        ciphertext_b64url: ciphertext.toString("base64url"),
        aad_sha256: sha256Base64url(aad),
      });
    },

    async open(envelope, aad, wrappingContext) {
      const validated = validateTransactionEnvelope(envelope);
      if (validated.aad_sha256 !== sha256Base64url(aad)) {
        fail("transaction envelope AAD does not match");
      }
      const dataKey = Buffer.from(
        await keyProvider.unwrapKey(
          Buffer.from(validated.wrapped_dek_b64url, "base64url"),
          {
            key_id: validated.kek_key_id,
            key_version: validated.kek_key_version,
          },
          { ...wrappingContext, aad_sha256: validated.aad_sha256 }
        )
      );
      if (dataKey.length !== 32) fail("unwrapped data key must be 32 bytes");
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          dataKey,
          Buffer.from(validated.iv_b64url, "base64url")
        );
        decipher.setAAD(Buffer.from(aad, "utf8"));
        decipher.setAuthTag(Buffer.from(validated.tag_b64url, "base64url"));
        const cleartext = Buffer.concat([
          decipher.update(Buffer.from(validated.ciphertext_b64url, "base64url")),
          decipher.final(),
        ]).toString("utf8");
        const parsed = JSON.parse(cleartext);
        canonicalJsonSecrets(parsed);
        return Object.freeze({ nonce: parsed.nonce, verifier: parsed.verifier });
      } finally {
        dataKey.fill(0);
      }
    },
  });
}
