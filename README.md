# K-SNS UI (kariya-sns-ui)

> **Component:** K-SNS SOC Operations UI
> **Part of:** Kariya Security Nervous System (K-SNS)
> **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
> **Status:** Alpha 1 UI/Console/KIF visibility pass
> **License:** AGPL-3.0 (open core) | Proprietary (Enterprise tier)

## Purpose

`kariya-sns-ui` is the dedicated security-operations surface for K-SNS, the autonomous SOC brain and Security Nervous System orchestration layer for Kariya.

The product lifecycle shown in this UI is:

**Sense -> Understand -> Decide -> Act/Enforce -> Verify -> Explain**

K-SNS owns orchestration, incident state, decisions, action lifecycle records, evidence, and explanation visibility. KAI reasons and explains. KES enforces edge/network actions. KEA handles endpoint telemetry and endpoint response. KIF/connectors bring third-party telemetry and action surfaces. MCP/tool governance tracks tool use, tool risk, and connector/tool control.

## Console Relationship

Console remains the canonical unified product portal:

- `https://console.kariya.ca`
- `https://console.kariya.ng`

K-SNS UI can exist as a dedicated SOC/security-operations surface, but it must not replace Console as the primary product entry point. Console should deep-link into K-SNS for:

- `/overview` — K-SNS dashboard
- `/workflow` — synthetic, customer-free security workflow and product-truth review notes
- `/incidents` and `/incidents/{incidentId}` — incident list/detail
- `/actions` — autonomous action lifecycle
- `/trust` — trust/risk posture
- `/integrations` — KIF connector and MCP/tool-governance visibility
- `/evidence-graph` — evidence and explanation lifecycle view

## Implemented UI Surfaces

- **Overview** — incident counts, high-risk incidents, action records, verification pending, trust posture, connector health, recent evidence, and KAI explanation coverage.
- **Incidents** — operational incident table plus incident detail route with lifecycle, evidence refs, timeline, decision/action/verification, residual risk, and KAI explanation state.
- **Autonomous Actions** — action ID, incident link, action type, target, enforcement surface, decision mode, policy authority, confidence, dispatch, verification, residual risk, and timestamp where backend fields exist.
- **Trust & Risk** — current trust score, derived risk display, asset buckets, contributing event/incident/action availability, and timeline surface.
- **Connectors & Telemetry** — KIF connector inventory, health, ingestion, auth/config status without secrets, supported telemetry/actions, readiness, and MCP/tool-governance reserved state.
- **Evidence & Explanation** — normalized events with correlation, trust/risk movement, decision/action, dispatch, verification, residual risk, and KAI explanation columns. Missing backend fields stay pending.
- **KAI Advisories** — accepted KAI advisory handoffs from K-SNS only, showing confidence, uncertainty, evidence refs, review gates, runtime/provenance, incident/decision correlation, and explicit advisory-only ownership.

No page fabricates incident counts, connector readiness, MCP telemetry, KAI explanations, action success, verification success, DNS completion, or production readiness.

## Backend Endpoints

Public browser code calls the same-origin K-SNS UI BFF at `/api/ksns/*`. The
BFF uses server-side `K_SNS_BASE_URL` to reach the private K-SNS API. The raw
K-SNS backend URL must not appear in the browser bundle or any `NEXT_PUBLIC_*`
variable for public deployment.

Currently used BFF routes:

