import test from "node:test";
import assert from "node:assert/strict";
import { createObservation, chronologicalObservations, normalizeObservationHistory, validateObservationHistory, amendObservation, voidObservation, mergeObservationHistories, hasActiveObservationDuplicate } from "../src/domain/index.js";
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
test("bounds observation text fields and rejects control characters", () => {
  assert.throws(() => createObservation({...valid,metric:"m".repeat(81)}), RangeError);
  assert.throws(() => createObservation({...valid,metric:"heart\nrate"}), TypeError);
  assert.throws(() => createObservation({...valid,unit:"u".repeat(25)}), RangeError);
  assert.throws(() => createObservation({...valid,unit:"bpm\u0000"}), TypeError);
  assert.throws(() => createObservation({...valid,source:"s".repeat(181)}), RangeError);
  assert.throws(() => createObservation({...valid,source:"wearable\u007f"}), TypeError);
});
test("accepts every registered unit for a registered metric", () => {
  assert.equal(createObservation({...valid, unit:"次/分"}).unit, "次/分");
  assert.equal(createObservation({...valid, metric:"heart-rate", unit:"bpm"}).unit, "bpm");
  assert.equal(createObservation({...valid, metric:"blood-pressure", unit:"mmHg"}).unit, "mmHg");
  assert.equal(createObservation({...valid, metric:"body-weight", unit:"公斤"}).unit, "公斤");
});
test("rejects units outside the registry for a registered metric", () => {
  assert.throws(() => createObservation({...valid, unit:"kg"}), RangeError);
  assert.throws(() => createObservation({...valid, metric:"body-weight", unit:"bpm"}), /unit is not valid for metric body-weight/);
});
test("leaves unregistered metrics free-form", () => {
  assert.equal(createObservation({...valid, metric:"research-index", unit:"lab-unit-x"}).unit, "lab-unit-x");
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
  assert.equal(sorted[0].observedAt,"2025-01-01T00:00:00.000Z");
  assert.equal(rows[0],valid);
});
test("chronological sorting rejects malformed measurement values and provenance", () => {
  for (const patch of [
    {metric:""}, {metric:"x".repeat(81)}, {value:NaN},
    {unit:""}, {source:""}, {quality:"unknown"},
  ]) {
    assert.throws(() => chronologicalObservations([{...valid,...patch}]));
  }
  const rows=[{...valid,metric:"  heart-rate  "},{...valid,observedAt:"2025-01-01T00:00:00Z"}];
  const sorted=chronologicalObservations(rows);
  assert.equal(sorted[1].metric,"heart-rate");
  assert.equal(sorted[1].observedAt,"2026-01-01T00:00:00.000Z");
  assert.equal(rows[0].metric,"  heart-rate  ");
});
test("rejects malformed rows rather than silently retaining unstable order", () => {
  assert.throws(() => chronologicalObservations([valid,{...valid,observedAt:"not-a-date"}]), TypeError);
  assert.throws(() => chronologicalObservations([valid,{...valid,observedAt:"2026-01-01T00:00:00"}]), TypeError);
  assert.throws(() => chronologicalObservations([null]), TypeError);
});


test("duplicate detection only considers current active observation versions",()=>{
 const active=normalizeObservationHistory([{...amendmentBase,id:"active-current"}]);
 const sameMeasurement={...amendmentBase,recordedAt:"2026-10-20T04:00:00Z"};
 assert.equal(hasActiveObservationDuplicate(active,sameMeasurement),true,
  "an identical measurement already marked active must be blocked");

 const voided=voidObservation(active,"active-current","Source record was invalidated","reviewer","2026-10-20T05:00:00Z");
 assert.equal(hasActiveObservationDuplicate(voided,sameMeasurement),false,
  "a voided historical observation must not block a newly verified re-entry");

 const amended=amendObservation(active,"active-current",{...amendmentBase,value:64},
  "Corrected transcription","reviewer","2026-10-20T05:00:00Z","active-replacement");
 assert.equal(hasActiveObservationDuplicate(amended,amendmentBase),false,
  "a superseded historical value must not block a new current observation");
 assert.equal(hasActiveObservationDuplicate(amended,{...amendmentBase,value:64}),true,
  "the current replacement must still block an exact duplicate");
});

test("merging refuses active duplicate measurements that have different record IDs",()=>{
 const existing=normalizeObservationHistory([{...amendmentBase,id:"existing-device-record"}]);
 const imported=normalizeObservationHistory([{...amendmentBase,id:"imported-device-record"}]);
 assert.throws(()=>mergeObservationHistories(existing,imported),/duplicates an existing measurement/,
  "cross-device IDs must not create two simultaneously active copies of the same measurement");
 const sameId=mergeObservationHistories(existing,normalizeObservationHistory([{...amendmentBase,id:"existing-device-record"}]));
 assert.equal(sameId.length,1,"the same record ID must remain an idempotent merge");
});

test("observation identity includes measurement value and provenance", async () => {
  const { observationIdentity } = await import("../src/domain/index.js");
  const first = createObservation(valid);
  assert.equal(observationIdentity(first), observationIdentity({...first}));
  for (const change of [
    {value:63}, {unit:"次/分"}, {observedAt:"2026-01-02T00:00:00Z"},
    {source:"manual"}, {quality:"reported"}, {metric:"blood-pressure", unit:"mmHg"}
  ]) {
    assert.notEqual(observationIdentity(first), observationIdentity({...first,...change}));
  }
  assert.equal(observationIdentity(first),
    observationIdentity({...first,recordedAt:"2026-01-02T00:00:00Z"}),
    "record-entry time must not prevent duplicate measurement detection");
  assert.throws(() => observationIdentity(null), TypeError);
  assert.throws(() => observationIdentity({...first, unit:""}), TypeError);
  assert.throws(() => observationIdentity({...first, observedAt:"not-a-date"}), TypeError);
  assert.throws(() => observationIdentity({...first, value:NaN}), TypeError);
  const sameInstant = {...first, observedAt:"2026-01-01T08:00:00+08:00"};
  assert.equal(observationIdentity(first), observationIdentity(sameInstant));
});


