import {
  canonical32,
  regionalTuple,
  validateIntrospectionResult,
} from "./cloudExchangeFoundation.mjs";

function fail(message) {
  throw new TypeError(message);
}

export function createSessionAuthority({ introspector, cloud }) {
  if (!introspector || typeof introspector.introspect !== "function") {
    fail("a session introspector is required");
  }

  return Object.freeze({
    async authorize(sessionHandle, expectedRegion) {
      canonical32(sessionHandle, "session_handle");
      regionalTuple(expectedRegion);
      let result;
      try {
        result = validateIntrospectionResult(
          await introspector.introspect({
            contract_version: "cloud.session-authority.v1",
            operation: "introspect",
            session_handle: sessionHandle,
            region: expectedRegion,
          }),
          expectedRegion
        );
      } catch {
        throw new Error("session_authority_unavailable");
      }
      if (result.active !== true) throw new Error("session_inactive");
      return result;
    },

    async logout(sessionHandle, expectedRegion) {
      canonical32(sessionHandle, "session_handle");
      regionalTuple(expectedRegion);
      if (!cloud || typeof cloud.logout !== "function") {
        throw new Error("session_authority_unavailable");
      }
      try {
        await cloud.logout({
          contract_version: "cloud.session-authority.v1",
          operation: "logout",
          session_handle: sessionHandle,
          region: expectedRegion,
          scope: "current_session_family",
        });
      } catch {
        throw new Error("session_authority_unavailable");
      }
    },
  });
}
