# Cloud exchange consumer foundation

Status: **source-only contract foundation; no login or session capability exists**.

This additive slice mirrors the accepted K-SNS consumer boundary for Cloud
`cloud.durable-exchange.v1`. It contains pure validation, exact regional
mapping, transaction-state types, fail-closed interfaces, and deterministic
tests only.

It does not add or change:

- authorization start or callback routes;
- cookie creation, deletion, or session issuance;
- Next Proxy, BFF, login, MFA, or client session-store behavior;
- PostgreSQL, Redis, filesystem, browser-storage, or in-memory persistence;
- environment variables or runtime configuration;
- network calls, Cloud endpoints, backend calls, credentials, certificates,
  KMS/HSM access, or trust material;
- runtime success, deployment, DNS, workflow, merge, or release behavior.

Every supplied adapter throws `consumer_foundation_unavailable`. The modules
are not wired into the application. Existing authentication behavior remains
unchanged and is not made compliant or production-ready by this draft.

## Frozen source contracts

The exact regional tuples are:

| Region | Issuer | Audience | Callback | Service URI SAN |
|---|---|---|---|---|
| NG | `https://console.kariya.ng` | `https://sns.kariya.ng` | `https://sns.kariya.ng/api/auth/exchange/callback` | `spiffe://kariya/services/ksns/ng` |
| CA | `https://console.kariya.ca` | `https://sns.kariya.ca` | `https://sns.kariya.ca/api/auth/exchange/callback` | `spiffe://kariya/services/ksns/ca` |

State, nonce, verifier, request ID, code, and opaque session handles are
canonical unpadded base64url values representing exactly 32 bytes. Cloud is the
time authority. A future host-only `sns_token` cookie may use only the positive
value `min(899, expires_at - server_time)`; this module does not write it.

The local transaction type is deliberately inert:
`created -> registered -> callback_reserved -> redeem_sent -> completed`,
with terminal `terminal_failed` and `expired` states. Returning a callback
reservation to `registered` represents only a future pre-redemption lease
release. There is no transition back after `redeem_sent`.

`ksns.bff-context.v1` is represented as an exact-key, channel-authenticated
context derived only from an active, region-matched Cloud introspection result.
The stripping helper retains only `Accept` and `Content-Type`; browser
Authorization, Cookie, Host/Forwarded, tenant, and Kariya context headers are
discarded. This draft does not send the context or authenticate any backend.

## Transaction custody source contract

The selected future correctness authority is a Cloud-approved HA PostgreSQL
service in each region. NG and CA transaction data and key references never
cross regions. Redis is not a correctness authority, replay store, or lock
service. No PostgreSQL client or connection exists in this draft.

`ksns.auth-transaction.v1` freezes the future record shape and validation
rules:

- state and Cloud request IDs are stored only as canonical SHA-256 digests;
- the normalized return path is same-origin, authority-free, and at most 512
  characters;
- registration records Cloud's exact 300-second issued/expires interval;
- callback reservation is versioned and cannot outlive that interval;
- row identity, region, state digest, and version are CAS invariants;
- moving to `redeem_sent` clears the encrypted custody envelope and can never
  return to a retryable state;
- completed, failed, and expired records retain a replay tombstone for exactly
  24 hours before becoming cleanup-eligible.

The future envelope profile is
`ksns.transaction-envelope.aes-256-gcm.v1`: one fresh 256-bit data key and
96-bit IV per record, a 128-bit authentication tag, and canonical AAD binding
the transaction ID, region, state digest, regional audience/callback, and
creation time. This draft validates only envelope metadata and constructs AAD.
It does not encrypt, decrypt, hash AAD, generate a key, wrap a key, or call a
KMS/HSM.

A future regional KMS/HSM keeps each key-encryption key outside application
source and configuration. Records carry only a key ID, key version, and wrapped
data key. New writes use the current version; reads select the recorded
version. Missing, revoked, unknown, cross-region, unwrap, or authentication
failure must fail closed without plaintext or fallback. Rotation, rewrapping,
custody, provisioning, and recovery remain separately authorized work.

The `TransactionStore`, `TransactionCipher`, and `KeyEncryptionProvider`
ports are exact source interfaces with unavailable adapters only. These tests
are synthetic interface evidence. They are not evidence of PostgreSQL
transactions, KMS/HSM behavior, encryption, 2/16/100 concurrency, crash
recovery, failover, cleanup scheduling, or production runtime behavior.

## Reserved later implementation names

The following names are documentation reservations only. They are not files,
dependencies, or configuration reads in this draft:

- dependency: `pg`;
- migration: `migrations/0001_create_ksns_auth_transactions.sql`;
- protected configuration: `K_SNS_TRANSACTION_DATABASE_URL`,
  `K_SNS_TRANSACTION_STORE_ENABLED` (default false),
  `K_SNS_TRANSACTION_KEK_ID`, `K_SNS_TRANSACTION_KEK_VERSION`, and
  `K_SNS_TRANSACTION_REGION`.

None may use a `NEXT_PUBLIC_` prefix. Adding them, applying a migration,
provisioning a store or key, or enabling an adapter requires a separate
Architecture decision.

Production persistence, encrypted verifier/nonce custody, mTLS, certificate
issuance, key custody, callback atomicity, live introspection, logout/revocation,
backend enforcement, HA validation, and authenticated visual review remain
unavailable and require separate authorization.