test("keeps measurement time separate from record-entry time while preserving legacy observations",()=>{
 const base={metric:"blood-pressure",value:120,unit:"mmHg",
  observedAt:"2026-10-18T08:00:00+08:00",source:"manual",quality:"reported"};
 const legacy=createObservation(base);
 assert.equal(legacy.observedAt,"2026-10-18T00:00:00.000Z");
 assert.equal(Object.hasOwn(legacy,"recordedAt"),false,
  "legacy records without recordedAt remain valid and are not assigned a fabricated entry time");
 const backfilled=createObservation({...base,recordedAt:"2026-10-19T09:30:00+08:00"});
 assert.equal(backfilled.recordedAt,"2026-10-19T01:30:00.000Z");
 assert.notEqual(backfilled.observedAt,backfilled.recordedAt);
 assert.ok(Object.isFrozen(backfilled));
 assert.throws(()=>createObservation({...base,recordedAt:"2026-02-30T09:30:00Z"}),TypeError);
 assert.throws(()=>createObservation({...base,recordedAt:"2026-10-19T09:30:00"}),TypeError);
});


const amendmentBase = {
  metric:"resting-heart-rate", value:62, unit:"bpm",
  observedAt:"2026-10-18T00:00:00Z", recordedAt:"2026-10-18T01:00:00Z",
  source:"wearable", quality:"measured"
};
test("normalizes legacy observations into stable active version records without changing measurements",()=>{
 const rows=normalizeObservationHistory([amendmentBase,{...amendmentBase,metric:"body-weight",value:70,unit:"kg"}]);
 assert.equal(rows[0].id,"legacy-observation-000001");
 assert.equal(rows[1].id,"legacy-observation-000002");
 assert.equal(rows[0].recordState,"active");
 assert.equal(rows[0].value,62);
 assert.equal(rows[0].source,"wearable");
 assert.ok(Object.isFrozen(rows));
 assert.ok(rows.every(Object.isFrozen));
});
test("amends an observation by appending a new version and preserving the original",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 const oldId=original[0].id;
 const amended=amendObservation(original,oldId,{...amendmentBase,value:64,source:"validated wearable export"},
  "Device export corrected after checking original measurement file","reviewer-1",
  "2026-10-19T02:00:00Z","obs-revision-001");
 assert.equal(amended.length,2);
 assert.equal(amended[0].value,62);
 assert.equal(amended[0].recordState,"superseded");
 assert.equal(amended[1].value,64);
 assert.equal(amended[1].recordState,"active");
 assert.equal(amended[1].previousVersionId,oldId);
 assert.equal(amended[1].amendmentReason,"Device export corrected after checking original measurement file");
 assert.equal(amended[1].amendedBy,"reviewer-1");
 assert.equal(amended[1].amendedAt,"2026-10-19T02:00:00.000Z");
 assert.equal(validateObservationHistory(amended).length,2);
 assert.ok(Object.isFrozen(amended[1]));
});
test("supports a chronological multi-step observation version chain",()=>{
 const first=normalizeObservationHistory([amendmentBase]);
 const second=amendObservation(first,first[0].id,{...amendmentBase,value:63},
  "Corrected transcription","operator-1","2026-10-19T02:00:00Z","obs-revision-002");
 const third=amendObservation(second,"obs-revision-002",{...amendmentBase,value:64},
  "Corrected after source file review","reviewer-1","2026-10-20T02:00:00Z","obs-revision-003");
 assert.deepEqual(third.map(row=>row.recordState),["superseded","superseded","active"]);
 assert.equal(third[2].previousVersionId,"obs-revision-002");
 assert.equal(third[1].previousVersionId,third[0].id);
});
test("rejects incomplete, ambiguous or tampered observation amendments",()=>{
 const base=normalizeObservationHistory([amendmentBase]);
 const id=base[0].id;
 assert.throws(()=>amendObservation(base,id,{...amendmentBase,value:63}," ","operator-1","2026-10-19T02:00:00Z","bad-1"),/amendment reason is required/);
 assert.throws(()=>amendObservation(base,id,{...amendmentBase,value:63},"reason"," ","2026-10-19T02:00:00Z","bad-2"),/amendment actor is required/);
 assert.throws(()=>amendObservation(base,id,{...amendmentBase,metric:"blood-pressure",unit:"mmHg"},"reason","operator-1","2026-10-19T02:00:00Z","bad-3"),/retain the original observation metric/);
 assert.throws(()=>amendObservation(base,id,{...amendmentBase,value:63},"reason","operator-1","2026-10-19T02:00:00Z",id),/already exists/);
 const amended=amendObservation(base,id,{...amendmentBase,value:63},"reason","operator-1","2026-10-19T02:00:00Z","obs-revision-004");
 assert.throws(()=>validateObservationHistory([...amended,{...amended[1],id:"obs-revision-005"}]),/only one direct successor/);
 assert.throws(()=>validateObservationHistory([{...amended[0],recordState:"active"},amended[1]]),/cannot remain active/);
 assert.throws(()=>validateObservationHistory([{...amended[1],previousVersionId:"missing-parent"},amended[0]]),/previous version does not exist/);
 assert.throws(()=>validateObservationHistory([
  {...amended[0],previousVersionId:"obs-revision-004",amendmentReason:"cycle",amendedBy:"reviewer",amendedAt:"2026-10-19T02:00:00Z"},
  {...amended[1],recordState:"superseded"}
 ]));
});
test("voids an active observation with a reason while retaining its full measurement and provenance",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 const result=voidObservation(original,original[0].id,"Duplicate of the verified source record","reviewer-2","2026-10-19T03:00:00Z");
 assert.equal(result.length,1);
 assert.equal(result[0].recordState,"voided");
 assert.equal(result[0].voidReason,"Duplicate of the verified source record");
 assert.equal(result[0].voidedBy,"reviewer-2");
 assert.equal(result[0].value,62);
 assert.equal(result[0].source,"wearable");
 assert.throws(()=>voidObservation(result,result[0].id,"again","reviewer-2","2026-10-19T04:00:00Z"),/only an active observation/);
 assert.throws(()=>amendObservation(result,result[0].id,{...amendmentBase,value:63},"reason","reviewer-2","2026-10-19T04:00:00Z","after-void"),/only an active observation/);
});
test("validates void audit time against legacy measurement time when recordedAt is absent",()=>{
 const legacy=normalizeObservationHistory([{...amendmentBase,recordedAt:undefined,id:"legacy-void-time"}]);
 const tampered=[{...legacy[0],recordState:"voided",voidReason:"Invalid source",
  voidedBy:"reviewer",voidedAt:"2026-10-17T23:59:59Z"}];
 assert.throws(()=>validateObservationHistory(tampered),
  /void time cannot precede the observation time/);
});

