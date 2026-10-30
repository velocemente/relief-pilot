'use strict';
// E1b CBM unit tests (ADR-004 layers 4–5).
//
// Covers:
//   - validate: cross-checks pass on GTI7134 and FK ZUCK-UAAA baselines
//   - validate: 1-unit change on any of the 8 fuel/weight values → status WARN
//   - validate: completeness (CA, ETOPS, airports)
//   - toLegacyShape: key set equals the 57-key legacy return
//   - resolveValidity: Atlas inline (with R1/R2), FlightKeys ISO, unresolvable

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const { validate }                     = require('../../src/import/validate.js');
const { toLegacyShape, LEGACY_KEYS }   = require('../../src/import/legacy-shape.js');
const { resolveValidity, makeNotamRecord } = require('../../src/import/notam-record.js');
const { REGISTRY }                     = require('../../src/import/registry.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build a minimal CBM from the 8 explicit cross-check values.
// Fuel values stored as strings (matching _ofpRulesetParse convention).
function mkCbm({ block, tof, taxi, zfw, togw, ramp, trip, ldgw }) {
  return {
    blockFuelRaw: String(block),
    taxiFuelRaw:  String(taxi),
    tofFuelRaw:   tof,   // integer (canonical-only)
    zfwActual:    zfw,
    togwActual:   togw,
    rampWeight:   ramp,  // integer (canonical-only)
    tripFuelRaw:  trip,  // integer (canonical-only)
    ldgwActual:   ldgw,
  };
}

// GTI7134 reference values.
const GTI = { block: 78500, tof: 77300, taxi: 1200,
               zfw: 260345, togw: 337645, ramp: 338845,
               trip: 62099, ldgw: 275546 };

// FlightKeys ZUCK-UAAA reference values.
const FK  = { block: 78200, tof: 76850, taxi: 1350,
               zfw: 270718, togw: 347568, ramp: 348918,
               trip: 50584, ldgw: 296984 };

// ── Cross-check baseline: all 5 checks pass ───────────────────────────────────

test('validate cross-checks GTI7134 baseline → OK', () => {
  const { status, findings } = validate(mkCbm(GTI));
  const xchk = findings.filter(f => f.code.startsWith('XCHK_'));
  assert.equal(xchk.length, 0, `unexpected cross-check findings: ${JSON.stringify(xchk)}`);
  assert.equal(status, 'OK');
});

test('validate cross-checks FK ZUCK-UAAA baseline → OK', () => {
  const { status, findings } = validate(mkCbm(FK));
  const xchk = findings.filter(f => f.code.startsWith('XCHK_'));
  assert.equal(xchk.length, 0, `unexpected cross-check findings: ${JSON.stringify(xchk)}`);
  assert.equal(status, 'OK');
});

// ── 1-unit change on each of the 8 values → WARN ─────────────────────────────

const FIELDS = ['block', 'tof', 'taxi', 'zfw', 'togw', 'ramp', 'trip', 'ldgw'];

for (const field of FIELDS) {
  test(`GTI7134: ${field}+1 → WARN`, () => {
    const vals = { ...GTI, [field]: GTI[field] + 1 };
    const { status } = validate(mkCbm(vals));
    assert.equal(status, 'WARN', `expected WARN when ${field} is off by 1`);
  });
  test(`FK ZUCK-UAAA: ${field}+1 → WARN`, () => {
    const vals = { ...FK, [field]: FK[field] + 1 };
    const { status } = validate(mkCbm(vals));
    assert.equal(status, 'WARN', `expected WARN when ${field} is off by 1`);
  });
}

// ── Specific cross-check codes ────────────────────────────────────────────────

test('XCHK_TOF_TAXI_BLOCK fires when block off by 1', () => {
  const { findings } = validate(mkCbm({ ...GTI, block: GTI.block + 1 }));
  assert.ok(findings.some(f => f.code === 'XCHK_TOF_TAXI_BLOCK'));
});

test('XCHK_ZFW_TOF_TOGW fires when zfw off by 1', () => {
  const { findings } = validate(mkCbm({ ...GTI, zfw: GTI.zfw + 1 }));
  assert.ok(findings.some(f => f.code === 'XCHK_ZFW_TOF_TOGW'));
});

test('XCHK_TOGW_TAXI_RAMP fires when ramp off by 1', () => {
  const { findings } = validate(mkCbm({ ...GTI, ramp: GTI.ramp + 1 }));
  assert.ok(findings.some(f => f.code === 'XCHK_TOGW_TAXI_RAMP'));
});

test('XCHK_TOGW_TRIP_LDGW fires when ldgw off by 1', () => {
  const { findings } = validate(mkCbm({ ...GTI, ldgw: GTI.ldgw + 1 }));
  assert.ok(findings.some(f => f.code === 'XCHK_TOGW_TRIP_LDGW'));
});

test('XCHK_MINF_GT_TOF fires when minfFuelRaw > tofFuelRaw', () => {
  const cbm = { ...mkCbm(GTI), minfFuelRaw: String(GTI.tof + 1) };
  const { findings } = validate(cbm);
  assert.ok(findings.some(f => f.code === 'XCHK_MINF_GT_TOF'));
});

test('XCHK_MINF_GT_TOF absent when minfFuelRaw <= tofFuelRaw', () => {
  const cbm = { ...mkCbm(GTI), minfFuelRaw: String(GTI.tof - 1) };
  const { findings } = validate(cbm);
  assert.ok(!findings.some(f => f.code === 'XCHK_MINF_GT_TOF'));
});

// ── Completeness: CA ──────────────────────────────────────────────────────────

test('COMPLETENESS_NO_CA fires when crew list has no CA', () => {
  const cbm = { crewMembers: [{ role: 'FO', name: 'SMITH' }] };
  const { findings } = validate(cbm);
  assert.ok(findings.some(f => f.code === 'COMPLETENESS_NO_CA'));
  assert.ok(findings.find(f => f.code === 'COMPLETENESS_NO_CA').severity === 'FAIL');
});

test('COMPLETENESS_NO_CA absent when CA present', () => {
  const cbm = { crewMembers: [{ role: 'CA', name: 'JONES' }] };
  const { findings } = validate(cbm);
  assert.ok(!findings.some(f => f.code === 'COMPLETENESS_NO_CA'));
});

// ── Completeness: airport NOTAM + weather ─────────────────────────────────────

test('COMPLETENESS_NOTAM_KJFK fires when notams is null', () => {
  const cbm = {
    origIcao: 'KJFK', destIcao: 'EGLL',
    altData: {},
    airportData: { KJFK: { weather: 'METAR OK', notams: null }, EGLL: { weather: '', notams: '' } },
  };
  const { findings } = validate(cbm);
  assert.ok(findings.some(f => f.code === 'COMPLETENESS_NOTAM_KJFK'));
});

test('no completeness airport finding when explicit empty string', () => {
  const cbm = {
    origIcao: 'KJFK', destIcao: 'EGLL',
    altData: {},
    airportData: { KJFK: { weather: '', notams: '' }, EGLL: { weather: '', notams: '' } },
  };
  const { findings } = validate(cbm);
  assert.ok(!findings.some(f => f.code.startsWith('COMPLETENESS_NOTAM_') ||
                                f.code.startsWith('COMPLETENESS_WEATHER_')));
});

// ── Completeness: ETOPS ───────────────────────────────────────────────────────

test('COMPLETENESS_ETOPS fields fire when etopsEntry set but fields missing', () => {
  const cbm = { etopsEntry: '1200', etopsSpec: '', etopsEntryMins: 0 }; // exit fields missing
  const { findings } = validate(cbm);
  assert.ok(findings.some(f => f.code === 'COMPLETENESS_ETOPS_ETOPSEXIT'));
  assert.ok(findings.some(f => f.code === 'COMPLETENESS_ETOPS_ETOPSEXITMINS'));
});

test('no ETOPS completeness finding when all ETOPS fields present', () => {
  const cbm = { etopsEntry: '1200', etopsSpec: '180', etopsEntryMins: 90,
                etopsExit: '1600', etopsExitMins: 180 };
  const { findings } = validate(cbm);
  assert.ok(!findings.some(f => f.code.startsWith('COMPLETENESS_ETOPS_')));
});

// ── toLegacyShape key set ─────────────────────────────────────────────────────

test('toLegacyShape({}) key set equals the 57-key legacy return', () => {
  const out     = toLegacyShape({});
  const actual  = new Set(Object.keys(out));
  const expected = new Set(LEGACY_KEYS);
  assert.deepEqual(actual, expected);
  assert.equal(LEGACY_KEYS.length, 57);
});

test('toLegacyShape uses legacyEmpty for absent fields', () => {
  const out = toLegacyShape({});
  assert.deepEqual(out.crewMembers, []);
  assert.deepEqual(out.navLog, []);
  assert.equal(out.blockFuelRaw, '');
  assert.strictEqual(out.dotExemption, null);
  assert.strictEqual(out.slotTime, null);
  assert.equal(out.weightUnit, 'KGS');
});

test('toLegacyShape uses CBM value when present', () => {
  const out = toLegacyShape({ fltNum: 'GTI7134', blockFuelRaw: '78500' });
  assert.equal(out.fltNum, 'GTI7134');
  assert.equal(out.blockFuelRaw, '78500');
});

test('toLegacyShape excludes canonical-only fields', () => {
  const out = toLegacyShape({ tofFuelRaw: 77300, tripFuelRaw: 62099, rampWeight: 338845 });
  assert.ok(!('tofFuelRaw'  in out));
  assert.ok(!('tripFuelRaw' in out));
  assert.ok(!('rampWeight'  in out));
});

// ── resolveValidity: Atlas inline (standard DDMMMHHmm-DDMMMHHmm) ──────────────

test('resolveValidity: standard Atlas inline window', () => {
  const r = resolveValidity('A0001/26', '01MAR0000-31MAR2359', '2026-03-15');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2026, 2, 1, 0, 0));
  assert.equal(r.endMs,   Date.UTC(2026, 2, 31, 23, 59));
});

