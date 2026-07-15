import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  PREAUTHORIZATION_TENANT_SCOPE,
  SYSTEMD_CURRENT_CREDENTIAL,
  SYSTEMD_PREVIOUS_CREDENTIAL,
  TRANSACTION_WRAP_PURPOSE,
  createRegionalEnvelopeKeyProvider,
} from "../src/server/auth/regionalEnvelopeKeyProvider.mjs";

const DIRECTORY = "/run/credentials/kariya-sns-ui.service";
const KEY_ID = "ksns-auth-ng-transaction-kek";
const CONTEXT = Object.freeze({
  tenant: PREAUTHORIZATION_TENANT_SCOPE,
  region: "ng",
  purpose: TRANSACTION_WRAP_PURPOSE,
  aad_sha256: Buffer.alloc(32, 7).toString("base64url"),
});

function syntheticFs({
  current = Buffer.alloc(32, 1),
  previous = Buffer.alloc(32, 2),
  uid = 1001,
  directoryMode = 0o40500,
  fileMode = 0o100400,
  symlink = false,
} = {}) {
  const reads = [];
  const keys = new Map([
    [SYSTEMD_CURRENT_CREDENTIAL, current],
    [SYSTEMD_PREVIOUS_CREDENTIAL, previous],
  ]);
  const name = (path) => [...keys.keys()].find((candidate) => path.endsWith(candidate));
  return {
    reads,
    statSync(path) {
      const credential = name(path);
      if (!credential) {
        return {
          uid,
          mode: directoryMode,
          isDirectory: () => true,
          isFile: () => false,
        };
      }
      const value = keys.get(credential);
      return {
        uid,
        mode: fileMode,
        size: value.length,
        isDirectory: () => false,
        isFile: () => true,
      };
    },
    lstatSync(path) {
      if (!name(path)) throw new Error("unexpected lstat");
      return { isSymbolicLink: () => symlink };
    },
    readFileSync(path) {
      const credential = name(path);
      if (!credential) throw new Error("missing credential");
      const plaintext = Buffer.from(keys.get(credential));
      reads.push(plaintext);
      return plaintext;
    },
  };
}

function provider(fs, options = {}) {
  return createRegionalEnvelopeKeyProvider(
    {
      region: "ng",
      credentialDirectory: DIRECTORY,
      keyId: KEY_ID,
      currentVersion: "v2",
      previousVersion: "v1",
      ...options,
    },
    { fs, random: (length) => Buffer.alloc(length, 9), expectedUid: 1001 }
  );
}

test("systemd runtime credential round-trip binds key metadata and context", async () => {
  const fs = syntheticFs();
  const custody = provider(fs);
  const reference = await custody.currentKeyReference();
  const plaintext = Buffer.alloc(32, 4);
  const wrapped = await custody.wrapKey(plaintext, reference, CONTEXT);
  assert.equal(wrapped.length, 60);
  assert.deepEqual(await custody.unwrapKey(wrapped, reference, CONTEXT), plaintext);
  assert.deepEqual(reference, { key_id: KEY_ID, key_version: "v2" });
  assert.ok(fs.reads.every((value) => value.every((byte) => byte === 0)));
});

test("tamper and wrong tenant, region, purpose, version or kid fail closed", async () => {
  const custody = provider(syntheticFs());
  const reference = await custody.currentKeyReference();
  const wrapped = await custody.wrapKey(Buffer.alloc(32, 4), reference, CONTEXT);
  const tampered = Buffer.from(wrapped);
  tampered[59] ^= 1;
  const attempts = [
    () => custody.unwrapKey(tampered, reference, CONTEXT),
    () => custody.unwrapKey(wrapped, reference, { ...CONTEXT, tenant: "tenant-a" }),
    () => custody.unwrapKey(wrapped, reference, { ...CONTEXT, region: "ca" }),
    () => custody.unwrapKey(wrapped, reference, { ...CONTEXT, purpose: "other" }),
    () => custody.unwrapKey(wrapped, { ...reference, key_version: "v3" }, CONTEXT),
    () => custody.unwrapKey(wrapped, { ...reference, key_id: "other" }, CONTEXT),
  ];
  for (const attempt of attempts) await assert.rejects(attempt, /unavailable/);
});

test("rotation encrypts with current and decrypts current or previous", async () => {
  const fs = syntheticFs();
  const custody = provider(fs);
  const current = await custody.currentKeyReference();
  const previous = { key_id: KEY_ID, key_version: "v1" };
  const plaintext = Buffer.alloc(32, 5);
  const currentWrapped = await custody.wrapKey(plaintext, current, CONTEXT);
  const previousWrapped = await custody.wrapKey(plaintext, previous, CONTEXT);
  assert.deepEqual(await custody.unwrapKey(currentWrapped, current, CONTEXT), plaintext);
  assert.deepEqual(await custody.unwrapKey(previousWrapped, previous, CONTEXT), plaintext);

  const restarted = provider(syntheticFs());
  assert.deepEqual(
    await restarted.unwrapKey(previousWrapped, previous, CONTEXT),
    plaintext
  );
  await restarted.close();
  await assert.rejects(
    restarted.unwrapKey(currentWrapped, current, CONTEXT),
    /unavailable/
  );
});

test("retired versions and invalid systemd custody metadata fail closed", async () => {
  const withoutPrevious = provider(syntheticFs(), { previousVersion: null });
  await assert.rejects(
    withoutPrevious.unwrapKey(
      Buffer.alloc(60),
      { key_id: KEY_ID, key_version: "v1" },
      CONTEXT
    ),
    /unavailable/
  );

  for (const fs of [
    syntheticFs({ current: Buffer.alloc(31) }),
    syntheticFs({ uid: 1002 }),
    syntheticFs({ directoryMode: 0o40700 | 0o077 }),
    syntheticFs({ fileMode: 0o100440 }),
    syntheticFs({ symlink: true }),
  ]) {
    assert.throws(() => provider(fs), /unavailable/);
  }
  const missing = syntheticFs();
  missing.readFileSync = () => {
    throw new Error("must-not-disclose-credential-path");
  };
  assert.throws(
    () => provider(missing),
    (error) =>
      /unavailable/.test(error.message) &&
      !/must-not-disclose/.test(error.message)
  );
  assert.throws(
    () => provider(syntheticFs(), { credentialDirectory: "relative" }),
    /unavailable/
  );
  assert.throws(
    () => provider(syntheticFs(), { keyId: "ksns-auth-ca-transaction-kek" }),
    /unavailable/
  );
  assert.throws(
    () => provider(syntheticFs(), { currentVersion: "v1", previousVersion: "v2" }),
    /unavailable/
  );
});

test("custody source does not accept key bytes from process environment", () => {
  const names = [
    "K_SNS_TRANSACTION_KEK",
    "K_SNS_TRANSACTION_KEK_BASE64",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ];
  for (const name of names) assert.equal(process.env[name], undefined);
});
