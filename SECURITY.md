# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report to: **security@kariya.io**

You will receive acknowledgement within 48 hours and a status update within
7 days.

## Responsible Disclosure

Please allow 90 days to remediate before public disclosure.

## Notes specific to this repository

- Authentication uses an httpOnly `sns_token` cookie. It must never be
  exposed to client-side JavaScript or logged.
- Browser K-SNS API calls go through the same-origin `/api/ksns` BFF.
  `K_SNS_BASE_URL` is server-side only and must never be exposed as
  `NEXT_PUBLIC_*` or embedded in the client bundle.
- Alpha 1 ships a local login stub (`src/app/api/auth/login/route.ts`) that
  accepts any credentials and always succeeds. This is acceptable only for
  explicitly approved Alpha 1 validation. It must be replaced with real
  authentication before production launch.
