'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/legacy-app.js','utf8');
const index = fs.readFileSync('index.html','utf8');
const domainSource = fs.readFileSync('src/domain/index.js','utf8').replace(/^export function /gm,'function ');
const start = app.indexOf('async function importObservations(){');
const end = app.indexOf('function parseLocalObservationDateTime',start);
if(start<0 || end<=start) throw new Error('Health observation import handler not found');
const importSource = app.slice(start,end);
const domainContext = vm.createContext({});
vm.runInContext(domainSource + '\nthis.HealthDomain={createObservation,chronologicalObservations,observationIdentity,normalizeObservationHistory,mergeObservationHistories,hasActiveObservationDuplicate};',domainContext);
const HealthDomain = domainContext.HealthDomain;

function observation(metric, value, date='2026-10-18T08:30:00Z') {
  return {metric,value,unit:'bpm',observedAt:date,source:'manual-test',quality:'reported'};
}
function harness({locked=true,writeFails=false,existing=[],confirmResult=true}={}) {
  const alerts=[];
  let writes=0, stored=null, renders=0, confirms=0;
  const picker={value:'',files:[],onchange:null,click(){this.clicked=true;}};
  const context={
    window:{HealthDomain,healthObservations:existing},
    observationDomainUnavailable:false,
    observationStorageRecoveryRequired:locked,
    OBSERVATION_STORAGE_KEY:'health-observations-v1',
    document:{getElementById:id=>id==='observationImportFile'?picker:null},
    localStorage:{setItem(key,value){writes++;if(writeFails)throw new Error('quota exceeded');stored={key,value};}},
    confirm:()=>{confirms++;return confirmResult;},
    alert:message=>alerts.push(message),
    renderObservations:()=>{renders++;}
  };
  vm.createContext(context);
  vm.runInContext(importSource+'\nthis.__importObservations=importObservations;',context);
  return {
    context,picker,alerts,
    get writes(){return writes;},
    get stored(){return stored;},
    get renders(){return renders;},
    get confirms(){return confirms;}
  };
}
async function importPayload(state,payload) {
  state.picker.files=[{size:Buffer.byteLength(JSON.stringify(payload)),text:async()=>JSON.stringify(payload)}];
  assert.equal(await state.context.__importObservations(),true,'import picker should open');
  assert.equal(typeof state.picker.onchange,'function','import must register a file handler');
  return state.picker.onchange();
}

(async()=>{
  assert.ok(index.includes('onclick="importObservations()"'),
    'a visible import control must remain available in the records page');
  assert.ok(app.includes('onclick="importObservations()"'),
    'the recovery panel must expose the import/restore action');
  assert.ok(app.includes('window.HealthDomain.hasActiveObservationDuplicate(existing,observation)'),
    'new readings must deduplicate against active versions only, not voided or superseded audit history');
  assert.ok(importSource.includes('if(recovering && !confirm('),
    'recovery import must require explicit confirmation before replacing corrupt cache');
  assert.ok(importSource.includes('observationStorageRecoveryRequired = false;'),
    'recovery lock must be cleared after persistence');

  const cleanBackup={schemaVersion:1,observations:[observation('heart-rate',72)]};
  let state=harness({locked:true});
  await importPayload(state,cleanBackup);
  assert.equal(state.writes,1,'valid backup must be written once when recovering');
  assert.equal(state.context.observationStorageRecoveryRequired,false,
    'successful write must release recovery lock');
  assert.equal(state.context.window.healthObservations.length,1);
  assert.equal(state.context.window.healthObservations[0].value,72);
  assert.equal(state.renders,1);
  assert.ok(state.alerts.some(message=>message.includes('恢复完成')),
    'successful restore must clearly report recovery completion');

  state=harness({locked:true,confirmResult:false});
  assert.equal(await state.context.__importObservations(),false,
    'cancelled recovery must not open an import or mutate storage');
  assert.equal(state.writes,0);
  assert.equal(state.picker.onchange,null);
  assert.equal(state.context.observationStorageRecoveryRequired,true);

  state=harness({locked:true,writeFails:true});
  await importPayload(state,cleanBackup);
  assert.equal(state.writes,1,'failed restore should make one persistence attempt');
  assert.equal(state.context.observationStorageRecoveryRequired,true,
    'quota failure must keep recovery lock enabled');
  assert.equal(state.context.window.healthObservations.length,0,
    'failed restore must not replace the in-memory safe state');
  assert.equal(state.renders,0,'failed restore must not render uncommitted observations');

  state=harness({locked:true});
  const invalidBackup={schemaVersion:1,observations:[{metric:'heart-rate',value:72}]};
  await importPayload(state,invalidBackup);
  assert.equal(state.writes,0,'invalid provenance/timestamp rows must not be written');
  assert.equal(state.context.observationStorageRecoveryRequired,true,
    'invalid backup must leave recovery lock enabled');
  assert.equal(state.context.window.healthObservations.length,0);

  state=harness({locked:true});
  const recoveryEnvelope={
    schemaVersion:1,
    exportedAt:'2026-10-18T09:00:00.000Z',
    storage:'local-browser-recovery',
    originalRaw:'{malformed-original',
    recoveryCopies:[{key:'health-observations-v1_recovery_1',raw:JSON.stringify([observation('steps',5000)])}]
  };
  await importPayload(state,recoveryEnvelope);
  assert.equal(state.context.observationStorageRecoveryRequired,false,
    'a recovery package with a valid raw copy must restore and unlock');
  assert.equal(state.context.window.healthObservations.length,1);
  assert.equal(state.context.window.healthObservations[0].metric,'steps');

  state=harness({locked:false,existing:[HealthDomain.createObservation(observation('heart-rate',72))]});
  const mergedBackup={schemaVersion:1,observations:[observation('heart-rate',72),observation('steps',5000)]};
  await importPayload(state,mergedBackup);
  assert.equal(state.context.window.healthObservations.length,2,
    'normal import must merge records and skip exact duplicates');
  assert.equal(state.context.observationStorageRecoveryRequired,false);

  state=harness({locked:false,existing:[{
    ...observation('heart-rate',72),id:'existing-device-record',recordState:'active'
  }]});
  const duplicateFromAnotherDevice={schemaVersion:1,observations:[{
    ...observation('heart-rate',72),id:'imported-device-record',recordState:'active'
  }]};
  await importPayload(state,duplicateFromAnotherDevice);
  assert.equal(state.writes,0,
    'a duplicate active measurement with a different device-generated ID must not be imported alongside the existing reading');
  assert.ok(state.alerts.some(message=>message.includes('duplicates an existing measurement')),
    'cross-device duplicate import must explain the conflict');

  console.log('Health observation recovery regression checks passed (restore, cancel, invalid backup, quota failure, raw recovery envelope, merge/deduplication).');
})().catch(error=>{console.error(error);process.exitCode=1;});