test("validates amendment audit time against legacy measurement time when recordedAt is absent",()=>{
 const legacy=normalizeObservationHistory([{...amendmentBase,recordedAt:undefined,id:"legacy-amend-time"}]);
 const tampered=[
  {...legacy[0],recordState:"superseded"},
  {...amendmentBase,recordedAt:undefined,id:"legacy-amend-replacement",recordState:"active",previousVersionId:"legacy-amend-time",
   amendmentReason:"Verified correction",amendedBy:"reviewer",
   amendedAt:"2026-10-17T23:59:59Z"}
 ];
 assert.throws(()=>validateObservationHistory(tampered),
  /amendment time cannot precede the previous observation time/);
});

test("rejects amendment histories where the replacement was recorded after its amendment",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 assert.throws(()=>amendObservation(original,original[0].id,{
  ...amendmentBase,value:63,recordedAt:"2026-10-19T03:00:00Z"
 },"Verified correction","reviewer-5","2026-10-19T02:00:00Z","obs-time-order-001"),
 /replacement record-entry time cannot follow its amendment time/);
 const valid=amendObservation(original,original[0].id,{...amendmentBase,value:64},
  "Verified correction","reviewer-5","2026-10-19T02:00:00Z","obs-time-order-002");
 const tampered=valid.map(row=>({...row}));
 tampered[1]={...tampered[1],recordedAt:"2026-10-19T03:00:00.000Z"};
 assert.throws(()=>validateObservationHistory(tampered),
  /replacement record-entry time cannot follow its amendment time/);
});

test("rejects amendment chains whose timestamps move backwards",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 const first=amendObservation(original,original[0].id,{
  ...amendmentBase,value:63,recordedAt:"2026-10-18T01:30:00Z"
 },"Verified correction","reviewer-6","2026-10-19T02:00:00Z","obs-time-chain-001");
 assert.throws(()=>amendObservation(first,"obs-time-chain-001",{
  ...amendmentBase,value:64,recordedAt:"2026-10-18T01:45:00Z"
 },"Second correction","reviewer-7","2026-10-18T02:00:00Z","obs-time-chain-002"),
 /amendment time cannot precede the previous version's amendment time/);
});

test("normalization enforces the history size limit before traversing records",()=>{
 const oversized=new Array(50001);
 Object.defineProperty(oversized,"0",{get(){throw new Error("records must not be traversed before size validation");}});
 assert.throws(()=>normalizeObservationHistory(oversized),/50000-record validation limit/);
});

test("rejects same-ID imports that alter record-entry time or amendment audit",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 const changedRecordTime=[{...original[0],recordedAt:"2026-10-18T02:00:00Z"}];
 assert.throws(()=>mergeObservationHistories(original,changedRecordTime),/id collision/);

 const amended=amendObservation(original,original[0].id,{...amendmentBase,value:64},
  "Verified correction","reviewer-4","2026-10-19T02:00:00Z","obs-snapshot-001");
 const changedAudit=amended.map(row=>({...row}));
 changedAudit[1]={...changedAudit[1],amendmentReason:"altered audit reason"};
 assert.throws(()=>mergeObservationHistories(amended,changedAudit),/id collision/);
});

test("merges an audited void transition without allowing measurement tampering",()=>{
 const original=normalizeObservationHistory([{...amendmentBase,id:"void-sync-record"}]);
 const voided=voidObservation(original,"void-sync-record",
  "Source record was invalidated","reviewer-sync","2026-10-20T06:00:00Z");
 const merged=mergeObservationHistories(original,voided);
 assert.equal(merged[0].recordState,"voided");
 assert.equal(merged[0].voidReason,"Source record was invalidated");
 assert.equal(mergeObservationHistories(merged,original)[0].recordState,"voided",
  "an older active copy must not reactivate a voided observation");
 const tampered=voided.map(row=>({...row,value:999}));
 assert.throws(()=>mergeObservationHistories(original,tampered),/id collision/,
  "a void transition must not conceal changes to immutable measurement fields");
});

test("merges imported amendment history without reverting superseded versions",()=>{
 const original=normalizeObservationHistory([amendmentBase]);
 const amended=amendObservation(original,original[0].id,{...amendmentBase,value:65},
  "Source verification correction","reviewer-3","2026-10-19T04:00:00Z","obs-revision-006");
 const merged=mergeObservationHistories(original,amended);
 assert.equal(merged.length,2);
 assert.equal(merged[0].recordState,"superseded");
 assert.equal(merged[1].recordState,"active");
 assert.equal(mergeObservationHistories(merged,original)[0].recordState,"superseded");
 assert.throws(()=>mergeObservationHistories(original,[{...original[0],value:999}]),/id collision/);
});


