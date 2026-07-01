# K-SNS UI (kariya-sns-ui)

> **Component:** K-SNS SOC Operations UI
> **Part of:** Kariya Security Nervous System (K-SNS)
> **License:** AGPL-3.0 (open core) | Proprietary (Enterprise tier)
> **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
> **Status:** Alpha 1 baseline
> **Governance:** ADR-0019 (K-SNS Dedicated UI Architecture)

---

## Overview

`kariya-sns-ui` is the dedicated SOC (Security Operations Center) operator
interface for the Kariya Security Nervous System. It is a separate,
purpose-built application for SOC analysts and security engineers — distinct
from the customer-facing Kariya Cloud portals (KCC/KCA/KCH/KCP), which serve
a different audience and a different information density.

Alpha 1 provides the navigation shell and route structure for:

- **Security Overview** — open incidents, trust posture, recent events
- **Events** — Sense/Understand-stage event feed
- **Trust** — trust score visualisation
- **Decisions** — K-SNS decisions awaiting/given operator approval
- **Incidents** — incident list with lightweight case grouping
- **Recommendations** — KAI-sourced recommendations awaiting operator approval
- **Explanations** — KAI narrative explanation viewer
- **Integrations** — KIF connector status (read-only)
- **Policies** — policy list with approval-gated activation
- **Evidence Graph** — explicitly marked "not yet implemented" placeholder

The K-SNS backend (`kariya-sns`) is an early scaffold and is not live yet.
Every page fails closed: if the API is unreachable, the page shows an empty/
error state — it never fabricates mock data that could be mistaken for real
SOC telemetry.

---

## Product boundary: K-SNS recommends, it does not enforce

**K-SNS is a coordination and decision-recommendation hub — it is not an
enforcement system.** Per ADR-0016 (decision D-02), any UI copy, API design,
or documentation that implies K-SNS (or KAI) makes autonomous enforcement
decisions is prohibited until AI Safety Tier 2 is validated.

Concretely, in this UI:

- Every action a SOC operator can take on a recommendation, decision, or
  policy is phrased as **Approve**, **Reject**, or **Request Action** — never
  "Execute", "Enforce", "Block now", or similar direct-action language.
- This is enforced structurally, not just as a copy convention: every action
  button in the app is built from one shared component,
  [`src/components/ApprovalAction.tsx`](src/components/ApprovalAction.tsx),
  which only knows how to render those three intents. There is no "execute"
  variant to reach for.
- "Request Action" means the operator is asking KES/KEA to carry out an
  enforcement step under an already-approved policy. K-SNS itself never
  performs network or endpoint enforcement — that responsibility remains
  with KES (edge security appliance) and KEA (endpoint agent).

---

## Quick Start

### Requirements

- Node.js 20+
- npm 10+

### Development

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_KSNS_API_URL if you have a local K-SNS API
npm install
npm run dev                   # starts on http://localhost:3010
```

Alpha 1 login is a local stub: any email/password combination succeeds and
sets the `sns_token` httpOnly cookie. There is no live K-SNS auth endpoint
wired up yet (see `src/app/api/auth/login/route.ts`).

### Build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

---

## Environment Variables

See [`.env.example`](.env.example) for all variables.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_KSNS_API_URL` | K-SNS C-009 external API base URL, called directly by `src/lib/ksnsPlatformClient.ts` |
| `NEXT_PUBLIC_APP_DOMAIN` | Public domain the app is served from (`sns.kariya.ca` or `sns.kariya.ng`) |

---

## Architecture

- **Framework:** Next.js 14, App Router, TypeScript, Tailwind CSS, Zustand
  (see ADR-0019 for the full technology rationale).
- **Auth:** JWT in an httpOnly cookie (`sns_token`). Next.js edge middleware
  (`src/middleware.ts`) enforces authentication on every route except
  `/login`. Token issuance/refresh is intended to happen server-side via
  `src/app/api/auth/*` route handlers — Alpha 1 ships a stub login route
  only.
- **API client:** `src/lib/ksnsPlatformClient.ts` is the single typed fetch
  client used by every page to call the K-SNS C-009 API. It fails closed —
  network errors and non-2xx responses raise a `KsnsClientError` that pages
  turn into an `EmptyState`, never mock data.
- **State:** Zustand (`src/stores/`) holds lightweight client-side session
  info (e.g. operator email for display). The JWT itself is never read or
  stored client-side — the httpOnly cookie is the only source of truth for
  authentication.

```
Browser → kariya-sns-ui (Next.js) → K-SNS API (kariya-sns backend, C-009)
```

### Styling

This repo does not currently consume `@kariya/ui` as an installed package
dependency — wiring a private/local npm package into `npm ci`-based CI was
judged not worth blocking Alpha 1 on. Instead, `tailwind.config.js` mirrors
the same color tokens as `kariya-ui/tailwind.config.base.js` (kariya orange,
navy palette, threat severity colors) so the visual language matches the
rest of the Kariya portal family. Revisit package consumption once
`@kariya/ui` is published somewhere `npm ci` can reach without extra
credentials.

---

## Deployment

Per ADR-0019, `kariya-sns-ui` is deployed on CT119 (172.16.16.119), served
behind Cloudflare at:

- `https://sns.kariya.ca`
- `https://sns.kariya.ng`

Both domains route to the same Next.js origin (port 3000 behind nginx).

---

## Related Repositories

| Repository | Role |
|---|---|
| `kariya-sns` | K-SNS backend target API (early scaffold; production K-SNS currently runs from `kariya-cloud`) |
| `kariya-cloud` | Kariya Cloud portal backend / current K-SNS production runtime |
| `kariya-central` | Kariya Cloud enterprise customer portal (KCC) |
| `kariya-ui` | Shared design system (`@kariya/ui`) |
| `kariya-governance` | ADRs and platform governance |

---

## Governance

All changes must follow the [Kariya Engineering Governance](https://github.com/thelightville/kariya-governance),
in particular ADR-0011, ADR-0012, ADR-0016, and ADR-0019.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and PR
requirements.
