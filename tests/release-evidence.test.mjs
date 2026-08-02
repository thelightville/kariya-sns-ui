import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "release-evidence.mjs");
const buildAvailable = existsSync(path.join(ROOT, ".next", "standalone"));
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
function run(arguments_, expected = 0) {
  const result = spawnSync(process.execPath, [SCRIPT, ...arguments_], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}

test("artifact, SBOM and signed provenance are deterministic and independently verifiable", { skip: !buildAvailable }, () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "ksns-ui-evidence-"));
  try {
    const keyPath = path.join(temporary, "key.pem");
    writeFileSync(keyPath, generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    const head = git("rev-parse", "HEAD");
    const tree = git("show", "-s", "--format=%T", "HEAD");
    const first = path.join(temporary, "first");
    const second = path.join(temporary, "second");
    const parameters = ["--head", head, "--tree", tree, "--signing-key", keyPath];
    run(["build", ...parameters, "--output-dir", first]);
    run(["verify", "--head", head, "--tree", tree, "--output-dir", first]);
    run(["build", ...parameters, "--output-dir", second]);
    const artifact = `kariya-sns-ui-${head}.tar.gz`;
    assert.deepEqual(readFileSync(path.join(first, artifact)), readFileSync(path.join(second, artifact)));
    const manifest = JSON.parse(readFileSync(path.join(first, `kariya-sns-ui-${head}.evidence.json`)));
    assert.deepEqual(manifest.source, { head, tree });
    assert.equal(manifest.rollback.status, "N/A_PROPOSED");
    assert.equal(manifest.databaseMigration.status, "N/A_PROPOSED");
    assert.deepEqual(Object.keys(manifest.configurationIdentities).sort(), [
      ".github/workflows/deploy.yml", "deploy/ct119-ui-instances.json",
      "deploy/systemd/kariya-sns-ui-ca.service", "deploy/systemd/kariya-sns-ui-ng.service",
      "next.config.mjs", "package-lock.json", "package.json",
    ]);
    writeFileSync(path.join(first, artifact), Buffer.concat([readFileSync(path.join(first, artifact)), Buffer.from("tampered") ]));
    assert.match(run(["verify", "--head", head, "--tree", tree, "--output-dir", first], 1).stderr, /artifact digest mismatch/);
    assert.match(run(["verify", "--head", "0".repeat(40), "--tree", tree, "--output-dir", second], 1).stderr, /head mismatch/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
