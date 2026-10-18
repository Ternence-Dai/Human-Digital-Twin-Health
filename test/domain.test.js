import test from "node:test";
import assert from "node:assert/strict";
import { createObservation, chronologicalObservations } from "../src/domain/index.js";
const valid = {metric:"resting-heart-rate",value:62,unit:"bpm",observedAt:"2026-01-01T00:00:00Z",source:"wearable",quality:"measured"};

test("stores explicit provenance and canonical timestamp", () => assert.equal(createObservation(valid).quality,"measured"));
test("normalizes an explicit timezone offset to UTC", () => {
  assert.equal(createObservation({...valid,observedAt:"2026-01-01T08:00:00+08:00"}).observedAt,"2026-01-01T00:00:00.000Z");
});
test("rejects timestamps without timezone and date-only values", () => {
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01T00:00:00"}), TypeError);
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01"}), TypeError);
});
test("rejects sub-millisecond precision that JavaScript would silently truncate", () => {
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01T00:00:00.1234Z"}), TypeError);
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01T00:00:00.123456789Z"}), TypeError);
  assert.equal(createObservation({...valid,observedAt:"2026-01-01T00:00:00.123Z"}).observedAt,"2026-01-01T00:00:00.123Z");
});
test("rejects impossible calendar dates and invalid timezone offsets", () => {
  assert.throws(() => createObservation({...valid,observedAt:"2026-02-30T00:00:00Z"}), TypeError);
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01T00:00:00+14:30"}), TypeError);
});
test("rejects offsets that normalize outside the supported four-digit UTC year range", () => {
  assert.throws(() => createObservation({...valid,observedAt:"0000-01-01T00:00:00+14:00"}), TypeError);
  assert.throws(() => createObservation({...valid,observedAt:"9999-12-31T23:59:59-14:00"}), TypeError);
});
test("accepts every explicit provenance class while rejecting an unselected quality", () => {
  for (const quality of ["measured", "reported", "estimated", "imported", "demo"]) {
    assert.equal(createObservation({...valid, quality}).quality, quality);
  }
  assert.throws(() => createObservation({...valid, quality:""}), RangeError);
  assert.throws(() => createObservation({...valid, quality:null}), RangeError);
});
test("rejects missing provenance and invalid measurements", () => {
  assert.throws(() => createObservation({...valid,source:""}), TypeError);
  assert.throws(() => createObservation({...valid,value:Infinity}), TypeError);
  assert.throws(() => createObservation({...valid,quality:"unknown"}), RangeError);
  assert.throws(() => createObservation({...valid,observedAt:1767225600000}), TypeError);
});
test("sorts a copy without mutating input", () => {
  const rows=[valid,{...valid,observedAt:"2025-01-01T00:00:00Z"}];
  const sorted=chronologicalObservations(rows);
  assert.equal(sorted[0].observedAt,"2025-01-01T00:00:00Z");
  assert.equal(rows[0],valid);
});
test("rejects malformed rows rather than silently retaining unstable order", () => {
  assert.throws(() => chronologicalObservations([valid,{...valid,observedAt:"not-a-date"}]), TypeError);
  assert.throws(() => chronologicalObservations([valid,{...valid,observedAt:"2026-01-01T00:00:00"}]), TypeError);
  assert.throws(() => chronologicalObservations([null]), TypeError);
});
