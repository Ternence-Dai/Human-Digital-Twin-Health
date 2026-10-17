import test from "node:test";
import assert from "node:assert/strict";
import { createObservation, chronologicalObservations } from "../src/domain/index.js";
const valid = {metric:"resting-heart-rate",value:62,unit:"bpm",observedAt:"2026-01-01T00:00:00Z",source:"wearable",quality:"measured"};
test("stores explicit provenance and canonical timestamp", () => assert.equal(createObservation(valid).quality,"measured"));
test("rejects missing provenance and invalid measurements", () => {
 assert.throws(() => createObservation({...valid,source:""}), TypeError);
 assert.throws(() => createObservation({...valid,value:Infinity}), TypeError);
 assert.throws(() => createObservation({...valid,quality:"unknown"}), RangeError);
});
test("sorts a copy without mutating input", () => {
 const rows=[valid,{...valid,observedAt:"2025-01-01T00:00:00Z"}];
 const sorted=chronologicalObservations(rows);
 assert.equal(sorted[0].observedAt,"2025-01-01T00:00:00Z");
 assert.equal(rows[0],valid);
});
