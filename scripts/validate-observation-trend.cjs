'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/legacy-app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const start = app.indexOf('function buildObservationTrendGroups(');
const end = app.indexOf('function renderTrend()', start);
assert.ok(start >= 0 && end > start, 'health dashboard must expose a pure record-derived trend selector');
const context = vm.createContext({});
vm.runInContext(app.slice(start, end) + '\nthis.buildObservationTrendGroups = buildObservationTrendGroups; this.buildObservationTrendSeries = buildObservationTrendSeries;', context);

const history = [
  {metric:'心率',unit:'次/分',value:70,observedAt:'2026-10-01T08:00:00.000Z',recordState:'active'},
  {metric:'心率',unit:'次/分',value:72,observedAt:'2026-10-02T08:00:00.000Z',recordState:'active'},
  {metric:'心率',unit:'次/分',value:75,observedAt:'2026-10-03T08:00:00.000Z',recordState:'active'},
  {metric:'心率',unit:'次/分',value:99,observedAt:'2026-10-04T08:00:00.000Z',recordState:'superseded'},
  {metric:'血压',unit:'mmHg',value:120,observedAt:'2026-10-01T08:00:00.000Z',recordState:'active'},
  {metric:'血压',unit:'mmHg',value:121,observedAt:'2026-10-02T08:00:00.000Z',recordState:'active'},
  {metric:'体温',unit:'°C',value:38,observedAt:'2026-10-05T08:00:00.000Z',recordState:'voided'},
  {metric:'体重',unit:'kg',value:70,observedAt:'not-a-date',recordState:'active'},
  {metric:'心率',unit:'bpm',value:70,observedAt:'2026-10-05T08:00:00.000Z',recordState:'active'}
];
const trend = JSON.parse(JSON.stringify(context.buildObservationTrendSeries(history, 3)));
assert.equal(trend.metric, '心率');
assert.equal(trend.unit, '次/分');
assert.deepEqual(trend.points.map(point => [point.value, point.label]), [
  [70, '10-01'], [72, '10-02'], [75, '10-03']
], 'trend must use only active, valid observations and keep units separate');

assert.equal(context.buildObservationTrendSeries(history, 2).points.length, 2);
const mixedProvenance = [
  {metric:'静息心率',unit:'bpm',value:60,observedAt:'2026-10-01T08:00:00.000Z',recordState:'active',quality:'measured',source:'Wearable A'},
  {metric:'静息心率',unit:'bpm',value:61,observedAt:'2026-10-02T08:00:00.000Z',recordState:'active',quality:'measured',source:'Wearable A'},
  {metric:'静息心率',unit:'bpm',value:70,observedAt:'2026-10-03T08:00:00.000Z',recordState:'active',quality:'reported',source:'本人手动记录'},
  {metric:'静息心率',unit:'bpm',value:71,observedAt:'2026-10-04T08:00:00.000Z',recordState:'active',quality:'reported',source:'本人手动记录'}
];
const catalogue = JSON.parse(JSON.stringify(context.buildObservationTrendGroups(mixedProvenance)));
assert.equal(catalogue.length, 2, 'one physiological metric with two provenance streams must form two separate series');
const reportedKey = catalogue.find(group => group.quality === 'reported').key;
const reportedTrend = JSON.parse(JSON.stringify(
  context.buildObservationTrendSeries(mixedProvenance, 3, reportedKey)
));
assert.equal(reportedTrend.source, '本人手动记录');
assert.equal(reportedTrend.quality, 'reported');
assert.deepEqual(reportedTrend.points.map(point => point.value), [70, 71],
  'selected trend must never mix wearable measurements with manually reported data');

assert.equal(context.buildObservationTrendSeries([
  {metric:'单次指标',unit:'u',value:1,observedAt:'2026-10-01T00:00:00.000Z',recordState:'active'}
]), null, 'a single observation must not be turned into a trend');
assert.equal(context.buildObservationTrendSeries([]), null,
  'no user observations must result in no chart data, not fixed demo values');
assert.throws(() => context.buildObservationTrendSeries(history, 1),
  error => error && error.name === 'RangeError');
assert.ok(app.includes("row.recordState !== 'active'") &&
          app.includes('window.healthObservations') &&
          app.includes('renderTrend();') &&
          !app.includes('const data = [80, 82, 84]'),
  'the trend renderer must read the active local record ledger and refresh with the record list');
assert.ok(index.includes('有效观察趋势分析') &&
          index.includes('id="trendSummary"') &&
          index.includes('id="observationTrendMetric"') &&
          index.includes('id="observationTrendLimit"') &&
          index.includes('legacy-app.js?v=20261023-provenance-trend-v1'),
  'the report must expose provenance-aware metric and point-count controls with a fresh script cache');
console.log('Health observation trend regression checks passed.');
