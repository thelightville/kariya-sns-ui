import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../src/app/(authenticated)/evidence-graph/page.tsx", import.meta.url);
const clientUrl = new URL("../src/lib/ksnsPlatformClient.ts", import.meta.url);
const typesUrl = new URL("../src/types/ksns.ts", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);

const [page, client, types, readme] = await Promise.all([
  readFile(pageUrl, "utf8"),
  readFile(clientUrl, "utf8"),
  readFile(typesUrl, "utf8"),
  readFile(readmeUrl, "utf8"),
]);

test("evidence graph presents the complete lifecycle chain without fabrication", () => {
  for (const phrase of [
    "source event",
    "KAI advisory",
    "proposed action",
    "execution evidence",
    "verification",
    "residual risk",
    "Missing evidence",
  ]) {
    assert.match(page, new RegExp(phrase, "i"));
  }
  assert.match(page, /KAI\s+advisories remain advisory-only/i);
  assert.match(page, /never appear executed or\s+verified without source execution and K-SNS verification evidence/i);
  assert.match(page, /No browser-to-KAI access is used/i);
});

test("platform client consumes K-SNS lifecycle evidence through same-origin BFF only", () => {
  assert.match(client, /getLifecycleEvidenceBundle/);
  assert.match(client, /\/lifecycle\/evidence/);
  assert.match(client, /evidence_lifecycle/);
  assert.doesNotMatch(client, /\/kai\/v1|NEXT_PUBLIC_KAI|KAI_API|11434/);
});

test("types expose bounded lifecycle projection and no private payload fields", () => {
  assert.match(types, /interface KsnsEvidenceLifecycleStage/);
  assert.match(types, /interface KsnsEvidenceLifecycleIntegrity/);
  assert.match(types, /kai_advisory_is_decision: false/);
  assert.match(types, /action_execution_fabricated: false/);
  assert.match(types, /verification_success_fabricated: false/);
  assert.doesNotMatch(types, /payload_hash|raw_payload|private_url|record_id|token/);
});

test("documentation describes explicit unavailable stages and ownership boundaries", () => {
  assert.match(readme, /Evidence & Explanation/);
  assert.match(readme, /source event -> incident -> KAI advisory -> decision -> proposed action/i);
  assert.match(readme, /Missing lifecycle stages remain unavailable/i);
  assert.match(readme, /KAI advisory is not a K-SNS\s+decision/i);
});