| Surface | Browser route | Upstream K-SNS endpoint | Status |
|---|---|---|---|
| Events/evidence | `GET /api/ksns/events` | `GET /events` | Implemented in C-009 UI API |
| Trust aggregate | `GET /api/ksns/trust/score` | `GET /trust/score` | Implemented in C-009 UI API |
| Decisions/actions | `GET /api/ksns/decisions` | `GET /decisions` | Implemented in C-009 UI API |
| Recommendations | `GET /api/ksns/recommendations` | `GET /recommendations` | Implemented in C-009 UI API |
| KAI explanations | `GET /api/ksns/explanations` | `GET /explanations` | Implemented in C-009 UI API |
| KAI advisory handoffs | `GET /api/ksns/kai-advisory-handoffs` | `GET /kai-advisory-handoffs` | Tenant-scoped K-SNS-owned advisory projection |
| Incidents | `GET /api/ksns/incidents`, `GET /api/ksns/incidents/{id}`, `GET /api/ksns/incidents/{id}/timeline` | Incident lifecycle endpoints | Backend-driven, no fabricated records |
| Actions | `GET /api/ksns/actions/` | `GET /actions/` | Tenant scope comes only from server-derived BFF context |
| Connectors | `GET /api/ksns/connectors/` | `GET /connectors/` | Tenant scope comes only from server-derived BFF context; readiness is backend-driven |
| SOC metrics | `GET /api/ksns/soc/metrics` | `GET /soc/metrics` | Tenant scope comes only from server-derived BFF context |
| MCP/tool governance | `GET /api/ksns/tool-governance` | `GET /tool-governance` | Backend-driven MCP/tool misuse visibility |
| Policies | `GET /api/ksns/policy/rules` | `GET /policy/rules` | Tenant scope comes only from server-derived BFF context |

Unsupported or partially supported fields are displayed as unavailable or pending.
## DNS And API Treatment

Primary product portals:

- `console.kariya.ca`
- `console.kariya.ng`

Approved dedicated K-SNS SOC surfaces (source contract only; not a deployment claim):

- `sns.kariya.ca`
- `sns.kariya.ng`

API:

- `api.kariya.ca`
- `api.kariya.ng`

Do not keep a `.ng` K-SNS DNS reference without the matching `.ca` reference. This repository does not claim DNS, Cloudflare, or deployment is live; those require manual infrastructure confirmation.

## Environment Variables

See [`.env.example`](.env.example).

| Variable | Description |
|---|---|
| `K_SNS_BASE_URL` | Server-side K-SNS API base URL used only by `/api/ksns/*`. Never expose it as `NEXT_PUBLIC_*`. |
| `K_SNS_BFF_UPSTREAM_TIMEOUT_MS` | Server-side BFF upstream timeout. Defaults to `5000`; invalid values fail closed with `503` and stalled backend calls return `504`. |
| `KARIYA_SNS_PUBLIC_ORIGIN` | Server-only canonical auth-redirect origin. Production accepts only the exact regional `https://sns.kariya.ng` or `https://sns.kariya.ca` origin. |
| `KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN` | Local-evidence gate only. Must remain disabled for every `sns.*` deployment. |
| `NEXT_PUBLIC_KSNS_OPERATOR_ID` | Non-secret operator identifier for approval/request payloads where required. |
| `NEXT_PUBLIC_APP_DOMAIN` | Public K-SNS surface, usually `sns.kariya.ca` or `sns.kariya.ng`. |

No `NEXT_PUBLIC_*` value may contain a credential, secret, or internal backend URL.

The portal never sends tenant authority from `NEXT_PUBLIC_*`, cookies, query
parameters or browser headers. `/api/ksns/*` strips caller authority inputs and
adds only server-derived Cloud session context before calling the private K-SNS
backend. Caller `tenant`, `tenant_id`, `X-Tenant-ID`,
`X-Kariya-Tenant-ID`, `Forwarded` and `X-Forwarded-*` values cannot override the
trusted context.
## Quick Start

Requirements:

- Node.js 20+
- npm 10+

```bash
cp .env.example .env.local
npm install
npm run dev
```

The dev server starts on `http://localhost:3010`.

Login and MFA are proxied server-side to the Cloud-owned authentication service configured by `KARIYA_CLOUD_AUTH_BASE_URL`. A successful Cloud response supplies the access token stored in the `sns_token` httpOnly cookie. When Cloud auth is not configured or unavailable, login fails closed; there is no local credential bypass.

