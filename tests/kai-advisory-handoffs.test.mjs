import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../src/app/(authenticated)/kai-advisories/page.tsx", import.meta.url);
const clientUrl = new URL("../src/lib/ksnsPlatformClient.ts", import.meta.url);
const typesUrl = new URL("../src/types/ksns.ts", import.meta.url);
const sidebarUrl = new URL("../src/components/Sidebar.tsx", import.meta.url);

const [page, client, types, sidebar] = await Promise.all([
  readFile(pageUrl, "utf8"),
  readFile(clientUrl, "utf8"),
  readFile(typesUrl, "utf8"),
  readFile(sidebarUrl, "utf8"),
]);

test("KAI advisory handoffs are reachable only through same-origin K-SNS BFF", () => {
  assert.match(client, /getKaiAdvisoryHandoffs/);
  assert.match(client, /\/kai-advisory-handoffs/);
  assert.doesNotMatch(client, /\/kai\/v1/);
  assert.doesNotMatch(client, /KAI_API_URL|NEXT_PUBLIC_KAI|11434/);
});

test("KAI advisory page renders explicit empty loading error and degraded states", () => {
  assert.match(page, /Loading KAI advisory handoffs through the K-SNS BFF/);
  assert.match(page, /KAI advisory handoffs unavailable/);
  assert.match(page, /No accepted KAI advisories/);
  assert.match(page, /Degraded\/unavailable/);
  assert.match(page, /Review required/);
});

test("KAI advisory page preserves advisory-only ownership boundary", () => {
  assert.match(page, /KAI is advisory-only/);
  assert.match(page, /K-SNS remains the incident system of record/);
  assert.match(page, /No browser-to-KAI/);
  assert.match(page, /cannot appear approved, executed, enforced, or verified/);
  assert.doesNotMatch(page, /fetch\(/);
});

test("KAI advisory route is present in navigation and typed without private payloads", () => {
  assert.match(sidebar, /href: "\/kai-advisories", label: "KAI Advisories"/);
  assert.match(types, /interface KsnsKaiAdvisoryHandoff/);
  assert.match(types, /private_payload_available: false/);
  assert.match(types, /browser_to_kai_allowed: false/);
  assert.doesNotMatch(types, /record_id|payload_hash|raw_payload|private_url|token/);
});