test('resolveValidity: PERM end token', () => {
  const r = resolveValidity('B0123/26', '01JAN0000-PERM', '2026-01-10');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2026, 0, 1, 0, 0));
  assert.ok(r.endMs > Date.UTC(2070, 0, 1)); // far-future sentinel
});

test('resolveValidity: B/C structured items', () => {
  const r = resolveValidity('', 'B) 2603010000 C) 2603312359', '2026-03-15');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2026, 2, 1, 0, 0));
  assert.equal(r.endMs,   Date.UTC(2026, 2, 31, 23, 59));
});

test('resolveValidity: R2 cross-year correction via /YY in NOTAM ID', () => {
  // NOTAM issued in /25 with start in DEC, end in JAN — start should be 2025.
  const r = resolveValidity('A1234/25', '15DEC0000-15JAN2359', '2026-01-10');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2025, 11, 15, 0, 0));
  assert.equal(r.endMs,   Date.UTC(2026, 0, 15, 23, 59));
});

// ── resolveValidity: FlightKeys ISO format ────────────────────────────────────

test('resolveValidity: FlightKeys ISO format', () => {
  const r = resolveValidity('', '2026-Oct-26 06:00 - 2026-Oct-27 16:00', '2026-10-26');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2026, 9, 26, 6, 0));
  assert.equal(r.endMs,   Date.UTC(2026, 9, 27, 16, 0));
});