test("merging the same audited void snapshot repeatedly is idempotent",()=>{
 const original=normalizeObservationHistory([{...amendmentBase,id:"void-idempotent-record"}]);
 const voided=voidObservation(original,"void-idempotent-record",
  "Duplicate source entry","reviewer-idempotent","2026-10-20T07:00:00Z");
 const once=mergeObservationHistories(original,voided);
 const twice=mergeObservationHistories(once,voided);
 assert.deepEqual(twice,once,
  "replaying an identical void event must not change the authoritative audit history");
 assert.equal(mergeObservationHistories(twice,original)[0].recordState,"voided");
});


test("rejects conflicting void audit metadata for the same observation ID",()=>{
 const original=normalizeObservationHistory([{...amendmentBase,id:"void-audit-conflict"}]);
 const first=voidObservation(original,"void-audit-conflict","Invalid source","reviewer-a","2026-10-20T07:10:00Z");
 const conflicting=voidObservation(original,"void-audit-conflict","Different reason","reviewer-b","2026-10-20T07:11:00Z");
 const merged=mergeObservationHistories(original,first);
 assert.throws(()=>mergeObservationHistories(merged,conflicting),/id collision/,
  "a replay with altered void reason, actor or timestamp must not overwrite the accepted audit event");
});


test("rejects void audit timestamps earlier than the immutable record-entry time",()=>{
 const original=normalizeObservationHistory([{
  ...valid,id:"void-time-order",recordedAt:"2026-10-19T04:00:00Z"
 }]);
 assert.throws(()=>voidObservation(
  original,"void-time-order","Invalid source record","reviewer-1","2026-10-19T03:59:59Z"
 ),/void time cannot precede the observation record-entry time/);
});


test("rejects an amendment timestamp earlier than the original measurement",()=>{
 const original=normalizeObservationHistory([{...valid,id:"amendment-before-measurement"}]);
 assert.throws(()=>amendObservation(
  original,"amendment-before-measurement",{...valid,value:63},
  "Corrected source reading","reviewer-chronology","2025-12-31T23:59:59Z","amendment-early-001"
 ),/amendment time cannot precede the original observation time/);
});


test("rejects void audit timestamps earlier than record entry",()=>{
 const row=createObservation({...valid,recordedAt:"2026-01-02T00:00:00Z"});
 assert.throws(()=>voidObservation([row],row.id,{reason:"duplicate",actor:"reviewer",voidedAt:"2026-01-01T00:00:00Z"}),RangeError);
});

test("validates long linear observation amendment chains without recursion",()=>{
  const rows=[];
  for(let index=0;index<1200;index++){
    const id="obs-"+index;
    rows.push({
      ...valid,id,recordState:index===1199?"active":"superseded",
      ...(index===0?{}:{
        previousVersionId:"obs-"+(index-1),
        amendmentReason:"correction",amendedBy:"reviewer",
        amendedAt:new Date(Date.UTC(2026,0,1,0,0,index)).toISOString()
      })
    });
  }
  assert.equal(validateObservationHistory(rows).length,1200);
});


test("observation history rejects unsupported imported fields instead of silently discarding them",()=>{
 const row={id:"OBS-STRICT-1",metric:"weight",value:70,unit:"kg",observedAt:"2026-10-20T09:00:00Z",source:"scale",quality:"measured",recordState:"active",clinicalOverride:true};
 assert.throws(()=>normalizeObservationHistory([row]),/unsupported fields/);
});


test("observation history enforces a bounded import size before traversing version links",()=>{
 const oversized=new Array(50001);
 assert.throws(()=>validateObservationHistory(oversized),RangeError);
});


test("rejects void audit timestamps earlier than the original measurement",()=>{
 const original=normalizeObservationHistory([{...valid,id:"void-before-observation",observedAt:"2026-10-20T08:00:00Z",recordedAt:"2026-10-20T07:00:00Z"}]);
 assert.throws(()=>voidObservation(
  original,"void-before-observation","Invalid chronology","reviewer-2","2026-10-20T07:30:00Z"
 ),/void time cannot precede the original observation time/);
});


test("merged observation histories enforce the combined record cap before normalization",()=>{
 assert.throws(()=>mergeObservationHistories(new Array(25001),new Array(25000)),RangeError);
 assert.throws(()=>mergeObservationHistories([],null),TypeError);
});

test("large observation merges use indexed active-measurement duplicate detection",()=>{
 const imported=Array.from({length:5000},(_,index)=>({
  ...valid,id:"bulk-observation-"+index,metric:"bulk-metric-"+index
 }));
 const merged=mergeObservationHistories([],imported);
 assert.equal(merged.length,5000);
 assert.equal(merged[4999].id,"bulk-observation-4999");
});

test("a void transition releases its measurement identity for a verified re-entry in the same merge",()=>{
 const original=normalizeObservationHistory([{...amendmentBase,id:"void-and-reenter"}]);
 const voided=voidObservation(original,"void-and-reenter",
  "Source record was invalidated","reviewer-reentry","2026-10-20T08:00:00Z");
 const reentered={...amendmentBase,id:"verified-reentry"};
 const merged=mergeObservationHistories(original,[...voided,reentered]);
 assert.equal(merged[0].recordState,"voided");
 assert.equal(merged[1].recordState,"active");
});


