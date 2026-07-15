import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
} from "node:crypto";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { productionRegionDefinition } from "./productionConfig.mjs";

export const SYSTEMD_CURRENT_CREDENTIAL = "ksns-transaction-kek-current";
export const SYSTEMD_PREVIOUS_CREDENTIAL = "ksns-transaction-kek-previous";
export const SYSTEMD_WRAP_PROFILE = "ksns.systemd-credential-dek-wrap.v1";
export const PREAUTHORIZATION_TENANT_SCOPE = "cloud-preauthorization-pending";
export const TRANSACTION_WRAP_PURPOSE = "ksns-auth-transaction-dek";

function fail() {
  throw new Error("cloud_auth_runtime_unavailable");
}

function exactKeys(value, names) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== [...names].sort().join(",")
  ) {
    fail();
  }
}

function canonicalWrapContext(reference, context) {
  exactKeys(context, ["aad_sha256", "purpose", "region", "tenant"]);
  if (
    context.tenant !== PREAUTHORIZATION_TENANT_SCOPE ||
    context.purpose !== TRANSACTION_WRAP_PURPOSE ||
    context.region !== reference.region ||
    typeof context.aad_sha256 !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(context.aad_sha256)
  ) {
    fail();
  }
  return Buffer.from(
    JSON.stringify([
      SYSTEMD_WRAP_PROFILE,
      reference.key_id,
      reference.key_version,
      context.tenant,
      context.region,
      context.purpose,
      context.aad_sha256,
    ]),
    "utf8"
  );
}

function assertCredentialMetadata(directory, path, fs, expectedUid) {
  if (!isAbsolute(directory)) fail();
  const directoryMetadata = fs.statSync(directory);
  const linkMetadata = fs.lstatSync(path);
  const fileMetadata = fs.statSync(path);
  if (
    !Number.isSafeInteger(expectedUid) ||
    expectedUid < 1 ||
    !directoryMetadata.isDirectory() ||
    directoryMetadata.uid !== expectedUid ||
    (directoryMetadata.mode & 0o077) !== 0 ||
    linkMetadata.isSymbolicLink() ||
    !fileMetadata.isFile() ||
    fileMetadata.uid !== expectedUid ||
    (fileMetadata.mode & 0o777) !== 0o400 ||
    fileMetadata.size !== 32
  ) {
    fail();
  }
}

function loadCredential(directory, credentialName, metadata, fs, expectedUid) {
  const path = join(directory, credentialName);
  assertCredentialMetadata(directory, path, fs, expectedUid);
  const plaintext = fs.readFileSync(path);
  if (!Buffer.isBuffer(plaintext) || plaintext.length !== 32) fail();
  try {
    return {
      ...metadata,
      credential_name: credentialName,
      key: createSecretKey(plaintext),
    };
  } finally {
    plaintext.fill(0);
  }
}

function referenceKey(reference) {
  return `${reference?.key_id ?? ""}\u0000${reference?.key_version ?? ""}`;
}

export function createRegionalEnvelopeKeyProvider(
  { region, credentialDirectory, keyId, currentVersion, previousVersion = null },
  {
    fs = { lstatSync, readFileSync, statSync },
    random = randomBytes,
    expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
  } = {}
) {
  productionRegionDefinition(region);
  const expectedKeyId = `ksns-auth-${region}-transaction-kek`;
  if (
    keyId !== expectedKeyId ||
    !/^v[1-9][0-9]{0,8}$/u.test(currentVersion) ||
    (previousVersion !== null &&
      (!/^v[1-9][0-9]{0,8}$/u.test(previousVersion) ||
        Number(previousVersion.slice(1)) >= Number(currentVersion.slice(1))))
  ) {
    fail();
  }

  const records = [
    loadCredential(
      credentialDirectory,
      SYSTEMD_CURRENT_CREDENTIAL,
      { region, key_id: keyId, key_version: currentVersion },
      fs,
      expectedUid
    ),
  ];
  if (previousVersion !== null) {
    records.push(
      loadCredential(
        credentialDirectory,
        SYSTEMD_PREVIOUS_CREDENTIAL,
        { region, key_id: keyId, key_version: previousVersion },
        fs,
        expectedUid
      )
    );
  }
  const byReference = new Map(
    records.map((record) => [referenceKey(record), record])
  );
  let closed = false;

  function recordFor(reference) {
    if (closed) fail();
    const record = byReference.get(referenceKey(reference));
    if (!record || record.region !== region || !record.key) fail();
    return record;
  }

  return Object.freeze({
    async currentKeyReference() {
      if (closed) fail();
      return Object.freeze({ key_id: keyId, key_version: currentVersion });
    },

    async wrapKey(dataKey, reference, context) {
      const record = recordFor(reference);
      if (!Buffer.isBuffer(dataKey) || dataKey.length !== 32) fail();
      const iv = random(12);
      if (!Buffer.isBuffer(iv) || iv.length !== 12) fail();
      const cipher = createCipheriv("aes-256-gcm", record.key, iv);
      cipher.setAAD(canonicalWrapContext(record, context));
      const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },

    async unwrapKey(wrappedKey, reference, context) {
      const record = recordFor(reference);
      if (!Buffer.isBuffer(wrappedKey) || wrappedKey.length !== 60) fail();
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          record.key,
          wrappedKey.subarray(0, 12)
        );
        decipher.setAAD(canonicalWrapContext(record, context));
        decipher.setAuthTag(wrappedKey.subarray(12, 28));
        const plaintext = Buffer.concat([
          decipher.update(wrappedKey.subarray(28)),
          decipher.final(),
        ]);
        if (plaintext.length !== 32) fail();
        return plaintext;
      } catch {
        fail();
      }
    },

    async assertReady() {
      if (closed || records.length < 1) fail();
    },

    async close() {
      if (closed) return;
      closed = true;
      for (const record of records) record.key = null;
      byReference.clear();
    },
  });
}
