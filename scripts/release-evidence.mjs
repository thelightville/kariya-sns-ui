import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
export const POLICY = Object.freeze({
  callerRepository: "thelightville/kariya-sns-ui",
  callerWorkflowPath: ".github/workflows/release-evidence-v2.yml",
  callerRef: "refs/pull/44/merge",
});
const IDENTITIES = [
  "package.json", "package-lock.json", "next.config.mjs",
  ".github/workflows/deploy.yml", POLICY.callerWorkflowPath,
  "deploy/ct119-ui-instances.json", "deploy/systemd/kariya-sns-ui-ng.service",
  "deploy/systemd/kariya-sns-ui-ca.service",
];
const SHA = /^[0-9a-f]{40}$/;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const json = (value) => Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`);
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

export function validateSourcePolicy(values) {
  assert.equal(values["caller-repository"], POLICY.callerRepository, "caller repository is not authorized");
  assert.equal(values["caller-workflow-path"], POLICY.callerWorkflowPath, "caller workflow path is not authorized");
  assert.equal(values["caller-ref"], POLICY.callerRef, "caller ref is not authorized");
  assert.notEqual(values["caller-ref"], "refs/heads/main", "main is not authorized");
  assert.match(values["caller-merge-sha"] ?? "", SHA, "caller merge SHA must be exact");
  assert.match(values.head ?? "", SHA, "source head must be exact");
  assert.match(values.tree ?? "", SHA, "source tree must be exact");
  return stable({
    repository: POLICY.callerRepository,
    workflowPath: POLICY.callerWorkflowPath,
    workflowRef: `${POLICY.callerRepository}/${POLICY.callerWorkflowPath}@${POLICY.callerRef}`,
    ref: POLICY.callerRef,
    mergeSha: values["caller-merge-sha"],
    sourceHead: values.head,
    sourceTree: values.tree,
  });
}

function revision(head, tree) {
  assert.equal(git("rev-parse", "HEAD"), head, "head mismatch");
  assert.equal(git("show", "-s", "--format=%T", "HEAD"), tree, "tree mismatch");
  assert.equal(git("status", "--porcelain"), "", "checkout must be clean");
}
function octal(value, width) {
  const encoded = value.toString(8).padStart(width - 1, "0");
  assert.ok(encoded.length < width);
  return `${encoded}\0`;
}
function header(name, size, mode, type = "0", link = "") {
  const block = Buffer.alloc(512);
  let base = name;
  let prefix = "";
  if (Buffer.byteLength(name) > 100) {
    const split = [...name.matchAll(/\//g)].map((match) => match.index).reverse().find((index) => Buffer.byteLength(name.slice(index + 1)) <= 100 && Buffer.byteLength(name.slice(0, index)) <= 155);
    assert.notEqual(split, undefined, `path exceeds ustar limits: ${name}`);
    base = name.slice(split + 1);
    prefix = name.slice(0, split);
  }
  assert.ok(Buffer.byteLength(link) <= 100, `link exceeds ustar limits: ${link}`);
  block.write(base, 0, 100); block.write(octal(mode, 8), 100, 8); block.write(octal(0, 8), 108, 8); block.write(octal(0, 8), 116, 8);
  block.write(octal(size, 12), 124, 12); block.write(octal(0, 12), 136, 12); block.fill(0x20, 148, 156); block.write(type, 156, 1); block.write(link, 157, 100);
  block.write("ustar\0", 257, 6); block.write("00", 263, 2); block.write("root", 265, 32); block.write("root", 297, 32); block.write(prefix, 345, 155);
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  block.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return block;
}
function collect(source, destination, entries) {
  const stat = lstatSync(source);
  const target = destination.replaceAll("\\", "/");
  if (stat.isDirectory()) {
    if (target !== ".") entries.push({ name: `${target}/`, data: Buffer.alloc(0), mode: 0o755, type: "5" });
    for (const child of readdirSync(source).sort()) collect(path.join(source, child), target === "." ? child : `${target}/${child}`, entries);
  } else if (stat.isSymbolicLink()) {
    entries.push({ name: target, data: Buffer.alloc(0), mode: 0o777, type: "2", link: readlinkSync(source).replaceAll("\\", "/") });
  } else if (stat.isFile()) {
    entries.push({ name: target, data: readFileSync(source), mode: stat.mode & 0o111 ? 0o755 : 0o644, type: "0" });
  } else throw new Error(`unsupported artifact entry: ${source}`);
}
function artifact(head) {
  const entries = [];
  for (const [source, target] of [[".next/standalone", "."], [".next/static", ".next/static"], ["public", "public"]]) collect(path.join(ROOT, source), target, entries);
  entries.push({ name: "REVISION", data: Buffer.from(`${head}\n`), mode: 0o644, type: "0" });
  entries.sort((a, b) => a.name.localeCompare(b, "en"));
  const blocks = [];
  for (const entry of entries) {
    blocks.push(header(entry.name, entry.data.length, entry.mode, entry.type, entry.link ?? ""), entry.data);
    if (entry.data.length % 512) blocks.push(Buffer.alloc(512 - (entry.data.length % 512)));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9, mtime: 0 });
}
function sbom(head, tree) {
  const lockBytes = readFileSync("package-lock.json");
  const lock = JSON.parse(lockBytes);
  const components = Object.entries(lock.packages ?? {}).filter(([where, pkg]) => where && pkg?.version).sort(([a], [b]) => a.localeCompare(b, "en")).map(([where, pkg]) => {
    const [algorithm, encoded] = (pkg.integrity ?? "").split("-", 2);
    return { type: "library", name: where.replace(/^node_modules\//, ""), version: pkg.version, scope: pkg.dev ? "optional" : "required", hashes: algorithm && encoded ? [{ alg: algorithm.toUpperCase().replace("SHA", "SHA-"), content: Buffer.from(encoded, "base64").toString("hex") }] : [], properties: [{ name: "kariya:lockfilePath", value: where }] };
  });
  return { bomFormat: "CycloneDX", specVersion: "1.6", version: 1, metadata: { component: { type: "application", name: "kariya-sns-ui", version: `git-${head}` }, properties: [{ name: "kariya:sourceHead", value: head }, { name: "kariya:sourceTree", value: tree }, { name: "kariya:packageLockSha256", value: sha256(lockBytes) }] }, components };
}
const identities = () => Object.fromEntries(IDENTITIES.map((file) => [file, { sha256: sha256(readFileSync(file)) }]));

export function buildUnsigned(values) {
  const source = validateSourcePolicy(values);
  revision(source.sourceHead, source.sourceTree);
  const output = path.resolve(values["output-dir"] ?? "unsigned-evidence");
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const prefix = `kariya-sns-ui-${source.sourceHead}`;
  const names = [`${prefix}.tar.gz`, `${prefix}.cdx.json`, `${prefix}.provenance.json`];
  const artifactBytes = artifact(source.sourceHead);
  const sbomBytes = json(sbom(source.sourceHead, source.sourceTree));
  const decisions = { rollback: { status: "N/A_PROPOSED", rationale: "No independently bound predecessor rollback artifact is available." }, databaseMigration: { status: "N/A_PROPOSED", rationale: "K-SNS UI is a schema consumer." } };
  const provenanceBytes = json({ _type: "https://in-toto.io/Statement/v1", subject: [{ name: names[0], digest: { sha256: sha256(artifactBytes) } }, { name: names[1], digest: { sha256: sha256(sbomBytes) } }], predicateType: "https://slsa.dev/provenance/v1", predicate: { buildDefinition: { buildType: "https://kariya.ca/build-types/nextjs-standalone/v1", externalParameters: { source: { repository: `https://github.com/${POLICY.callerRepository}`, head: source.sourceHead, tree: source.sourceTree } }, internalParameters: { configurationIdentities: identities() }, resolvedDependencies: [{ uri: "pkg:npm/kariya-sns-ui", digest: { sha256: sha256(readFileSync("package-lock.json")) } }] }, runDetails: { builder: { id: "thelightville/kariya-governance/.github/workflows/reusable-release-signer.yml@2e88e23b745764009ed170400b922e0d98968a89" }, metadata: { invocationId: process.env.GITHUB_RUN_ID ?? "local-verification" } }, releaseDecisions: decisions } });
  const bytes = [artifactBytes, sbomBytes, provenanceBytes];
  names.forEach((name, index) => writeFileSync(path.join(output, name), bytes[index]));
  const manifest = { schema: "kariya.ksns-ui.unsigned-release-evidence.v1", source, subjects: names.map((name, index) => ({ name, sha256: sha256(bytes[index]) })) };
  writeFileSync(path.join(output, "unsigned-evidence.json"), json(manifest));
  return manifest;
}
function parseArgs(argv) {
  const [mode, ...rest] = argv;
  assert.equal(mode, "build", "only unsigned build mode is supported");
  assert.equal(rest.length % 2, 0, "flags require values");
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    assert.match(rest[index] ?? "", /^--[a-z-]+$/, "invalid flag");
    assert.ok(rest[index + 1], `missing value for ${rest[index]}`);
    values[rest[index].slice(2)] = rest[index + 1];
  }
  return values;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.stdout.write(`${JSON.stringify(buildUnsigned(parseArgs(process.argv.slice(2))))}\n`);
}
