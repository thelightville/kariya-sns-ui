import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "release-evidence.mjs");
const EXPECTED_WORKFLOW_REF = "thelightville/kariya-sns-ui/.github/workflows/release-evidence-v2.yml@refs/pull/44/merge";
const EXPECTED_WORKFLOW_SHA = "84268e64632d7933cc5d5963d866775dc426c875";
const EXPECTED_IDENTITY = `https://github.com/${EXPECTED_WORKFLOW_REF}`;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const buildAvailable = existsSync(path.join(ROOT, ".next", "standalone"));
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
function run(arguments_, expected = 0) {
  const result = spawnSync(process.execPath, [SCRIPT, ...arguments_], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}
function fakeBundle(index, subject) {
  return `${JSON.stringify({ mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.3", verificationMaterial: { tlogEntries: [{ logIndex: String(index) }] }, testSubjectSha256: digest(subject) })}\n`;
}
function fakeLegacyBundle(index, subject) {
  return `${JSON.stringify({ base64Signature: "test", cert: "test", rekorBundle: { Payload: { logIndex: index } }, testSubjectSha256: digest(subject) })}\n`;
}
function replaceArguments(values, replacements) {
  const result = [...values];
  for (const [flag, value] of Object.entries(replacements)) {
    const index = result.indexOf(flag);
    assert.notEqual(index, -1, `missing argument ${flag}`);
    result[index + 1] = value;
  }
  return result;
}

test("artifact, SBOM and provenance bind exact workflow trust and retained Sigstore bundles", { skip: !buildAvailable }, () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "ksns-ui-evidence-"));
  try {
    const head = git("rev-parse", "HEAD");
    const tree = git("show", "-s", "--format=%T", "HEAD");
    const workflowRef = EXPECTED_WORKFLOW_REF;
    const identity = EXPECTED_IDENTITY;
    const trust = ["--certificate-identity", identity, "--oidc-issuer", "https://token.actions.githubusercontent.com", "--workflow-ref", workflowRef, "--workflow-sha", EXPECTED_WORKFLOW_SHA];
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
    const artifactPath = path.join(first, artifact);
    const sbomPath = path.join(first, `${prefix}.cdx.json`);
    const provenancePath = path.join(first, `${prefix}.provenance.json`);
    writeFileSync(`${artifactPath}.sigstore.json`, fakeLegacyBundle(11, readFileSync(artifactPath)));
    for (const [subjectPath, index] of [[sbomPath, 12], [provenancePath, 13]]) writeFileSync(`${subjectPath}.sigstore.json`, fakeBundle(index, readFileSync(subjectPath)));
    run(["bind", ...parameters, "--output-dir", first]);
    const manifestPath = path.join(first, `${prefix}.evidence.json`);
    const manifest = JSON.parse(readFileSync(manifestPath));
    assert.equal(manifest.schema, "kariya.ksns-ui.release-evidence.v2");
    assert.deepEqual(manifest.signing.trust, { certificateIdentity: identity, oidcIssuer: "https://token.actions.githubusercontent.com", repository: "thelightville/kariya-sns-ui", workflowPath: ".github/workflows/release-evidence-v2.yml", workflowRef, workflowSha: EXPECTED_WORKFLOW_SHA });
    assert.deepEqual(manifest.signing.bundles.artifact.rekorLogIndexes, ["11"]);
    assert.equal(manifest.rollback.status, "N/A_PROPOSED");
    assert.equal(manifest.databaseMigration.status, "N/A_PROPOSED");
    assert.deepEqual(Object.keys(manifest.configurationIdentities).sort(), [
      ".github/workflows/deploy.yml", ".github/workflows/release-evidence-v2.yml", "deploy/ct119-ui-instances.json",
      "deploy/systemd/kariya-sns-ui-ca.service", "deploy/systemd/kariya-sns-ui-ng.service",
      "next.config.mjs", "package-lock.json", "package.json",
    ]);
    const fakeCosign = path.join(temporary, "cosign");
    writeFileSync(fakeCosign, `#!/usr/bin/env node
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const bundleIndex = process.argv.indexOf("--bundle");
if (bundleIndex < 0 || !process.argv[bundleIndex + 1]) process.exit(2);
const bundle = JSON.parse(readFileSync(process.argv[bundleIndex + 1]));
const subject = readFileSync(process.argv[process.argv.length - 1]);
const actual = createHash("sha256").update(subject).digest("hex");
if (!bundle.testSubjectSha256 || bundle.testSubjectSha256 !== actual) process.exit(1);
`);
    chmodSync(fakeCosign, 0o755);
    writeFileSync(`${manifestPath}.sigstore.json`, fakeBundle(14, readFileSync(manifestPath)));
    run(["verify", ...parameters, "--output-dir", first, "--cosign", fakeCosign]);

    const policyFailures = [
      [{ "--workflow-sha": "0".repeat(40) }, /workflow SHA is not authorized/],
      [{ "--workflow-ref": `${workflowRef.split("@")[0]}@refs/heads/main`, "--certificate-identity": `https://github.com/${workflowRef.split("@")[0]}@refs/heads/main` }, /workflow ref is not authorized/],
      [{ "--workflow-ref": "thelightville/kariya-sns-ui/.github/workflows/other.yml@refs/pull/44/merge", "--certificate-identity": "https://github.com/thelightville/kariya-sns-ui/.github/workflows/other.yml@refs/pull/44/merge" }, /workflow ref is not authorized/],
      [{ "--workflow-ref": "attacker/kariya-sns-ui/.github/workflows/release-evidence-v2.yml@refs/pull/44/merge", "--certificate-identity": "https://github.com/attacker/kariya-sns-ui/.github/workflows/release-evidence-v2.yml@refs/pull/44/merge" }, /workflow ref is not authorized/],
      [{ "--oidc-issuer": "https://issuer.example.test" }, /OIDC issuer mismatch/],
      [{ "--certificate-identity": identity.replace("thelightville", "attacker") }, /repository or workflow identity mismatch/],
    ];
    for (const [replacements, pattern] of policyFailures) {
      assert.match(run(["verify", ...replaceArguments(parameters, replacements), "--output-dir", first, "--cosign", fakeCosign], 1).stderr, pattern);
    }
    assert.match(run(["verify", "--head", "0".repeat(40), "--tree", tree, ...trust, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /head mismatch/);

    for (const subjectPath of [artifactPath, sbomPath, provenancePath, manifestPath]) {
      const original = readFileSync(subjectPath);
      writeFileSync(subjectPath, Buffer.concat([original, Buffer.from("tampered")]));
      assert.match(run(["verify", ...parameters, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /digest mismatch|Unexpected non-whitespace|Command failed|verification/i);
      writeFileSync(subjectPath, original);
    }
    for (const bundlePath of [`${artifactPath}.sigstore.json`, `${sbomPath}.sigstore.json`, `${provenancePath}.sigstore.json`, `${manifestPath}.sigstore.json`]) {
      const original = readFileSync(bundlePath);
      writeFileSync(bundlePath, `${JSON.stringify({ tampered: true })}\n`);
      assert.match(run(["verify", ...parameters, "--output-dir", first, "--cosign", fakeCosign], 1).stderr, /Sigstore bundle|signature bundle mismatch|Command failed|verification/i);
      writeFileSync(bundlePath, original);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
