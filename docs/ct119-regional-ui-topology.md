# CT119 region-bound public UI contract

This source contract does not authorize deployment or any protected operation.
CT119 remains quiesced and production authentication remains paused.

| Region | Unit | Listener | Environment | Exact client identity |
| --- | --- | --- | --- | --- |
| NG | `kariya-sns-ui-ng.service` | `127.0.0.1:3011` | `/etc/kariya/sns-ui-ng.env` | `spiffe://kariya/services/ksns/ng` |
| CA | `kariya-sns-ui-ca.service` | `127.0.0.1:3012` | `/etc/kariya/sns-ui-ca.env` | `spiffe://kariya/services/ksns/ca` |

Both processes run as `kariya_ksns_auth:kariya_ksns_auth` from the same reviewed immutable release under `/opt/kariya/sns/current`. Each unit has a separate systemd credential directory and loads only encrypted-at-rest sources beginning with `ksns-ui-ng-` or `ksns-ui-ca-`. Runtime aliases are scoped to that private credential directory. Existing application validation requires exactly the configured regional SPIFFE URI and its matching private key.

The required protected environment keys are machine-readable in `deploy/ct119-ui-instances.json`. Certificate, key, single replacement-CA trust, and database-CA paths are unit-bound to `%d`; they cannot be replaced by environment-file paths. The trust file must contain exactly one current replacement anchor; legacy anchors, overlap bundles, CRL/OCSP material, missing or malformed trust, cross-region identities, and leaves exceeding 24 hours all keep startup or the authentication boundary unavailable.

After TLS validation, revocation is owned by Cloud's immutable authorization set: removing the exact regional SPIFFE identity causes every request to fail closed. K-SNS has no local revocation list, authorization fallback, or backend-route fallback.

`GET /api/health` returns 200 for process health. Unauthenticated `/overview` returns 307 to login, and unauthenticated `/api/ksns/incidents` returns 401. Dependency or credential failure never becomes permissive.

The proven `kariya-sns-ui-v1.service` on `0.0.0.0:3011` is the NG predecessor. It must be stopped and disabled before loopback NG activation and is not a fallback. The generic backend `kariya-sns.service` on `172.16.16.119:8019` is not a public UI upstream.

Immutable staging retains the existing release directory and atomic `current` symlink. A separately authorized rollout must preflight both stopped regional units before either start. Credential renewal replaces only the intended region's encrypted sources and requires a separately authorized restart of that region; there is no live credential reload. Rollback restores the previous immutable symlink only while both units are stopped, preflights both identities, and then uses separately authorized starts.
