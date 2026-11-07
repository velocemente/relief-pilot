'use strict';
// notam-record.js — Layer 4 NOTAM record factory + resolveValidity.
//
// Produces absolute UTC {startMs, endMs} from a NOTAM validity string.
// Follows the same rules as xNW_standalone in src/notam.html (HF-5 decision
// table T1-T6, plus D38 year crossing). Keep the two in step:
// test/unit/notam-copies-agree.test.js compares them on every fixture NOTAM.
//   R1 — trailing year must be on the same line ([ \t]+, not \s+); 20\d{2} only
//   T1 — end has a same-line year E and the ID carries /YY (I = 2000+YY):
//        start year = SMALLEST Y in [I, E] with start(Y) <= end
//   T2 — end has no year: end year inferred (flight month anchor), start year =
//        SMALLEST Y in [I, endYear] with start(Y) <= end
//   T3 — PERM: start year = I (no /YY: flight year)
//   T4 — WEF / EFFECTIVE ... PERM: start year = I when the text has a /YY ID
//   T5 — no /YY anywhere: flight-anchored behaviour (D38)
//   T6 — no resolvable window (impossible date, start after end, I > end year)
//        → unresolvable
// Additionally supports FlightKeys ISO format:
//   "YYYY-Mon-DD HH:mm - YYYY-Mon-DD HH:mm"
//
// When no parseable window is found the record is flagged unresolvable (ADR-004 D8).
// Unresolvable NOTAMs are stored without evaluation; the app presents them as-is.

const _SMON = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5,
                JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

// Mixed-case 3-letter month names used in FlightKeys ISO format.
const _MON3 = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5,
                Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// T6: reject impossible date parts BEFORE a date is built, so an impossible
// value never rolls over into another date (month 13, 30 FEB, hour 25).
// "2400" (end of day) is accepted: it means 00:00 the next day.
// Mirrors _validDateParts in src/notam.html.
function _validDateParts(yr, mo, dd, hh, mi) {
  if (!(mo >= 0 && mo <= 11)) return false;
  const leap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
  const dim  = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo];
  if (!(dd >= 1 && dd <= dim)) return false;
  if (!(mi >= 0 && mi <= 59)) return false;
  if (hh === 24 && mi === 0) return true;
  return hh >= 0 && hh <= 23;
}

// Parse a single NOTAM date token to UTC ms (mirrors _parseDateToken in src/notam.html).
// Accepts:
//   DDMMMHHmm  — 9-char day/month-abbr/hhmm (year inferred or forced)
//   YYMMDDHHmm — 10-digit ICAO format
function _parseDateToken(token, baseYear, forceYear) {
  const t = token.trim().toUpperCase();

  // 10-digit ICAO: YYMMDDHHmm
  if (/^\d{10}$/.test(t)) {
    const yr = parseInt('20' + t.slice(0, 2));
    const mo = parseInt(t.slice(2, 4)) - 1;
    const dd = parseInt(t.slice(4, 6));
    const hh = parseInt(t.slice(6, 8));
    const mi = parseInt(t.slice(8, 10));
    if (!_validDateParts(yr, mo, dd, hh, mi)) return null;
    return Date.UTC(yr, mo, dd, hh, mi);
  }

  // DDMMMHHmm (9 chars): e.g. 01APR0001
  const m9 = t.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4})$/);
  if (m9) {
    const yr = forceYear || baseYear || new Date().getUTCFullYear();
    const mo = _SMON[m9[2]];
    const dd = parseInt(m9[1]);
    const hh = parseInt(m9[3].slice(0, 2));
    const mi = parseInt(m9[3].slice(2, 4));
    if (!_validDateParts(yr, mo, dd, hh, mi)) return null;
    return Date.UTC(yr, mo, dd, hh, mi);
  }

  return null;
}