test('resolveValidity: FlightKeys ISO format cross-month', () => {
  const r = resolveValidity('', '2026-Dec-30 00:00 - 2027-Jan-03 23:59', '2026-12-31');
  assert.equal(r.unresolvable, false);
  assert.equal(r.startMs, Date.UTC(2026, 11, 30, 0, 0));
  assert.equal(r.endMs,   Date.UTC(2027, 0,  3, 23, 59));
});

// ── resolveValidity: unresolvable ─────────────────────────────────────────────

test('resolveValidity: unresolvable returns flag', () => {
  const r = resolveValidity('', 'UNTIL FURTHER NOTICE', '2026-03-15');
  assert.equal(r.unresolvable, true);
  assert.strictEqual(r.startMs, null);
  assert.strictEqual(r.endMs,   null);
});

test('resolveValidity: empty validity string → unresolvable', () => {
  const r = resolveValidity('', '', '2026-03-15');
  assert.equal(r.unresolvable, true);
});

// ── makeNotamRecord ───────────────────────────────────────────────────────────

test('makeNotamRecord populates _prov and resolves window', () => {
  const prov = { page: 3, line: 42, quote: '01MAR0000-31MAR2359' };
  const rec  = makeNotamRecord({
    notamId:    'A0001/26',
    text:       'A0001/26 NOTAM TEXT 01MAR0000-31MAR2359',
    validity:   null,
    refDateISO: '2026-03-15',
    prov,
  });
  assert.equal(rec.notamId,      'A0001/26');
  assert.equal(rec.unresolvable, false);
  assert.equal(rec.startMs,      Date.UTC(2026, 2, 1, 0, 0));
  assert.deepEqual(rec._prov,    prov);
});

test('makeNotamRecord sets unresolvable when text has no date range', () => {
  const rec = makeNotamRecord({
    notamId: '', text: 'NO DATE RANGE HERE', validity: null, refDateISO: '2026-03-15', prov: null,
  });
  assert.equal(rec.unresolvable, true);
  assert.strictEqual(rec._prov, null);
});

// ── REGISTRY sanity ───────────────────────────────────────────────────────────

test('REGISTRY: all LEGACY_KEYS have legacyKey !== null', () => {
  for (const key of LEGACY_KEYS) {
    const def = REGISTRY[key];
    assert.ok(def, `REGISTRY missing entry for legacy key "${key}"`);
    assert.equal(def.legacyKey, key,
      `REGISTRY[${key}].legacyKey should equal "${key}", got "${def.legacyKey}"`);
  }
});

test('REGISTRY: canonical-only fields have legacyKey null', () => {
  for (const [key, def] of Object.entries(REGISTRY)) {
    if (def.legacyKey === null) {
      assert.ok(!LEGACY_KEYS.includes(key), `canonical-only field "${key}" should not be in LEGACY_KEYS`);
    }
  }
});

test('REGISTRY: every safetyClass is SC, OP, or INFO', () => {
  const valid = new Set(['SC', 'OP', 'INFO']);
  for (const [key, def] of Object.entries(REGISTRY)) {
    assert.ok(valid.has(def.safetyClass), `REGISTRY[${key}].safetyClass = "${def.safetyClass}"`);
  }
});
