# Alpha 1 Visible Demo Path

This path shows the merged K-SNS lifecycle without claiming production connector readiness.

## Local services

1. Start K-SNS backend from `kariya-sns` with its normal local database configuration.
2. Run migrations; the merged lifecycle stack has Alembic head `m7_sns_004`.
3. Start K-SNS UI with:

```bash
NEXT_PUBLIC_KSNS_API_URL=http://localhost:8000/api/v1 NEXT_PUBLIC_KSNS_TENANT_ID=<tenant-uuid> npm run dev
```

On Windows PowerShell:

```powershell
$env:NEXT_PUBLIC_KSNS_API_URL="http://localhost:8000/api/v1"
$env:NEXT_PUBLIC_KSNS_TENANT_ID="<tenant-uuid>"
npm run dev
```

## Lifecycle flow

1. Ingest one Alpha 1 event through the UI-safe demo path:

```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  --data @../kariya-sns/docs/api/examples/ingestion/source-kea.json
```

2. Confirm normalized event visibility:

```bash
curl http://localhost:8000/api/v1/events
```

3. Confirm trust/risk movement:

```bash
curl http://localhost:8000/api/v1/trust/score
curl http://localhost:8000/api/v1/trust/movement-summary
```

4. Confirm decisions and KAI explanation surface:

```bash
curl http://localhost:8000/api/v1/decisions
curl http://localhost:8000/api/v1/explanations
```

5. Open K-SNS UI:

- `http://localhost:3010/overview`
- `http://localhost:3010/incidents`
- `http://localhost:3010/actions`
- `http://localhost:3010/evidence-graph`

6. For an incident returned by K-SNS, open:

```text
http://localhost:3010/incidents/<incident-id>
```

The incident detail page reads:

- `GET /api/v1/lifecycle/incidents/{incident_id}`
- `GET /api/v1/lifecycle/evidence/{incident_id}`
- `GET /api/v1/lifecycle/incidents/{incident_id}/kai-explanation-payload`

## Honest Alpha 1 boundaries

- K-SNS orchestrates lifecycle state and records decisions/actions.
- KAI explains and supplies explanation payload references.
- KES/KEA/connectors enforce only where those integrations are implemented.
- Dispatch, verification, connector readiness, and action success remain pending or unavailable unless returned by K-SNS.
- The UI does not fabricate telemetry, action success, verification success, or connector readiness.