test("exports provenance-preserving numeric observations as explicit FHIR R4 resources", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const resource = toFhirObservation({
    id: "obs-001",
    metric: "heart-rate",
    value: 72,
    unit: "bpm",
    observedAt: "2026-01-01T08:00:00+08:00",
    recordedAt: "2026-01-01T09:00:00+08:00",
    source: "wearable",
    quality: "measured",
    recordState: "active"
  }, {
    status: "final",
    subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4", display: "Heart rate" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-quality",
    identifier: { system: "https://example.org/observation-id", value: "obs-001" }
  });
  assert.equal(resource.resourceType, "Observation");
  assert.equal(resource.status, "final");
  assert.equal(resource.subject.reference, "Patient/example");
  assert.equal(resource.effectiveDateTime, "2026-01-01T00:00:00.000Z");
  assert.equal(resource.issued, "2026-01-01T01:00:00.000Z");
  assert.equal(resource.code.coding[0].code, "8867-4");
  assert.equal(resource.valueQuantity.value, 72);
  assert.equal(resource.valueQuantity.code, "/min");
  assert.deepEqual(resource.extension.map(item => item.valueString || item.valueCode), ["wearable", "measured"]);
  assert.equal(resource.identifier[0].value, "obs-001");
  assert.ok(Object.isFrozen(resource) && Object.isFrozen(resource.valueQuantity));
});

test("FHIR export refuses guessed terminology, identity, status and extension namespaces", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    metric: "resting-heart-rate", value: 62, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported"
  };
  const mapping = {
    status: "final", subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality"
  };
  assert.throws(() => toFhirObservation(observation, { ...mapping, code: { code: "8867-4" } }), TypeError);
  assert.throws(() => toFhirObservation(observation, { ...mapping, subjectReference: "" }), TypeError);
  assert.throws(() => toFhirObservation(observation, { ...mapping, status: "measured" }), RangeError);
  assert.throws(() => toFhirObservation(observation, { ...mapping, qualityExtensionUrl: mapping.sourceExtensionUrl }), RangeError);
  assert.throws(() => toFhirObservation({ ...observation, recordState: "voided" }, mapping), RangeError);
  const voided = toFhirObservation({
    ...observation, recordState: "voided",
    voidReason: "Duplicate entry", voidedBy: "reviewer-1",
    voidedAt: "2026-01-02T00:00:00Z"
  }, {
    ...mapping, status: "entered-in-error",
    versionAuditExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-version-audit"
  });
  assert.equal(voided.status, "entered-in-error");
  assert.throws(() => toFhirObservation({
    ...observation, recordState: "voided"
  }, { ...mapping, status: "entered-in-error" }), /require reason, actor and void time/);
  assert.throws(() => toFhirObservation({ ...observation, recordState: "unknown" }, mapping), RangeError);
});



test("FHIR export preserves amended and voided observation audit lineage", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const mapping = {
    status: "amended",
    subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality",
    versionAuditExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-version-audit"
  };
  const amended = toFhirObservation({
    id: "obs-v2", metric: "heart-rate", value: 70, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported",
    recordState: "active", previousVersionId: "obs-v1",
    amendmentReason: "Corrected transcription", amendedBy: "reviewer-1",
    amendedAt: "2026-01-02T00:00:00Z"
  }, mapping);
  const audit = amended.extension.find(item => item.url === mapping.versionAuditExtensionUrl);
  assert.deepEqual(audit.extension.map(item => item.url), [
    "previous-version-id", "amendment-reason", "amended-by", "amended-at"
  ]);
  assert.equal(audit.extension[0].valueString, "obs-v1");
  assert.equal(audit.extension[3].valueDateTime, "2026-01-02T00:00:00.000Z");

  const voided = toFhirObservation({
    id: "obs-void", metric: "heart-rate", value: 70, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported",
    recordState: "voided", voidReason: "Duplicate entry", voidedBy: "reviewer-1",
    voidedAt: "2026-01-03T00:00:00Z"
  }, { ...mapping, status: "entered-in-error" });
  const voidAudit = voided.extension.find(item => item.url === mapping.versionAuditExtensionUrl);
  assert.deepEqual(voidAudit.extension.map(item => item.url), [
    "void-reason", "voided-by", "voided-at"
  ]);
  assert.equal(voidAudit.extension[0].valueString, "Duplicate entry");
  assert.ok(Object.isFrozen(voidAudit) && Object.isFrozen(voidAudit.extension));

  assert.throws(() => toFhirObservation({
    id: "obs-incomplete", metric: "heart-rate", value: 70, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported",
    recordState: "voided"
  }, { ...mapping, status: "entered-in-error" }), /require reason, actor and void time/);
  assert.throws(() => toFhirObservation({
    id: "obs-incomplete-amendment", metric: "heart-rate", value: 70, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported",
    previousVersionId: "obs-v1", amendmentReason: "Corrected"
  }, mapping), /require previous version, reason, actor and amendment time/);
  assert.throws(() => toFhirObservation({
    id: "obs-collision", metric: "heart-rate", value: 70, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported",
    previousVersionId: "obs-v1", amendmentReason: "Corrected", amendedBy: "reviewer-1",
    amendedAt: "2026-01-02T00:00:00Z"
  }, { ...mapping, versionAuditExtensionUrl: mapping.sourceExtensionUrl }), /distinct canonical URL/);
});

