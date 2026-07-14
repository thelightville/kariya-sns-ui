const FORWARDED_REQUEST_HEADERS = ["accept", "content-type"];

export function buildBffHeaders(inboundHeaders, sessionToken, trustedTenantId = "") {
  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = inboundHeaders.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("Authorization", `Bearer ${sessionToken}`);

  const tenantId = trustedTenantId.trim();
  if (tenantId) {
    headers.set("X-Tenant-ID", tenantId);
  }

  return headers;
}
