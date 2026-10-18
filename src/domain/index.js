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
  const { metric, value, unit, observedAt, source, quality } = input;
  if (typeof metric !== "string" || !metric.trim()) throw new TypeError("metric is required");
  if (metric.trim().length > 80) throw new RangeError("metric must not exceed 80 characters");
  if (/[\x00-\x1F\x7F]/.test(metric)) throw new TypeError("metric must not contain control characters");
  if (!Number.isFinite(value)) throw new TypeError("value must be finite");
  if (typeof unit !== "string" || !unit.trim()) throw new TypeError("unit is required");
  if (unit.trim().length > 24) throw new RangeError("unit must not exceed 24 characters");
  if (/[\x00-\x1F\x7F]/.test(unit)) throw new TypeError("unit must not contain control characters");
  const canonicalObservedAt = parseObservedAt(observedAt);
  if (typeof source !== "string" || !source.trim()) throw new TypeError("source is required");
  if (source.trim().length > 180) throw new RangeError("source must not exceed 180 characters");
  if (/[\x00-\x1F\x7F]/.test(source)) throw new TypeError("source must not contain control characters");
  if (!allowedQuality.has(quality)) throw new RangeError("quality must identify the provenance class");
  return Object.freeze({ metric:metric.trim(), value, unit:unit.trim(), observedAt:canonicalObservedAt, source:source.trim(), quality });
}

export function chronologicalObservations(observations) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  const validated = observations.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new TypeError("every observation must be an object with a valid observedAt timestamp");
    }
    parseObservedAt(row.observedAt);
    return row;
  });
  return validated.sort((a,b) => Date.parse(a.observedAt)-Date.parse(b.observedAt));
}
