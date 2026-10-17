# Rebuild plan — 人体数字孪生与个人健康数据平台

## Product intent

A privacy-first personal health data platform for longitudinal observations, transparent visualizations, explainable trends, and interoperable records. It is not a diagnostic or treatment system.

## Target capabilities

1. Health profile and consent-aware data ownership
2. Longitudinal measurements and source provenance
3. Import/export and standards-oriented data adapters
4. Trend visualizations with missing-data handling
5. Explainable rules and configurable alerts
6. Audit trail, privacy controls, and synthetic demo-data isolation

## Non-negotiable correctness and safety gates

Demo data must be unmistakably labelled and segregated. No clinical claims or diagnosis. Preserve units, timestamps, source, and uncertainty; validate calculations and access controls.

## Delivery sequence

1. Inventory current behavior, assets, data formats, and dependencies.
2. Define domain model, API contracts, permissions, and migration/import strategy.
3. Implement the smallest end-to-end vertical slice with typed interfaces.
4. Add unit, integration, and browser-level tests for critical workflows.
5. Add CI, security/dependency scanning, and reproducible build instructions.
6. Validate with reference datasets and document known limitations.
7. Review deployment, backup, recovery, and release process before production use.

## Open-source adoption policy

For each dependency or reference project, record its repository URL, license, maintenance activity, security posture, exact component being reused or adapted, and attribution obligations. Prefer stable standards and small interoperable components over copying whole applications.

## Status

- [ ] Existing repository and data audit complete
- [ ] Domain model and architecture approved
- [ ] Core vertical slice implemented
- [ ] Critical workflows tested
- [ ] CI and security checks passing
- [ ] Deployment and backup procedure verified
- [ ] Release candidate reviewed
