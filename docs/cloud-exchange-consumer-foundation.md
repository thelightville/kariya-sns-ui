# Cloud exchange consumer completion

Status: **source integration candidate; production authority, trust, persistence,
and runtime enablement remain unavailable**.

This slice implements the K-SNS side of the accepted Cloud authorization
contracts for the founder journey to sns.kariya.ng. It preserves the paired
.ca tuple, but it does not add another hostname or deployment surface.

## What the source now does

- /api/auth/exchange/start creates independently random state, nonce, and PKCE
  verifier, stores only required digests plus an encrypted custody envelope,
  registers the exact regional transaction, and sends the browser only
  request_id and raw state to the paired Account origin.
- /api/auth/exchange/callback accepts exactly code and state, atomically
  reserves the matching regional transaction, clears the custody envelope
  before redemption, validates Cloud nonce/region/audience/time, and writes a
  host-local sns_token whose positive Max-Age is the smaller of 899 and the
  Cloud-reported remaining lifetime.
- Proxy and BFF authorization call Cloud introspection for every protected
  request. Cookie presence is never authorization and no stale-success cache
  exists.
- The BFF forwards only validated ksns.bff-context.v1 plus the Accept and
  Content-Type inbound allowlist. It never forwards the opaque session handle,
  a Cloud token, browser Cookie/Authorization/Host/Forwarded headers, static
  tenant configuration, or caller query authority.
- Direct K-SNS password and MFA proxy routes return 410; credentials are not
  accepted or forwarded.
- Logout requests Cloud family logout and always clears only the exact-host
  K-SNS cookie.

All workflow scenarios remain deterministic synthetic/customer-free evidence.
Nothing in this slice claims live KAI, KES, KEA, dispatch, execution, or
verification.

## Exact regional contract

| Region | Issuer | Audience | Callback | Service URI SAN |
|---|---|---|---|---|
| NG | https://account.kariya.ng | https://sns.kariya.ng | https://sns.kariya.ng/api/auth/exchange/callback | spiffe://kariya/services/ksns/ng |
| CA | https://account.kariya.ca | https://sns.kariya.ca | https://sns.kariya.ca/api/auth/exchange/callback | spiffe://kariya/services/ksns/ca |

Console issuers are accepted only as explicit migration compatibility for
existing sessions/transactions that still match the same region, audience,
callback, and destination host. New K-SNS authentication starts use Account.

State, nonce, verifier, request ID, authorization code, and opaque session
handle are canonical unpadded base64url encodings of exactly 32 bytes. Cloud is
the only time authority. Preauthorization is exactly 300 seconds; redemption
sessions are exactly 899 seconds and the local cookie never extends that
expiry.

## Durable custody and replay behavior

migrations/0001_create_ksns_auth_transactions.sql defines the regional
PostgreSQL correctness record. The source store accepts an injected
PostgreSQL-compatible pool; this repository adds no pg dependency, connection
string, database client, or automatic migration runner.

The state sequence is created -> registered -> callback_reserved ->
redeem_sent -> completed, with terminal terminal_failed and expired states.
State digest is unique, mutations use row locks and version CAS, Cloud
registration time is exactly 300 seconds, and terminal tombstones remain for
exactly 24 hours. The encrypted envelope is cleared before the single
redemption attempt. A lost or ambiguous response after redeem_sent is terminal
and cannot retry or issue another session.

The envelope profile is ksns.transaction-envelope.aes-256-gcm.v1: fresh
256-bit data key, 96-bit IV, 128-bit tag, and canonical regional AAD. The data
key is wrapped by an injected regional key-provider port. No production key,
credential, certificate, production custody adapter, or trust material is included. The
deterministic key provider under tests/fixtures is synthetic and non-secret
and must never be used outside tests.

## Fail-closed runtime posture

runtimeComposition.mjs deliberately composes only unavailable transaction,
cipher, Cloud, and introspection adapters. Therefore the checked-in runtime
cannot create a session. Start, callback, protected-cookie, BFF, and logout
paths return generic unavailable/unauthorized behavior until separately
authorized production PostgreSQL, systemd credential custody, TLS 1.3 mTLS, Cloud client, and
introspection adapters are provisioned and tested.

The SQL migration is not applied. No database, Redis, DNS, certificate, secret,
deployment, or production runtime is changed by this source branch. Synthetic
tests exercise interface behavior only; they are not PostgreSQL concurrency,
systemd credential custody, HA/failover, certificate, ingress, or production crash evidence.

## Protected production composition (default disabled)

Production is selected only by the protected server setting
`K_SNS_AUTH_RUNTIME=production`. Any missing or malformed database, regional
systemd credential, certificate, key, replacement-CA, origin, or trust setting leaves the unavailable
runtime selected. No protected setting uses a `NEXT_PUBLIC_` name.

The production adapter uses a TLS-validated Node `pg` pool and performs a
read-only exact schema-head check before any auth operation. It never runs
runtime DDL or applies migrations.

Each region has an exact key identifier and version. A 32-byte AES-256-GCM KEK
is loaded only from systemd's runtime credential directory after
`LoadCredentialEncrypted=` decrypts its root-owned encrypted-at-rest blob.
The Node process converts the 32-byte buffer directly to a non-exported
`KeyObject` and zeros the input buffer. It never accepts KEK bytes from
environment, source, image, database, CLI arguments, logs, or browser state.

The provider wraps only fresh 32-byte transaction DEKs. Its authenticated
context binds wrap profile, key identifier, key version, the explicit
`cloud-preauthorization-pending` tenant scope, region, purpose, and transaction
AAD digest. The unresolved tenant marker is deliberate: K-SNS does not possess
Cloud-validated tenant authority before redemption, and the preauthorization
ciphertext must never be mistaken for tenant-authorized state. Current and
immediately previous versions support bounded rotation; unknown, retired,
cross-region, tampered, missing, malformed, symlinked, non-root, or
permission-invalid credentials fail closed.

K-SNS-to-Cloud calls use direct TLS 1.3 mutual authentication with protected
read-only client-certificate, private-key, and single replacement-CA mounts.
The replacement trust anchor must be a current self-signed P-256/SHA-256 CA
with path length zero, keyCertSign only, and no CRL-sign capability. Each leaf
must match its private key, be P-256/non-CA/SHA-256, contain only the paired
regional SPIFFE URI SAN, clientAuth EKU, and digitalSignature key usage, and
have a lifetime no longer than 24 hours. The Cloud server leaf is held to the
same lifetime/key profile with its exact regional DNS SAN and serverAuth EKU.
Calls have a three-second timeout and 64 KiB body bound, do not use a proxy,
do not follow redirects or reuse TLS sessions, and reload trust material for each
call. Caller Host/Forwarded headers never select region or identity.

The pool, credential provider and Cloud client expose idempotent shutdown; SIGTERM and
SIGINT initiate graceful closure. Revocation is Cloud's fail-closed removal of
the exact SPIFFE identity from its immutable authorization set after successful
TLS validation; CRL and OCSP interfaces are prohibited. Certificate delivery,
trust replacement, authorization-set publication, encrypted credential installation,
database provisioning, migration application and deployment remain external release gates. This
branch contains no certificate, private key, credential or provider-specific cloud resource and is
not a production-readiness claim.


The offline generation, encrypted recovery, installation, rotation, and rollback
checklist is in [systemd-credential-custody.md](systemd-credential-custody.md).
It is an operator plan only and contains no production key material.
