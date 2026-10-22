'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8') + '\n' + fs.readFileSync('assets/js/health-demo-data.js', 'utf8') + '\n' + fs.readFileSync('assets/js/legacy-app.js', 'utf8');
const productCss = fs.readFileSync('assets/css/workspace.css', 'utf8');
assert.ok(html.includes('workspace.css?v=20261022-record-first-v2'),
  'health app must load the record-first product workspace stylesheet');
assert.match(productCss, /Health data workspace redesign/,
  'health product design layer must be explicitly versioned');
for (const selector of [
  '.sidebar{', '.topbar{', '.health-home-dashboard{', '.health-home-primary',
  '.health-home-trust', '.health-home-modules', '.health-section-intro',
  '.health-report-integrity', '#observationForm{', '#observationList{', '.tabbar{'
]) assert.ok(productCss.includes(selector),
  'health V3 design must style the major product area: ' + selector);
assert.ok(productCss.includes('@media(max-width:860px)'),
  'health redesign must include tablet/mobile layout rules');
assert.ok(productCss.includes('@media(max-width:520px)'),
  'health redesign must include narrow phone layout rules');

assert.ok(productCss.includes('.health-home-dashboard{') &&
          productCss.includes('.health-home-trust{') &&
          productCss.includes('.health-knowledge-modal__boundary{') &&
          productCss.includes('.health-meridian-reference-grid{'),
  'record-first health workspace must distinguish observations, anatomy education and traditional-theory references');
assert.ok(productCss.includes('@media(max-width:860px)') &&
          productCss.includes('@media(max-width:520px)') &&
          productCss.includes('.product-workflow__item:hover'),
  'health V4 must include responsive workflow layouts and interactive focus affordances');

assert.match(productCss, /prefers-reduced-motion:reduce/,
  'health redesign must respect reduced-motion preferences');

assert.match(html, /症状资料导航/,
  'symptom page must be an information directory, not a pseudo-triage panel');
assert.match(html, /https:\/\/medlineplus\.gov\/symptoms\.html/,
  'symptom navigation must link to the official MedlinePlus symptom directory');
assert.match(html, /https:\/\/www\.nhs\.uk\/symptoms\//,
  'symptom navigation must link to the official NHS symptom directory');
assert.match(html, /不会把症状描述映射为器官、经络、疾病或风险等级/,
  'symptom input must disclose that it does not infer diagnoses or risk levels');
assert.match(html, /PERSONAL HEALTH RECORDS · FHIR-ALIGNED/,
  'home must be a record-first personal health workspace');
assert.match(html, /id="personalRecordSnapshot"/,
  'home must show the validated local observation snapshot');
assert.match(html, /数据边界/,
  'home must state source, measurement and clinical interpretation boundaries');
assert.match(html, /近期有效记录趋势/,
  'report page must use the current observation-driven trend');
assert.doesNotMatch(html, /今日体征|综合健康总分（演示）|六维能力雷达（演示）|126\/82|72 bpm|84 分/,
  'home and report must not present fabricated patient-like vital signs or a synthetic overall score');
assert.match(html, /图谱演示说明/,
  'digital human must be described as an anatomy education model');
assert.match(html, /未连接真实设备/,
  'current device status must not imply a real connected device');
assert.doesNotMatch(html, /无限次 AI 智能问诊/,
  'demo must not advertise nonexistent AI consultation');
assert.match(html, /if\(role === 'user'\) bubble\.textContent/,
  'user-entered symptoms must be rendered as text to prevent HTML injection');
assert.ok(html.includes('function escHTML(value)'),
  'health result renderer must define an HTML escaping helper');
