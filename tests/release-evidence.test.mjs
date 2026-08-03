import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { POLICY, validateSourcePolicy } from "../scripts/release-evidence.mjs";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "release-evidence.mjs");
const HEAD = "3".repeat(40);
const TREE = "4".repeat(40);
const MERGE = "5".repeat(40);
const exact = (overrides = {}) => ({
  "caller-repository": POLICY.callerRepository,
  "caller-workflow-path": POLICY.callerWorkflowPath,
  "caller-ref": POLICY.callerRef,
  "caller-merge-sha": MERGE,
  head: HEAD,
  tree: TREE,
  ...overrides,
});

test("accepts only the exact caller/source boundary", () => {
  const source = validateSourcePolicy(exact());
  assert.equal(source.workflowRef, `${POLICY.callerRepository}/${POLICY.callerWorkflowPath}@${POLICY.callerRef}`);
  assert.equal(source.mergeSha, MERGE);
  const failures = [
    [{ "caller-repository": "attacker/kariya-sns-ui" }, /repository/],
    [{ "caller-workflow-path": ".github/workflows/other.yml" }, /workflow path/],
    [{ "caller-ref": "refs/heads/main" }, /caller ref|main/],
    [{ "caller-ref": "refs/pull/45/merge" }, /caller ref/],
    [{ "caller-merge-sha": "short" }, /merge SHA/],
    [{ head: "short" }, /source head/],
    [{ tree: "short" }, /source tree/],
  ];
  for (const [changes, pattern] of failures) assert.throws(() => validateSourcePolicy(exact(changes)), pattern);
});

test("workflow delegates signing only to the approved immutable trust root", () => {
  const workflow = readFileSync(path.join(ROOT, ".github/workflows/release-evidence-v2.yml"), "utf8");
  const approved = "thelightville/kariya-governance/.github/workflows/reusable-release-signer.yml@2e88e23b745764009ed170400b922e0d98968a89";
  assert.equal((workflow.match(new RegExp(approved.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 1);
  assert.match(workflow, /reusable_workflow_sha:\s*2e88e23b745764009ed170400b922e0d98968a89/);
  assert.match(workflow, /caller_ref:\s*\$\{\{ github\.ref \}\}/);
  assert.match(workflow, /caller_merge_sha:\s*\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch|cosign sign-blob|refs\/heads\/main/);
  assert.equal((workflow.match(/id-token:\s*write/g) ?? []).length, 1);
});

test("deterministic unsigned evidence binds exact source and subject set", { skip: !existsSync(path.join(ROOT, ".next", "standalone")) }, () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["show", "-s", "--format=%T", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const first = mkdtempSync(path.join(tmpdir(), "ksns-unsigned-a-"));
  const second = mkdtempSync(path.join(tmpdir(), "ksns-unsigned-b-"));
  const args = ["build", "--head", head, "--tree", tree, "--caller-repository", POLICY.callerRepository, "--caller-workflow-path", POLICY.callerWorkflowPath, "--caller-ref", POLICY.callerRef, "--caller-merge-sha", MERGE];
  try {
    for (const output of [first, second]) {
      const result = spawnSync(process.execPath, [SCRIPT, ...args, "--output-dir", output], { cwd: ROOT, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const manifest = JSON.parse(readFileSync(path.join(first, "unsigned-evidence.json"), "utf8"));
    assert.equal(manifest.schema, "kariya.ksns-ui.unsigned-release-evidence.v1");
    assert.equal(manifest.source.sourceHead, head);
    assert.equal(manifest.source.sourceTree, tree);
    assert.deepEqual(manifest.subjects.map(({ name }) => name), [`kariya-sns-ui-${head}.tar.gz`, `kariya-sns-ui-${head}.cdx.json`, `kariya-sns-ui-${head}.provenance.json`]);
    for (const { name } of manifest.subjects) assert.deepEqual(readFileSync(path.join(first, name)), readFileSync(path.join(second, name)));
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});
