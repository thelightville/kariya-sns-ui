import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AUTHENTICATED_HOME_PATH,
  loginRedirectLocation,
} from "../src/lib/authRedirects.mjs";

const middlewareUrl = new URL("../src/middleware.ts", import.meta.url);
const middleware = await readFile(middlewareUrl, "utf8");

test("protected routes emit a standards-valid relative login Location", () => {
  assert.equal(loginRedirectLocation("/workflow"), "/login?next=%2Fworkflow");
  assert.equal(
    loginRedirectLocation("/incidents"),
    "/login?next=%2Fincidents"
  );
  assert.equal(AUTHENTICATED_HOME_PATH, "/overview");

  for (const location of [
    loginRedirectLocation("/workflow"),
    AUTHENTICATED_HOME_PATH,
  ]) {
    assert.match(location, /^\/(?!\/)/);
    assert.doesNotMatch(
      location,
      /localhost|127\.0\.0\.1|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\.internal|console\.kariya|sns\.kariya/i
    );
  }
});

test("unsafe next destinations fail closed without origin authority", () => {
  for (const value of [
    "https://evil.example/phish",
    "//evil.example/phish",
    "/%2fevil.example/phish",
    "/%5cevil.example/phish",
    "/safe%0d%0aLocation:https://evil.example",
  ]) {
    assert.equal(loginRedirectLocation(value), "/login?next=%2Foverview");
  }
});

test("middleware never derives redirect origins from request metadata", () => {
  assert.match(middleware, /headers: \{ Location: location \}/);
  assert.match(middleware, /loginRedirectLocation\(pathname\)/);
  assert.doesNotMatch(middleware, /new URL\(|request\.url/);
  assert.doesNotMatch(
    middleware,
    /X-Forwarded-Host|X-Forwarded-Proto|Forwarded|Origin|Referer|return_to|headers\.get|request\.headers/i
  );

  for (const approvedHost of ["sns.kariya.ng", "sns.kariya.ca"]) {
    const location = loginRedirectLocation("/workflow");
    assert.equal(location, "/login?next=%2Fworkflow", approvedHost);
  }
});
