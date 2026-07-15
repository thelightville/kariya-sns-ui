import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";

const host = "127.0.0.1";

async function reserveLoopbackPort() {
  const server = createServer();
  server.listen(0, host);
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitUntilReady(origin, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next exited before readiness (code ${child.exitCode}):\n${output()}`);
    }
    try {
      const response = await fetch(`${origin}/login`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The loopback listener is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for loopback readiness:\n${output()}`);
}

const port = await reserveLoopbackPort();
const origin = `http://${host}:${port}`;
const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", host, "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      KARIYA_SNS_PUBLIC_ORIGIN: origin,
      KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }
);

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
const output = () => `${stdout}\n${stderr}`;

try {
  await waitUntilReady(origin, child, output);

  const login = await fetch(`${origin}/login`, { redirect: "manual" });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("location"), null);

  for (const pathname of ["/api/auth/login", "/api/auth/mfa"]) {
    const response = await fetch(`${origin}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "synthetic@example.invalid", password: "never-sent" }),
    });
    assert.equal(response.status, 410, pathname);
    assert.equal(response.headers.get("set-cookie"), null, pathname);
  }

  const start = await fetch(`${origin}/api/auth/exchange/start?next=%2Fworkflow`, {
    redirect: "manual",
  });
  assert.equal(start.status, 503);
  assert.equal(start.headers.get("set-cookie"), null);

  const protectedRoutes = ["/workflow", "/actions", "/incidents", "/overview"];
  for (const pathname of protectedRoutes) {
    const response = await fetch(`${origin}${pathname}`, {
      redirect: "manual",
      headers: {
        Host: pathname === "/actions" ? "sns.kariya.ca" : "sns.kariya.ng",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
        Forwarded: "host=evil.example;proto=http",
        Origin: "https://evil.example",
        Referer: "https://evil.example/phish",
      },
    });
    assert.equal(response.status, 307, `${pathname}\n${output()}`);
    assert.equal(
      response.headers.get("location"),
      `/login?next=${encodeURIComponent(pathname)}`,
      pathname
    );
  }

  for (const pathname of ["/workflow", "/actions"]) {
    const response = await fetch(`${origin}${pathname}`, {
      redirect: "manual",
      headers: { Host: "unapproved.internal" },
    });
    const location = response.headers.get("location");
    assert.equal(response.status, 307, output());
    assert.equal(
      location,
      `/login?next=${encodeURIComponent(pathname)}`
    );
    assert.doesNotMatch(location, /evil\.example|unapproved\.internal|sns\.kariya|console\.kariya/i);
  }

  const fakeSession = await fetch(`${origin}/workflow`, {
    redirect: "manual",
    headers: { Cookie: "sns_token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  });
  assert.equal(fakeSession.status, 307);
  assert.equal(fakeSession.headers.get("location"), "/login?next=%2Fworkflow");

  const bff = await fetch(`${origin}/api/ksns/incidents`, {
    headers: { Cookie: "sns_token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  });
  assert.equal(bff.status, 503);
  assert.equal(bff.headers.get("cache-control"), "no-store");

  console.log(
    `http-readiness verification passed on explicit loopback origin ${origin}`
  );
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}
