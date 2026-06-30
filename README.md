# Kariya SNS UI

Dedicated K-SNS operator interface for SOC dashboard, incidents, cases, policy
visibility, and KIF connector status.

This repository is the CLD-010 bootstrap for the Founder-approved
`kariya-sns-ui` product surface. It is a Cloud-owned UI repository that consumes
approved K-SNS outputs. It does not implement trust scoring, decisioning,
incident correlation, SOC automation, KAI reasoning, endpoint logic, or edge
enforcement.

## Scope

- Next.js 14 application for deployment on CT119.
- Target domains: `sns.kariya.ca` and `sns.kariya.ng`.
- Operator-first workspace with dashboard, incidents, cases, policy, and
  connectors views.
- Static typed preview data during bootstrap, routed through a single data
  loading module for later facade replacement.
- Browser API access constrained to the same-origin `/platform/c009` facade.

## Commands

```bash
npm install
npm run lint
npm run test:boundary
npm run test:c009-staging:optional
npm run build
```

`npm run test:c009-staging` is an opt-in staging check. It requires
`KARIYA_SNS_UI_C009_ORIGIN` and a comma-separated
`KARIYA_SNS_UI_C009_ENDPOINTS` list. Each endpoint must be an approved
same-origin `/platform/c009/...` route; the script rejects absolute upstream
URLs and response payloads containing internal-only fields.

## Boundary Rules

- Browser code must not call K-SNS or KAI internal service URLs directly.
- Browser code must not contain service tokens, connector secrets, or internal
  URLs.
- Raw model traces, prompts, and reasoning fields are prohibited in UI payloads.
- Decision and enforcement actions are displayed only as pending approval
  states when present; this UI does not execute enforcement.

## Deployment

The app is configured for standalone Next.js output and is intended for CT119.
Runtime deployment configuration should provide any future server-side upstream
values through non-public environment variables only.
