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
 * PostgreSQL correctness boundary. Implementations must use row locking and
 * state-version compare-and-swap; Redis is never a correctness authority.
 *
 * @typedef {object} TransactionStore
 * @property {(record: unknown) => Promise<unknown>} create
 * @property {(id: string, expectedVersion: number, registration: unknown) => Promise<unknown>} markRegistered
 * @property {(stateDigest: string, reservation: unknown) => Promise<unknown>} reserveCallback
 * @property {(id: string, expectedVersion: number, reservationDigest: string, update: unknown) => Promise<unknown>} releaseReservation
 * @property {(id: string, expectedVersion: number, reservationDigest: string, update: unknown) => Promise<unknown>} markRedeemSent
 * @property {(id: string, expectedVersion: number, terminal: unknown) => Promise<unknown>} complete
 * @property {(id: string, expectedVersion: number, terminal: unknown) => Promise<unknown>} failTerminal
 * @property {(id: string, expectedVersion: number, terminal: unknown) => Promise<unknown>} expire
 * @property {(now: number) => Promise<number>} purgeTerminal
 */

/**
 * AES-256-GCM transaction-envelope boundary.
 * @typedef {object} TransactionCipher
 * @property {(plaintext: unknown, aad: string) => Promise<unknown>} seal
 * @property {(envelope: unknown, aad: string) => Promise<unknown>} open
 */

/**
 * Regional KMS/HSM boundary. Plaintext wrapping keys must never be returned.
 * @typedef {object} KeyEncryptionProvider
 * @property {() => Promise<{key_id: string, key_version: string}>} currentKeyReference
 * @property {(dataKey: Uint8Array, keyReference: unknown) => Promise<Uint8Array>} wrapKey
 * @property {(wrappedKey: Uint8Array, keyReference: unknown) => Promise<Uint8Array>} unwrapKey
 */

/**
 * Mutually authenticated K-SNS-to-Cloud boundary.
 * @typedef {object} CloudExchangeClient
 * @property {(request: unknown) => Promise<unknown>} register
 * @property {(request: unknown) => Promise<unknown>} redeem
 * @property {(request: unknown) => Promise<void>} revoke
 * @property {(request: unknown) => Promise<void>} logout
 */

/**
 * Every protected UI and BFF request invokes this port. No stale-success cache.
 * @typedef {object} SessionIntrospector
 * @property {(request: unknown) => Promise<unknown>} introspect
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
    markRegistered: unavailable("transaction_store.mark_registered"),
    reserveCallback: unavailable("transaction_store.reserve_callback"),
    releaseReservation: unavailable("transaction_store.release_reservation"),
    markRedeemSent: unavailable("transaction_store.mark_redeem_sent"),
    complete: unavailable("transaction_store.complete"),
    failTerminal: unavailable("transaction_store.fail_terminal"),
    expire: unavailable("transaction_store.expire"),
    purgeTerminal: unavailable("transaction_store.purge_terminal"),
  });
}

/** @returns {TransactionCipher} */
export function unavailableTransactionCipher() {
  return Object.freeze({
    seal: unavailable("transaction_cipher.seal"),
    open: unavailable("transaction_cipher.open"),
  });
}

/** @returns {KeyEncryptionProvider} */
export function unavailableKeyEncryptionProvider() {
  return Object.freeze({
    currentKeyReference: unavailable("key_encryption.current_reference"),
    wrapKey: unavailable("key_encryption.wrap"),
    unwrapKey: unavailable("key_encryption.unwrap"),
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
