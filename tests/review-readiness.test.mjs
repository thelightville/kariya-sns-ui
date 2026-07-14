import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("../src/data/founderWorkflow.json", import.meta.url);
const pageUrl = new URL("../src/app/(authenticated)/workflow/page.tsx", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);
const [workflow, page, readme] = await Promise.all([
  readFile(fixtureUrl, "utf8").then(JSON.parse),
  readFile(pageUrl, "utf8"),
  readFile(readmeUrl, "utf8"),
]);

test("review access names only the approved paired K-SNS hosts", () => {
  assert.deepEqual(workflow.review_access.approved_hosts, [
    "sns.kariya.ng",
    "sns.kariya.ca",
  ]);
  assert.equal(workflow.review_access.path, "/workflow");
  assert.match(workflow.review_access.authentication, /Cloud-owned/i);
  assert.match(workflow.review_access.backend_boundary, /same-origin \/api\/ksns/i);
  assert.match(workflow.review_access.deployment, /Unavailable/i);
  assert.match(workflow.review_access.review_notes, /storage is unavailable/i);
  assert.match(page, /Authenticated review readiness/);
});

test("KAI and KES paths remain contract-only and browser-safe", () => {
  assert.deepEqual(
    workflow.integration_paths.map(({ product, state }) => [product, state]),
    [["KAI", "contract-only"], ["KES", "contract-only"]]
  );
  assert.match(workflow.integration_paths[0].detail, /does not call KAI directly/i);
  assert.match(workflow.integration_paths[1].detail, /does not dispatch, execute, or verify/i);
});

test("documentation describes Cloud auth and mandatory security sequencing", () => {
  assert.doesNotMatch(readme, /any email\/password combination succeeds/i);
  assert.match(readme, /KARIYA_CLOUD_AUTH_BASE_URL/);
  assert.match(readme, /PR #10/);
  assert.match(readme, /deployment prerequisite/i);
  assert.match(readme, /relative `Location`/i);
  assert.ok(readme.includes("absolute `http://localhost:3010` login redirect"));
  assert.match(readme, /deployment blocker/i);
  assert.match(readme, /statically paired `sns\\.kariya\\.ng` or `sns\\.kariya\\.ca` listener/i);
  assert.match(readme, /Neither K-SNS nor the gateway may select an origin from `Host`/i);
  assert.match(readme, /cross-country and arbitrary-origin redirects fail closed/i);
});