const anatomyData = fs.readFileSync('assets/js/health-demo-data.js', 'utf8');
const organData = anatomyData.slice(anatomyData.indexOf('const ORGANS = ['), anatomyData.indexOf('const MERIDIANS_12'));
const meridianData = anatomyData.slice(anatomyData.indexOf('const MERIDIANS_12'), anatomyData.indexOf('const ACUPOINTS'));
assert.equal((organData.match(/\{ id:'/g) || []).length, 12,
  'all 12 anatomy entries must be preserved');
assert.doesNotMatch(organData, /score:|risk:|metrics:|history:|advice:/,
  'anatomy reference data must not contain fabricated patient scores, lab results or histories');
assert.doesNotMatch(meridianData, /energy:|status:/,
  'meridian theory reference data must not contain fabricated energy or blockage states');
assert.match(html, /function renderVesselMetrics\(/,
  'vascular metrics renderer must exist');
assert.match(html, /row\.recordState === 'active'/,
  'vascular data must be drawn only from active observations');
assert.ok(html.includes('function runAnalysis(query)'),
  'symptom navigation must use a non-diagnostic information-directory handler');
assert.ok(html.includes('escHTML(text)'),
  'user query text must be escaped before it is displayed beside official resources');
assert.ok(html.includes('escHTML(source.url)'),
  'public resource URLs must be escaped before insertion into trusted navigation markup');
assert.doesNotMatch(html, /function matchSymptom\\(|const r = matchSymptom|关键词匹配完成|匹配人体器官图谱|匹配经络循行路径/,
  'the old organ/meridian symptom matcher and simulated analysis sequence must be removed');
const symptomSource = anatomyData.slice(anatomyData.indexOf('const SYMPTOM_REFERENCE_SOURCES'));
assert.ok(symptomSource.includes('https://medlineplus.gov/symptoms.html'));
assert.ok(symptomSource.includes('https://www.nhs.uk/symptoms/'));
assert.doesNotMatch(symptomSource, /risk:|lv:|meridian:|organ:/,
  'symptom reference sources must not carry unsupported risk or organ mappings');
console.log('Health demo disclosure and symptom safety checks passed.');

assert.match(html, /data-page="records"/, 'health observation page must be available');
assert.match(html, /onsubmit="return saveObservation\(event\)"/, 'observation form must call the save handler');
assert.match(html, /<select name="quality" required><option value="" selected disabled>请选择数据质量来源<\/option><option value="measured">/,
  'health observation quality must start unselected, never default to measured');
assert.match(html, /手动自述请选择 reported.*文件导入请选择 imported.*示例值请选择 demo/,
  'the observation form must explain the correct provenance choice for manual, imported and demo data');
assert.match(html, /window\.HealthDomain\.createObservation/, 'records must use the domain provenance validator');
assert.match(html, /const rows = window\.HealthDomain\.normalizeObservationHistory\(/,
  'records UI must validate complete observation version history before display');
assert.match(html, /Date\.parse\(b\.recordedAt \|\| b\.amendedAt \|\| b\.observedAt\)/,
  'records UI must order versions by actual record or amendment time');
assert.match(html, /function beginObservationAmendment\(id\)/,
  'records UI must offer append-only observation correction');
assert.match(html, /function voidObservationRecord\(id\)/,
  'records UI must offer traceable observation voiding');
assert.match(html, /window\.HealthDomain\.amendObservation\(/,
  'corrections must use the domain version lifecycle');
assert.match(html, /window\.HealthDomain\.mergeObservationHistories\(/,
  'imports must merge versioned history without reverting superseded observations');
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
assert.match(html, /window\.HealthDomain\.normalizeObservationHistory\(payload\.observations\)/, 'restore must validate imported measurement rows and version metadata before saving');
assert.match(html, /file\.size > 5 \* 1024 \* 1024/, 'restore must enforce a file size limit');
assert.match(html, /localStorage\.setItem\(OBSERVATION_STORAGE_KEY,JSON\.stringify\(next\)\)/, 'restore must persist the fully validated merged result');
assert.match(html, /window\.HealthDomain\.mergeObservationHistories\(existing, imported\)/, 'restore must merge versioned history without reverting prior corrections');

assert.match(html, /if\(next\.length > 10000\)/, 'restore must cap the merged local dataset, not only the imported file');
assert.match(html, /本地健康记录最多保存 10000 个版本/, 'manual entry must cap the complete version history');

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

assert.match(html, /本机有效健康记录/,
  'circulatory workspace must be backed by local observation records');
assert.match(html, /血管解剖结构示意/,
  'vascular page must present anatomy reference rather than fabricated measurements');
assert.match(html, /十二正经 · 理论路径/,
  'meridian view must be identified as a traditional-theory reference');
assert.match(html, /不把经络概念解释为已经验证的解剖结构/,
  'meridian information must not imply measured physiology');
assert.match(html, /本机浏览器保存 · 未连接真实设备/,
  'the current local-only storage and device status must be explicit');
