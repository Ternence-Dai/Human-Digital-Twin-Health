# Health observation domain core

The first rebuild slice establishes a provenance-first observation model. Every accepted datum carries a metric, finite numeric value, unit, observation timestamp, source, and explicit quality class.

## Observation contract

`createObservation(input)` validates and returns an immutable normalized record.

| Field | Contract |
|---|---|
| `metric` | Non-empty text; whitespace is trimmed |
| `value` | Finite JavaScript number |
| `unit` | Non-empty text; whitespace is trimmed |
| `observedAt` | ISO timestamp with an explicit timezone; precision is limited to milliseconds |
| `source` | Non-empty provenance text; whitespace is trimmed |
| `quality` | One of `measured`, `reported`, `estimated`, `imported`, or `demo` |

Accepted timestamps are normalized to canonical UTC ISO strings. Impossible calendar dates, invalid offsets, timestamps without a timezone, and values with precision that JavaScript would silently truncate are rejected.

`chronologicalObservations(rows)` requires an array of observation-like rows with valid timestamps and returns a chronologically sorted array without sorting the caller's original array in place. Callers should use `createObservation` when they need full field/provenance validation.

## Provenance and presentation

- Measured, reported, estimated, imported and demo observations must remain distinguishable in storage and UI.
- Never convert demo values into measured observations or silently merge data with different provenance.
- Sorting or charting must preserve the original value, unit, timestamp and source; timezone conversion must not shift date-only values into another calendar day.
- A local browser record is not automatically synchronized to a server or another device.

## Privacy and safety

- This domain module is a data-validation component, not a diagnostic or treatment engine.
- It does not infer clinical normal ranges, diagnose disease, triage emergencies, or recommend a medication or treatment.
- Do not commit identifiable health records, access tokens or secrets.
- A production service must add consent, access controls, retention/deletion policy, audit trails, and encryption appropriate to its threat model.
- Exported backups may contain sensitive health information and must be handled accordingly.

## Verification boundary

The domain tests cover provenance classes, required fields, timezone normalization, calendar validation, millisecond precision, and chronological sorting. These tests establish data-contract behaviour; they do not establish clinical validity or medical safety.
