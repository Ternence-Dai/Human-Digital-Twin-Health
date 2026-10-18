# Human Digital Twin & Personal Health Data Platform

> 人体数字孪生与个人健康数据平台

A privacy-first personal health data platform for longitudinal observations, transparent visualizations, explainable trends, and interoperable records. It is not a diagnostic or treatment system.

## Product modules

- Health profile and consent-aware data ownership
- Longitudinal measurements and source provenance
- Import/export and standards-oriented data adapters
- Trend visualizations with missing-data handling
- Explainable rules and configurable alerts
- Audit trail, privacy controls, and synthetic demo-data isolation

## Engineering principles

Demo data must be unmistakably labelled and segregated. No clinical claims or diagnosis. Preserve units, timestamps, source, and uncertainty; validate calculations and access controls.

- Modular, typed, documented code; no monolithic application entry point.
- Reproducible setup, deterministic tests, and automated quality checks.
- Secure configuration: secrets belong in environment variables or managed secret stores, never in source control.
- Accessible, responsive interface with clear loading, empty, error, and offline states.
- Open-source components are evaluated for maintenance, license compatibility, security, and fit before adoption.

## Delivery status

The modernization work is being applied directly to `main`. The verified data slice validates each observation's metric, finite value, unit, timezone-qualified timestamp, source, and provenance class (`measured`, `reported`, `estimated`, `imported`, or `demo`). Manual entry now requires an explicit quality choice and never defaults a new value to `measured`; helper text distinguishes direct measurement, self-report, estimates, imports and synthetic demo data. The records UI uses the shared chronological sorter, keeps newest observations visible first, and has recovery-protected local JSON import/export. The V3 interface is now a light, responsive health-data workspace with a rebuilt navigation rail, dashboard, metric cards, observation form/list, and mobile tab bar. Demo scores and static organ/vascular/meridian displays remain explicitly labelled as illustrative, not clinical assessments. CI, tests, build, and Pages deployment are being re-run against this interface revision.

Remaining delivery work includes broader browser-level testing, consent and access-control workflows, secure backup/retention/deletion design, interoperability adapters, and validation with real user-approved source data. Storage is local to the current browser; it is not yet a synchronized clinical record service. The symptom helper is a local keyword-based aid, not an AI diagnosis or treatment system.

See [the rebuild plan](docs/REBUILD_PLAN.md) and [domain rules, units and validation boundaries](docs/DOMAIN_CORE.md).
