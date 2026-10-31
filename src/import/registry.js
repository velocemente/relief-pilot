'use strict';
// Field registry — Layer 4 of the canonical import engine (ADR-004 §4).
//
// One entry per field the app consumes (the full _ofpRulesetParse return),
// plus three canonical-only fields required for cross-check arithmetic.
//
// Each entry:
//   type        — 'string' | 'number' | 'boolean' | 'array' | 'object' | 'integer'
//   unit        — descriptive string or null
//   safetyClass — 'SC' | 'OP' | 'INFO'
//   required    — human-readable condition, or null
//   validate    — function(value) → null | string error, or null
//   legacyKey   — key in _ofpRulesetParse return, or null for canonical-only fields
//   legacyEmpty — value used for absent fields in toLegacyShape()
//
// Provenance: format profiles attach a _prov map to the CBM,
//   cbm._prov[fieldKey] = { page, line, quote }  (quote ≤ 80 chars)
// Array records additionally carry a per-record  _prov: { page, line, quote }.

const REGISTRY = {
  // ── flight identity ───────────────────────────────────────────────────────
  fltNum: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: v => (v && /^[A-Z0-9]{2,10}$/i.test(String(v))) ? null : 'not a valid flight number',
    legacyKey: 'fltNum', legacyEmpty: '',
  },
  acftType: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'acftType', legacyEmpty: '',
  },
  weightUnit: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: v => (v === 'KGS' || v === 'LBS') ? null : 'must be KGS or LBS',
    legacyKey: 'weightUnit', legacyEmpty: 'KGS',
  },
  isHeavy: {
    type: 'boolean', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'isHeavy', legacyEmpty: false,
  },
  dateStr: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: v => (v && /^\d{2} [A-Z]{3} \d{2}$/.test(v)) ? null : 'must be DD MMM YY',
    legacyKey: 'dateStr', legacyEmpty: '',
  },
  flightDateISO: {
    type: 'string', unit: 'YYYY-MM-DD', safetyClass: 'OP',
    required: null,
    validate: v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? null : 'must be YYYY-MM-DD',
    legacyKey: 'flightDateISO', legacyEmpty: '',
  },
  origIcao: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: v => (v && /^[A-Z]{4}$/.test(v)) ? null : 'must be 4-letter ICAO code',
    legacyKey: 'origIcao', legacyEmpty: '',
  },
  destIcao: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: v => (v && /^[A-Z]{4}$/.test(v)) ? null : 'must be 4-letter ICAO code',
    legacyKey: 'destIcao', legacyEmpty: '',
  },
  // ── timing ────────────────────────────────────────────────────────────────
  offFromOFP: {
    type: 'string', unit: 'HHmmZ', safetyClass: 'OP',
    required: null,
    validate: v => (!v || /^\d{4}$/.test(v)) ? null : 'must be 4-digit HHmm',
    legacyKey: 'offFromOFP', legacyEmpty: '',
  },
  etaDest: {
    type: 'string', unit: 'HHmmZ', safetyClass: 'OP',
    required: null,
    validate: v => (!v || /^\d{4}$/.test(v)) ? null : 'must be 4-digit HHmm',
    legacyKey: 'etaDest', legacyEmpty: '',
  },
  destEtaOffsetMins: {
    type: 'integer', unit: 'min', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'destEtaOffsetMins', legacyEmpty: 0,
  },
  tripMinutes: {
    type: 'integer', unit: 'min', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v !== 'number' || v <= 0) ? 'must be a positive number' : null,
    legacyKey: 'tripMinutes', legacyEmpty: 0,
  },
  taxiMins: {
    type: 'integer', unit: 'min', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'taxiMins', legacyEmpty: 0,
  },
  tocOffsetMins: {
    type: 'integer', unit: 'min', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'tocOffsetMins', legacyEmpty: 0,
  },
  // ── ETOPS ─────────────────────────────────────────────────────────────────
  etopsEntry: {
    type: 'string', unit: 'HHmmZ', safetyClass: 'SC',
    required: 'when ETOPS section present',
    validate: v => (!v || /^\d{4}$/.test(v)) ? null : 'must be 4-digit HHmm',
    legacyKey: 'etopsEntry', legacyEmpty: '',
  },
  etopsSpec: {
    type: 'string', unit: null, safetyClass: 'SC',
    required: 'when ETOPS section present',
    validate: null,
    legacyKey: 'etopsSpec', legacyEmpty: '',
  },
  etopsEntryMins: {
    type: 'integer', unit: 'min', safetyClass: 'SC',
    required: 'when ETOPS section present',
    validate: null,
    legacyKey: 'etopsEntryMins', legacyEmpty: 0,
  },
  etopsExit: {
    type: 'string', unit: 'HHmmZ', safetyClass: 'SC',
    required: 'when ETOPS section present',
    validate: v => (!v || /^\d{4}$/.test(v)) ? null : 'must be 4-digit HHmm',
    legacyKey: 'etopsExit', legacyEmpty: '',
  },
  etopsExitMins: {
    type: 'integer', unit: 'min', safetyClass: 'SC',
    required: 'when ETOPS section present',
    validate: null,
    legacyKey: 'etopsExitMins', legacyEmpty: 0,
  },
  // ── POR ───────────────────────────────────────────────────────────────────
  porWpt: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'porWpt', legacyEmpty: '',
  },
  porOffsetMins: {
    type: 'integer', unit: 'min', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'porOffsetMins', legacyEmpty: 0,
  },
  porMinf: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'porMinf', legacyEmpty: '',
  },
  // ── fuel ──────────────────────────────────────────────────────────────────
  alt1Fuel: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'alt1Fuel', legacyEmpty: '',
  },
  destRemf: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'destRemf', legacyEmpty: '',
  },
  blockFuelRaw: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'SC',
    required: 'always',
    validate: v => (v && /\d/.test(String(v))) ? null : 'must be a numeric fuel string',
    legacyKey: 'blockFuelRaw', legacyEmpty: '',
  },
  minfFuelRaw: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'SC',
    required: 'always',
    validate: v => (v && /\d/.test(String(v))) ? null : 'must be a numeric fuel string',
    legacyKey: 'minfFuelRaw', legacyEmpty: '',
  },
  fresFuelRaw: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'fresFuelRaw', legacyEmpty: '',
  },
  ballastFuel: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'ballastFuel', legacyEmpty: '',
  },
  taxiFuelRaw: {
    type: 'string', unit: 'lbs/kg raw', safetyClass: 'SC',
    required: 'always',
    validate: v => (v && /\d/.test(String(v))) ? null : 'must be a numeric fuel string',
    legacyKey: 'taxiFuelRaw', legacyEmpty: '',
  },
  // ── weights ───────────────────────────────────────────────────────────────
  togwActual: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v === 'number' && v > 0) ? null : 'must be a positive number',
    legacyKey: 'togwActual', legacyEmpty: 0,
  },
  togwLimit: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'togwLimit', legacyEmpty: 0,
  },
  zfwActual: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v === 'number' && v > 0) ? null : 'must be a positive number',
    legacyKey: 'zfwActual', legacyEmpty: 0,
  },
  zfwLimit: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'zfwLimit', legacyEmpty: 0,
  },
  ldgwActual: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v === 'number' && v > 0) ? null : 'must be a positive number',
    legacyKey: 'ldgwActual', legacyEmpty: 0,
  },
  ldgwLimit: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'ldgwLimit', legacyEmpty: 0,
  },
  addlFfAdj: {
    type: 'number', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'addlFfAdj', legacyEmpty: 0,
  },
  // ── crew ──────────────────────────────────────────────────────────────────
  crewMembers: {
    type: 'array', unit: null, safetyClass: 'SC',
    required: 'CA must be present',
    validate: null, // CA presence checked separately in completeness
    legacyKey: 'crewMembers', legacyEmpty: [],
  },
  // ── special ops ───────────────────────────────────────────────────────────
  hasPerishables: {
    type: 'boolean', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'hasPerishables', legacyEmpty: false,
  },
  dotExemption: {
    type: 'string', unit: null, safetyClass: 'SC',
    required: 'when DOT exemption alternate present',
    validate: null,
    legacyKey: 'dotExemption', legacyEmpty: null,
  },
  hasTemperatureControl: {
    type: 'boolean', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'hasTemperatureControl', legacyEmpty: false,
  },
  hasVzfwCkLimit: {
    type: 'boolean', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'hasVzfwCkLimit', legacyEmpty: false,
  },
  slotTime: {
    type: 'string', unit: 'HHmmZ', safetyClass: 'SC',
    required: 'when slot time present in OFP',
    validate: v => (!v || /^\d{4}$/.test(v)) ? null : 'must be 4-digit HHmm',
    legacyKey: 'slotTime', legacyEmpty: null,
  },
  catIiIiiApproaches: {
    type: 'array', unit: null, safetyClass: 'SC',
    required: 'when CAT II/III section present',
    validate: null,
    legacyKey: 'catIiIiiApproaches', legacyEmpty: [],
  },
  // ── structured data ───────────────────────────────────────────────────────
  ddgItems: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'ddgItems', legacyEmpty: [],
  },
  melItems: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'melItems', legacyEmpty: [],
  },
  overflightPerms: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'overflightPerms', legacyEmpty: '',
  },
  altRoutes: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'altRoutes', legacyEmpty: [],
  },
  altData: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'altData', legacyEmpty: [],
  },
  qualAirports: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'qualAirports', legacyEmpty: null,
  },
  oeiData: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'oeiData', legacyEmpty: [],
  },
  etpPoints: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'etpPoints', legacyEmpty: [],
  },
  navLog: {
    type: 'array', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'navLog', legacyEmpty: [],
  },
  enrouteNotams: {
    type: 'string', unit: null, safetyClass: 'SC',
    required: null,
    validate: null,
    legacyKey: 'enrouteNotams', legacyEmpty: null,
  },
  natTrack: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'natTrack', legacyEmpty: null,
  },
  airportData: {
    type: 'object', unit: null, safetyClass: 'SC',
    required: 'each release airport must have NOTAM and weather or explicit nil',
    validate: null, // validated per-airport in completeness check
    legacyKey: 'airportData', legacyEmpty: {},
  },
  parsedVerbalCallsign: {
    type: 'string', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'parsedVerbalCallsign', legacyEmpty: null,
  },
  zfwIncrFactor: {
    type: 'number', unit: null, safetyClass: 'OP',
    required: null,
    validate: null,
    legacyKey: 'zfwIncrFactor', legacyEmpty: null,
  },
  rawOFP: {
    type: 'string', unit: null, safetyClass: 'INFO',
    required: null,
    validate: null,
    legacyKey: 'rawOFP', legacyEmpty: '',
  },
  // ── canonical-only (no legacy key) ───────────────────────────────────────
  // Not in _ofpRulesetParse; needed for independent cross-check arithmetic.
  // Format profiles set these when independently extracted from the OFP.
  tofFuelRaw: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'SC',
    required: null,
    validate: v => (typeof v === 'number' && v >= 0) ? null : 'must be a non-negative integer',
    legacyKey: null, legacyEmpty: null,
  },
  tripFuelRaw: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v === 'number' && v >= 0) ? null : 'must be a non-negative integer',
    legacyKey: null, legacyEmpty: null,
  },
  rampWeight: {
    type: 'integer', unit: 'lbs/kg', safetyClass: 'OP',
    required: null,
    validate: v => (typeof v === 'number' && v > 0) ? null : 'must be a positive integer',
    legacyKey: null, legacyEmpty: null,
  },
};

module.exports = { REGISTRY };