## Founder Review Source Readiness

Both approved K-SNS origins serve the same authenticated product routes:

- `https://sns.kariya.ng/workflow`
- `https://sns.kariya.ca/workflow`

The browser calls only same-origin `/api/auth/*` and `/api/ksns/*` routes. Cloud owns centralized authentication/session contracts, tenant and role authority, regional routing, and any persistent review-note storage. This repository stores no credentials or review notes and does not expose the raw K-SNS backend.

Next 16 Proxy redirect construction uses the server-only `KARIYA_SNS_PUBLIC_ORIGIN` instead of request metadata. Production accepts exactly `https://sns.kariya.ng` or `https://sns.kariya.ca`; missing or invalid configuration fails closed with 503. A separately gated explicit `http://127.0.0.1:<port>` origin exists only for local evidence and Cloud's exact configured loopback-upstream rewrite contract; it is not `sns.*` readiness evidence and must not be enabled in an `sns.*` deployment. Neither K-SNS nor the gateway may select an origin from `Host`, `X-Forwarded-Host`, `Forwarded`, `Origin`, `Referer`, query parameters, or `return_to`; cross-country and arbitrary-origin redirects fail closed.

The minimum cross-product journey is intentionally narrow:

- KAI advisory content reaches K-SNS through the server-side KAI/K-SNS handoff contract and K-SNS lifecycle record; the UI reads K-SNS-owned advisory projections through `/api/ksns/kai-advisory-handoffs` and explanation data through `/api/ksns/explanations`. The browser never calls KAI directly, and degraded/unavailable KAI results stay review-gated rather than approved, executed, enforced, or verified.
- A KES-targeted K-SNS action may link from authenticated `/actions` to the paired regional Console `/products/kes/response-orchestration` view using `kes.console-review.v1`. Action and incident IDs are lookup hints only; Cloud must re-resolve them under tenant/role authority. The link is posture review only and does not dispatch, execute, or verify.

Deployment sequencing is mandatory even when this source branch is green:

1. PR #10 boundary hardening is the deployment prerequisite.
2. PR #8/#9 must be rebased and revalidated on the exact accepted post-#10 base.
3. This stacked slice must then be rebased onto that combined accepted head and fully revalidated.

No merge, deployment, DNS/routing change, Cloud session/RBAC implementation, KES execution, or production-readiness claim is included here.

## Checks

```bash
npm run build
npm run lint
npm run verify:public-bff
npm run verify:auth
npm run verify:http
```

For authorized read-only public evidence, run:

```bash
npm run verify:external
```

`verify:external` checks the owned `https://sns.kariya.ng` and
`https://sns.kariya.ca` origins by default. It requires protected page routes to
redirect to login and unauthenticated `GET /api/ksns/events` to fail closed with
`401`, so regional timeouts or public BFF exposure block deployment-readiness
claims. Override the target list only for controlled evidence with
`SNS_EXTERNAL_ORIGINS=https://sns.kariya.ng,https://sns.kariya.ca`.

## Known Gaps

- MCP/tool-governance depends on backend-returned MCP/tool misuse records; empty state means no visible records, not proof of no misuse.
- Connector inventory requires tenant-scoped backend configuration and does not imply live readiness without health/ingestion data.
- Action verification and dispatch result fields display only when returned by the backend.
- Incident detail depth depends on backend module fields; missing correlation/evidence/action fields remain pending.
- DNS/Cloudflare/deployment status is not asserted by this repo.

## Related Repositories

| Repository | Role |
|---|---|
| `kariya-sns` | K-SNS backend API and orchestration runtime |
| `kariya-integrations` | KIF SDK and connector implementations |
| `kariya-kai` | KAI reasoning and explanation service |
| `kariya-kes` | Edge/network enforcement surface |
| `kariya-kea` | Endpoint telemetry and response surface |
| `kariya-governance` | ADRs, missions, and platform governance |
| `kariya-ui` | Shared design system |
