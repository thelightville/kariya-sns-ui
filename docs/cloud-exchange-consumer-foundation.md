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

Production persistence, encrypted verifier/nonce custody, mTLS, certificate
issuance, key custody, callback atomicity, live introspection, logout/revocation,
backend enforcement, HA validation, and authenticated visual review remain
unavailable and require separate authorization.
