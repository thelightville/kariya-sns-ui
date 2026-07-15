import { lstatSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { Agent } from "node:https";
import { checkServerIdentity } from "node:tls";
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

export function validateCloudServerIdentity(
  hostname,
  certificate,
  expectedServerName,
  defaultValidator = checkServerIdentity
) {
  if (hostname !== expectedServerName) return new Error("cloud_authority_unavailable");
  const standardError = defaultValidator(hostname, certificate);
  if (standardError) return standardError;
  const sans = (certificate.subjectaltname ?? "")
    .split(/,\s*/u)
    .filter(Boolean);
  if (sans.length !== 1 || sans[0] !== `DNS:${expectedServerName}`) {
    return new Error("cloud_authority_unavailable");
  }
  return undefined;
}

export function parseCloudResponse(
  { statusCode, headers = {}, body },
  responseMode
) {
  if (!Number.isSafeInteger(statusCode) || !Buffer.isBuffer(body)) fail();
  if (responseMode === "empty") {
    if (
      statusCode !== 204 ||
      body.length !== 0 ||
      headers["content-length"] !== undefined ||
      headers["transfer-encoding"] !== undefined
    ) {
      fail();
    }
    return undefined;
  }
  if (responseMode !== "json" || statusCode !== 200 || body.length === 0) fail();
  const contentType = headers["content-type"];
  if (
    typeof contentType !== "string" ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)
  ) {
    fail();
  }
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    fail();
  }
}

function requestJson(
  url,
  body,
  config,
  materialLoader = loadProtectedMtlsMaterial,
  responseMode = "json"
) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.origin !== config.transport_origin) fail();
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
    checkServerIdentity: (hostname, certificate) =>
      validateCloudServerIdentity(hostname, certificate, config.tls_server_name),
  });

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      target,
      {
        method: "POST",
        agent,
        servername: config.tls_server_name,
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
          try {
            resolve(
              parseCloudResponse(
                {
                  statusCode: response.statusCode,
                  headers: response.headers,
                  body: Buffer.concat(chunks),
                },
                responseMode
              )
            );
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
  if (
    config.cloud_origin !== definition.cloud_origin ||
    config.tls_server_name !== definition.cloud_server_name
  ) fail();
  const call = async (operation, body) => {
    const endpoint = config.endpoints[operation];
    if (typeof endpoint !== "string") fail();
    const responseMode = new Set(["revoke", "logout"]).has(operation)
      ? "empty"
      : "json";
    return transport(endpoint, body, config, materialLoader, responseMode);
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
