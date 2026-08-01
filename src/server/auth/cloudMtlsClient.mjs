import { lstatSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { Agent } from "node:https";
import { checkServerIdentity } from "node:tls";
import { createPrivateKey, X509Certificate } from "node:crypto";

import { productionRegionDefinition } from "./productionConfig.mjs";

const ECDSA_WITH_SHA256_OID = "1.2.840.10045.4.3.2";
const CLIENT_AUTH_OID = "1.3.6.1.5.5.7.3.2";
const SERVER_AUTH_OID = "1.3.6.1.5.5.7.3.1";
const BASIC_CONSTRAINTS_OID = "2.5.29.19";
const KEY_USAGE_OID = "2.5.29.15";
const MAX_LEAF_LIFETIME_MS = 86_400_000;
const MAX_CA_LIFETIME_MS = 5 * 366 * 86_400_000;

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

export function certificateValidityWindow(parsed) {
  const validFrom =
    parsed.validFromDate instanceof Date
      ? parsed.validFromDate.getTime()
      : Date.parse(parsed.validFrom);
  const validTo =
    parsed.validToDate instanceof Date
      ? parsed.validToDate.getTime()
      : Date.parse(parsed.validTo);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validTo)) fail();
  return Object.freeze({ validFrom, validTo });
}

function derElement(data, offset = 0) {
  if (!Buffer.isBuffer(data) || offset < 0 || offset + 2 > data.length) fail();
  const tag = data[offset];
  const firstLength = data[offset + 1];
  let length = firstLength;
  let valueStart = offset + 2;
  if ((firstLength & 0x80) !== 0) {
    const count = firstLength & 0x7f;
    if (count === 0 || count > 4 || valueStart + count > data.length) fail();
    length = 0;
    for (let index = 0; index < count; index += 1) {
      length = length * 256 + data[valueStart + index];
    }
    if (length < 128) fail();
    valueStart += count;
  }
  const end = valueStart + length;
  if (end > data.length) fail();
  return Object.freeze({ tag, offset, valueStart, end });
}

function derChildren(data, parent) {
  const values = [];
  let offset = parent.valueStart;
  while (offset < parent.end) {
    const child = derElement(data, offset);
    if (child.end > parent.end) fail();
    values.push(child);
    offset = child.end;
  }
  if (offset !== parent.end) fail();
  return values;
}

function derOid(data, element) {
  if (element.tag !== 0x06 || element.valueStart >= element.end) fail();
  const bytes = data.subarray(element.valueStart, element.end);
  const values = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let value = 0;
  for (const byte of bytes.subarray(1)) {
    value = value * 128 + (byte & 0x7f);
    if (!Number.isSafeInteger(value)) fail();
    if ((byte & 0x80) === 0) {
      values.push(value);
      value = 0;
    }
  }
  if (value !== 0) fail();
  return values.join(".");
}

export function certificateDerProfile(raw) {
  const data = Buffer.from(raw);
  const root = derElement(data);
  if (root.tag !== 0x30 || root.offset !== 0 || root.end !== data.length) fail();
  const certificate = derChildren(data, root);
  if (
    certificate.length !== 3 ||
    certificate[0].tag !== 0x30 ||
    certificate[1].tag !== 0x30
  ) {
    fail();
  }
  const signature = derChildren(data, certificate[1]);
  if (signature.length !== 1) fail();
  const signatureOid = derOid(data, signature[0]);
  const tbs = derChildren(data, certificate[0]);
  const extensionsWrapper = tbs.find((element) => element.tag === 0xa3);
  if (!extensionsWrapper) fail();
  const wrapperChildren = derChildren(data, extensionsWrapper);
  if (wrapperChildren.length !== 1 || wrapperChildren[0].tag !== 0x30) fail();
  const extensions = new Map();
  for (const extension of derChildren(data, wrapperChildren[0])) {
    if (extension.tag !== 0x30) fail();
    const parts = derChildren(data, extension);
    if (parts.length < 2 || parts.length > 3) fail();
    const oid = derOid(data, parts[0]);
    const value = parts.at(-1);
    if (value.tag !== 0x04 || extensions.has(oid)) fail();
    extensions.set(oid, data.subarray(value.valueStart, value.end));
  }
  const basicRaw = extensions.get(BASIC_CONSTRAINTS_OID);
  const keyUsageRaw = extensions.get(KEY_USAGE_OID);
  if (!basicRaw || !keyUsageRaw) fail();
  const basicRoot = derElement(basicRaw);
  const usageRoot = derElement(keyUsageRaw);
  if (
    basicRoot.tag !== 0x30 ||
    basicRoot.end !== basicRaw.length ||
    usageRoot.tag !== 0x03 ||
    usageRoot.end !== keyUsageRaw.length
  ) {
    fail();
  }
  const basic = derChildren(basicRaw, basicRoot).map((element) =>
    Buffer.from(basicRaw.subarray(element.offset, element.end)).toString("hex")
  );
  const keyUsage = Buffer.from(
    keyUsageRaw.subarray(usageRoot.valueStart, usageRoot.end)
  ).toString("hex");
  return Object.freeze({ signatureOid, basic, keyUsage });
}

