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

The modernization work is being applied directly to `main`. The current baseline includes a domain-core module, automated domain tests, standalone-app validation, and a GitHub Pages deployment workflow. These checks passing confirms the current baseline is buildable; it does **not** mean the full product rebuild is complete.

Remaining delivery work includes validating the existing application workflows and data, extracting maintainable modules from the legacy entry point, adding migration-safe persistence and import/export checks, and documenting verified domain rules. Existing user data and the legacy application must be preserved while these changes are introduced.

See [the rebuild plan](docs/REBUILD_PLAN.md).
