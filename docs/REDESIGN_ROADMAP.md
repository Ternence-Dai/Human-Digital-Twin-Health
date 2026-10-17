# Human Digital Twin — Deep Redesign Roadmap

> Status: discovery and architecture baseline. This is a wellness and personal-data product plan, not a medical-device claim.

## Product vision
Rebuild the current single-page experience as a privacy-first personal health data workspace that helps users understand longitudinal trends, context, and questions to discuss with qualified clinicians.

## Product pillars
1. **Personal data vault** — consent-aware imports, source attribution, timestamps, units, and user-controlled retention/export/deletion.
2. **Longitudinal timeline** — observations, activity, sleep, and user-entered context with clear provenance and missing-data visibility.
3. **Digital-twin profile** — transparent descriptive state, not a diagnosis or a claim to reproduce the human body.
4. **Explainable insights** — trend summaries with date range, source, uncertainty, and limitations; avoid causal conclusions from correlation.
5. **Care preparation** — user-approved summaries and questions for appointments, never autonomous treatment decisions.

## Proposed architecture
- Frontend: TypeScript + React/Vite, accessible visualization components.
- Domain model: Observation, Metric, Source, Consent, Profile, Insight, ExportJob.
- Backend: authenticated API, strict authorization, encryption in transit/at rest, audit events, data minimization.
- Analytics: deterministic trend calculations first; AI summaries only over explicitly selected records and with provenance.
- Testing: schema/unit tests, authorization tests, privacy regression tests, Playwright workflows.

## Redesign workstreams
### P0 — data and privacy audit
- Inventory existing inputs, sample/demo data, browser storage, network requests, and third-party scripts.
- Identify personal identifiers and remove unnecessary public contact metadata.
- Classify data sensitivity; do not upload real health data to third-party services without explicit informed consent.
- Define retention, export, deletion, and consent behavior before persistent storage.

### P1 — reliable health data foundation
- Normalize units and timestamps while retaining original values and source records.
- Distinguish measured, user-entered, imported, estimated, and synthetic/demo data.
- Validate ranges without silently discarding unusual values.
- Implement per-user access control and audit logging before multi-user deployment.

### P2 — user-centered experience
- Redesign around Overview / Timeline / Metrics / Insights / Data Sources / Privacy.
- Provide configurable date ranges, trend context, source drill-down, accessible charts, and clear empty/error states.
- Make consent and data controls discoverable, not buried in settings.

### P3 — bounded AI assistance
- Generate summaries only from user-selected, traceable data.
- Cite the underlying observations and date ranges in each insight.
- Flag missing/conflicting data and uncertainty.
- Never diagnose, prescribe, or recommend changing medication/treatment.

## Acceptance criteria
- Every displayed metric includes unit, timestamp, and provenance.
- User can inspect, export, and delete their data.
- Authorization tests prove one user cannot access another user's records.
- AI summaries are traceable to source observations and clearly non-diagnostic.
- No real personal health information appears in fixtures, logs, screenshots, or public demos.
- CI and privacy/security checks pass before merge.

## Non-goals / safeguards
- No medical diagnosis, treatment recommendation, or emergency triage claims.
- No fabricated health measurements or misleading risk scores.
- No persistent sensitive data without explicit consent and documented controls.
