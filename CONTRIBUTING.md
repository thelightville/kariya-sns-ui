# Contributing to K-SNS UI (kariya-sns-ui)

Thank you for contributing to the K-SNS SOC Operations UI. This document
defines the development workflow, coding standards, and PR requirements.

All work must follow the **[Kariya Engineering Governance](https://github.com/thelightville/kariya-governance)**,
in particular ADR-0011 (K-SNS Repository Strategy), ADR-0016 (Platform
Convergence), and ADR-0019 (K-SNS Dedicated UI Architecture).

---

## Development Environment

### Requirements

- Node.js 20+
- npm 10+

### Setup

```bash
cp .env.example .env.local   # configure server-side K_SNS_BASE_URL
npm install
npm run dev                   # http://localhost:3010
```

---

## Coding Standards

### TypeScript

- **Strict TypeScript** — no `any` without a justification comment.
- **Functional components only** — no class components.
- **ESLint** — run `npm run lint` before commit.

### Product boundary — read this before adding any action button

K-SNS is a coordination/decision-recommendation hub, **not** an enforcement
system (ADR-0016, decision D-02). Concretely:

- Never add copy or a control that implies K-SNS or KAI directly executes,
  enforces, or blocks something. Approved verbs are **Approve**, **Reject**,
  and **Request Action**.
- Every actionable control (accepting a recommendation, approving a
  decision, activating a policy) must be built using
  `src/components/ApprovalAction.tsx`. Do not build a bespoke button for an
  action flow — extend `ApprovalAction` if you need a new intent, and get
  the intent's copy reviewed against ADR-0016 before merging.
- If you are unsure whether a piece of UI copy crosses this line, default to
  the more conservative recommendation-only phrasing and flag it in the PR
  description.

### Architecture Constraints

- `kariya-sns-ui` is a **presentation layer** over the K-SNS C-009 API. It
  must not implement trust scoring, incident correlation, detection, or
  enforcement logic locally.
- All K-SNS data access goes through `src/lib/ksnsPlatformClient.ts`. Do not
  add ad hoc `fetch` calls to K-SNS endpoints elsewhere in the app.
- Displaying a K-SNS value received from the API is permitted. Recalculating
  it locally is not.
- Never fabricate mock data in place of a failed API call. Use `EmptyState`
  (or `ComingSoon` for genuinely unimplemented features) instead.

---

## Git Workflow

### Branch Strategy

- `main` — stable, production-ready. Never commit directly.
- `feat/*` — new features. Branch from `main`, PR back to `main`.
- `fix/*` — bug fixes. Branch from `main`.
- `docs/*` — documentation changes only.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(decisions): add decision approval list
fix(auth): correct sns_token cookie maxAge
docs(readme): add deployment instructions
chore(deps): bump next to 14.2.5
```

---

## PR Requirements

Before opening a PR:

- [ ] `npm run lint` produces zero errors
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] No credentials in diff
- [ ] Any new action control uses `ApprovalAction` and uses only
      Approve/Reject/Request Action language

---

## Security Rules

- **No credentials in source code.** Use `.env.local` (gitignored).
- **No client-side secrets.** Environment variables exposed to the browser
  (`NEXT_PUBLIC_*`) must not contain secrets.
- Never hard-code API URLs, tenant IDs, or auth tokens.
- Browser code must call the same-origin `/api/ksns` BFF, not the raw K-SNS
  backend URL. Keep `K_SNS_BASE_URL` server-side only.
- The K-SNS JWT lives only in the httpOnly `sns_token` cookie — never store
  it in localStorage, sessionStorage, or a client-readable cookie.
