# C-009 Facade Readiness

The K-SNS UI bootstrap remains a Cloud-owned presentation layer. It does not
implement K-SNS trust scoring, decisioning, incident correlation, SOC
automation, KAI reasoning, endpoint logic, or edge enforcement.

## Data Loading

Application pages read operator data through `src/lib/portalData.ts`.
The current implementation returns typed preview data while preserving a single
replacement point for future approved facade consumption.

## Staging Verification

Use the optional staging verifier only with approved Cloud facade routes:

```bash
KARIYA_SNS_UI_C009_ORIGIN=https://sns.kariya.ca \
KARIYA_SNS_UI_C009_ENDPOINTS=/platform/c009/example \
npm run test:c009-staging
```

The verifier enforces:

- Endpoints must be same-origin `/platform/c009/...` paths.
- Absolute upstream URLs are rejected.
- Responses must be JSON.
- Payloads must not expose internal service credentials, connector secrets,
  internal URLs, raw traces, prompts, or raw reasoning fields.

The verifier does not define new platform contract paths. Approved endpoint
names must come from the accepted C-009 facade contract or a reviewed Cloud BFF
implementation.
