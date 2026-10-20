const allowedQuality = new Set(["measured","reported","estimated","imported","demo"]);

function parseObservedAt(value) {
  if (typeof value !== "string") throw new TypeError("observedAt must be an ISO timestamp with an explicit timezone");
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw new TypeError("observedAt must be an ISO timestamp with an explicit timezone");
  const [, yearText, monthText, dayText, , , , zone, sign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new TypeError("observedAt contains an invalid calendar date");
  }
  if (zone !== "Z") {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetMinute > 59 || offsetHour > 14 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new TypeError("observedAt contains an invalid timezone offset");
    }
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("observedAt must be a valid ISO timestamp");
  const canonicalDate = new Date(timestamp);
  // Keep canonical values inside the four-digit year format accepted by this parser.
  // Otherwise a valid offset near a calendar boundary could normalize to an
  // extended-year ISO string that this same module cannot read back.
  const utcYear = canonicalDate.getUTCFullYear();
  if (utcYear < 0 || utcYear > 9999) throw new TypeError("observedAt normalizes outside the supported UTC year range");
  return canonicalDate.toISOString();
}

export function createObservation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("observation must be an object");
  const { metric, value, unit, observedAt, recordedAt, source, quality } = input;
  if (typeof metric !== "string" || !metric.trim()) throw new TypeError("metric is required");
  if (metric.trim().length > 80) throw new RangeError("metric must not exceed 80 characters");
  if (/[\x00-\x1F\x7F]/.test(metric)) throw new TypeError("metric must not contain control characters");
  if (!Number.isFinite(value)) throw new TypeError("value must be finite");
  if (typeof unit !== "string" || !unit.trim()) throw new TypeError("unit is required");
  if (unit.trim().length > 24) throw new RangeError("unit must not exceed 24 characters");
  if (/[\x00-\x1F\x7F]/.test(unit)) throw new TypeError("unit must not contain control characters");
  const canonicalObservedAt = parseObservedAt(observedAt);
  // Ingestion time is distinct from measurement time: a manually backfilled
  // reading must retain when it was entered, not appear to have been entered
  // at the time it was measured. Keep this optional for legacy backup files.
  const canonicalRecordedAt = recordedAt === undefined ? undefined : parseObservedAt(recordedAt);
  if (typeof source !== "string" || !source.trim()) throw new TypeError("source is required");
  if (source.trim().length > 180) throw new RangeError("source must not exceed 180 characters");
  if (/[\x00-\x1F\x7F]/.test(source)) throw new TypeError("source must not contain control characters");
  if (!allowedQuality.has(quality)) throw new RangeError("quality must identify the provenance class");
  const observation = {
    metric:metric.trim(), value, unit:unit.trim(), observedAt:canonicalObservedAt,
    source:source.trim(), quality
  };
  if (canonicalRecordedAt !== undefined) observation.recordedAt = canonicalRecordedAt;
  return Object.freeze(observation);
}

export function chronologicalObservations(observations) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  // Sorting is also a trust boundary: validate and canonicalize every field,
  // not just the timestamp, before exposing records to charts or summaries.
  const validated = observations.map((row) => createObservation(row));
  return validated.sort((a,b) => Date.parse(a.observedAt)-Date.parse(b.observedAt));
}


// A measurement is a duplicate only when its value, unit, timestamp and provenance all match.
export function observationIdentity(observation) {
  // Measurement identity deliberately excludes ingestion time: entering the
  // same observation twice at different moments must still be deduplicated.
  // The record-entry timestamp remains part of the immutable backup snapshot
  // checked by mergeObservationHistories below.
  const validated = createObservation(observation);
  return JSON.stringify([
    validated.metric, validated.value, validated.unit,
    validated.observedAt, validated.source, validated.quality
  ]);
}

// Duplicate detection is scoped to the current authoritative versions. A
// superseded or voided event remains in the audit trail, but must not prevent
// a user from entering a newly verified measurement with the same content.
export function hasActiveObservationDuplicate(history, candidate) {
  const rows = normalizeObservationHistory(history);
  const candidateIdentity = observationIdentity(candidate);
  return rows.some(row =>
    row.recordState === "active" &&
    observationIdentity(row) === candidateIdentity
  );
}

function observationSnapshotIdentity(observation) {
  const { recordState, ...snapshot } = observation;
  return JSON.stringify(snapshot);
}

function observationMeasurementSnapshotIdentity(observation) {
  const {
    recordState, voidReason, voidedBy, voidedAt, ...snapshot
  } = observation;
  return JSON.stringify(snapshot);
}


const observationVersionStates = new Set(["active", "superseded", "voided"]);
function requiredObservationAuditText(value, field, maxLength = 240) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(field + " is required");
  const text = value.trim();
  if (text.length > maxLength) throw new RangeError(field + " exceeds " + maxLength + " characters");
  if (/[\x00-\x1F\x7F]/.test(text)) throw new TypeError(field + " must not contain control characters");
  return text;
}

