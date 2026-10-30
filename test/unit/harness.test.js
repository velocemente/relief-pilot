'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');
const { normalize } = require('../golden/serialize');

const app = loadApp();

test('harness exposes the four functions under test', () => {
  for (const n of ['_ofpRulesetParse', '_splitNotams', 'evalNotams', 'xNW_standalone']) {
    assert.equal(typeof app[n], 'function', n);
  }
});

test('_ofpRulesetParse: empty input gives null', () => {
  assert.equal(app._ofpRulesetParse(''), null);
  assert.equal(app._ofpRulesetParse('   \n'), null);
});

test('_ofpRulesetParse: flight id and weight unit from a minimal header', () => {
  const r = app._ofpRulesetParse('GTI7103/30 KLAX - RJAA 01 MAY 26 N407KZ\nB747-400F / CF680C2B1F / LBS / IFR\n');
  assert.equal(r.fltNum, 'GTI7103/30');
  assert.equal(r.weightUnit, 'LBS');
});

test('_ofpRulesetParse: weight unit defaults to KGS', () => {
  assert.equal(app._ofpRulesetParse('GTI7103/30 KLAX - RJAA\n').weightUnit, 'KGS');
});

test('_splitNotams: splits on "- ICAO" line starts, keeps single blocks whole', () => {
  // arrays come from the vm realm, so compare as JSON rather than by prototype
  const j = x => JSON.stringify(x);
  assert.equal(j(app._splitNotams('- KLAX\nA1\n- KORD\nB2')), j(['- KLAX\nA1\n', '- KORD\nB2']));
  assert.equal(j(app._splitNotams('no notam header here')), j(['no notam header here']));
});

test('xNW_standalone: B)/C) window is read as UTC', () => {
  const w = app.xNW_standalone('B) 2603010000 C) 2603312359 E) RWY 07R CLSD', '2026-03-15');
  assert.equal(w.startMs, Date.UTC(2026, 2, 1, 0, 0));
  assert.equal(w.endMs, Date.UTC(2026, 2, 31, 23, 59));
});

test('xNW_standalone: PERM end is far in the future; no dates gives null', () => {
  const w = app.xNW_standalone('B) 2603010000 C) PERM E) X', '2026-03-15');
  assert.ok(w.endMs > Date.UTC(2070, 0, 1));
  assert.equal(app.xNW_standalone('E) NO DATES HERE', '2026-03-15'), null);
});

test('evalNotams: no NOTAMs is "unknown"; an active runway closure is red', () => {
  assert.equal(app.evalNotams([], 'dest', null, 'B744', '2026-03-15').worst, 'unknown');
  const n = ['- KLAX 07R/25L CLSD\nB) 2603010000 C) 2603312359 E) RWY 07R/25L CLSD'];
  const r = app.evalNotams(n, 'dest', 600, 'B744', '2026-03-15');
  assert.equal(r.worst, 'red');
  assert.equal(r.issues[0].rwy, '07R/25L');
});

test('golden serializer: cross-realm Map/Set/NaN are tagged, keys sorted', () => {
  const r = app.evalNotams(['- KLAX 07R/25L CLSD\nB) 2603010000 C) 2603312359 E) RWY 07R/25L CLSD'], 'dest', 600, 'B744', '2026-03-15');
  assert.ok(normalize(r.rwyGroups).$map, 'Map from the vm realm must serialize as $map');
  assert.deepEqual(Object.keys(normalize({ b: 1, a: NaN })), ['a', 'b']);
  assert.equal(normalize({ a: NaN }).a, '$NaN');
});
