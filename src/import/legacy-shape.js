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
    out[key] = (cbm !== null && cbm !== undefined && key in cbm)
      ? cbm[key]
      : (def ? def.legacyEmpty : null);
  }
  return out;
}

module.exports = { toLegacyShape, LEGACY_KEYS };