test("FHIR export rejects recognized display units paired with contradictory UCUM codes", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    metric: "blood-pressure", value: 120, unit: "mmHg",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported"
  };
  const mapping = {
    status: "final", subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "85354-9" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "mm[Hg]" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality"
  };
  assert.equal(toFhirObservation(observation, mapping).valueQuantity.code, "mm[Hg]");
  assert.throws(() => toFhirObservation(observation, {
    ...mapping, unitCoding: { ...mapping.unitCoding, code: "/min" }
  }), /does not match the recognized display unit/);

  const heartRate = { ...observation, metric: "heart-rate", unit: "bpm", value: 72 };
  assert.equal(toFhirObservation(heartRate, {
    ...mapping, code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" }
  }).valueQuantity.code, "/min");
  assert.throws(() => toFhirObservation(heartRate, {
    ...mapping, code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "kg" }
  }), /does not match the recognized display unit/);

  // Unknown display units require an explicit domain mapping and are not
  // guessed or converted by the generic FHIR serializer.
  const custom = { ...observation, metric: "research-index", unit: "lab-unit-x" };
  assert.equal(toFhirObservation(custom, {
    ...mapping, unitCoding: { system: "http://unitsofmeasure.org", code: "{lab-unit-x}" }
  }).valueQuantity.code, "{lab-unit-x}");
});

test("FHIR export requires UCUM as the Quantity code system", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    metric: "resting-heart-rate", value: 62, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported"
  };
  const mapping = {
    status: "final", subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality"
  };
  assert.equal(toFhirObservation(observation, mapping).valueQuantity.system,
    "http://unitsofmeasure.org");
  for (const system of ["http://loinc.org", "https://example.org/codes/units", "urn:example:units"]) {
    assert.throws(() => toFhirObservation(observation, {
      ...mapping, unitCoding: { ...mapping.unitCoding, system }
    }), /Quantity.system must identify the UCUM code system/);
  }
});

test("FHIR export rejects malformed subject references and invalid coding URIs", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    metric: "resting-heart-rate", value: 62, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported"
  };
  const mapping = {
    status: "final", subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality"
  };
  for (const subjectReference of ["Patient", "Patient/", "not-a-reference", "Patient/a b"]) {
    assert.throws(() => toFhirObservation(observation, { ...mapping, subjectReference }));
  }
  assert.throws(() => toFhirObservation(observation, {
    ...mapping, code: { ...mapping.code, system: "not-a-uri" }
  }), /absolute HTTP\(S\) or URN URI/);
});


test("FHIR export requires record-state audit lineage for amended and entered-in-error statuses", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    id: "obs-status-lineage",
    metric: "resting-heart-rate",
    value: 62,
    unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z",
    recordedAt: "2026-01-01T00:05:00Z",
    source: "manual-entry",
    quality: "reported"
  };
  const mapping = {
    status: "final",
    subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality",
    versionAuditExtensionUrl: "https://example.org/fhir/StructureDefinition/version-audit"
  };

  assert.throws(() => toFhirObservation(observation, {
    ...mapping, status: "entered-in-error"
  }), /entered-in-error status requires a voided record and complete void audit/);
  assert.throws(() => toFhirObservation(observation, {
    ...mapping, status: "amended"
  }), /amended or corrected status requires complete amendment lineage/);
  assert.throws(() => toFhirObservation(observation, {
    ...mapping, status: "corrected"
  }), /amended or corrected status requires complete amendment lineage/);

  const voided = toFhirObservation({
    ...observation,
    recordState: "voided",
    voidReason: "Duplicate",
    voidedBy: "reviewer",
    voidedAt: "2026-01-02T00:00:00Z"
  }, { ...mapping, status: "entered-in-error" });
  assert.equal(voided.status, "entered-in-error");

  const amended = toFhirObservation({
    ...observation,
    recordState: "superseded",
    previousVersionId: "obs-before",
    amendmentReason: "Corrected transcription",
    amendedBy: "reviewer",
    amendedAt: "2026-01-02T00:00:00Z"
  }, { ...mapping, status: "corrected" });
  assert.equal(amended.status, "corrected");
});


test("FHIR export rejects an observation that references itself as its previous version", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    id: "obs-self-version",
    metric: "resting-heart-rate",
    value: 62,
    unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z",
    recordedAt: "2026-01-01T00:05:00Z",
    source: "manual-entry",
    quality: "reported",
    previousVersionId: "obs-self-version",
    amendmentReason: "Correction",
    amendedBy: "reviewer",
    amendedAt: "2026-01-02T00:00:00Z"
  };
  const mapping = {
    status: "corrected",
    subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality",
    versionAuditExtensionUrl: "https://example.org/fhir/StructureDefinition/version-audit"
  };
  assert.throws(() => toFhirObservation(observation, mapping),
    /cannot reference itself as a previous FHIR version/);
});


test("rejects RFC 3339 unknown-local-offset timestamps", () => {
  assert.throws(() => createObservation({...valid,observedAt:"2026-01-01T00:00:00-00:00"}), TypeError);
  assert.throws(() => createObservation({...valid,recordedAt:"2026-01-01T00:00:00-00:00"}), TypeError);
  assert.equal(createObservation({...valid,observedAt:"2026-01-01T00:00:00+00:00"}).observedAt,"2026-01-01T00:00:00.000Z");
});


test("FHIR export blocks synthetic demo observations from entering clinical exchange",async()=>{
 const {toFhirObservation}=await import("../src/domain/index.js");
 const demo={
  metric:"resting-heart-rate",value:72,unit:"bpm",
  observedAt:"2026-01-01T00:00:00Z",source:"synthetic-demo-fixture",quality:"demo"
 };
 const mapping={
  status:"final",subjectReference:"Patient/example",
  code:{system:"http://loinc.org",code:"8867-4"},
  unitCoding:{system:"http://unitsofmeasure.org",code:"/min"},
  sourceExtensionUrl:"https://example.org/fhir/StructureDefinition/source",
  qualityExtensionUrl:"https://example.org/fhir/StructureDefinition/quality"
 };
 assert.throws(()=>toFhirObservation(demo,mapping),
  /demo observations cannot be exported as clinical FHIR resources/);
 assert.equal(toFhirObservation({...demo,quality:"reported"},mapping).resourceType,"Observation",
  "real reported measurements remain eligible for explicitly configured FHIR export");
});


