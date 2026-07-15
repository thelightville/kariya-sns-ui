import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";

import { KeyManagementServiceClient } from "@google-cloud/kms";

import { productionRegionDefinition } from "./productionConfig.mjs";

function fail() {
  throw new Error("cloud_auth_runtime_unavailable");
}

function validateKeyResource(region, keyResource) {
  const definition = productionRegionDefinition(region);
  const match = /^projects\/[^/]+\/locations\/([^/]+)\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/u.exec(
    keyResource
  );
  if (!match || match[1] !== definition.kms_location) fail();
}

export function validateExternalAccountWifConfig(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "external_account" ||
    typeof value.audience !== "string" ||
    !value.audience.startsWith("//iam.googleapis.com/") ||
    value.subject_token_type !== "urn:ietf:params:oauth:token-type:jwt" ||
    value.token_url !== "https://sts.googleapis.com/v1/token" ||
    value.credential_source === null ||
    typeof value.credential_source !== "object" ||
    "private_key" in value ||
    "private_key_id" in value ||
    "client_email" in value
  ) {
    fail();
  }
  return value;
}

function createWifKmsClient(path) {
  try {
    validateExternalAccountWifConfig(JSON.parse(readFileSync(path, "utf8")));
    return new KeyManagementServiceClient({ keyFilename: path });
  } catch {
    fail();
  }
}

export function createRegionalEnvelopeKeyProvider(
  { region, keyResource, wifConfigPath },
  { kmsClient } = {}
) {
  validateKeyResource(region, keyResource);
  kmsClient ??= createWifKmsClient(wifConfigPath);
  if (!kmsClient || typeof kmsClient.getCryptoKey !== "function") fail();

  return Object.freeze({
    async currentKeyReference() {
      try {
        const [key] = await kmsClient.getCryptoKey({ name: keyResource });
        const version = key?.primary?.name;
        if (
          typeof version !== "string" ||
          !version.startsWith(`${keyResource}/cryptoKeyVersions/`) ||
          key.primary.protectionLevel !== "HSM" ||
          key.primary.state !== "ENABLED" ||
          key.primary.algorithm !== "GOOGLE_SYMMETRIC_ENCRYPTION"
        ) {
          fail();
        }
        return Object.freeze({ key_id: keyResource, key_version: version });
      } catch {
        fail();
      }
    },

    async wrapKey(dataKey, reference) {
      if (
        !Buffer.isBuffer(dataKey) ||
        dataKey.length !== 32 ||
        reference?.key_id !== keyResource ||
        !reference?.key_version?.startsWith(`${keyResource}/cryptoKeyVersions/`)
      ) {
        fail();
      }
      try {
        const [result] = await kmsClient.encrypt({
          name: keyResource,
          plaintext: dataKey,
        });
        if (
          result?.name !== reference.key_version ||
          !result.ciphertext ||
          Buffer.from(result.ciphertext).length === 0
        ) {
          fail();
        }
        return Buffer.from(result.ciphertext);
      } catch {
        fail();
      }
    },

    async unwrapKey(wrappedKey, reference) {
      if (
        !Buffer.isBuffer(wrappedKey) ||
        wrappedKey.length === 0 ||
        reference?.key_id !== keyResource ||
        !reference?.key_version?.startsWith(`${keyResource}/cryptoKeyVersions/`)
      ) {
        fail();
      }
      try {
        const [result] = await kmsClient.decrypt({
          name: keyResource,
          ciphertext: wrappedKey,
        });
        const plaintext = Buffer.from(result?.plaintext ?? []);
        if (plaintext.length !== 32) fail();
        return plaintext;
      } catch {
        fail();
      }
    },

    async assertReady() {
      await this.currentKeyReference();
    },

    async close() {
      if (typeof kmsClient.close === "function") await kmsClient.close();
    },
  });
}