// Resolve an inline DDMMMHHmm date range (WEF / EFFECTIVE), handling PERM and
// cross-year. Mirrors _resolveInlineDateRange in src/notam.html.
//   issYear   — issue year from the NOTAM ID (/YY), or null
//   flightMo  — flight month (0–11), anchors the year crossing (D38)
//   flightISO — 'YYYY-MM-DD' flight date, or null
// Returns { startMs, endMs } or null (T6: no window).
function _resolveInlineDateRange(startToken, endToken, baseYear, issYear, flightMo, flightISO) {
  if (/^PERM$/i.test(endToken)) {
    // T4: PERM start year = issue year; no /YY → flight year.
    const sMs = _parseDateToken(startToken, baseYear, issYear || baseYear);
    if (sMs === null) return null;
    return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1) };
  }
  const startMo = _SMON[(startToken.slice(2, 5) || '').toUpperCase()];
  const endMo   = _SMON[(endToken.slice(2, 5) || '').toUpperCase()];
  if (startMo === undefined || endMo === undefined) return null;
  // D38 with /YY: end month before start month → the end is in the year after
  // the start, and the start year is never before the issue year I. Candidate
  // windows: start in Y, end in Y+1, Y from I to the flight year. The first that
  // covers the flight date (00:00Z–24:00Z) is used; if none does, the
  // flight-anchored one (start year raised to I). Impossible date → no window.
  if (endMo < startMo && issYear !== null) {
    if (issYear > baseYear) return null;
    const dayMs   = flightISO ? Date.parse(flightISO + 'T00:00:00Z') : NaN;
    const anchorY = Math.max(issYear, endMo < flightMo ? baseYear : baseYear - 1);
    let anchored  = null;
    for (let Y = issYear; Y <= baseYear; Y++) {
      const sMs = _parseDateToken(startToken, baseYear, Y);
      const eMs = _parseDateToken(endToken,   baseYear, Y + 1);
      if (sMs === null || eMs === null) return null;
      if (sMs < dayMs + 86400000 && eMs > dayMs) return { startMs: sMs, endMs: eMs };
      if (Y === anchorY) anchored = { startMs: sMs, endMs: eMs };
    }
    return anchored;
  }
  // D38 (no /YY): a crossing window lands on the same year pair whether the
  // flight is in late December or early January.
  const endYear   = endMo < startMo && endMo < flightMo ? baseYear + 1 : baseYear;
  const startYear = endMo < startMo ? endYear - 1 : endYear;
  const startMs   = _parseDateToken(startToken, baseYear, startYear);
  const endMs     = _parseDateToken(endToken,   baseYear, endYear);
  if (startMs === null || endMs === null) return null;
  // T6: an inverted window cannot be trusted → no window.
  if (startMs > endMs) return null;
  return { startMs, endMs };
}