test("observation amendments and voids cannot be recorded ahead of the reference clock",()=>{
 const source={
  metric:"resting-heart-rate",value:72,unit:"bpm",
  observedAt:"2026-10-20T08:00:00.000Z",
  recordedAt:"2026-10-20T08:05:00.000Z",
  source:"validated-device-import",quality:"measured"
 };
 const history=[{...source,id:"OBS-FUTURE-AUDIT",recordState:"active"}];
 const asOf=new Date("2026-10-24T09:00:00.000Z");
 const replacement={...source,value:73,source:"clinician-corrected"};
 assert.throws(()=>amendObservation(
  history,"OBS-FUTURE-AUDIT",replacement,"Corrected transcription","clinician-1",
  "2026-10-25T09:00:00.000Z","OBS-FUTURE-REPLACEMENT",asOf
 ),/future-dated observation amendment/);
 assert.throws(()=>voidObservation(
  history,"OBS-FUTURE-AUDIT","Duplicate import","reviewer-1",
  "2026-10-25T09:00:00.000Z",asOf
 ),/future-dated observation void/);
 assert.throws(()=>amendObservation(
  history,"OBS-FUTURE-AUDIT",replacement,"Corrected transcription","clinician-1",
  "2026-10-24T09:00:00.000Z","OBS-INVALID-CLOCK","2026-10-24"
 ),/reference time must be a valid Date/);
 assert.throws(()=>voidObservation(
  history,"OBS-FUTURE-AUDIT","Duplicate import","reviewer-1",
  "2026-10-24T09:00:00.000Z","2026-10-24"
 ),/reference time must be a valid Date/);
 const amended=amendObservation(
  history,"OBS-FUTURE-AUDIT",replacement,"Corrected transcription","clinician-1",
  "2026-10-24T09:00:00.000Z","OBS-CURRENT-REPLACEMENT",asOf
 );
 assert.equal(amended.at(-1).recordState,"active");
 const voided=voidObservation(
  history,"OBS-FUTURE-AUDIT","Duplicate import","reviewer-1",
  "2026-10-24T09:00:00.000Z",asOf
 );
 assert.equal(voided[0].recordState,"voided");
});

const standardFhirOptions = {
  subjectReference: "Patient/example",
  sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-source",
  qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-quality",
  versionAuditExtensionUrl: "https://example.org/fhir/StructureDefinition/observation-version-audit"
};
const standardFhirBase = {
  observedAt: "2026-01-01T00:00:00Z", source: "manual-entry", quality: "reported"
};

test("standard FHIR terminology maps registered metrics to vetted LOINC and UCUM codes", async () => {
  const { toStandardFhirObservation, STANDARD_FHIR_TERMINOLOGY } = await import("../src/domain/index.js");
  assert.equal(STANDARD_FHIR_TERMINOLOGY["heart-rate"].code.code, "8867-4");
  assert.equal(STANDARD_FHIR_TERMINOLOGY["blood-pressure"].code.code, "85354-9");

  const heart = toStandardFhirObservation(
    { ...standardFhirBase, metric: "heart-rate", value: 72, unit: "次/分" }, standardFhirOptions);
  assert.equal(heart.resourceType, "Observation");
  assert.equal(heart.status, "final");
  assert.equal(heart.subject.reference, "Patient/example");
  assert.equal(heart.effectiveDateTime, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(heart.category, [{
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/observation-category",
      code: "vital-signs"
    }]
  }]);
  assert.equal(heart.code.coding[0].system, "http://loinc.org");
  assert.equal(heart.code.coding[0].code, "8867-4");
  assert.equal(heart.code.coding[0].display, "Heart rate");
  assert.equal(heart.valueQuantity.value, 72);
  assert.equal(heart.valueQuantity.system, "http://unitsofmeasure.org");
  assert.equal(heart.valueQuantity.code, "/min");
  // The local display unit is normalized to the canonical UCUM display so a
  // 次/分 record and a bpm record export identically.
  assert.equal(heart.valueQuantity.unit, "/min");

  const resting = toStandardFhirObservation(
    { ...standardFhirBase, metric: "resting-heart-rate", value: 62, unit: "bpm" }, standardFhirOptions);
  assert.equal(resting.code.coding[0].code, "40443-4");
  assert.equal(resting.code.coding[0].display, "Heart rate --resting");
  assert.equal(resting.valueQuantity.code, "/min");

  const weight = toStandardFhirObservation(
    { ...standardFhirBase, metric: "body-weight", value: 65.5, unit: "公斤" }, standardFhirOptions);
  assert.equal(weight.code.coding[0].code, "29463-7");
  assert.equal(weight.code.coding[0].display, "Body weight");
  assert.equal(weight.valueQuantity.code, "kg");
  assert.equal(weight.valueQuantity.unit, "kg");
  const alias = toStandardFhirObservation(
    { ...standardFhirBase, metric: "weight", value: 65.5, unit: "kg" }, standardFhirOptions);
  assert.equal(alias.code.coding[0].code, "29463-7");

  // The local model stores one unattributed pressure value, so the export
  // keeps the panel code with a single mm[Hg] quantity and must not invent
  // systolic/diastolic components.
  const pressure = toStandardFhirObservation(
    { ...standardFhirBase, metric: "blood-pressure", value: 120, unit: "mmHg" }, standardFhirOptions);
  assert.equal(pressure.code.coding[0].code, "85354-9");
  assert.equal(pressure.valueQuantity.code, "mm[Hg]");
  assert.equal(pressure.valueQuantity.unit, "mm[Hg]");
  assert.equal(pressure.component, undefined);
});

