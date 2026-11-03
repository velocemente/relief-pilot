'use strict';
// legacy-shape.js — Layer 5 output: toLegacyShape (ADR-004 §5).
//
// toLegacyShape(cbm) → exact _ofpRulesetParse return shape.
// All 58 legacy keys are present; absent CBM fields use their legacyEmpty value.
// Canonical-only CBM fields (legacyKey: null) are not included in the output.
//
// The ordered key list matches the _ofpRulesetParse return statement in
// src/ofp-parse.html exactly.

const { REGISTRY } = require('./registry.js');

// Month map for FK "YYYY-Mon-DD [HH:mm]" → DDMMMHHmm
const _FK_MON = {
  jan:'JAN', feb:'FEB', mar:'MAR', apr:'APR', may:'MAY', jun:'JUN',
  jul:'JUL', aug:'AUG', sep:'SEP', oct:'OCT', nov:'NOV', dec:'DEC',
};

// Convert FK ISO date string "YYYY-Mon-DD [HH:mm]" → "DDMMMHHmm".  Returns null if unparseable.
function _fkDateToToken(s) {
  const m = s && /^(\d{4})-([A-Za-z]{3})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  const mon = _FK_MON[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}${mon}${m[4] || '00'}${m[5] || '00'}`;
}

// Convert FK validFrom + validTo to legacy validity string for the NOTAM header line.
// UFN and UFN(EST …) both become "startToken-UFN [EST]" so xNW_standalone returns null
// (always active), matching FK's intent that UFN NOTAMs are indefinitely in-effect.
function _fkValidityStr(validFrom, validTo) {
  const start = _fkDateToToken(validFrom);
  if (!start) return '';
  if (!validTo) return `${start}-UFN`;
  if (/^UFN/i.test(validTo)) return `${start}-UFN${/EST/i.test(validTo) ? ' EST' : ''}`;
  if (/^PERM$/i.test(validTo)) return `${start}-PERM`;
  const end = _fkDateToToken(validTo);
  if (!end) return `${start}-UFN`;
  const sy = parseInt(validFrom);  // "2026-..." → 2026
  const ey = parseInt(validTo);
  return ey > sy ? `${start}-${end} ${ey}` : `${start}-${end}`;
}

// Convert FK canonical NOTAM record {id, validFrom, validTo, body} → legacy text block.
// Header: "- ICAO  NOTAMID VALIDITY\nbody" (two spaces between ICAO and NOTAM ID).
function _fkNotamToLegacyText(rec) {
  const sp   = (rec.id || '').indexOf(' ');
  const icao = sp > 0 ? rec.id.slice(0, sp)     : (rec.id || '');
  const nid  = sp > 0 ? rec.id.slice(sp + 1)    : '';
  const v    = _fkValidityStr(rec.validFrom, rec.validTo);
  const hdr  = v ? `- ${icao}  ${nid} ${v}` : `- ${icao}  ${nid}`;
  return rec.body ? `${hdr}\n${rec.body}` : hdr;
}

// Convert FK canonical weather {taf, metars, atis} → legacy weather string (METARs then TAF).
function _fkWeatherToLegacy(w) {
  if (!w || typeof w !== 'object') return '';
  const parts = Array.isArray(w.metars) ? w.metars.filter(Boolean) : [];
  if (w.taf) parts.push(w.taf);
  return parts.join('\n');
}

// Convert FK canonical opsNotes array [{notamId, subject, body}] → legacy {header, body} or null.
function _fkOpsNotesToLegacy(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const body = arr.map(o => o.body || '').filter(Boolean).join('\n');
  return body ? { header: arr[0].subject || '', body } : null;
}

const LEGACY_KEYS = [
  'fltNum', 'acftType', 'weightUnit', 'isHeavy', 'dateStr', 'flightDateISO',
  'origIcao', 'destIcao', 'offFromOFP', 'etaDest', 'destEtaOffsetMins',
  'tripMinutes', 'taxiMins',
  'etopsEntry', 'etopsSpec', 'etopsEntryMins', 'etopsExit', 'etopsExitMins',
  'porWpt', 'porOffsetMins', 'porMinf', 'alt1Fuel', 'destRemf',
  'blockFuelRaw', 'minfFuelRaw', 'fresFuelRaw', 'ballastFuel',
  'crewMembers', 'tocOffsetMins',
  'togwActual', 'togwLimit', 'zfwActual', 'zfwLimit', 'ldgwActual', 'ldgwLimit',
  'hasPerishables', 'dotExemption', 'hasTemperatureControl', 'hasVzfwCkLimit',
  'slotTime', 'catIiIiiApproaches', 'addlFfAdj',
  'ddgItems', 'melItems', 'overflightPerms', 'altRoutes', 'altData', 'qualAirports',
  'oeiData', 'etpPoints', 'navLog', 'enrouteNotams', 'natTrack', 'airportData',
  'parsedVerbalCallsign', 'zfwIncrFactor', 'taxiFuelRaw', 'rawOFP',
];

function toLegacyShape(cbm) {
  const out = {};
  for (const key of LEGACY_KEYS) {
    const def = REGISTRY[key];
    let value = (cbm !== null && cbm !== undefined && key in cbm)
      ? cbm[key]
      : (def ? def.legacyEmpty : null);

    // Convert fltNum: append date day from dateStr if available
    if (key === 'fltNum' && value && cbm && cbm.dateStr) {
      const dayMatch = String(cbm.dateStr).match(/^(\d{2})\s/);
      if (dayMatch) {
        value = value + '/' + dayMatch[1];
      }
    }

    // Convert airportData from canonical shape to legacy text format.
    // Canonical: notams = array of FK records, weather = {taf, metars, atis}, opsNotes = array.
    // Legacy:    notams = text string, weather = text string, opsNotes = {header, body}|null.
    // Canonical-only fields (roles, windows) stay in model, don't reach screens.
    if (key === 'airportData' && value && typeof value === 'object') {
      const legacy = {};
      for (const icao in value) {
        const apt = value[icao];
        // notams: FK canonical is [{id, validFrom, validTo, body}]; Navtech is already a string.
        const notamsText = Array.isArray(apt.notams)
          ? apt.notams.map(_fkNotamToLegacyText).join('\n')
          : (typeof apt.notams === 'string' ? apt.notams : '');
        // weather: FK canonical is {taf, metars, atis}; Navtech is already a string.
        const weatherText = (apt.weather && typeof apt.weather === 'object')
          ? _fkWeatherToLegacy(apt.weather)
          : (typeof apt.weather === 'string' ? apt.weather : '');
        legacy[icao] = { notams: notamsText, weather: weatherText };
        // opsNotes: FK canonical is [{notamId, subject, body}]; Navtech is already {header, body}.
        const opsLegacy = Array.isArray(apt.opsNotes)
          ? _fkOpsNotesToLegacy(apt.opsNotes)
          : apt.opsNotes;
        if (opsLegacy) legacy[icao].opsNotes = opsLegacy;
        if (apt.curfew) legacy[icao].curfew = apt.curfew;
        if (apt.ewinsWeather) legacy[icao].ewinsWeather = apt.ewinsWeather;
        if (apt.ewinsRole) legacy[icao].ewinsRole = apt.ewinsRole;
        if (apt.ewinsWindow) legacy[icao].ewinsWindow = apt.ewinsWindow;
      }
      value = legacy;
    }

    out[key] = value;
  }
  return out;
}

module.exports = { toLegacyShape, LEGACY_KEYS };
