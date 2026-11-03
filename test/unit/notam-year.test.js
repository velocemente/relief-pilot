'use strict';
/**
 * TC-110 — NOTAM year resolution (HF-5)
 *
 * Decision table (headers "DDMMMhhmm-DDMMMhhmm [YYYY]" / "DDMMMhhmm-PERM"
 * whose NOTAM ID carries /YY; I = 2000 + YY):
 *   T1  End has a same-line year E: start year = SMALLEST Y in [I, E] with
 *       start(Y) <= end. (R1: year on the same line, 20xx only.)
 *   T2  End has no year: end year inferred as before; start year = SMALLEST
 *       Y in [I, endYear] with start(Y) <= end.
 *   T3  PERM: start year = I.
 *   T4  WEF / EFFECTIVE ... PERM: start year = I when the text has a /YY ID.
 *   T5  No /YY anywhere: behaviour unchanged.
 *   T6  Fail-safe: no resolvable window (or start > end) → IN EFFECT;
 *       evalNotams() no longer falls back to the legacy xNW().
 *
 * TC-110-S01..S08  synthetic lines (formerly TC-110-001..006, N01, N02)
 * TC-110-001..005  real lines from the fixture packages (FAIL if fixtures missing)
 * TC-110-007       year boundary (synthetic)
 * TC-110-008       fail-safe in evalNotams()
 * TC-110-009       negative: no /YY ID → same window as before HF-5
 *
 * Real-line tests assert only dates and NOTAM IDs; no fixture text is copied here.
 * All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { loadApp } = require('../harness');

const app = loadApp();
const xNW = app.xNW_standalone;

function utcMs(year, mon1, day, hh, mm) {
  return Date.UTC(year, mon1 - 1, day, hh, mm);
}
function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }

// Window overlaps the UTC flight day [00:00Z, 24:00Z). No window = in effect (T6).
function inEffectOn(w, iso) {
  if (!w) return true;
  const d0 = Date.parse(iso + 'T00:00:00Z');
  return w.startMs < d0 + 86400000 && w.endMs > d0;
}

// ── Fixtures path resolution (same candidates as atlas-fk.test.js) ────────
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_CANDIDATES = [
  process.env.PB_FIXTURES,
  path.join(ROOT, 'fixtures'),
  path.join(ROOT, '..', 'pilotbrief-fixtures'),
].filter(Boolean);
const FIXTURES_DIR = FIXTURES_CANDIDATES.find(d => {
  try { return fs.existsSync(path.join(d, 'manifest.json')); } catch (_) { return false; }
});
const MANIFEST = FIXTURES_DIR
  ? JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'))
  : null;

// Never skip: without fixtures every real-line test fails here.
function requireFixtures() {
  assert.ok(FIXTURES_DIR, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
}
function fixture(id) {
  requireFixtures();
  const fx = MANIFEST.fixtures.find(f => f.id === id);
  assert.ok(fx, `fixture ${id} not in manifest`);
  return { fx, raw: fs.readFileSync(path.join(FIXTURES_DIR, fx.files.text), 'utf8') };
}
// Every NOTAM in the package whose header is "- ICAO <id> ...".
function notamsFor(fixtureId, icao, id) {
  const { fx, raw } = fixture(fixtureId);
  const hits = app._splitNotams(raw).filter(n => n.startsWith(`- ${icao} ${id} `));
  assert.ok(hits.length > 0, `${icao} ${id} not found in ${fixtureId}`);
  return { date: fx.date, hits };
}
// Resolve every occurrence at the fixture's flight date and run check(w, date).
function eachWindow(fixtureId, icao, id, check) {
  const { date, hits } = notamsFor(fixtureId, icao, id);
  for (const n of hits) {
    const w = xNW(n, date);
    assert.ok(w, `${icao} ${id}: a window is expected`);
    check(w, date);
  }
}

// ══ Synthetic lines (renamed from TC-110-001..006, N01, N02) ═════════════

test('TC-110-S01 R1: daily schedule on next line not read as trailing year', () => {
  const r = xNW('A0100/26 05JAN0000-30JAN2359\nD) 1410-2030', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0),  'start 2026-01-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

test('TC-110-S02 R1: valid 20xx trailing year on same line still accepted', () => {
  const r = xNW('05JAN0000-30JAN2359 2026', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0),  'start 2026-01-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

test('TC-110-S03 T1: same-month inverted window anchored to /YY issue year', () => {
  // Issued /26; end year 2027; smallest Y in [2026, 2027] with start <= end → 2026.
  const r = xNW('A0100/26 22OCT1455-22OCT1454 2027', '2026-10-22');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 10, 22, 14, 55), 'start 2026-10-22 14:55Z');
  assert.equal(r.endMs,   utcMs(2027, 10, 22, 14, 54), 'end 2027-10-22 14:54Z');
});

test('TC-110-S04 T2: cross-month window anchored to /YY issue year', () => {
  // Issued /25; DEC→JAN; no end year → end 2026; smallest Y = 2025.
  const r = xNW('A0100/25 05DEC0000-30JAN2359', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2025, 12, 5, 0, 0),  'start 2025-12-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

test('TC-110-S05 T3: PERM NOTAM end is far in the future', () => {
  const r = xNW('A0100/26 05JAN0000-PERM', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.ok(r.endMs > utcMs(2070, 1, 1, 0, 0), 'endMs far in future');
});

test('TC-110-S06 T1: /YY same year, non-inverted → start in issue year', () => {
  const r = xNW('A0100/26 10MAR0800-10MAR1800', '2026-03-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 3, 10, 8, 0),  'start 2026-03-10 08:00Z');
  assert.equal(r.endMs,   utcMs(2026, 3, 10, 18, 0), 'end 2026-03-10 18:00Z');
});

test('TC-110-S07 negative: A0100/26 JAN window on flight 2026-01-10', () => {
  const r = xNW('- XXXX A0100/26 05JAN0000-30JAN2359', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0), 'start 2026-01-05 00:00Z');
});

test('TC-110-S08 negative: no NOTAM ID falls back to heuristic', () => {
  const r = xNW('05FEB0100-28FEB2359', '2026-02-15');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 2, 5, 1, 0),   'start 2026-02-05 01:00Z');
  assert.equal(r.endMs,   utcMs(2026, 2, 28, 23, 59), 'end 2026-02-28 23:59Z');
});

test('TC-110-S09 T1: smallest year, not latest — /25 start with end year 2026', () => {
  // Start SEP, end OCT 2026. 2026-09-08 also fits, but the earliest is 2025.
  const r = xNW('- XXXX A0100/25 08SEP1200-31OCT1200 2026', '2026-03-13');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2025, 9, 8, 12, 0), 'start 2025-09-08 12:00Z');
  assert.equal(r.endMs,   utcMs(2026, 10, 31, 12, 0), 'end 2026-10-31 12:00Z');
  assert.ok(inEffectOn(r, '2026-03-13'));
});

test('TC-110-S10 T3: PERM start uses the /YY issue year, not the flight year', () => {
  const r = xNW('- XXXX A0100/23 24AUG1424-PERM', '2026-03-12');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2023, 8, 24, 14, 24), 'start 2023-08-24 14:24Z');
  assert.ok(inEffectOn(r, '2026-03-12'));
});

test('TC-110-S11 T4: WEF / EFFECTIVE ... PERM with /YY → start in issue year', () => {
  const a = xNW('- XXXX A0100/24 WEF 05AUG0000 UFC PERM', '2026-03-10');
  assert.ok(a, 'WEF: should return a window');
  assert.equal(a.startMs, utcMs(2024, 8, 5, 0, 0), 'WEF start 2024-08-05 00:00Z');
  assert.ok(inEffectOn(a, '2026-03-10'));
  const b = xNW('- XXXX A0100/25 EFFECTIVE 05AUG0000 UNTIL PERM', '2026-03-10');
  assert.ok(b, 'EFFECTIVE: should return a window');
  assert.equal(b.startMs, utcMs(2025, 8, 5, 0, 0), 'EFFECTIVE start 2025-08-05 00:00Z');
});

test('TC-110-S12 T4 negative: WEF ... PERM without /YY → start in flight year (unchanged)', () => {
  const a = xNW('WEF 05AUG0000 UFC PERM', '2026-03-10');
  assert.ok(a, 'should return a window');
  assert.equal(a.startMs, utcMs(2026, 8, 5, 0, 0), 'start 2026-08-05 00:00Z');
  assert.equal(inEffectOn(a, '2026-03-10'), false);
});

// ══ Real lines from the fixture packages ═════════════════════════════════

test('TC-110-001 RJAA A0486/26: next-line schedule not read as a year', () => {
  const FX = 'NB_RJAA-PANC_11APR26_notamschedule_rev5';
  const { hits } = notamsFor(FX, 'RJAA', 'A0486/26');
  for (const n of hits) {
    const lines = n.split('\n');
    assert.match(lines[1] || '', /^1410-2030\b/, 'the next line is the daily schedule');
  }
  eachWindow(FX, 'RJAA', 'A0486/26', w => {
    assert.equal(w.startMs, utcMs(2026, 4, 1, 14, 10),  'start 2026-04-01 1410Z');
    assert.equal(w.endMs,   utcMs(2026, 4, 30, 20, 30), 'end 2026-04-30 2030Z');
  });
});

test('TC-110-002 PAED V0716/25 and A0001/25 start in their issue year', () => {
  const FX = 'NB_RODN-PANC_13MAR26_etops_rev16';
  eachWindow(FX, 'PAED', 'V0716/25', (w, date) => {
    assert.equal(isoDay(w.startMs), '2025-09-08', 'V0716/25 start');
    assert.equal(isoDay(w.endMs),   '2026-10-31', 'V0716/25 end');
    assert.equal(date, '2026-03-13');
    assert.ok(inEffectOn(w, date), 'V0716/25 in effect on 2026-03-13');
  });
  eachWindow(FX, 'PAED', 'A0001/25', w => {
    assert.equal(isoDay(w.startMs), '2025-06-14', 'A0001/25 start');
  });
});

test('TC-110-003 KORD A8813/25 and A8811/25 (FAA "(nn/nnn)" headers) start 2025-12-30', () => {
  const FX = 'NB_EBLG-KORD_12OCT26_remarksdump_rev11';
  for (const id of ['A8813/25', 'A8811/25']) {
    eachWindow(FX, 'KORD', id, (w, date) => {
      assert.equal(isoDay(w.startMs), '2025-12-30', `${id} start`);
      assert.equal(date, '2026-10-12');
      assert.ok(inEffectOn(w, date), `${id} in effect on 2026-10-12`);
    });
  }
});

test('TC-110-004 KCHS-LIBG: PERM and long-term NOTAMs start in the right year', () => {
  const FX = 'NB_KCHS-LIBG_12MAR26_lcf_rev16';
  const cases = [
    ['EDDF', 'A6663/25', '2025-12-17', null],
    ['EIDW', 'B1124/23', '2023-08-24', null],
    ['KCHS', 'A0155/26', '2026-03-12', null],
    ['KZJX', 'A0144/26', '2026-01-28', '2028-01-29'],
  ];
  for (const [icao, id, start, end] of cases) {
    eachWindow(FX, icao, id, (w, date) => {
      assert.equal(isoDay(w.startMs), start, `${icao} ${id} start`);
      if (end) assert.equal(isoDay(w.endMs), end, `${icao} ${id} end`);
      assert.equal(date, '2026-03-12');
      assert.ok(inEffectOn(w, date), `${icao} ${id} in effect on 2026-03-12`);
    });
  }
});

test('TC-110-005 every Navtech/eOFP fixture: no start before 2000, no start after end', () => {
  requireFixtures();
  const HEADER_RE = /^- [A-Z]{4}\b.*\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}-(?:\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/;
  const fixtures = MANIFEST.fixtures.filter(f => f.format !== 'flightkeys');
  assert.ok(fixtures.length > 0, 'Navtech/eOFP fixtures expected');
  let checked = 0;
  const bad = [];
  for (const fx of fixtures) {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, fx.files.text), 'utf8');
    for (const n of app._splitNotams(raw)) {
      const first = n.split('\n')[0];
      if (!HEADER_RE.test(first)) continue;
      checked++;
      const w = xNW(n, fx.date);
      if (!w) continue;   // no window → in effect (T6)
      const id = (first.match(/\b[A-Z]\d{4}\/\d{2}\b/) || ['(no id)'])[0];
      if (new Date(w.startMs).getUTCFullYear() < 2000) bad.push(`${fx.id} ${first.slice(2, 6)} ${id}: start before 2000`);
      if (w.startMs > w.endMs) bad.push(`${fx.id} ${first.slice(2, 6)} ${id}: start after end`);
    }
  }
  assert.ok(checked > 1000, `NOTAM headers checked: ${checked}`);
  assert.deepEqual(bad, []);
});

// ══ Year boundary (synthetic) ════════════════════════════════════════════

test('TC-110-007 year boundary: /25 January NOTAM and DEC→JAN NOTAM', () => {
  const jan = '- XXXX A9999/25 05JAN0000-30JAN2359';
  assert.equal(inEffectOn(xNW(jan, '2026-01-10'), '2026-01-10'), true,  'in effect on 2026-01-10');
  const w = xNW(jan, '2025-12-30');
  assert.ok(w, 'a window is expected on 2025-12-30');
  assert.equal(inEffectOn(w, '2025-12-30'), false, 'not in effect on 2025-12-30');
  const dec = '- XXXX A9998/25 28DEC0000-05JAN2359';
  const w2 = xNW(dec, '2026-01-02');
  assert.ok(w2, 'a window is expected');
  assert.equal(w2.startMs, utcMs(2025, 12, 28, 0, 0), 'start 2025-12-28 00:00Z');
  assert.equal(w2.endMs,   utcMs(2026, 1, 5, 23, 59), 'end 2026-01-05 23:59Z');
  assert.equal(inEffectOn(w2, '2026-01-02'), true, 'in effect on 2026-01-02');
});

// ══ Fail-safe (T6) ═══════════════════════════════════════════════════════

function evalShows(notam, iso) {
  const r = app.evalNotams([notam], 'DEST', 600, 'B744', iso);
  return r.issues.some(i => i.notamRaw === notam);
}

test('TC-110-008 fail-safe: unreadable date range → no window, in effect in evalNotams()', () => {
  // Inverted range with no year in [I, E] that puts the start before the end.
  const inverted = '- XXXX A0100/26 30JAN0000-05JAN2359 2026\nRWY 09/27 CLSD\n';
  assert.equal(xNW(inverted, '2026-06-01'), null, 'no window for an inverted range');
  assert.equal(evalShows(inverted, '2026-06-01'), true, 'inverted range shown as in effect');
  // Issue year after the end year.
  const future = '- XXXX A0100/30 05JAN0000-30JAN2359\nRWY 09/27 CLSD\n';
  assert.equal(xNW(future, '2026-06-01'), null, 'no window when issue year > end year');
  assert.equal(evalShows(future, '2026-06-01'), true, 'shown as in effect');
});

test('TC-110-008N fail-safe negative: a readable expired window is still not in effect', () => {
  const expired = '- XXXX A0101/26 01FEB0000-05FEB2359\nRWY 09/27 CLSD\n';
  assert.ok(xNW(expired, '2026-06-01'), 'window resolved');
  assert.equal(evalShows(expired, '2026-06-01'), false, 'expired NOTAM not shown');
});

// ══ Negative: no /YY ID → unchanged (T5) ═════════════════════════════════

test('TC-110-009 negative: no /YY ID gives the same window as main', () => {
  // Expected values are main (5d3636f) xNW_standalone output for these lines.
  const cases = [
    ['05FEB0100-28FEB2359',              '2026-03-10', '2026-02-05T01:00', '2026-02-28T23:59'],
    ['- XXXX 05DEC0000-30JAN2359',       '2026-03-10', '2026-12-05T00:00', '2027-01-30T23:59'],
    ['- XXXX 05DEC0000-30JAN2359',       '2026-01-10', '2025-12-05T00:00', '2026-01-30T23:59'],
    ['- XXXX 05AUG0000-PERM',            '2026-03-10', '2026-08-05T00:00', '2076-01-01T00:00'],
    ['- XXXX 22OCT1455-22OCT1454 2027',  '2026-03-10', '2026-10-22T14:55', '2027-10-22T14:54'],
    ['- XXXX 01APR1410-30APR2030\n1410-2030', '2026-04-11', '2026-04-01T14:10', '2026-04-30T20:30'],
  ];
  for (const [line, iso, start, end] of cases) {
    const w = xNW(line, iso);
    assert.ok(w, `${line}: window expected`);
    assert.equal(new Date(w.startMs).toISOString().slice(0, 16), start, `${line} @ ${iso} start`);
    assert.equal(new Date(w.endMs).toISOString().slice(0, 16),   end,   `${line} @ ${iso} end`);
  }
});
