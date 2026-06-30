# Security Notes

## CLD-010 Next.js 14 Bootstrap Audit

`kariya-sns-ui` is bootstrapped on Next.js 14 per the Founder-approved
K-SNS UI direction recorded in governance. During bootstrap, `npm audit` was
run after updating Next.js to `14.2.35`.

Current audit posture:

- Critical vulnerabilities: 0
- High vulnerabilities: 1, via Next.js advisories that require a semver-major
  Next.js upgrade according to npm audit
- Moderate vulnerabilities: 1, via bundled PostCSS under Next.js

Disposition:

- The bootstrap does not use `next/image`, middleware, rewrites, WebSocket
  upgrades, custom API routes, or public upstream proxy code.
- The app is static preview UI at this stage and contains no service tokens,
  internal URLs, raw reasoning traces, or enforcement paths.
- Major migration beyond Next.js 14 is deferred because the accepted bootstrap
  direction names Next.js 14. Reclassification should happen explicitly before
  changing the framework major line.

Validation commands:

```bash
npm run test:boundary
npm run lint
npm run build
npm audit --audit-level=critical
```
