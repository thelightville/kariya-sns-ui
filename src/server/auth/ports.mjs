export const FOUNDATION_UNAVAILABLE_CODE = "consumer_foundation_unavailable";

export class FoundationUnavailableError extends Error {
  constructor(capability) {
    super(`${capability} is unavailable in the source-only consumer foundation`);
    this.name = "FoundationUnavailableError";
    this.code = FOUNDATION_UNAVAILABLE_CODE;
    this.capability = capability;
  }
}

/**
 * @typedef {object} TransactionStore
 * @property {(record: unknown) => Promise<never>} create
 * @property {(state: string) => Promise<never>} reserveCallback
 * @property {(id: string) => Promise<never>} markRedeemSent
 * @property {(id: string) => Promise<never>} complete
 * @property {(id: string) => Promise<never>} fail
 * @property {(id: string) => Promise<never>} expire
 */

/**
 * @typedef {object} CloudExchangeClient
 * @property {(request: unknown) => Promise<never>} register
 * @property {(request: unknown) => Promise<never>} redeem
 * @property {(request: unknown) => Promise<never>} revoke
 * @property {(request: unknown) => Promise<never>} logout
 */

/**
 * @typedef {object} SessionIntrospector
 * @property {(sessionHandle: string) => Promise<never>} introspect
 */

function unavailable(capability) {
  return async function unavailableOperation() {
    throw new FoundationUnavailableError(capability);
  };
}

/** @returns {TransactionStore} */
export function unavailableTransactionStore() {
  return Object.freeze({
    create: unavailable("transaction_store.create"),
    reserveCallback: unavailable("transaction_store.reserve_callback"),
    markRedeemSent: unavailable("transaction_store.mark_redeem_sent"),
    complete: unavailable("transaction_store.complete"),
    fail: unavailable("transaction_store.fail"),
    expire: unavailable("transaction_store.expire"),
  });
}

/** @returns {CloudExchangeClient} */
export function unavailableCloudExchangeClient() {
  return Object.freeze({
    register: unavailable("cloud_exchange.register"),
    redeem: unavailable("cloud_exchange.redeem"),
    revoke: unavailable("cloud_exchange.revoke"),
    logout: unavailable("cloud_exchange.logout"),
  });
}

/** @returns {SessionIntrospector} */
export function unavailableSessionIntrospector() {
  return Object.freeze({
    introspect: unavailable("session_introspection"),
  });
}
