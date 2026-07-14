import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  authenticatedHomeLocation,
  loginRedirectLocation,
} from "../src/lib/authRedirects.mjs";

const middlewareUrl = new URL("../src/middleware.ts", import.meta.url);
const middleware = await readFile(middlewareUrl, "utf8");

test("protected routes use only the configured paired SNS origin", () => {
  const cases = [
    ["https://sns.kariya.ng", "https://sns.kariya.ng/login?next=%2Fworkflow"],
    ["https://sns.kariya.ca", "https://sns.kariya.ca/login?next=%2Fworkflow"],
  ];

  for (const [origin, expected] of cases) {
    assert.equal(loginRedirectLocation("/workflow", origin), expected);
    assert.equal(
      authenticatedHomeLocation(origin),
      `${origin}/overview`
    );
  }
});

test("invalid, private, and cross-origin configuration fails closed", () => {
  for (const origin of [
    undefined,
    "",
    "https://evil.example",
    "https://sns.kariya.ng.evil.example",
    "https://sns.kariya.ng.",
    "http://sns.kariya.ng",
    "https://sns.kariya.ng:444",
    "https://user@sns.kariya.ng",
    "https://sns.kariya.ng/path",
    "http://localhost:3010",
    "http://127.0.0.1:3010",
    "https://10.0.0.1",
    "//sns.kariya.ng",
  ]) {
    assert.equal(loginRedirectLocation("/workflow", origin), null, origin);
    assert.equal(authenticatedHomeLocation(origin), null, origin);
  }
});

test("loopback origin requires an explicit local evidence gate", () => {
  const options = { allowLoopback: true };
  assert.equal(
    loginRedirectLocation("/workflow", "http://127.0.0.1:3011", options),
    "http://127.0.0.1:3011/login?next=%2Fworkflow"
  );
  assert.equal(
    authenticatedHomeLocation("http://127.0.0.1:3011", options),
    "http://127.0.0.1:3011/overview"
  );
  assert.equal(
    loginRedirectLocation("/workflow", "http://localhost:3011", options),
    null
  );
});

test("unsafe next destinations fall back under the same trusted origin", () => {
  for (const value of [
    "https://evil.example/phish",
    "//evil.example/phish",
    "/%2fevil.example/phish",
    "/%5cevil.example/phish",
    "/safe%0d%0aLocation:https://evil.example",
  ]) {
    assert.equal(
      loginRedirectLocation(value, "https://sns.kariya.ng"),
      "https://sns.kariya.ng/login?next=%2Foverview"
    );
  }
});

test("middleware never derives redirect origins from request metadata", () => {
  assert.match(middleware, /process\.env\.KARIYA_SNS_PUBLIC_ORIGIN/);
  assert.match(middleware, /loginRedirectLocation\(pathname, CONFIGURED_ORIGIN/);
  assert.doesNotMatch(middleware, /new URL\(|request\.url/);
  assert.doesNotMatch(
    middleware,
    /["'](?:X-Forwarded-Host|X-Forwarded-Proto|Forwarded|Origin|Referer|return_to)["']|headers\.get|request\.headers/i
  );
});
