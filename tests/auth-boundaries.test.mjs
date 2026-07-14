import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_NEXT_PATH, safeNextPath } from "../src/lib/safeNextPath.mjs";

const loginPageUrl = new URL("../src/app/login/page.tsx", import.meta.url);
const loginPage = await readFile(loginPageUrl, "utf8");

const unsafeDestinations = [
  null,
  undefined,
  "",
  "overview",
  "https://evil.example/phish",
  "javascript:alert(1)",
  "//evil.example/phish",
  "/\\evil.example/phish",
  "/%2fevil.example/phish",
  "/%5cevil.example/phish",
  "/%252fevil.example/phish",
  "/%255cevil.example/phish",
  "/%25252fevil.example/phish",
  "/safe%0d%0aX-Injected:yes",
  "/%",
  "/safe\u0000path",
];

function assertUnsafeDestinationsUseDefault(flow) {
  for (const destination of unsafeDestinations) {
    assert.equal(
      safeNextPath(destination),
      DEFAULT_NEXT_PATH,
      `${flow} accepted unsafe destination: ${String(destination)}`
    );
  }
}

test("safeNextPath preserves valid same-origin absolute paths", () => {
  assert.equal(safeNextPath("/workflow"), "/workflow");
  assert.equal(
    safeNextPath("/incidents?state=open#latest"),
    "/incidents?state=open#latest"
  );
  assert.equal(safeNextPath("/evidence%20review"), "/evidence%20review");
});

test("password completion rejects unsafe next destinations", () => {
  assertUnsafeDestinationsUseDefault("password completion");
});

test("MFA completion rejects unsafe next destinations", () => {
  assertUnsafeDestinationsUseDefault("MFA completion");
});

test("password and MFA completion share the guarded navigation path", () => {
  assert.match(
    loginPage,
    /const next = safeNextPath\(searchParams\.get\("next"\)\);/
  );
  assert.equal((loginPage.match(/completeLogin\(\);/g) ?? []).length, 2);
  assert.doesNotMatch(loginPage, /router\.push\(searchParams\.get/);
});
