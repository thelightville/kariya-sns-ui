import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sidebarUrl = new URL("../src/components/Sidebar.tsx", import.meta.url);
const fixtureUrl = new URL("../src/data/founderWorkflow.json", import.meta.url);
const pageUrl = new URL("../src/app/(authenticated)/workflow/page.tsx", import.meta.url);

const [sidebar, workflow, page] = await Promise.all([
  readFile(sidebarUrl, "utf8"),
  readFile(fixtureUrl, "utf8").then(JSON.parse),
  readFile(pageUrl, "utf8"),
]);

test("founder workflow is discoverable in K-SNS navigation", () => {
  assert.match(sidebar, /href: "\/workflow", label: "Founder Workflow"/);
});

test("private API capability is contract-only rather than a live integration claim", () => {
  const contract = workflow.capability_states.find(
    ({ label }) => label === "Private K-SNS API contract"
  );

  assert.equal(contract?.state, "contract-only");
  assert.match(contract?.detail ?? "", /does not call a live API/i);
  assert.equal(
    workflow.capability_states.some(({ state }) => state === "available"),
    false
  );
  assert.match(page, /"contract-only": "badge-neutral"/);
  assert.doesNotMatch(page, /available: "badge-ok"/);
});
