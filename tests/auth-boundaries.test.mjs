import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_NEXT_PATH, safeNextPath } from "../src/lib/safeNextPath.mjs";

const loginPageUrl = new URL("../src/app/login/page.tsx", import.meta.url);
const loginPage = await readFile(loginPageUrl, "utf8");

function nestedSeparator(separator, layers) {
  let value = `${separator}evil.example/phish`;
  for (let layer = 0; layer < layers; layer += 1) {
    value = encodeURIComponent(value);
  }
  return `/${value}`;
}

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
  nestedSeparator("/", 4),
  nestedSeparator("\\", 4),
  nestedSeparator("/", 8),
  nestedSeparator("\\", 8),
  nestedSeparator("/", 9),
  nestedSeparator("\\", 9),
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
  assert.equal(safeNextPath("/caf%C3%A9"), "/caf%C3%A9");
  assert.equal(
    safeNextPath("/reports%20and%20evidence?tag=high%20risk"),
    "/reports%20and%20evidence?tag=high%20risk"
  );
});

test("deeply nested slash and backslash encodings fail closed", () => {
  for (const layers of [4, 8, 9, 16]) {
    assert.equal(safeNextPath(nestedSeparator("/", layers)), DEFAULT_NEXT_PATH);
    assert.equal(safeNextPath(nestedSeparator("\\", layers)), DEFAULT_NEXT_PATH);
  }
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
