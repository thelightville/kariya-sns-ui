import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("../src/data/founderWorkflow.json", import.meta.url);
const workflow = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("walkthrough is explicitly synthetic and customer-free", () => {
  assert.equal(workflow.provenance, "synthetic");
  assert.equal(workflow.event.data_classification, "No customer data");
  assert.match(workflow.summary, /without claiming live telemetry/i);
});

test("walkthrough covers event-to-residual-risk context", () => {
  assert.equal(workflow.assessment.outcome, "Incident candidate");
  assert.ok(workflow.trust_context.before > workflow.trust_context.after);
  assert.ok(workflow.evidence.length >= 1);
  assert.ok(workflow.recommendation.action);
  assert.ok(workflow.verification.state);
  assert.ok(workflow.residual_risk.level);
});

test("unexecuted work cannot appear verified or contained", () => {
  assert.equal(workflow.recommendation.dispatch, "Not dispatched");
  assert.equal(workflow.verification.state, "Not started");
  assert.match(workflow.verification.observed, /no action was executed/i);
  assert.notEqual(workflow.residual_risk.level.toLowerCase(), "none");
});

test("capability inventory separates contract availability from live evidence", () => {
  const states = new Set(workflow.capability_states.map(({ state }) => state));
  assert.deepEqual(states, new Set(["implemented", "synthetic", "available", "unavailable"]));
  assert.match(
    workflow.capability_states.find(({ label }) => label.includes("KAI"))?.detail ?? "",
    /no live cross-product evidence/i
  );
});
