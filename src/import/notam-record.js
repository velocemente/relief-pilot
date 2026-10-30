'use strict';
// notam-record.js — Layer 4 NOTAM record factory + resolveValidity.
//
// Produces absolute UTC {startMs, endMs} from a NOTAM validity string.
// Implements the same HF-1 rules as xNW_standalone in src/notam.html:
//   R1 — trailing year must be on the same line ([ \t]+, not \s+); 20\d{2} only
//   R2 — when NOTAM ID carries /YY, startYear = latest Y in [2000+YY, endYear]
//        such that start(Y) ≤ end
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
    return Date.UTC(yr, mo, dd, hh, mi);
  }

  return null;
}

// Resolve an inline DDMMMHHmm date range, handling PERM and cross-year.
// Mirrors _resolveInlineDateRange in src/notam.html.
function _resolveInlineDateRange(startToken, endToken, baseYear) {
  if (/^PERM$/i.test(endToken)) {
    const sMs = _parseDateToken(startToken, baseYear, baseYear);
    if (sMs === null) return null;
    return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1) };
  }
  const startMo = _SMON[(startToken.slice(2, 5) || '').toUpperCase()];
  const endMo   = _SMON[(endToken.slice(2, 5) || '').toUpperCase()];
  if (startMo === undefined || endMo === undefined) return null;
  const endYear   = endMo < startMo ? baseYear + 1 : baseYear;
  const startYear = endMo < startMo ? endYear - 1 : endYear;
  const startMs   = _parseDateToken(startToken, baseYear, startYear);
  const endMs     = _parseDateToken(endToken,   baseYear, endYear);
  if (startMs === null || endMs === null) return null;
  return { startMs, endMs };
}

// Resolve the validity window of a NOTAM to absolute UTC.
// @param {string}      notamId     — NOTAM identifier (e.g. "A1234/26"), used for R2
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

  // ── B/C structured (highest confidence): B) 2603010000 C) 2603312359 ────
  const bcM = tu.match(/B\)\s*(\d{10})\s+C\)\s*(\d{10}|PERM)/);
  if (bcM) {
    const startMs = _parseDateToken(bcM[1], baseYear, null);
    const endMs   = bcM[2] === 'PERM'
      ? Date.UTC(baseYear + 50, 0, 1)
      : _parseDateToken(bcM[2], baseYear, null);
    if (startMs !== null && endMs !== null)
      return { startMs, endMs, unresolvable: false };
  }

  // ── WEF … UFC/UNTIL … ────────────────────────────────────────────────────
  const wefRe = /WEF\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UFC|UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const wefM  = tu.match(wefRe);
  if (wefM) {
    const r = _resolveInlineDateRange(wefM[1], wefM[2], baseYear);
    if (r) return { ...r, unresolvable: false };
  }

  // ── EFFECTIVE … UNTIL/TO … ───────────────────────────────────────────────
  const effRe = /EFFECTIVE\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const effM  = tu.match(effRe);
  if (effM) {
    const r = _resolveInlineDateRange(effM[1], effM[2], baseYear);
    if (r) return { ...r, unresolvable: false };
  }

  // ── DDMMMHHmm-DDMMMHHmm (standard Atlas inline, R1 + R2) ─────────────────
  // R1: trailing year must be on the SAME line ([ \t]+, not \s+); 20\d{2} only.
  const inlineRe = /(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})-(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)(?:[ \t]+(20\d{2})\b)?/i;
  const inM = tu.match(inlineRe);
  if (inM) {
    const endToken     = inM[2];
    const trailingYear = inM[3] ? parseInt(inM[3]) : null;
    if (/^PERM$/i.test(endToken)) {
      const sMs = _parseDateToken(inM[1], baseYear, baseYear);
      if (sMs !== null)
        return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1), unresolvable: false };
    }
    const startMo  = _SMON[inM[1].slice(2, 5).toUpperCase()];
    const endMo    = _SMON[endToken.slice(2, 5).toUpperCase()];
    const flightMo = iso ? parseInt(iso.slice(5, 7)) - 1 : new Date().getUTCMonth();
    const endYear  = trailingYear ||
                     (endMo < startMo && endMo < flightMo ? baseYear + 1 : baseYear);
    const endMs    = _parseDateToken(endToken, baseYear, endYear);
    // R2: prefer notamId for /YY extraction; fall back to embedded ID in validity string.
    const idSrc = notamId ? notamId.toUpperCase() : tu;
    const idM   = idSrc.match(/\b[A-Z]\d{4}\/(\d{2})\b/);
    let startYear;
    if (idM && endMs !== null) {
      const issYear = 2000 + parseInt(idM[1]);
      startYear = endYear;
      for (let Y = endYear; Y >= issYear; Y--) {
        const tryMs = _parseDateToken(inM[1], baseYear, Y);
        if (tryMs !== null && tryMs <= endMs) { startYear = Y; break; }
      }
    } else {
      startYear = (endMo < startMo) ? endYear - 1 : endYear;
    }
    let startMs = _parseDateToken(inM[1], baseYear, startYear);
    if (startMs !== null && endMs !== null) {
      // Safety net: fix any remaining inverted window.
      if (startMs >= endMs) {
        if (idM) {
          const century = Math.floor(endYear / 100) * 100;
          let issYear2 = century + parseInt(idM[1]);
          if (issYear2 > endYear) issYear2 -= 100;
          const tryMs = _parseDateToken(inM[1], baseYear, issYear2);
          if (tryMs !== null && tryMs < endMs) startMs = tryMs;
        }
        if (startMs >= endMs) {
          for (let sy = startYear - 1; sy >= startYear - 5; sy--) {
            const tryMs = _parseDateToken(inM[1], baseYear, sy);
            if (tryMs !== null && tryMs < endMs) { startMs = tryMs; break; }
          }
        }
      }
      return { startMs, endMs, unresolvable: false };
    }
  }

  // ── 10-digit pair: 2603010000-2603312359 ─────────────────────────────────
  const tenM = tu.match(/(\d{10})\s*[-–]\s*(\d{10})/);
  if (tenM) {
    const startMs = _parseDateToken(tenM[1], baseYear, null);
    const endMs   = _parseDateToken(tenM[2], baseYear, null);
    if (startMs !== null && endMs !== null)
      return { startMs, endMs, unresolvable: false };
  }

  return { startMs: null, endMs: null, unresolvable: true };
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
