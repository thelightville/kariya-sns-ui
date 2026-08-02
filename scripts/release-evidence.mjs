import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const REPOSITORY = "thelightville/kariya-sns-ui";
const WORKFLOW_PATH = ".github/workflows/release-evidence-v2.yml";
const ISSUER = "https://token.actions.githubusercontent.com";
const IDENTITIES = ["package.json", "package-lock.json", "next.config.mjs", ".github/workflows/deploy.yml", WORKFLOW_PATH, "deploy/ct119-ui-instances.json", "deploy/systemd/kariya-sns-ui-ng.service", "deploy/systemd/kariya-sns-ui-ca.service"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const json = (value) => Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`);
function args(argv) {
  const [mode, ...rest] = argv;
  const values = {};
  for (let i = 0; i < rest.length; i += 2) {
    assert.match(rest[i] ?? "", /^--[a-z-]+$/);
    assert.ok(rest[i + 1], `missing ${rest[i]}`);
    values[rest[i].slice(2)] = rest[i + 1];
  }
  assert.ok(["build", "bind", "verify"].includes(mode), "mode must be build, bind or verify");
  return { mode, values };
}
function revision(head, tree) {
  assert.match(head, /^[0-9a-f]{40}$/, "invalid head");
  assert.match(tree, /^[0-9a-f]{40}$/, "invalid tree");
  assert.equal(git("rev-parse", "HEAD"), head, "head mismatch");
  assert.equal(git("show", "-s", "--format=%T", "HEAD"), tree, "tree mismatch");
  assert.equal(git("status", "--porcelain"), "", "checkout must be clean");
}
function trust(values) {
  const expectedPrefix = `https://github.com/${REPOSITORY}/${WORKFLOW_PATH}@`;
  assert.equal(values["oidc-issuer"], ISSUER, "OIDC issuer mismatch");
  assert.equal(values["certificate-identity"], `https://github.com/${values["workflow-ref"]}`, "certificate identity/workflow ref mismatch");
  assert.ok(values["certificate-identity"].startsWith(expectedPrefix), "repository or workflow identity mismatch");
  assert.match(values["workflow-ref"], new RegExp(`^${REPOSITORY.replaceAll("/", "\\/")}\\/${WORKFLOW_PATH.replaceAll(".", "\\.")}@refs\\/(pull\\/44\\/merge|heads\\/main)$`), "workflow ref is not authorized");
  assert.match(values["workflow-sha"] ?? "", /^[0-9a-f]{40}$/, "invalid workflow SHA");
  return { certificateIdentity: values["certificate-identity"], oidcIssuer: ISSUER, repository: REPOSITORY, workflowPath: WORKFLOW_PATH, workflowRef: values["workflow-ref"], workflowSha: values["workflow-sha"] };
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
  } else if (stat.isSymbolicLink()) entries.push({ name: target, data: Buffer.alloc(0), mode: 0o777, type: "2", link: readlinkSync(source).replaceAll("\\", "/") });
  else if (stat.isFile()) entries.push({ name: target, data: readFileSync(source), mode: stat.mode & 0o111 ? 0o755 : 0o644, type: "0" });
  else throw new Error(`unsupported artifact entry: ${source}`);
}
function artifact(head) {
  const entries = [];
  for (const [source, target] of [[".next/standalone", "."], [".next/static", ".next/static"], ["public", "public"]]) collect(path.join(ROOT, source), target, entries);
  entries.push({ name: "REVISION", data: Buffer.from(`${head}\n`), mode: 0o644, type: "0" });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
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
function names(head, output) {
  const prefix = `kariya-sns-ui-${head}`;
  const artifactName = `${prefix}.tar.gz`;
  const sbomName = `${prefix}.cdx.json`;
  const provenanceName = `${prefix}.provenance.json`;
  const manifestName = `${prefix}.evidence.json`;
  return {
    artifact: path.join(output, artifactName), sbom: path.join(output, sbomName), provenance: path.join(output, provenanceName), manifest: path.join(output, manifestName),
    subjects: { artifact: artifactName, sbom: sbomName, provenance: provenanceName },
    bundles: { artifact: path.join(output, `${artifactName}.sigstore.json`), sbom: path.join(output, `${sbomName}.sigstore.json`), provenance: path.join(output, `${provenanceName}.sigstore.json`), manifest: path.join(output, `${manifestName}.sigstore.json`) },
  };
}
function bundleRecord(file) {
  const bytes = readFileSync(file);
  const bundle = JSON.parse(bytes);
  const modernEntries = bundle.verificationMaterial?.tlogEntries ?? [];
  const legacyIndex = bundle.rekorBundle?.Payload?.logIndex ?? bundle.rekorBundle?.payload?.logIndex;
  const rekorLogIndexes = modernEntries.map((entry) => String(entry.logIndex ?? "")).filter(Boolean);
  if (legacyIndex !== undefined && legacyIndex !== null) rekorLogIndexes.push(String(legacyIndex));
  rekorLogIndexes.sort();
  assert.ok(rekorLogIndexes.length > 0, `Sigstore bundle has no Rekor entry: ${path.basename(file)}`);
  if (modernEntries.length > 0) assert.equal(rekorLogIndexes.length, modernEntries.length, "Sigstore bundle missing Rekor log index");
  return { name: path.basename(file), sha256: sha256(bytes), rekorLogIndexes };
}
function build(values) {
  const { head, tree } = values;
  revision(head, tree);
  const signingTrust = trust(values);
  const output = path.resolve(values["output-dir"] ?? "release-evidence");
  rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
  const files = names(head, output); const artifactBytes = artifact(head); const sbomBytes = json(sbom(head, tree));
  writeFileSync(files.artifact, artifactBytes); writeFileSync(files.sbom, sbomBytes);
  const decisions = { rollback: { status: "N/A_PROPOSED", rationale: "No independently bound predecessor rollback artifact is available in the assignment evidence." }, databaseMigration: { status: "N/A_PROPOSED", rationale: "kariya-sns-ui is a schema consumer; this evidence does not imply Cloud schema compatibility." } };
  const provenanceBytes = json({ _type: "https://in-toto.io/Statement/v1", subject: [{ name: path.basename(files.artifact), digest: { sha256: sha256(artifactBytes) } }, { name: path.basename(files.sbom), digest: { sha256: sha256(sbomBytes) } }], predicateType: "https://slsa.dev/provenance/v1", predicate: { buildDefinition: { buildType: "https://kariya.ca/build-types/nextjs-standalone/v1", externalParameters: { source: { repository: `https://github.com/${REPOSITORY}`, head, tree } }, internalParameters: { configurationIdentities: identities(), signingTrust }, resolvedDependencies: [{ uri: "pkg:npm/kariya-sns-ui", digest: { sha256: sha256(readFileSync("package-lock.json")) } }] }, runDetails: { builder: { id: signingTrust.certificateIdentity }, metadata: { invocationId: process.env.GITHUB_RUN_ID ?? "local-verification" } }, releaseDecisions: decisions } });
  writeFileSync(files.provenance, provenanceBytes);
  const manifest = { schema: "kariya.ksns-ui.release-evidence.v2", source: { head, tree }, artifact: { name: path.basename(files.artifact), sha256: sha256(artifactBytes) }, sbom: { name: path.basename(files.sbom), sha256: sha256(sbomBytes) }, provenance: { name: path.basename(files.provenance), sha256: sha256(provenanceBytes) }, configurationIdentities: identities(), signing: { trust: signingTrust, bundles: "PENDING_SIGSTORE_BINDING" }, rollback: decisions.rollback, databaseMigration: decisions.databaseMigration };
  writeFileSync(files.manifest, json(manifest));
  return manifest;
}
function bind(values) {
  const { head, tree } = values;
  revision(head, tree);
  const expectedTrust = trust(values);
  const files = names(head, path.resolve(values["output-dir"] ?? "release-evidence"));
  const manifest = JSON.parse(readFileSync(files.manifest));
  assert.deepEqual(manifest.source, { head, tree }, "manifest revision mismatch");
  assert.deepEqual(manifest.signing.trust, expectedTrust, "manifest signing trust mismatch");
  manifest.signing.bundles = { artifact: bundleRecord(files.bundles.artifact), sbom: bundleRecord(files.bundles.sbom), provenance: bundleRecord(files.bundles.provenance) };
  writeFileSync(files.manifest, json(manifest));
  return manifest;
}
function cosignVerify(cosign, subject, bundle, expectedTrust) {
  execFileSync(cosign, ["verify-blob", "--bundle", bundle, "--certificate-identity", expectedTrust.certificateIdentity, "--certificate-oidc-issuer", expectedTrust.oidcIssuer, subject], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
}
function verifyEvidence(values) {
  const { head, tree } = values; revision(head, tree);
  const expectedTrust = trust(values);
  const files = names(head, path.resolve(values["output-dir"] ?? "release-evidence"));
  const manifest = JSON.parse(readFileSync(files.manifest)); const artifactBytes = readFileSync(files.artifact); const sbomBytes = readFileSync(files.sbom); const provenanceBytes = readFileSync(files.provenance);
  assert.deepEqual(manifest.source, { head, tree }, "manifest revision mismatch");
  assert.deepEqual(manifest.signing.trust, expectedTrust, "manifest signing trust mismatch");
  assert.equal(sha256(artifactBytes), manifest.artifact.sha256, "artifact digest mismatch"); assert.equal(sha256(sbomBytes), manifest.sbom.sha256, "SBOM digest mismatch"); assert.equal(sha256(provenanceBytes), manifest.provenance.sha256, "provenance digest mismatch"); assert.deepEqual(manifest.configurationIdentities, identities(), "configuration identity mismatch");
  const statement = JSON.parse(provenanceBytes); assert.equal(statement.predicate.buildDefinition.externalParameters.source.head, head, "provenance head mismatch"); assert.equal(statement.predicate.buildDefinition.externalParameters.source.tree, tree, "provenance tree mismatch"); assert.deepEqual(statement.predicate.buildDefinition.internalParameters.signingTrust, expectedTrust, "provenance signing trust mismatch"); assert.equal(statement.subject[0].digest.sha256, sha256(artifactBytes), "provenance artifact mismatch"); assert.equal(statement.subject[1].digest.sha256, sha256(sbomBytes), "provenance SBOM mismatch");
  for (const kind of ["artifact", "sbom", "provenance"]) assert.deepEqual(manifest.signing.bundles[kind], bundleRecord(files.bundles[kind]), `${kind} signature bundle mismatch`);
  assert.ok(values.cosign, "independent cosign verifier required");
  cosignVerify(values.cosign, files.artifact, files.bundles.artifact, expectedTrust);
  cosignVerify(values.cosign, files.sbom, files.bundles.sbom, expectedTrust);
  cosignVerify(values.cosign, files.provenance, files.bundles.provenance, expectedTrust);
  cosignVerify(values.cosign, files.manifest, files.bundles.manifest, expectedTrust);
  return manifest;
}
const parsed = args(process.argv.slice(2));
const result = parsed.mode === "build" ? build(parsed.values) : parsed.mode === "bind" ? bind(parsed.values) : verifyEvidence(parsed.values);
process.stdout.write(`${JSON.stringify(result)}\n`);
