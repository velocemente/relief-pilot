'use strict';
/**
 * TC-110 — NOTAM year-inference regression tests
 *
 * Covers:
 *   R1  inlineRe trailing-year group must not cross a newline and must
 *       require a 20xx year, preventing schedule text ("1410-2030") on
 *       the next line from being misread as year 1410.
 *
 *   R2  When the NOTAM ID carries /YY, start year = latest Y in
 *       [2000+YY, endYear] such that start(Y) ≤ end.
 *       No /YY → heuristic unchanged.
 *
 * TC-110-001  R1 — daily schedule on next line NOT read as trailing year
 * TC-110-002  R1 — valid 20xx year on same line IS still parsed
 * TC-110-003  R2 — same-month inverted window anchored to /YY issYear
 * TC-110-004  R2 — cross-month window anchored to /YY issYear
 * TC-110-005  R2 — PERM NOTAM start unaffected
 * TC-110-006  R2 — /YY same year, non-inverted → start at issYear
 * TC-110-N01  Negative: "- XXXX A0100/26 05JAN0000-30JAN2359" on 2026-01-10
 *             → start 2026-01-05 (R2 picks latest valid year = 2026)
 * TC-110-N02  Negative: no NOTAM ID → heuristic result unchanged
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const app = loadApp();
const xNW = app.xNW_standalone;

function utcMs(year, mon1, day, hh, mm) {
  return Date.UTC(year, mon1 - 1, day, hh, mm);
}

// ── TC-110-001: R1 ────────────────────────────────────────────────────────
test('TC-110-001 R1: daily schedule on next line not read as trailing year', () => {
  // Without the fix, \s+ crosses the newline → trailingYear=1410 → window
  // lands in year 1410 → NOTAM wrongly suppressed at ETA.
  const r = xNW('A0100/26 05JAN0000-30JAN2359\nD) 1410-2030', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0),  'start 2026-01-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

// ── TC-110-002: R1 ────────────────────────────────────────────────────────
test('TC-110-002 R1: valid 20xx trailing year on same line still accepted', () => {
  const r = xNW('05JAN0000-30JAN2359 2026', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0),  'start 2026-01-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

// ── TC-110-003: R2 ────────────────────────────────────────────────────────
test('TC-110-003 R2: same-month inverted window anchored to /YY issYear', () => {
  // Issued /26; trailing year 2027; both tokens OCT.
  // R2 finds latest Y in [2026,2027] with start(Y) ≤ end → Y=2026.
  const r = xNW('A0100/26 22OCT1455-22OCT1454 2027', '2026-10-22');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 10, 22, 14, 55), 'start 2026-10-22 14:55Z');
  assert.equal(r.endMs,   utcMs(2027, 10, 22, 14, 54), 'end 2027-10-22 14:54Z');
});

// ── TC-110-004: R2 ────────────────────────────────────────────────────────
test('TC-110-004 R2: cross-month window anchored to /YY issYear', () => {
  // Issued /25; DEC→JAN cross-year; no trailing year.
  // issYear=2025, latest valid Y=2025 → start in DEC 2025.
  const r = xNW('A0100/25 05DEC0000-30JAN2359', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2025, 12, 5, 0, 0),  'start 2025-12-05 00:00Z');
  assert.equal(r.endMs,   utcMs(2026, 1, 30, 23, 59), 'end 2026-01-30 23:59Z');
});

// ── TC-110-005: R2 ────────────────────────────────────────────────────────
test('TC-110-005 R2: PERM NOTAM start uses baseYear (code path unchanged)', () => {
  const r = xNW('A0100/26 05JAN0000-PERM', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0), 'start 2026-01-05 00:00Z');
  assert.ok(r.endMs > utcMs(2070, 1, 1, 0, 0), 'endMs far in future');
});

// ── TC-110-006: R2 ────────────────────────────────────────────────────────
test('TC-110-006 R2: /YY same year non-inverted window → start at issYear', () => {
  // issYear=2026, endYear=2026; loop: Y=2026 valid → startYear=2026.
  const r = xNW('A0100/26 10MAR0800-10MAR1800', '2026-03-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 3, 10, 8, 0),  'start 2026-03-10 08:00Z');
  assert.equal(r.endMs,   utcMs(2026, 3, 10, 18, 0), 'end 2026-03-10 18:00Z');
});

// ── TC-110-N01: negative ──────────────────────────────────────────────────
test('TC-110-N01 negative: A0100/26 JAN window on flight 2026-01-10', () => {
  const r = xNW('- XXXX A0100/26 05JAN0000-30JAN2359', '2026-01-10');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 1, 5, 0, 0), 'start 2026-01-05 00:00Z');
});

// ── TC-110-N02: negative ──────────────────────────────────────────────────
test('TC-110-N02 negative: no NOTAM ID falls back to heuristic', () => {
  const r = xNW('05FEB0100-28FEB2359', '2026-02-15');
  assert.ok(r, 'should return a window');
  assert.equal(r.startMs, utcMs(2026, 2, 5, 1, 0),   'start 2026-02-05 01:00Z');
  assert.equal(r.endMs,   utcMs(2026, 2, 28, 23, 59), 'end 2026-02-28 23:59Z');
});