function buildObservationEvent(row, index, allowLegacyId) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new TypeError("observation history entries must be objects");
  }
  const base = createObservation(row);
  const id = row.id === undefined && allowLegacyId
    ? "legacy-observation-" + String(index + 1).padStart(6, "0")
    : requiredObservationAuditText(row.id, "observation id", 120);
  const recordState = row.recordState === undefined && allowLegacyId
    ? "active" : row.recordState;
  if (!observationVersionStates.has(recordState)) {
    throw new RangeError("observation recordState must be active, superseded or voided");
  }
  const event = { ...base, id, recordState };

  if (row.previousVersionId !== undefined) {
    event.previousVersionId = requiredObservationAuditText(row.previousVersionId, "previousVersionId", 120);
  }
  if (row.amendmentReason !== undefined) {
    event.amendmentReason = requiredObservationAuditText(row.amendmentReason, "amendmentReason", 1000);
  }
  if (row.amendedBy !== undefined) {
    event.amendedBy = requiredObservationAuditText(row.amendedBy, "amendedBy", 120);
  }
  if (row.amendedAt !== undefined) event.amendedAt = parseObservedAt(row.amendedAt);
  if (row.voidReason !== undefined) {
    event.voidReason = requiredObservationAuditText(row.voidReason, "voidReason", 1000);
  }
  if (row.voidedBy !== undefined) {
    event.voidedBy = requiredObservationAuditText(row.voidedBy, "voidedBy", 120);
  }
  if (row.voidedAt !== undefined) event.voidedAt = parseObservedAt(row.voidedAt);
  return Object.freeze(event);
}

export function validateObservationHistory(history) {
  if (!Array.isArray(history)) throw new TypeError("observation history must be an array");
  const rows = history.map((row, index) => buildObservationEvent(row, index, false));
  const byId = new Map();
  const children = new Map();

  for (const row of rows) {
    if (byId.has(row.id)) throw new RangeError("observation ids must be unique");
    byId.set(row.id, row);
    if (row.previousVersionId) {
      if (row.previousVersionId === row.id) throw new RangeError("observation cannot reference itself as a previous version");
      if (!row.amendmentReason || !row.amendedBy || !row.amendedAt) {
        throw new TypeError("amended observations require reason, actor and amendment time");
      }
      if (children.has(row.previousVersionId)) {
        throw new RangeError("an observation version can have only one direct successor");
      }
      children.set(row.previousVersionId, row.id);
    } else if (row.amendmentReason !== undefined || row.amendedBy !== undefined || row.amendedAt !== undefined) {
      throw new TypeError("amendment audit fields require previousVersionId");
    }
    if (row.recordState === "voided") {
      if (!row.voidReason || !row.voidedBy || !row.voidedAt) {
        throw new TypeError("voided observations require reason, actor and void time");
      }
      if (row.recordedAt && Date.parse(row.voidedAt) < Date.parse(row.recordedAt)) {
        throw new RangeError("void time cannot precede the observation record-entry time");
      }
    } else if (row.voidReason !== undefined || row.voidedBy !== undefined || row.voidedAt !== undefined) {
      throw new TypeError("void audit fields are only valid on voided observations");
    }
  }

  for (const row of rows) {
    const successorId = children.get(row.id);
    if (row.recordState === "superseded" && !successorId) {
      throw new RangeError("superseded observations must reference a replacement version");
    }
    if (row.recordState === "active" && successorId) {
      throw new RangeError("an observation with a successor cannot remain active");
    }
    if (row.recordState === "voided" && successorId) {
      throw new RangeError("a voided observation cannot have a replacement successor");
    }
    if (row.previousVersionId) {
      const previous = byId.get(row.previousVersionId);
      if (!previous) throw new RangeError("observation previous version does not exist");
      if (previous.recordState !== "superseded") {
        throw new RangeError("previous observation version must be marked superseded");
      }
      if (previous.metric !== row.metric) {
        throw new RangeError("an amendment must retain the original observation metric");
      }
      if (previous.recordedAt && Date.parse(row.amendedAt) < Date.parse(previous.recordedAt)) {
        throw new RangeError("amendment time cannot precede the previous record-entry time");
      }
      if (previous.amendedAt && Date.parse(row.amendedAt) < Date.parse(previous.amendedAt)) {
        throw new RangeError("amendment time cannot precede the previous version's amendment time");
      }
      if (row.recordedAt && Date.parse(row.recordedAt) > Date.parse(row.amendedAt)) {
        throw new RangeError("replacement record-entry time cannot follow its amendment time");
      }
    }
  }

  for (const row of rows) {
    const visited = new Set([row.id]);
    let cursor = row;
    while (cursor.previousVersionId) {
      if (visited.has(cursor.previousVersionId)) throw new RangeError("observation version history cannot contain cycles");
      visited.add(cursor.previousVersionId);
      cursor = byId.get(cursor.previousVersionId);
      if (!cursor) break;
    }
  }
  return Object.freeze(rows);
}