function exactUsage(parsed, expected) {
  return (
    Array.isArray(parsed.keyUsage) &&
    parsed.keyUsage.length === 1 &&
    parsed.keyUsage[0] === expected
  );
}

export function validateLeafCertificateProfile(
  parsed,
  {
    identity,
    client,
    now = Date.now(),
    derProfile = certificateDerProfile(parsed.raw),
  }
) {
  const expectedSan = `${client ? "URI" : "DNS"}:${identity}`;
  const { validFrom, validTo } = certificateValidityWindow(parsed);
  const expectedUsage = client ? CLIENT_AUTH_OID : SERVER_AUTH_OID;
  if (
    parsed.ca ||
    parsed.subject !== "" ||
    parsed.subjectAltName !== expectedSan ||
    parsed.publicKey?.asymmetricKeyType !== "ec" ||
    parsed.publicKey?.asymmetricKeyDetails?.namedCurve !== "prime256v1" ||
    !exactUsage(parsed, expectedUsage) ||
    derProfile.signatureOid !== ECDSA_WITH_SHA256_OID ||
    derProfile.basic.length !== 0 ||
    derProfile.keyUsage !== "0780" ||
    validTo <= validFrom ||
    validTo - validFrom > MAX_LEAF_LIFETIME_MS ||
    now < validFrom ||
    now >= validTo
  ) {
    fail();
  }
}

export function validateReplacementTrustAnchorCertificate(
  parsed,
  {
    now = Date.now(),
    derProfile = certificateDerProfile(parsed.raw),
  } = {}
) {
  const { validFrom, validTo } = certificateValidityWindow(parsed);
  if (
    !parsed.ca ||
    parsed.subject !== parsed.issuer ||
    parsed.publicKey?.asymmetricKeyType !== "ec" ||
    parsed.publicKey?.asymmetricKeyDetails?.namedCurve !== "prime256v1" ||
    derProfile.signatureOid !== ECDSA_WITH_SHA256_OID ||
    derProfile.basic.join(",") !== "0101ff,020100" ||
    derProfile.keyUsage !== "0204" ||
    validTo <= validFrom ||
    validTo - validFrom > MAX_CA_LIFETIME_MS ||
    now < validFrom ||
    now >= validTo ||
    typeof parsed.verify !== "function" ||
    !parsed.verify(parsed.publicKey)
  ) {
    fail();
  }
}
function validateClientIdentity(cert, key, region) {
  try {
    const definition = productionRegionDefinition(region);
    const parsed = new X509Certificate(cert);
    if (!parsed.checkPrivateKey(createPrivateKey(key))) fail();
    validateLeafCertificateProfile(parsed, {
      identity: definition.spiffe_uri,
      client: true,
    });
    const sans = (parsed.subjectAltName ?? "")
      .split(/,\s*/u)
      .filter((value) => value.startsWith("URI:"));
    if (sans.length !== 1 || sans[0] !== `URI:${definition.spiffe_uri}`) fail();
    const { validFrom, validTo } = certificateValidityWindow(parsed);
    if (
      parsed.ca ||
      /(?:^|\\n)CN=/u.test(parsed.subject) ||
      /(?:^|,\\s*)DNS:/u.test(parsed.subjectAltName ?? "") ||
      parsed.publicKey.asymmetricKeyType !== "ec" ||
      parsed.publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1" ||
      !Array.isArray(parsed.keyUsage) ||
      parsed.keyUsage.length !== 1 ||
      parsed.keyUsage[0] !== "1.3.6.1.5.5.7.3.2" ||
      validTo - validFrom > MAX_LEAF_LIFETIME_MS ||
      Date.now() < validFrom ||
      Date.now() >= validTo
    ) {
      fail();
    }
  } catch {
    fail();
  }
}

export function validateReplacementTrustAnchor(
  ca,
  {
    certificateFactory = (value) => new X509Certificate(value),
    profileValidator = validateReplacementTrustAnchorCertificate,
  } = {}
) {
  try {
    const text = ca.toString("ascii").trim();
    const anchors =
      text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu) ?? [];
    if (anchors.length !== 1 || anchors[0] !== text) fail();
    const parsed = certificateFactory(Buffer.from(text, "ascii"));
    profileValidator(parsed);
  } catch {
    fail();
  }
}
export function loadProtectedMtlsMaterial(config) {
  const cert = readProtected(config.client_certificate_path);
  const key = readProtected(config.client_private_key_path, { privateKey: true });
  const ca = readProtected(config.cloud_ca_bundle_path);
  validateClientIdentity(cert, key, config.region);
  validateReplacementTrustAnchor(ca);
  return Object.freeze({ cert, key, ca });
}

export function validateCloudServerIdentity(
  hostname,
  certificate,
  expectedServerName,
  defaultValidator = checkServerIdentity,
  profileValidator = (peer, options) =>
    validateLeafCertificateProfile(new X509Certificate(peer.raw), options)
) {
  if (hostname !== expectedServerName) return new Error("cloud_authority_unavailable");
  const standardError = defaultValidator(hostname, certificate);
  if (standardError) return standardError;
  try {
    profileValidator(certificate, {
      identity: expectedServerName,
      client: false,
    });
  } catch {
    return new Error("cloud_authority_unavailable");
  }
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
