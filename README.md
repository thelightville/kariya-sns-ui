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

No page fabricates incident counts, connector readiness, MCP telemetry, KAI explanations, action success, verification success, DNS completion, or production readiness.

## Backend Endpoints

The UI consumes `NEXT_PUBLIC_KSNS_API_URL`, normally a `/api/v1` base URL.

Currently used endpoints:

| Surface | Endpoint | Status |
|---|---|---|
| Events/evidence | `GET /events` | Implemented in C-009 UI API |
| Trust aggregate | `GET /trust/score` | Implemented in C-009 UI API |
| Decisions | `GET /decisions` | Implemented in C-009 UI API |
| Recommendations | `GET /recommendations` | Implemented in C-009 UI API |
| KAI explanations | `GET /explanations` | Implemented in C-009 UI API |
| Incidents | `GET /incidents`, `GET /incidents/{id}`, `GET /incidents/{id}/timeline` | Backend module exists; tenant/list shape may vary |
| Actions | `GET /actions/?tenant_id=...` | Requires `NEXT_PUBLIC_KSNS_TENANT_ID` |
| Connectors | `GET /connectors/?tenant_id=...` | Requires `NEXT_PUBLIC_KSNS_TENANT_ID` |
| SOC metrics | `GET /soc/metrics?tenant_id=...` | Client-ready; not required by dashboard render |
| MCP/tool governance | `GET /tool-governance` | Reserved/pending backend dependency |

Unsupported or partially supported fields are displayed as unavailable or pending.

## DNS And API Treatment

Primary product portals:

- `console.kariya.ca`
- `console.kariya.ng`

Dedicated K-SNS SOC surface, if retained:

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
| `NEXT_PUBLIC_KSNS_API_URL` | K-SNS API base URL, for example `http://localhost:8000/api/v1` or `https://api.kariya.ca/api/v1` |
| `NEXT_PUBLIC_KSNS_TENANT_ID` | Tenant id for tenant-scoped module routes such as actions/connectors/SOC metrics. Leave blank to show unavailable state. |
| `NEXT_PUBLIC_KSNS_OPERATOR_ID` | Non-secret operator identifier for approval/request payloads where required. |
| `NEXT_PUBLIC_APP_DOMAIN` | Public K-SNS surface, usually `sns.kariya.ca` or `sns.kariya.ng`. |

No `NEXT_PUBLIC_*` value may contain a credential or secret.

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

Alpha 1 login is a local stub: any email/password combination succeeds and sets the `sns_token` httpOnly cookie. Live auth is still a backend dependency.

## Checks

```bash
npm run build
npm run lint
```

## Known Gaps

- MCP/tool-governance has normalized telemetry examples in K-SNS, but no dedicated UI inventory endpoint yet.
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
