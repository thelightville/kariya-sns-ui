import { Buffer } from "node:buffer";

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

export function createRegionalEnvelopeKeyProvider(
  { region, keyResource },
  { kmsClient = new KeyManagementServiceClient() } = {}
) {
  validateKeyResource(region, keyResource);
  if (!kmsClient || typeof kmsClient.getCryptoKey !== "function") fail();

  return Object.freeze({
    async currentKeyReference() {
      try {
        const [key] = await kmsClient.getCryptoKey({ name: keyResource });
        const version = key?.primary?.name;
        if (
          typeof version !== "string" ||
          !version.startsWith(`${keyResource}/cryptoKeyVersions/`)
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