// Resolve the validity window of a NOTAM to absolute UTC.
// @param {string}      notamId     — NOTAM identifier (e.g. "A1234/26"), gives the issue year
// @param {string}      validityStr — raw validity string from OFP or FlightKeys
// @param {string|null} refDateISO  — 'YYYY-MM-DD' reference date (flight date)
// @returns {{ startMs: number|null, endMs: number|null, unresolvable: boolean }}
function resolveValidity(notamId, validityStr, refDateISO) {
  const iso      = refDateISO || null;
  const baseYear = iso ? parseInt(iso.slice(0, 4)) : new Date().getUTCFullYear();

  // ── FlightKeys ISO: "2026-Oct-26 06:00 - 2026-Oct-27 16:00" ─────────────
  const isoRe = /(\d{4})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})\s+(\d{2}):(\d{2})\s*[-–]\s*(\d{4})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})\s+(\d{2}):(\d{2})/i;
  const isoM  = (validityStr || '').match(isoRe);
  if (isoM) {
    const [, sy, smRaw, sd, sh, smi, ey, emRaw, ed, eh, emi] = isoM;
    const smKey = smRaw.charAt(0).toUpperCase() + smRaw.slice(1).toLowerCase();
    const emKey = emRaw.charAt(0).toUpperCase() + emRaw.slice(1).toLowerCase();
    const startMo = _MON3[smKey];
    const endMo   = _MON3[emKey];
    if (startMo !== undefined && endMo !== undefined) {
      const startMs = Date.UTC(parseInt(sy), startMo, parseInt(sd), parseInt(sh), parseInt(smi));
      const endMs   = Date.UTC(parseInt(ey), endMo,   parseInt(ed), parseInt(eh), parseInt(emi));
      return { startMs, endMs, unresolvable: false };
    }
  }

  const tu = (validityStr || '').toUpperCase();
  const flightMo = iso ? parseInt(iso.slice(5, 7)) - 1 : new Date().getUTCMonth();
  const none = { startMs: null, endMs: null, unresolvable: true };   // T6
  // Issue year from the NOTAM ID (/YY), e.g. "A0486/26" → 2026; null if absent.
  // The ID argument is used first, then the validity text (as the app reads it).
  const idM = ((notamId || '').toUpperCase().match(/\b[A-Z]\d{4}\/(\d{2})\b/)) ||
              tu.match(/\b[A-Z]\d{4}\/(\d{2})\b/);
  const issYear = idM ? 2000 + parseInt(idM[1]) : null;

  // ── B/C structured (highest confidence): B) 2603010000 C) 2603312359 ────
  const bcM = tu.match(/B\)\s*(\d{10})\s+C\)\s*(\d{10}|PERM)/);
  if (bcM) {
    const startMs = _parseDateToken(bcM[1], baseYear, null);
    const endMs   = bcM[2] === 'PERM'
      ? Date.UTC(baseYear + 50, 0, 1)
      : _parseDateToken(bcM[2], baseYear, null);
    // T6: impossible date or backwards window → unresolvable.
    if (startMs === null || endMs === null || startMs > endMs) return none;
    return { startMs, endMs, unresolvable: false };
  }

  // ── WEF … UFC/UNTIL … ────────────────────────────────────────────────────
  const wefRe = /WEF\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UFC|UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const wefM  = tu.match(wefRe);
  if (wefM) {
    const r = _resolveInlineDateRange(wefM[1], wefM[2], baseYear, issYear, flightMo, iso);
    return r ? { ...r, unresolvable: false } : none;
  }

  // ── EFFECTIVE … UNTIL/TO … ───────────────────────────────────────────────
  const effRe = /EFFECTIVE\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const effM  = tu.match(effRe);
  if (effM) {
    const r = _resolveInlineDateRange(effM[1], effM[2], baseYear, issYear, flightMo, iso);
    return r ? { ...r, unresolvable: false } : none;
  }

  // ── DDMMMHHmm-DDMMMHHmm (standard Atlas inline) ──────────────────────────
  // R1: trailing year must be on the SAME line ([ \t]+, not \s+); 20\d{2} only.
  const inlineRe = /(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})-(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)(?:[ \t]+(20\d{2})\b)?/i;
  const inM = tu.match(inlineRe);
  if (inM) {
    const endToken     = inM[2];
    const trailingYear = inM[3] ? parseInt(inM[3]) : null;
    if (/^PERM$/i.test(endToken)) {
      // T3: PERM start year = issue year (/YY); no /YY → flight year.
      const sMs = _parseDateToken(inM[1], baseYear, issYear || baseYear);
      if (sMs === null) return none;
      return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1), unresolvable: false };
    }
    const startMo = _SMON[inM[1].slice(2, 5).toUpperCase()];
    const endMo   = _SMON[endToken.slice(2, 5).toUpperCase()];
    // Flight month anchors cross-year inference: end month before the flight
    // month → the window wrapped into next year.
    const endYear = trailingYear ||
                    (endMo < startMo && endMo < flightMo ? baseYear + 1 : baseYear);
    const endMs   = _parseDateToken(endToken, baseYear, endYear);
    if (endMs === null) return none;   // T6: impossible end date
    // T1/T2: with /YY, start year = EARLIEST Y in [I, endYear] with start(Y) <= end.
    // No such Y → unresolvable. An impossible start date in a candidate year
    // (e.g. 29 FEB in a non-leap year) → unresolvable, never a different year.
    if (issYear !== null) {
      for (let Y = issYear; Y <= endYear; Y++) {
        const tryMs = _parseDateToken(inM[1], baseYear, Y);
        if (tryMs === null) return none;
        if (tryMs <= endMs) return { startMs: tryMs, endMs, unresolvable: false };
      }
      return none;
    }
    // T5/D38 (no /YY): end month before start month → the end rolls into the year
    // after the start. Any other backwards window, or an impossible date → unresolvable.
    const startYear = (endMo < startMo) ? endYear - 1 : endYear;
    const startMs   = _parseDateToken(inM[1], baseYear, startYear);
    if (startMs === null || startMs > endMs) return none;
    return { startMs, endMs, unresolvable: false };
  }

  // ── 10-digit pair: 2603010000-2603312359 ─────────────────────────────────
  const tenM = tu.match(/(\d{10})\s*[-–]\s*(\d{10})/);
  if (tenM) {
    const startMs = _parseDateToken(tenM[1], baseYear, null);
    const endMs   = _parseDateToken(tenM[2], baseYear, null);
    // T6: impossible date or backwards window → unresolvable.
    if (startMs === null || endMs === null || startMs > endMs) return none;
    return { startMs, endMs, unresolvable: false };
  }

  return none;
}

// Create a canonical NOTAM record with provenance and resolved validity.
// @param {object} opts
//   notamId    — NOTAM identifier (e.g. "A1234/26")
//   text       — full NOTAM text
//   validity   — raw validity string; null = extract from text
//   refDateISO — 'YYYY-MM-DD' flight date
//   prov       — provenance { page, line, quote } or null
// @returns {NotamRecord}
function makeNotamRecord({ notamId, text, validity, refDateISO, prov }) {
  const validityStr = validity !== null ? validity : text;
  const resolved    = resolveValidity(notamId || '', validityStr, refDateISO || null);
  return {
    notamId:      notamId || '',
    text:         text    || '',
    startMs:      resolved.startMs,
    endMs:        resolved.endMs,
    unresolvable: resolved.unresolvable,
    _prov:        prov || null,
  };
}

module.exports = {
  resolveValidity,
  makeNotamRecord,
  _parseDateToken,
  _resolveInlineDateRange,
};