test("standard FHIR export refuses unmapped metrics and demo data", async () => {
  const { toStandardFhirObservation } = await import("../src/domain/index.js");
  assert.throws(() => toStandardFhirObservation(
    { ...standardFhirBase, metric: "research-index", value: 1, unit: "lab-unit-x" }, standardFhirOptions
  ), /no vetted standard FHIR terminology mapping/);
  assert.throws(() => toStandardFhirObservation(
    { ...standardFhirBase, metric: "heart-rate", value: 72, unit: "bpm", quality: "demo" }, standardFhirOptions
  ), /demo observations cannot be exported/);
});

test("standard FHIR export derives lifecycle status from the record state", async () => {
  const { toStandardFhirObservation } = await import("../src/domain/index.js");
  const voided = toStandardFhirObservation({
    ...standardFhirBase, metric: "heart-rate", value: 70, unit: "bpm",
    recordState: "voided", voidReason: "Duplicate entry", voidedBy: "reviewer-1",
    voidedAt: "2026-01-03T00:00:00Z"
  }, standardFhirOptions);
  assert.equal(voided.status, "entered-in-error");
  const amended = toStandardFhirObservation({
    ...standardFhirBase, metric: "heart-rate", value: 70, unit: "bpm",
    recordState: "active", previousVersionId: "obs-v1",
    amendmentReason: "Corrected transcription", amendedBy: "reviewer-1",
    amendedAt: "2026-01-02T00:00:00Z"
  }, standardFhirOptions);
  assert.equal(amended.status, "amended");
  const uncategorized = toStandardFhirObservation(
    { ...standardFhirBase, metric: "heart-rate", value: 72, unit: "bpm" },
    { ...standardFhirOptions, category: null });
  assert.equal(uncategorized.category, undefined);
});

test("generic FHIR serializer only emits a category when the caller supplies one", async () => {
  const { toFhirObservation } = await import("../src/domain/index.js");
  const observation = {
    metric: "heart-rate", value: 72, unit: "bpm",
    observedAt: "2026-01-01T00:00:00Z", source: "wearable", quality: "measured"
  };
  const mapping = {
    status: "final", subjectReference: "Patient/example",
    code: { system: "http://loinc.org", code: "8867-4", display: "Heart rate" },
    unitCoding: { system: "http://unitsofmeasure.org", code: "/min" },
    sourceExtensionUrl: "https://example.org/fhir/StructureDefinition/source",
    qualityExtensionUrl: "https://example.org/fhir/StructureDefinition/quality"
  };
  assert.equal(toFhirObservation(observation, mapping).category, undefined);
  const categorized = toFhirObservation(observation, {
    ...mapping,
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }]
  });
  assert.equal(categorized.category[0].coding[0].code, "vital-signs");
  assert.throws(() => toFhirObservation(observation, { ...mapping, category: [] }), TypeError);
  assert.throws(() => toFhirObservation(observation, { ...mapping, category: [{ coding: [] }] }), TypeError);
});

test("FHIR Bundle export packages standard observations as an R4 collection", async () => {
  const { toFhirBundle } = await import("../src/domain/index.js");
  const bundle = toFhirBundle([
    {
      id: "obs-hr-1", metric: "heart-rate", value: 72, unit: "bpm",
      observedAt: "2026-01-01T00:00:00Z", source: "wearable", quality: "measured",
      recordState: "active"
    },
    {
      id: "obs-wt-1", metric: "body-weight", value: 65.5, unit: "kg",
      observedAt: "2026-01-01T01:00:00Z", source: "scale", quality: "measured",
      recordState: "active"
    },
    {
      metric: "resting-heart-rate", value: 62, unit: "bpm",
      observedAt: "2026-01-01T02:00:00Z", source: "wearable", quality: "measured"
    }
  ], { ...standardFhirOptions, timestamp: "2026-02-01T00:00:00Z" });
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.equal(bundle.timestamp, "2026-02-01T00:00:00.000Z");
  assert.equal(bundle.entry.length, 3);
  assert.equal(bundle.entry[0].fullUrl, "Observation/obs-hr-1");
  assert.equal(bundle.entry[0].resource.id, "obs-hr-1");
  assert.equal(bundle.entry[0].resource.resourceType, "Observation");
  assert.equal(bundle.entry[0].resource.code.coding[0].code, "8867-4");
  assert.equal(bundle.entry[0].resource.category[0].coding[0].code, "vital-signs");
  assert.equal(bundle.entry[1].resource.code.coding[0].code, "29463-7");
  assert.equal(bundle.entry[1].resource.valueQuantity.code, "kg");
  // Records without a local id stay anonymous instead of gaining an
  // invented identifier.
  assert.equal(bundle.entry[2].fullUrl, undefined);
  assert.equal(bundle.entry[2].resource.id, undefined);
  assert.equal(bundle.entry[2].resource.code.coding[0].code, "40443-4");
  assert.ok(Object.isFrozen(bundle) && Object.isFrozen(bundle.entry));
  assert.throws(() => toFhirBundle("not-an-array", standardFhirOptions), TypeError);
  assert.throws(() => toFhirBundle([
    {
      id: "duplicate-observation",
      metric: "heart-rate", value: 72, unit: "bpm",
      observedAt: "2026-01-01T00:00:00Z", source: "wearable", quality: "measured"
    },
    {
      id: "duplicate-observation",
      metric: "heart-rate", value: 73, unit: "bpm",
      observedAt: "2026-01-01T01:00:00Z", source: "wearable", quality: "measured"
    }
  ], standardFhirOptions), /FHIR Bundle Observation ids must be unique/);

  const oversized = new Array(50001);
  Object.defineProperty(oversized, "0", {
    get() { throw new Error("bundle entries must not be traversed before size validation"); }
  });
  assert.throws(() => toFhirBundle(oversized, standardFhirOptions),
    /50000-observation export limit/);
});
