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
- The manual-entry form begins with no quality selected. A user must deliberately select the provenance class; it must never silently default a manual value to measured.
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



Observation metadata is bounded at the domain boundary: metric labels are limited to 80 characters, units to 24, and source labels to 180. Control characters are rejected. These limits protect imported as well as manually entered records; they do not establish that a metric's unit is clinically appropriate. Metric-specific unit registries and validated conversions must be introduced before automated aggregation across different units.

## Open-source architecture references

- [HAPI FHIR](https://github.com/hapifhir/hapi-fhir) and [OpenMRS](https://github.com/openmrs/openmrs-core) are reference points for interoperable health-resource structures, identifiers, provenance, and explicit clinical-data boundaries. This browser-local project is not yet a FHIR server and must not imply clinical-system interoperability until adapters and conformance tests exist.
- [SMART Health IT](https://github.com/smart-on-fhir) provides a useful reference for consent-aware authorization and scoped health-data access. It informs future access-control design; no OAuth/SMART workflow is claimed as implemented.
- The current observation contract deliberately keeps measured, reported, estimated, imported, and demo records distinct. Reference implementations inform future resource mapping, not clinical interpretation or default normal ranges.


## FHIR R4 export boundary

`toFhirObservation(observation, mapping)` converts one validated numeric observation to a FHIR R4 `Observation` resource. It preserves the measurement time as `effectiveDateTime`, the entry time (when present) as `issued`, the numeric value as `valueQuantity`, and the local source/quality provenance in caller-configured extensions.

The adapter deliberately requires the caller to supply:
- A FHIR Observation status and subject reference.
- A terminology coding for the observation (for example, a reviewed LOINC mapping).
- A unit coding (for example, a reviewed UCUM code).
- Two distinct canonical extension URLs for source and quality.

It never guesses a patient/device identity, LOINC code, UCUM code, clinical status, or canonical extension namespace. Implementers must publish and govern the extension definitions and terminology mappings before exchanging resources with another organization. A local JSON export is not evidence of a connected FHIR server, patient consent, authorization, or production interoperability. Voided records require `entered-in-error`; superseded versions require an explicit `amended` or `corrected` status.
