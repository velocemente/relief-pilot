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

    // Convert airportData from canonical shape to legacy text format
    // Canonical: notams = array of NOTAM records, weather = object
    // Legacy: notams = text, weather = text, opsNotes = {body,…}, curfew unchanged
    // Canonical-only fields (roles, windows) stay in model, don't reach screens
    if (key === 'airportData' && value && typeof value === 'object') {
      const legacy = {};
      for (const icao in value) {
        const apt = value[icao];
        legacy[icao] = {
          notams: (apt.notams && Array.isArray(apt.notams))
            ? apt.notams.map(r => r.text || String(r)).join('\n')
            : (typeof apt.notams === 'string' ? apt.notams : ''),
          weather: (apt.weather && typeof apt.weather === 'object')
            ? apt.weather.text || (typeof apt.weather.raw === 'string' ? apt.weather.raw : '')
            : (typeof apt.weather === 'string' ? apt.weather : ''),
        };
        if (apt.opsNotes) legacy[icao].opsNotes = apt.opsNotes;
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
