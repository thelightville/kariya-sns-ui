import { lstatSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { Agent } from "node:https";
import { createPrivateKey, X509Certificate } from "node:crypto";

import { productionRegionDefinition } from "./productionConfig.mjs";

function fail() {
  throw new Error("cloud_auth_runtime_unavailable");
}

function readProtected(path, { privateKey = false } = {}) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) fail();
    if (privateKey && process.platform !== "win32" && (stat.mode & 0o077) !== 0) fail();
    return readFileSync(path);
  } catch {
    fail();
  }
}

function validateClientIdentity(cert, key, region) {
  try {
    const definition = productionRegionDefinition(region);
    const parsed = new X509Certificate(cert);
    if (!parsed.checkPrivateKey(createPrivateKey(key))) fail();
    const sans = (parsed.subjectAltName ?? "")
      .split(/,\s*/u)
      .filter((value) => value.startsWith("URI:"));
    if (sans.length !== 1 || sans[0] !== `URI:${definition.spiffe_uri}`) fail();
    if (
      parsed.ca ||
      /(?:^|\\n)CN=/u.test(parsed.subject) ||
      /(?:^|,\\s*)DNS:/u.test(parsed.subjectAltName ?? "") ||
      parsed.publicKey.asymmetricKeyType !== "ec" ||
      parsed.publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1" ||
      !Array.isArray(parsed.keyUsage) ||
      parsed.keyUsage.length !== 1 ||
      parsed.keyUsage[0] !== "1.3.6.1.5.5.7.3.2" ||
      parsed.validToDate.getTime() - parsed.validFromDate.getTime() > 2_592_000_000 ||
      Date.now() < parsed.validFromDate.getTime() ||
      Date.now() >= parsed.validToDate.getTime()
    ) {
      fail();
    }
  } catch {
    fail();
  }
}

export function loadProtectedMtlsMaterial(config) {
  const cert = readProtected(config.client_certificate_path);
  const key = readProtected(config.client_private_key_path, { privateKey: true });
  const ca = readProtected(config.cloud_ca_bundle_path);
  const crl = readProtected(config.cloud_crl_path);
  validateClientIdentity(cert, key, config.region);
  if (!ca.includes(Buffer.from("BEGIN CERTIFICATE")) || crl.length === 0) fail();
  return Object.freeze({ cert, key, ca, crl });
}

function requestJson(url, body, config, materialLoader = loadProtectedMtlsMaterial) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.origin !== config.cloud_origin) fail();
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  if (encoded.length > config.response_max_bytes) fail();
  const material = materialLoader(config);
  const agent = new Agent({
    ...material,
    minVersion: "TLSv1.3",
    maxVersion: "TLSv1.3",
    rejectUnauthorized: true,
    keepAlive: false,
    maxCachedSessions: 0,
  });

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      target,
      {
        method: "POST",
        agent,
        servername: target.hostname,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "content-length": String(encoded.length),
          "cache-control": "no-store",
        },
        timeout: config.request_timeout_ms,
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > config.response_max_bytes) request.destroy(new Error("response_too_large"));
          else chunks.push(chunk);
        });
        response.on("end", () => {
          agent.destroy();
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("cloud_authority_unavailable"));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("cloud_authority_unavailable"));
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("cloud_timeout")));
    request.on("error", () => {
      agent.destroy();
      reject(new Error("cloud_authority_unavailable"));
    });
    request.end(encoded);
  });
}

export function createCloudMtlsClient(
  config,
  { transport = requestJson, materialLoader = loadProtectedMtlsMaterial } = {}
) {
  const definition = productionRegionDefinition(config.region);
  if (config.cloud_origin !== definition.cloud_origin) fail();
  const call = async (operation, body) => {
    const endpoint = config.endpoints[operation];
    if (typeof endpoint !== "string") fail();
    return transport(endpoint, body, config, materialLoader);
  };
  return Object.freeze({
    register: (body) => call("register", body),
    redeem: (body) => call("redeem", body),
    introspect: (body) => call("introspect", body),
    revoke: (body) => call("revoke", body),
    logout: (body) => call("logout", body),
    async assertReady() {
      materialLoader(config);
    },
    async close() {},
  });
}
