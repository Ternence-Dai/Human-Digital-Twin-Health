'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/legacy-app.js','utf8');
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('assets/css/workspace.css','utf8');

assert.ok(!html.includes('NO HEALTH SCORE') &&
          !html.includes('stroke-dasharray="326.7"') &&
          !html.includes('class="score-card'),
  'home must not render a placeholder health score ring or an empty score card');
assert.ok(html.includes('class="health-data-command"') &&
          html.includes('id="personalRecordSnapshot"') &&
          html.includes('PERSONAL HEALTH RECORDS · FHIR-ALIGNED') &&
          html.includes('数据边界') &&
          html.includes('health-home-dashboard') &&
          html.includes('health-home-trust'),
  'home must expose a record-first FHIR workspace with explicit provenance and data-boundary rules');
assert.ok(html.includes('legacy-app.js?v=20261022-observation-native-v3') &&
          html.includes('workspace.css?v=20261022-record-first-v2'),
  'home snapshot must load the cache-busted record-first runtime and stylesheet');
for (const selector of [
  '.personal-record-snapshot{','.personal-record-stats{','.personal-record-row{',
  '.personal-record-state.is-warning'
]) assert.ok(css.includes(selector),'snapshot UI must provide dedicated responsive styling: '+selector);
assert.ok(css.includes('@media(max-width:420px)'),'snapshot UI must support narrow mobile screens');

function extractFunction(source,name,nextMarker){
  const start=source.indexOf('function '+name+'(');
  const end=source.indexOf(nextMarker,start+1);
  assert.ok(start>=0 && end>start,'function source must be extractable: '+name);
  return source.slice(start,end);
}
const snapshotSource=extractFunction(app,'renderPersonalRecordSnapshot','function renderObservations');
const renderSource=extractFunction(app,'renderObservations','function exportObservationRecovery');
assert.ok(renderSource.includes('renderPersonalRecordSnapshot();'),
  'the home snapshot must refresh whenever the versioned observation list is rendered');
assert.ok(snapshotSource.includes("window.HealthDomain.normalizeObservationHistory(") &&
          snapshotSource.includes("row.recordState === 'active'") &&
          snapshotSource.includes("row.recordState === 'superseded'") &&
          snapshotSource.includes("row.recordState === 'voided'"),
  'snapshot must rely on the same domain validation and count active/audit states separately');
assert.ok(snapshotSource.includes("row.quality === 'demo'") &&
          snapshotSource.includes('row.source') &&
          snapshotSource.includes('row.observedAt'),
  'measurement provenance, demo quality, and actual measurement time must be visible');
assert.ok(snapshotSource.includes('personal-record-provenance') &&
          snapshotSource.includes('qualityKinds') &&
          snapshotSource.includes('coverageChecks') &&
          snapshotSource.includes('recordedAt') &&
          snapshotSource.includes('FHIR · Observation provenance'),
  'home snapshot must show source distribution and field completeness for validated observations');
assert.ok(snapshotSource.includes('不代表测量准确性、健康风险、临床有效性或诊断结论'),
  'provenance coverage must not be presented as a clinical score or measurement-accuracy claim');

function run({rows=[],locked=false,unavailable=false,normalizer}={}){
  const host={innerHTML:''};
  let normalizeCalls=0;
  const context={
    document:{getElementById:id=>id==='personalRecordSnapshot'?host:null},
    window:{
      healthObservations:rows,
      HealthDomain:{normalizeObservationHistory:source=>{
        normalizeCalls++;
        if(normalizer) return normalizer(source);
        return source;
      }}
    },
    observationStorageRecoveryRequired:locked,
    observationDomainUnavailable:unavailable,
    escHTML:value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    preserveInvalidObservationStorage:()=>true,
    localStorage:{getItem:()=>null},
    console:{error(){}}
  };
  vm.createContext(context);
  vm.runInContext(snapshotSource+'\nthis.renderPersonalRecordSnapshot=renderPersonalRecordSnapshot;',context);
  context.renderPersonalRecordSnapshot();
  return {html:host.innerHTML,context,normalizeCalls};
}

let result=run();
assert.match(result.html,/尚无当前有效观察值/);
assert.match(result.html,/记录第一条观察值/);
assert.match(result.html,/当前有效记录/);
assert.doesNotMatch(result.html,/72 bpm|126\/82|98%/,
  'an empty personal record list must not be filled with hard-coded sample vitals');
assert.doesNotMatch(app,/lb:'心率', v:'72'|lb:'血压', v:'126\/82'|lb:'血氧', v:'98'|lb:'睡眠', v:'7\.2'/,
  'the dashboard runtime must not contain fabricated personal vital values');
assert.doesNotMatch(html,/今日体征|健康教育示例|id="homeMetrics"/,
  'the home page must not show demo vitals or static sample-alert panels as personal data');

result=run({rows:[
  {id:'h1',metric:'心率',value:72,unit:'bpm',observedAt:'2026-10-20T08:00:00+08:00',source:'手环',quality:'measured',recordState:'active'},
  {id:'h0',metric:'心率',value:69,unit:'bpm',observedAt:'2026-10-19T08:00:00+08:00',source:'手环',quality:'measured',recordState:'superseded'},
  {id:'b1',metric:'血压',value:120,unit:'mmHg',observedAt:'2026-10-20T07:30:00+08:00',source:'家用血压计 CSV 备份',quality:'imported',recordState:'active'},
  {id:'g1',metric:'空腹血糖',value:5.2,unit:'mmol/L',observedAt:'2026-10-18T07:30:00+08:00',source:'导入文件',quality:'imported',recordState:'voided',voidReason:'样本错误'}
]});
assert.match(result.html,/>2</,'snapshot must count two current active records');
assert.match(result.html,/>2<\/strong><small>已更正或已作废/,'snapshot must count historical versions separately');
assert.match(result.html,/心率/);
assert.match(result.html,/72/);
assert.match(result.html,/血压/);
assert.match(result.html,/家用血压计 CSV 备份/);
assert.match(result.html,/设备\/仪器测量/);
assert.match(result.html,/文件导入/);
assert.equal(result.normalizeCalls,1,'each summary refresh should normalize the complete versioned history once');

result=run({locked:true,rows:[]});
assert.match(result.html,/个人记录待恢复/);
assert.match(result.html,/空白不代表记录已丢失/);
assert.equal(result.normalizeCalls,0,'recovery mode must not interpret protected empty memory as zero records');

result=run({unavailable:true});
assert.match(result.html,/记录校验模块不可用/);
assert.equal(result.normalizeCalls,0);

result=run({rows:[],normalizer:()=>{throw new Error('invalid history')}});
assert.match(result.html,/个人记录校验失败/);
assert.equal(result.context.observationStorageRecoveryRequired,true,
  'invalid version history must activate recovery mode before the snapshot displays data');

console.log('Health home snapshot regression checks passed (empty, live records, audit versions, provenance, recovery lock and unavailable domain).');
