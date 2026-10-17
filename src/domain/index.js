const allowedQuality = new Set(["measured","reported","estimated","imported","demo"]);
export function createObservation(input) {
  if (!input || typeof input !== "object") throw new TypeError("observation must be an object");
  const { metric, value, unit, observedAt, source, quality } = input;
  if (typeof metric !== "string" || !metric.trim()) throw new TypeError("metric is required");
  if (!Number.isFinite(value)) throw new TypeError("value must be finite");
  if (typeof unit !== "string" || !unit.trim()) throw new TypeError("unit is required");
  if (typeof observedAt !== "string" || !observedAt.trim() || !Number.isFinite(Date.parse(observedAt))) throw new TypeError("observedAt must be a valid date string");
  if (typeof source !== "string" || !source.trim()) throw new TypeError("source is required");
  if (!allowedQuality.has(quality)) throw new RangeError("quality must identify the provenance class");
  return Object.freeze({ metric:metric.trim(), value, unit:unit.trim(), observedAt:new Date(observedAt).toISOString(), source:source.trim(), quality });
}
export function chronologicalObservations(observations) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  const validated = observations.map((row) => {
    if (!row || typeof row !== "object" || typeof row.observedAt !== "string" || !Number.isFinite(Date.parse(row.observedAt))) {
      throw new TypeError("every observation must contain a valid observedAt date string");
    }
    return row;
  });
  return validated.sort((a,b) => Date.parse(a.observedAt)-Date.parse(b.observedAt));
}
