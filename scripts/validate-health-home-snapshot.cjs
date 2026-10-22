'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/legacy-app.js','utf8');
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('assets/css/health-data-workspace.css','utf8');

const scoreArcStart = html.indexOf('<circle cx="62" cy="62" r="52" fill="none" stroke="url(#ringGrad)"');
const scoreArc = scoreArcStart >= 0 ? html.slice(scoreArcStart, html.indexOf('>', scoreArcStart) + 1) : '';
assert.ok(html.includes('NO HEALTH SCORE') && scoreArc &&
          scoreArc.includes('stroke-dasharray="326.7"') &&
          scoreArc.includes('stroke-dashoffset="326.7"'),
  'the demo home must not display a fabricated partial health-score ring when no validated score exists');

assert.ok(html.includes('id="personalRecordSnapshot"') &&
          html.includes('本机个人记录') &&
          html.includes('独立于上方示例体征'),
  'home must expose a separate local-observation area, not merge personal measurements into demo vitals');
assert.ok(html.includes('legacy-app.js?v=20261020-health-real-trend-v2') &&
          html.includes('health-data-workspace.css?v=20261020-v3'),
  'home snapshot must load the cache-busted runtime and stylesheet');
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
