'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8') + '\n' + fs.readFileSync('assets/js/health-demo-data.js', 'utf8') + '\n' + fs.readFileSync('assets/js/legacy-app.js', 'utf8');
const productCss = fs.readFileSync('assets/css/product-system.css', 'utf8');
assert.ok(html.includes('product-system.css?v=20261018-v3'),
  'health app must load the visible V3 product interface stylesheet');
assert.match(productCss, /Health data workspace redesign/,
  'health product design layer must be explicitly versioned');
for (const selector of [
  '.sidebar{', '.topbar{', '.health-intro{', '.score-card{',
  '.metric-card{', '.quick-item{', '#observationForm{',
  '#observationList{', '.tabbar{'
]) assert.ok(productCss.includes(selector),
  'health V3 design must style the major product area: ' + selector);
assert.match(productCss, /@media\\(max-width:860px\\)/,
  'health redesign must include tablet/mobile layout rules');
assert.match(productCss, /@media\\(max-width:520px\\)/,
  'health redesign must include narrow phone layout rules');
assert.match(productCss, /prefers-reduced-motion:reduce/,
  'health redesign must respect reduced-motion preferences');

assert.match(html, /本地预设的症状关键词条目/,
  'symptom tool must disclose its local keyword-based implementation');
assert.match(html, /不是人工智能诊断/,
  'symptom tool must not imply an AI diagnosis');
assert.match(html, /风险较低，也不能排除疾病/,
  'unmatched symptoms must not be presented as low risk');
assert.match(html, /示例体征 · 非真实测量数据/,
  'sample vitals must be clearly labeled');
assert.match(html, /演示数据说明/,
  'hard-coded health scores and trends must have a prominent demo disclaimer');
assert.match(html, /不来自本地健康记录、真实设备或医学检查/,
  'demo scores must not be confused with user observations or clinical test results');
assert.match(html, /综合健康总分（演示）/,
  'the hard-coded total score must be labeled as demo data');
assert.match(html, /六维能力雷达（演示）/,
  'static radar metrics must be labeled as demo data');
assert.match(html, /近 3 次检测趋势（演示）/,
  'static trend data must be labeled as demo data');
assert.match(html, /图谱演示说明/,
  'digital human organ positions and state labels must be labeled as a visual demo');
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
assert.match(html, /const rows = window\.HealthDomain\.chronologicalObservations\(\s*Array\.isArray\(window\.healthObservations\)/,
  'records UI must use the shared chronological sorter for its validated observations');
assert.match(html, /\)\.reverse\(\);/,
  'records UI must present the newest validated observation first');
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
assert.match(html, /catch \(error\) \{\s*observationDomainUnavailable = true;/,
  'a failed dynamic import must activate the unavailable state even when the cache is empty');
assert.match(html, /原始浏览器缓存未修改/, 'domain loading failure must preserve the original cache');
assert.match(html, /if\(observationDomainUnavailable\)/, 'reads, saves, and exports must stop while the validator is unavailable');

assert.match(html, /onclick="importObservations\(\)"/, 'health records must offer a JSON restore action');
assert.match(html, /async function importObservations\(\)/, 'JSON restore handler must exist');
assert.match(html, /payload\.schemaVersion !== 1/, 'restore must reject unsupported backup schemas');
assert.match(html, /payload\.observations\.map\(row => window\.HealthDomain\.createObservation\(row\)\)/, 'restore must validate every imported row before saving');
assert.match(html, /file\.size > 5 \* 1024 \* 1024/, 'restore must enforce a file size limit');
assert.match(html, /localStorage\.setItem\(OBSERVATION_STORAGE_KEY,JSON\.stringify\(next\)\)/, 'restore must persist the fully validated merged result');
assert.match(html, /跳过重复/, 'restore must report duplicate records');

assert.match(html, /if\(next\.length > 10000\)/, 'restore must cap the merged local dataset, not only the imported file');
assert.match(html, /本地健康记录最多保存 10000 条/, 'manual entry must enforce the same local record cap as JSON restore');

assert.match(html, /parseLocalObservationDateTime\(localDate\)/,
  'manual observations must reject invalid local calendar values before UTC conversion');
const dateParserMatch = html.match(/function parseLocalObservationDateTime\(value\)\s*\{[\s\S]*?\n\}/);
assert.ok(dateParserMatch, 'strict local datetime parser must exist');
const parseLocalObservationDateTime = vm.runInNewContext('(' + dateParserMatch[0] + ')');
assert.equal(new Date(parseLocalObservationDateTime('2026-10-18T08:30')).toISOString(),
  new Date('2026-10-18T08:30').toISOString(), 'valid datetime-local values must keep local-time conversion semantics');
for (const invalid of ['2026-02-30T08:30','2026-13-01T08:30','2026-10-18T24:00','2026-10-18T08:60','2026-10-18T08:30:00.1234']) {
  assert.throws(() => parseLocalObservationDateTime(invalid),
    error => error && error.name === 'TypeError',
    'invalid datetime-local value must not be silently normalized: ' + invalid);
}

assert.match(html, /循环系统指标（演示）/,
  'vascular metrics must be explicitly marked as demonstration data');
assert.match(html, /风险评估（演示）/,
  'vascular risk blocks must be explicitly marked as demonstration data');
assert.match(html, /不是实时设备测量、医学检查结果或个体化风险评估/,
  'vascular demo must disclose that static values are not personal clinical results');
assert.match(html, /经络热力图（演示）/,
  'meridian heatmap must be explicitly marked as demonstration data');
assert.match(html, /十二正经（演示）/,
  'meridian twelve-channel panel must be explicitly marked as demonstration data');
assert.match(html, /奇经八脉（演示）/,
  'extraordinary-vessel panel must be explicitly marked as demonstration data');
assert.match(html, /不是生理检测结果，也不会由设备自动计算/,
  'meridian demo must disclose its static provenance');
assert.match(html, /演示能量值/,
  'meridian detail modal must not imply a measured energy value');
