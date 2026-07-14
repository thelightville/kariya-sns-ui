import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildKesConsoleReviewUrl,
  isKesTargetedAction,
  KES_CONSOLE_REVIEW_PATH,
} from "../src/lib/kesConsoleHandoff.mjs";

const actionsPageUrl = new URL("../src/app/(authenticated)/actions/page.tsx", import.meta.url);
const handoffUrl = new URL("../src/components/KesConsoleHandoff.tsx", import.meta.url);
const [actionsPage, handoff] = await Promise.all([
  readFile(actionsPageUrl, "utf8"),
  readFile(handoffUrl, "utf8"),
]);

test("approved sns hosts map only to the paired regional Console KES view", () => {
  const cases = [
    ["sns.kariya.ng", "https://console.kariya.ng"],
    ["sns.kariya.ca", "https://console.kariya.ca"],
  ];

  for (const [hostname, origin] of cases) {
    const value = buildKesConsoleReviewUrl({
      hostname,
      actionId: "action_01:review",
      incidentId: "incident-01.review",
    });
    const target = new URL(value);
    assert.equal(target.origin, origin);
    assert.equal(target.pathname, KES_CONSOLE_REVIEW_PATH);
    assert.deepEqual([...target.searchParams.entries()], [
      ["source", "ksns"],
      ["action_id", "action_01:review"],
      ["incident_id", "incident-01.review"],
    ]);
    assert.equal(target.searchParams.has("return_to"), false);
  }
});

test("local, unapproved, incomplete, or malformed handoffs fail closed", () => {
  for (const hostname of [
    "localhost",
    "127.0.0.1",
    "unapproved.kariya.ng",
    "sns.kariya.ng.",
    "__proto__",
  ]) {
    assert.equal(
      buildKesConsoleReviewUrl({ hostname, actionId: "action-01", incidentId: "incident-01" }),
      null
    );
  }

  assert.equal(buildKesConsoleReviewUrl({ hostname: "sns.kariya.ng", actionId: "", incidentId: "incident-01" }), null);
  assert.equal(buildKesConsoleReviewUrl({ hostname: "sns.kariya.ng", actionId: "action-01", incidentId: "bad\nvalue" }), null);
  assert.equal(buildKesConsoleReviewUrl({ hostname: "sns.kariya.ng", actionId: "a".repeat(129), incidentId: "incident-01" }), null);
});

test("only explicit KES action records expose a posture link", () => {
  assert.equal(isKesTargetedAction("KES"), true);
  assert.equal(isKesTargetedAction(" kes "), true);
  assert.equal(isKesTargetedAction("network"), false);
  assert.equal(isKesTargetedAction("unknown"), false);
  assert.match(actionsPage, /<KesConsoleHandoff action=\{action\} \/>/);
  assert.match(handoff, /Review KES response posture in Console/);
  assert.match(handoff, /this link does not dispatch/i);
  assert.doesNotMatch(handoff, /return_to/);
  assert.doesNotMatch(handoff, /fetch\s*\(|iframe|Authorization|Cookie/);
});
