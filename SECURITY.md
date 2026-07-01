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
- `NEXT_PUBLIC_KSNS_API_URL` is a public (browser-visible) environment
  variable by design — it must never carry embedded credentials.
- Alpha 1 ships a local login stub (`src/app/api/auth/login/route.ts`) that
  accepts any credentials and always succeeds. This must not be deployed to
  any environment reachable outside a local development machine, and must be
  replaced with a real call to the K-SNS auth endpoint before any shared or
  production deployment.
