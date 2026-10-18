'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8') + '\n' + fs.readFileSync('assets/js/health-demo-data.js', 'utf8') + '\n' + fs.readFileSync('assets/js/legacy-app.js', 'utf8');
assert.match(html, /本地预设的症状关键词条目/,
  'symptom tool must disclose its local keyword-based implementation');
assert.match(html, /不是人工智能诊断/,
  'symptom tool must not imply an AI diagnosis');
assert.match(html, /风险较低，也不能排除疾病/,
  'unmatched symptoms must not be presented as low risk');
assert.match(html, /示例体征 · 非真实测量数据/,
  'sample vitals must be clearly labeled');
assert.match(html, /未连接真实设备/,
  'demo device state must not imply a real connected device');
assert.doesNotMatch(html, /无限次 AI 智能问诊/,
  'demo must not advertise nonexistent AI consultation');
assert.match(html, /if\(role === 'user'\) bubble\.textContent/,
  'user-entered symptoms must be rendered as text to prevent HTML injection');
assert.ok(html.includes('function escHTML(value)'),
  'health result renderer must define an HTML escaping helper');
for (const token of [
  '${escHTML(r.organ)}', '${escHTML(r.meridian)}', '${escHTML(r.risk)}',
  '${escHTML(r.note)}', '${escHTML(JSON.stringify(json, null, 2))}', '${escHTML(r.advice)}'
]) assert.ok(html.includes(token), 'health result field must be escaped: ' + token);
assert.doesNotMatch(html, /\\$\\{r\\.(?:organ|meridian|risk|note|advice)\\}/,
  'health result data must not be interpolated into HTML without escaping');
console.log('Health demo disclosure and symptom safety checks passed.');

assert.match(html, /data-page="records"/, 'health observation page must be available');
assert.match(html, /onsubmit="return saveObservation\(event\)"/, 'observation form must call the save handler');
assert.match(html, /window\.HealthDomain\.createObservation/, 'records must use the domain provenance validator');
assert.match(html, /localStorage\.setItem\(OBSERVATION_STORAGE_KEY/, 'validated observations must persist locally');
assert.match(html, /escHTML\(row\.metric\)/, 'user-provided observation values must be escaped before rendering');
assert.match(html, /quality/, 'observation records must expose provenance quality');

assert.match(html, /onclick="exportObservations\(\)"/, 'health records must offer a JSON backup action');
assert.match(html, /function exportObservations\(\)/, 'JSON backup handler must exist');
assert.match(html, /schemaVersion:1/, 'export must include a versioned backup schema');
assert.match(html, /observations:rows/, 'export must include saved observation records');
assert.match(html, /URL\.revokeObjectURL\(url\)/, 'export must release its temporary object URL');
assert.match(html, /备份文件可能包含敏感健康信息/, 'export must warn users to protect sensitive backup files');

assert.match(html, /let observationStorageRecoveryRequired = false/, 'health cache recovery state must be explicit');
assert.match(html, /function preserveInvalidObservationStorage\(raw\)/, 'corrupted raw health cache must be preserved when possible');
assert.match(html, /'_recovery_'/, 'recovery copy must use a separate storage key');
assert.match(html, /已阻止后续保存覆盖原始数据/, 'corrupted cache must not be silently replaced');
assert.match(html, /if\(observationStorageRecoveryRequired\)/, 'saving must stop while cache recovery is required');

assert.match(html, /let observationDomainUnavailable = false/, 'domain loading failure must have a distinct safe state');
assert.match(html, /原始浏览器缓存未修改/, 'domain loading failure must preserve the original cache');
assert.match(html, /if\(observationDomainUnavailable\)/, 'reads, saves, and exports must stop while the validator is unavailable');

assert.match(html, /onclick="importObservations\(\)"/, 'health records must offer a JSON restore action');
assert.match(html, /async function importObservations\(\)/, 'JSON restore handler must exist');
assert.match(html, /payload\.schemaVersion !== 1/, 'restore must reject unsupported backup schemas');
assert.match(html, /payload\.observations\.map\(row => window\.HealthDomain\.createObservation\(row\)\)/, 'restore must validate every imported row before saving');
assert.match(html, /file\.size > 5 \* 1024 \* 1024/, 'restore must enforce a file size limit');
assert.match(html, /localStorage\.setItem\(OBSERVATION_STORAGE_KEY,JSON\.stringify\(next\)\)/, 'restore must persist the fully validated merged result');
assert.match(html, /跳过重复/, 'restore must report duplicate records');
