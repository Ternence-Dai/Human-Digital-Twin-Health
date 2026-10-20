'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/legacy-app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const start = app.indexOf('function buildObservationTrendSeries(');
const end = app.indexOf('function renderTrend()', start);
assert.ok(start >= 0 && end > start, 'health dashboard must expose a pure record-derived trend selector');
const context = vm.createContext({});
vm.runInContext(app.slice(start, end) + '\nthis.buildObservationTrendSeries = buildObservationTrendSeries;', context);

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
assert.ok(index.includes('近期真实记录趋势') &&
          index.includes('id="trendSummary"') &&
          index.includes('health-real-trend-v2'),
  'the report heading, metric summary and browser cache must match the real-record trend');
console.log('Health observation trend regression checks passed.');
