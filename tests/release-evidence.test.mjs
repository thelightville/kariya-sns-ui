import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
function fakeBundle(index) {
  return `${JSON.stringify({ mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.3", verificationMaterial: { tlogEntries: [{ logIndex: String(index) }] } })}\n`;
}
function fakeLegacyBundle(index) {
  return `${JSON.stringify({ base64Signature: "test", cert: "test", rekorBundle: { Payload: { logIndex: index } } })}\n`;
}

test("artifact, SBOM and provenance bind exact workflow trust and retained Sigstore bundles", { skip: !buildAvailable }, () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "ksns-ui-evidence-"));
  try {
    const head = git("rev-parse", "HEAD");
    const tree = git("show", "-s", "--format=%T", "HEAD");
    const workflowRef = "thelightville/kariya-sns-ui/.github/workflows/release-evidence-v2.yml@refs/pull/44/merge";
    const identity = `https://github.com/${workflowRef}`;
    const trust = ["--certificate-identity", identity, "--oidc-issuer", "https://token.actions.githubusercontent.com", "--workflow-ref", workflowRef, "--workflow-sha", head];
    const first = path.join(temporary, "first");
    const second = path.join(temporary, "second");
    const parameters = ["--head", head, "--tree", tree, ...trust];
    run(["build", ...parameters, "--output-dir", first]);
    run(["build", ...parameters, "--output-dir", second]);
    const prefix = `kariya-sns-ui-${head}`;
    const artifact = `${prefix}.tar.gz`;
    assert.deepEqual(readFileSync(path.join(first, artifact)), readFileSync(path.join(second, artifact)));
    assert.deepEqual(readFileSync(path.join(first, `${prefix}.cdx.json`)), readFileSync(path.join(second, `${prefix}.cdx.json`)));
    assert.deepEqual(readFileSync(path.join(first, `${prefix}.provenance.json`)), readFileSync(path.join(second, `${prefix}.provenance.json`)));
    writeFileSync(path.join(first, `${artifact}.sigstore.json`), fakeLegacyBundle(11));
    for (const [name, index] of [[`${prefix}.cdx.json`, 12], [`${prefix}.provenance.json`, 13]]) writeFileSync(path.join(first, `${name}.sigstore.json`), fakeBundle(index));
    run(["bind", ...parameters, "--output-dir", first]);
    const manifestPath = path.join(first, `${prefix}.evidence.json`);
    const manifest = JSON.parse(readFileSync(manifestPath));
    assert.equal(manifest.schema, "kariya.ksns-ui.release-evidence.v2");
    assert.deepEqual(manifest.signing.trust, { certificateIdentity: identity, oidcIssuer: "https://token.actions.githubusercontent.com", repository: "thelightville/kariya-sns-ui", workflowPath: ".github/workflows/release-evidence-v2.yml", workflowRef, workflowSha: head });
    assert.deepEqual(manifest.signing.bundles.artifact.rekorLogIndexes, ["11"]);
    assert.equal(manifest.rollback.status, "N/A_PROPOSED");
    assert.equal(manifest.databaseMigration.status, "N/A_PROPOSED");
    assert.deepEqual(Object.keys(manifest.configurationIdentities).sort(), [
      ".github/workflows/deploy.yml", ".github/workflows/release-evidence-v2.yml", "deploy/ct119-ui-instances.json",
      "deploy/systemd/kariya-sns-ui-ca.service", "deploy/systemd/kariya-sns-ui-ng.service",
      "next.config.mjs", "package-lock.json", "package.json",
    ]);
    writeFileSync(path.join(first, artifact), Buffer.concat([readFileSync(path.join(first, artifact)), Buffer.from("tampered") ]));
    const fakeCosign = path.join(temporary, "cosign");
    writeFileSync(fakeCosign, "#!/bin/sh\nexit 0\n"); chmodSync(fakeCosign, 0o755);
    writeFileSync(path.join(first, `${prefix}.evidence.json.sigstore.json`), fakeBundle(14));
    assert.match(run(["verify", ...parameters, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /artifact digest mismatch/);
    assert.match(run(["verify", ...parameters.filter((value, index) => index < parameters.length - 8), "--certificate-identity", identity.replace("thelightville", "attacker"), ...trust.slice(2), "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /certificate identity|repository or workflow identity/);
    writeFileSync(path.join(first, artifact), readFileSync(path.join(second, artifact)));
    writeFileSync(path.join(first, `${artifact}.sigstore.json`), fakeBundle(99));
    assert.match(run(["verify", ...parameters, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /artifact signature bundle mismatch/);
    assert.match(run(["verify", "--head", "0".repeat(40), "--tree", tree, ...trust, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /head mismatch/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
