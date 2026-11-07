'use strict';
/**
 * TC-111 — the two copies of the NOTAM window rules agree
 *
 * The app resolves a NOTAM's validity window in xNW_standalone() (src/notam.html,
 * rules T1-T6 from HF-5, plus D38). The import engine keeps its own copy in
 * resolveValidity() (src/import/notam-record.js). The engine is not in the app
 * yet; this test stops the two copies drifting apart before it is.
 *
 *   TC-111-001  every NOTAM in every Navtech/eOFP fixture: same start, same end;
 *               where the app returns no window the engine returns unresolvable.
 *               Fixtures missing = FAIL (never skip).
 *   TC-111-010..  engine rules on synthetic lines, each with a negative case
 *               (T1 smallest year, T2 cross-month, T3 PERM, T4 WEF/EFFECTIVE PERM,
 *               T5 no /YY unchanged, T6 unresolvable, D38, impossible dates).
 *
 * Messages name fixture ids, ICAO codes, NOTAM IDs and dates only; no fixture text.
 * All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { loadApp } = require('../harness');
// PB_NOTAM_RECORD lets a run point at a modified copy (used to prove the test bites).
const { resolveValidity } = require(process.env.PB_NOTAM_RECORD ||
  path.resolve(__dirname, '..', '..', 'src', 'import', 'notam-record.js'));

const app = loadApp();
const xNW = app.xNW_standalone;

// ── Fixtures path resolution (same candidates as notam-year.test.js) ──────
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

// The NOTAM ID as the app reads it: first "X0000/YY" in the NOTAM text, or ''.
function notamIdOf(text) {
  const m = text.toUpperCase().match(/\b[A-Z]\d{4}\/\d{2}\b/);
  return m ? m[0] : '';
}

// Compare the two copies on one NOTAM text. Returns null when they agree,
// otherwise a short description with dates only.
function disagreement(text, iso) {
  const a = xNW(text, iso);
  const e = resolveValidity(notamIdOf(text), text, iso);
  const d = ms => (ms === null || ms === undefined ? 'null' : new Date(ms).toISOString().slice(0, 16) + 'Z');
  if (a === null) {
    if (e.unresolvable === true && e.startMs === null && e.endMs === null) return null;
    return `app: no window; engine: ${d(e.startMs)} -> ${d(e.endMs)} (unresolvable=${e.unresolvable})`;
  }
  if (e.unresolvable === true) {
    return `app: ${d(a.startMs)} -> ${d(a.endMs)}; engine: unresolvable`;
  }
  if (a.startMs === e.startMs && a.endMs === e.endMs) return null;
  return `app: ${d(a.startMs)} -> ${d(a.endMs)}; engine: ${d(e.startMs)} -> ${d(e.endMs)}`;
}

// ══ Every NOTAM in every Navtech/eOFP fixture ════════════════════════════

test('TC-111-001 every Navtech/eOFP fixture NOTAM: app and engine give the same window', () => {
  assert.ok(FIXTURES_DIR, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
  const fixtures = MANIFEST.fixtures.filter(f => f.format !== 'flightkeys');
  assert.ok(fixtures.length > 0, 'Navtech/eOFP fixtures expected');
  let checked = 0, windows = 0, none = 0;
  const bad = [];
  for (const fx of fixtures) {
    const file = path.join(FIXTURES_DIR, fx.files.text);
    assert.ok(fs.existsSync(file), `fixture text missing: ${fx.id}`);
    const raw = fs.readFileSync(file, 'utf8');
    for (const n of app._splitNotams(raw)) {
      checked++;
      if (xNW(n, fx.date) === null) none++; else windows++;
      const why = disagreement(n, fx.date);
      if (why) {
        const first = n.split('\n')[0];
        const id = (first.match(/\b[A-Z]\d{4}\/\d{2}\b/) || ['(no id)'])[0];
        bad.push(`${fx.id} ${first.slice(2, 6)} ${id} @ ${fx.date}: ${why}`);
      }
    }
  }
  assert.ok(checked > 1000, `NOTAMs compared: ${checked}`);
  assert.ok(windows > 500, `NOTAMs with a window: ${windows}`);
  assert.ok(none > 0, `NOTAMs with no window: ${none}`);
  assert.deepEqual(bad, [], `${bad.length} disagreement(s) out of ${checked} NOTAMs`);
});

// ══ Engine rules on synthetic lines (each agrees with the app) ═══════════

const iso16 = ms => new Date(ms).toISOString().slice(0, 16);
// Assert the engine window and that the app agrees with it.
function window(line, flt, start, end) {
  const e = resolveValidity(notamIdOf(line), line, flt);
  assert.equal(e.unresolvable, false, `resolvable: ${line.replace('\n', ' ')}`);
  assert.equal(iso16(e.startMs), start, `start: ${line.replace('\n', ' ')} @ ${flt}`);
  assert.equal(iso16(e.endMs),   end,   `end: ${line.replace('\n', ' ')} @ ${flt}`);
  assert.equal(disagreement(line, flt), null, `copies agree: ${line.replace('\n', ' ')} @ ${flt}`);
}
// Assert the engine flags it unresolvable and that the app returns no window.
function unresolvable(line, flt) {
  const e = resolveValidity(notamIdOf(line), line, flt);
  assert.equal(e.unresolvable, true, `unresolvable: ${line.replace('\n', ' ')} @ ${flt}`);
  assert.equal(e.startMs, null);
  assert.equal(e.endMs, null);
  assert.equal(xNW(line, flt), null, `app: no window: ${line.replace('\n', ' ')} @ ${flt}`);
}

test('TC-111-010 T1: smallest year with start <= end, not the latest', () => {
  // /25, SEP→OCT 2026: 2026-09-08 also fits, the earliest is 2025.
  window('- XXXX A0100/25 08SEP1200-31OCT1200 2026', '2026-03-13', '2025-09-08T12:00', '2026-10-31T12:00');
  // same-month inverted, /26, end year 2027 → start 2026.
  window('A0100/26 22OCT1455-22OCT1454 2027', '2026-10-22', '2026-10-22T14:55', '2027-10-22T14:54');
  // negative: /26 and a non-inverted window stays in the issue year.
  window('A0100/26 10MAR0800-10MAR1800', '2026-03-10', '2026-03-10T08:00', '2026-03-10T18:00');
});

test('TC-111-011 T2: no end year, cross-month window starts in the issue year', () => {
  window('A0100/25 05DEC0000-30JAN2359', '2026-01-10', '2025-12-05T00:00', '2026-01-30T23:59');
  // negative: /26 issue year, same flight date → start 2026 is after the end? no window.
  unresolvable('A0100/26 05DEC0000-30JAN2359', '2026-01-10');
});

test('TC-111-012 T3: PERM start year is the issue year, not the flight year', () => {
  window('- XXXX A0100/23 24AUG1424-PERM', '2026-03-12', '2023-08-24T14:24', '2076-01-01T00:00');
  // negative: no /YY → flight year.
  window('- XXXX 05AUG0000-PERM', '2026-03-10', '2026-08-05T00:00', '2076-01-01T00:00');
});

test('TC-111-013 T4: WEF / EFFECTIVE ... PERM with /YY starts in the issue year', () => {
  window('- XXXX A0100/24 WEF 05AUG0000 UFC PERM', '2026-03-10', '2024-08-05T00:00', '2076-01-01T00:00');
  window('- XXXX A0100/25 EFFECTIVE 05AUG0000 UNTIL PERM', '2026-03-10', '2025-08-05T00:00', '2076-01-01T00:00');
  // negative: no /YY → flight year.
  window('WEF 05AUG0000 UFC PERM', '2026-03-10', '2026-08-05T00:00', '2076-01-01T00:00');
});

test('TC-111-014 T5: no /YY anywhere keeps the flight-anchored window', () => {
  window('05FEB0100-28FEB2359', '2026-02-15', '2026-02-05T01:00', '2026-02-28T23:59');
  window('- XXXX 05DEC0000-30JAN2359', '2026-03-10', '2026-12-05T00:00', '2027-01-30T23:59');
  window('- XXXX 05DEC0000-30JAN2359', '2026-01-10', '2025-12-05T00:00', '2026-01-30T23:59');
  window('- XXXX 01APR1410-30APR2030\n1410-2030', '2026-04-11', '2026-04-01T14:10', '2026-04-30T20:30');
});

test('TC-111-015 R1: next-line schedule is not read as a trailing year', () => {
  window('A0100/26 05JAN0000-30JAN2359\nD) 1410-2030', '2026-01-10', '2026-01-05T00:00', '2026-01-30T23:59');
  window('05JAN0000-30JAN2359 2026', '2026-01-10', '2026-01-05T00:00', '2026-01-30T23:59');
});

test('TC-111-016 T6: nothing resolvable, or start after end → unresolvable', () => {
  unresolvable('- XXXX A0100/26 30JAN0000-05JAN2359 2026', '2026-06-01');   // inverted
  unresolvable('- XXXX A0100/30 05JAN0000-30JAN2359', '2026-06-01');        // issue year > end year
  unresolvable('- XXXX 22OCT1455-22OCT1454 2027', '2026-03-10');            // backwards, no /YY
  unresolvable('- XXXX A9996 20MAR0000-10MAR2359', '2026-03-15');           // backwards, no /YY
  unresolvable('RWY 09/27 CLSD', '2026-03-10');                             // no dates at all
  unresolvable('- XXXX A0100/26\nB) 2603312359 C) 2603010000', '2026-06-01');
  unresolvable('- XXXX A0101/26 2603312359-2603010000', '2026-06-01');
  // negative: a readable window is still resolved.
  window('- XXXX A0101/26 01FEB0000-05FEB2359', '2026-06-01', '2026-02-01T00:00', '2026-02-05T23:59');
  window('- XXXX A0100/26\nB) 2603010000 C) 2603312359', '2026-03-15', '2026-03-01T00:00', '2026-03-31T23:59');
  window('- XXXX A0101/26 2603010000-2603312359', '2026-03-15', '2026-03-01T00:00', '2026-03-31T23:59');
});

test('TC-111-017 T6: impossible dates give no window and never roll over', () => {
  const bad10 = ['2613010000', '2600010000', '2601320000', '2602300000', '2502290000', '2603012500', '2603010060'];
  for (const t of bad10) {
    unresolvable(`- XXXX A0102/26\nB) ${t} C) 2604302359`, '2026-09-01');
    unresolvable(`- XXXX A0102/26\nB) 2501010000 C) ${t}`, '2026-09-01');
    unresolvable(`- XXXX A0103/26 ${t}-2604302359`, '2026-09-01');
    unresolvable(`- XXXX A0103/25 2501010000-${t}`, '2026-09-01');
  }
  const badDdmmm = ['32JAN0000', '00JAN0000', '30FEB0000', '05JAN2500', '05JAN0060'];
  for (const t of badDdmmm) {
    unresolvable(`- XXXX A0104/26 ${t}-30APR2359`, '2026-09-01');
    unresolvable(`- XXXX A0104/26 01JAN0000-${t}`, '2026-09-01');
    unresolvable(`- XXXX A0105 ${t}-30APR2359`, '2026-09-01');
    unresolvable(`- XXXX A0106/26 ${t}-PERM`, '2026-09-01');
    unresolvable(`- XXXX A0107 WEF ${t} UFC 30APR2359`, '2026-09-01');
    unresolvable(`- XXXX A0107 WEF 01JAN0000 UFC ${t}`, '2026-09-01');
    unresolvable(`- XXXX A0108/26 EFFECTIVE ${t} UNTIL PERM`, '2026-09-01');
  }
  unresolvable('- XXXX A0109/25 29FEB0000-30MAR2359', '2025-09-01');
  unresolvable('- XXXX A0109/25 29FEB0000-PERM', '2025-09-01');
  unresolvable('- XXXX A0109/25 WEF 29FEB0000 UFC PERM', '2025-09-01');
  // negative: 29 FEB 2028 is valid on every path; 2400 means 00:00 the next day.
  for (const l of ['- XXXX A0100/28\nB) 2802290800 C) 2802291800', '- XXXX A0100/28 2802290800-2802291800',
                   '- XXXX A0100/28 29FEB0800-29FEB1800', '- XXXX A0100 29FEB0800-29FEB1800',
                   '- XXXX A0100 WEF 29FEB0800 UFC 29FEB1800']) {
    window(l, '2028-02-29', '2028-02-29T08:00', '2028-02-29T18:00');
  }
  window('- XXXX A0110/26 2603010000-2603312400', '2026-03-15', '2026-03-01T00:00', '2026-04-01T00:00');
});

test('TC-111-018 D38: year crossing agrees on the inline and WEF paths', () => {
  for (const [flt, start, end] of [
    ['2026-12-30', '2026-12-28T00:00', '2027-01-05T23:59'],
    ['2027-01-02', '2026-12-28T00:00', '2027-01-05T23:59'],
  ]) {
    window('- XXXX A9997 28DEC0000-05JAN2359', flt, start, end);
    window('- XXXX A9997 WEF 28DEC0000 UFC 05JAN2359', flt, start, end);
  }
  // /YY with a crossing window: the candidate year that covers the flight date.
  window('- XXXX A0100/25 WEF 28DEC0000 UFC 05JAN2359', '2026-01-02', '2025-12-28T00:00', '2026-01-05T23:59');
  window('- XXXX A0100/25 EFFECTIVE 28DEC0000 UNTIL 05JAN2359', '2026-01-02', '2025-12-28T00:00', '2026-01-05T23:59');
  // negative: issue year after the flight year → unresolvable.
  unresolvable('- XXXX A0100/30 WEF 28DEC0000 UFC 05JAN2359', '2026-01-02');
});