export function normalizeObservationHistory(history) {
  if (!Array.isArray(history)) throw new TypeError("observation history must be an array");
  const events = history.map((row, index) => buildObservationEvent(row, index, true));
  return validateObservationHistory(events);
}

export function amendObservation(history, targetId, replacement, amendmentReason, amendedBy, amendedAt, newId) {
  const current = normalizeObservationHistory(history);
  const target = current.find(row => row.id === targetId);
  if (!target) throw new RangeError("observation to amend was not found");
  if (target.recordState !== "active") throw new RangeError("only an active observation can be amended");
  const id = requiredObservationAuditText(newId, "new observation id", 120);
  if (current.some(row => row.id === id)) throw new RangeError("new observation id already exists");
  const reason = requiredObservationAuditText(amendmentReason, "amendment reason", 1000);
  const actor = requiredObservationAuditText(amendedBy, "amendment actor", 120);
  const timestamp = parseObservedAt(amendedAt);
  if (Date.parse(timestamp) < Date.parse(target.observedAt)) {
    throw new RangeError("amendment time cannot precede the original observation time");
  }
  const base = createObservation({
    ...replacement,
    recordedAt: replacement && replacement.recordedAt !== undefined ? replacement.recordedAt : timestamp
  });
  if (base.metric !== target.metric) {
    throw new RangeError("an amendment must retain the original observation metric");
  }
  const updated = current.map(row => row.id === target.id
    ? Object.freeze({ ...row, recordState: "superseded" })
    : row);
  const next = Object.freeze({
    ...base,
    id,
    recordState: "active",
    previousVersionId: target.id,
    amendmentReason: reason,
    amendedBy: actor,
    amendedAt: timestamp
  });
  return validateObservationHistory([...updated, next]);
}

export function voidObservation(history, targetId, voidReason, voidedBy, voidedAt) {
  const current = normalizeObservationHistory(history);
  const target = current.find(row => row.id === targetId);
  if (!target) throw new RangeError("observation to void was not found");
  if (target.recordState !== "active") throw new RangeError("only an active observation can be voided");
  const reason = requiredObservationAuditText(voidReason, "void reason", 1000);
  const actor = requiredObservationAuditText(voidedBy, "void actor", 120);
  const timestamp = parseObservedAt(voidedAt);
  const updated = current.map(row => row.id === target.id
    ? Object.freeze({ ...row, recordState: "voided", voidReason: reason, voidedBy: actor, voidedAt: timestamp })
    : row);
  return validateObservationHistory(updated);
}

export function mergeObservationHistories(existingHistory, importedHistory) {
  const existing = normalizeObservationHistory(existingHistory);
  const imported = normalizeObservationHistory(importedHistory);
  const merged = [...existing];
  const indexes = new Map(merged.map((row, index) => [row.id, index]));
  for (const incoming of imported) {
    if (!indexes.has(incoming.id)) {
      if (incoming.recordState === "active" && merged.some(row =>
        row.recordState === "active" &&
        observationIdentity(row) === observationIdentity(incoming)
      )) {
        throw new RangeError("imported active observation duplicates an existing measurement under a different record id");
      }
      indexes.set(incoming.id, merged.length);
      merged.push(incoming);
      continue;
    }
    const index = indexes.get(incoming.id);
    const current = merged[index];
    // The same ID must retain every immutable source/audit field even
    // though an imported version may legitimately advance recordState from
    // active to superseded. This catches changed recordedAt and amendment data.
    if (observationSnapshotIdentity(current) !== observationSnapshotIdentity(incoming)) {
      const sameMeasurementSnapshot =
        observationMeasurementSnapshotIdentity(current) === observationMeasurementSnapshotIdentity(incoming);
      const isAuditedVoidTransition = current.recordState === "active" &&
        incoming.recordState === "voided" && sameMeasurementSnapshot;
      const isStaleActiveCopy = current.recordState === "voided" &&
        incoming.recordState === "active" && sameMeasurementSnapshot;
      if (!isAuditedVoidTransition && !isStaleActiveCopy) {
        throw new RangeError("observation id collision: imported record content does not match the existing version");
      }
    }
    if (current.recordState !== incoming.recordState) {
      if (current.recordState === "active" && incoming.recordState !== "active") {
        merged[index] = incoming;
      } else if (incoming.recordState !== "active") {
        throw new RangeError("conflicting non-active observation version states in imported history");
      }
    }
  }
  return validateObservationHistory(merged);
}
