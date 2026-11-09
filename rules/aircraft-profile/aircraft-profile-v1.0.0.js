/**
 * aircraft-profile.js — Aircraft and Registration Profile  (v1.0.0)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1 "Aircraft and registration", §2.2):
 * the aircraft type table, the type → profile builder and the callsign
 * index (CS-1), shared by every OFP format and ruleset.
 *
 * v1.0.0 is an EXTRACTION. Output is identical to today's code:
 *   § 2  AIRCRAFT_DATA, getWingspan(), buildAcftProfile() — verbatim from
 *        rules/notam-rules/notam-rules-v1.11.2.js (lines 509–625), which
 *        the app builds into index.html. _acftApplies() and every NOTAM
 *        rule stay in the NOTAM module; this PR does not change it.
 *   § 3  CALLSIGN_INDEX, deriveCallsign() — from src/ofp-parse.html.
 *        Behaviour identical; the designator → callsign map, an inline
 *        literal in the app, is the named export CALLSIGN_INDEX (CS-1).
 * Edits are marked "v1.0.0". test/rules/aircraft-profile.test.js (TC-150)
 * checks the copies and compares every output with the NOTAM module and
 * the app.
 *
 * NOT IN THIS MODULE — _acftApplies() and the NOTAM rules (notam-rules),
 * the FPL wake / heavy flag (ofp-navblue, FPL field 9), the "VERBAL
 * CALLSIGN" remark (ofp-navblue), parseOFP() and any UI.
 * PLANNED (v1.1.0) — approach category (D44), once the Exec supplies the
 * fleet table. Registration profile: not yet specified.
 *
 * DUAL CONTEXT
 *   Node / rules-loader: module.exports = the API object below.
 *   Browser (a plain script): no `module` → the API object is published
 *   once as the global AircraftProfile. Every declaration stays in the
 *   factory scope, so nothing collides with the app's own names
 *   (AIRCRAFT_DATA, buildAcftProfile in NotamRules; deriveCallsign in
 *   src/ofp-parse.html). No window, no DOM, no storage, no app state.
 *   Strict, like the app's main inline script.
 * ─────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.AircraftProfile = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · RULESET SCHEMA IDENTITY (Blueprint / rules-loader contract)
// ═══════════════════════════════════════════════════════════════

const RULESET_TYPE    = 'aircraft-profile';
const RULESET_VERSION = '1.0.0';
const SCHEMA_VERSION  = 1;
const RULESET_SOURCE  = "Aircraft table: Jane's / manufacturer type certificate data sheets / FAA AC 150/5300-13A (as carried in the NOTAM ruleset v1.11.2); ICAO aerodrome reference code (Annex 14) and wake turbulence category (Doc 8643 / Doc 4444); callsign index: Atlas Air SOPs (as carried in the PilotBrief app)";

// ═══════════════════════════════════════════════════════════════
// § 2 · AIRCRAFT TYPE TABLE AND PROFILE
//       Verbatim: rules/notam-rules/notam-rules-v1.11.2.js lines 509–625.
// ═══════════════════════════════════════════════════════════════

// ── Aircraft data database
// ── Source: Jane's / manufacturer type certificate data sheets / FAA AC 150/5300-13A
// Fields per entry:
//   ws   — wingspan metres (maximum, wingtip to wingtip)
//   mtow — max takeoff weight kg (approximate max certified)
//   code — ICAO aerodrome reference code letter (A–F) derived from wingspan
//          A: <15m  B: 15–24m  C: 24–36m  D: 36–52m  E: 52–65m  F: >65m
//   wake — ICAO wake turbulence category: L/M/H/J (Light/Medium/Heavy/Super)
//   turbine — true = jet/turboprop (false = piston — rare in commercial ops)
const AIRCRAFT_DATA = {
  // ── Narrowbody ──
  B735: { ws:28.9, mtow:52390,  code:'C', wake:'M', turbine:true },
  B736: { ws:28.9, mtow:56245,  code:'C', wake:'M', turbine:true },
  B737: { ws:28.9, mtow:56245,  code:'C', wake:'M', turbine:true },
  B738: { ws:35.8, mtow:79016,  code:'C', wake:'M', turbine:true },
  B739: { ws:35.8, mtow:85139,  code:'C', wake:'M', turbine:true },
  B37M: { ws:35.9, mtow:82191,  code:'C', wake:'M', turbine:true },
  B38M: { ws:35.9, mtow:82191,  code:'C', wake:'M', turbine:true },
  B39M: { ws:35.9, mtow:88314,  code:'C', wake:'M', turbine:true },
  A19N: { ws:35.8, mtow:75500,  code:'C', wake:'M', turbine:true },
  A20N: { ws:35.8, mtow:79000,  code:'C', wake:'M', turbine:true },
  A21N: { ws:35.8, mtow:97000,  code:'C', wake:'M', turbine:true },
  A318: { ws:34.1, mtow:68000,  code:'C', wake:'M', turbine:true },
  A319: { ws:33.9, mtow:75500,  code:'C', wake:'M', turbine:true },
  A320: { ws:33.9, mtow:77000,  code:'C', wake:'M', turbine:true },
  A321: { ws:35.8, mtow:93500,  code:'C', wake:'M', turbine:true },
  E190: { ws:28.7, mtow:51800,  code:'C', wake:'M', turbine:true },
  E195: { ws:28.7, mtow:52290,  code:'C', wake:'M', turbine:true },
  E75L: { ws:26.0, mtow:38790,  code:'C', wake:'M', turbine:true },
  E75S: { ws:26.0, mtow:37500,  code:'C', wake:'M', turbine:true },
  CRJ2: { ws:21.2, mtow:21319,  code:'B', wake:'L', turbine:true },
  CRJ7: { ws:23.2, mtow:33113,  code:'C', wake:'M', turbine:true },
  CRJ9: { ws:24.9, mtow:36514,  code:'C', wake:'M', turbine:true },
  CRJX: { ws:26.2, mtow:42184,  code:'C', wake:'M', turbine:true },
  DH8D: { ws:28.4, mtow:29257,  code:'C', wake:'M', turbine:true },
  AT76: { ws:27.1, mtow:23000,  code:'C', wake:'M', turbine:true },
  AT75: { ws:27.1, mtow:22800,  code:'C', wake:'M', turbine:true },
  // ── Widebody — long haul ──
  B744: { ws:64.4, mtow:412800, code:'E', wake:'H', turbine:true },
  B748: { ws:68.4, mtow:447700, code:'F', wake:'H', turbine:true },
  BLCF: { ws:68.4, mtow:447700, code:'F', wake:'H', turbine:true }, // 747-400LCF Dreamlifter
  B762: { ws:47.6, mtow:175540, code:'D', wake:'H', turbine:true },
  B763: { ws:47.6, mtow:186900, code:'D', wake:'H', turbine:true },
  B764: { ws:51.9, mtow:204120, code:'D', wake:'H', turbine:true },
  B772: { ws:60.9, mtow:297550, code:'E', wake:'H', turbine:true },
  B77L: { ws:64.8, mtow:347800, code:'E', wake:'H', turbine:true },
  B77W: { ws:64.8, mtow:352440, code:'E', wake:'H', turbine:true },
  B778: { ws:71.8, mtow:352400, code:'F', wake:'H', turbine:true },
  B779: { ws:71.8, mtow:352400, code:'F', wake:'H', turbine:true },
  B788: { ws:60.1, mtow:227930, code:'E', wake:'H', turbine:true },
  B789: { ws:60.1, mtow:254011, code:'E', wake:'H', turbine:true },
  B78X: { ws:60.1, mtow:254011, code:'E', wake:'H', turbine:true },
  A306: { ws:44.8, mtow:171700, code:'D', wake:'H', turbine:true },
  A310: { ws:43.9, mtow:157000, code:'D', wake:'H', turbine:true },
  A332: { ws:60.3, mtow:242000, code:'E', wake:'H', turbine:true },
  A333: { ws:60.3, mtow:242000, code:'E', wake:'H', turbine:true },
  A338: { ws:64.0, mtow:251000, code:'E', wake:'H', turbine:true },
  A339: { ws:64.0, mtow:251000, code:'E', wake:'H', turbine:true },
  A342: { ws:60.3, mtow:233000, code:'E', wake:'H', turbine:true },
  A343: { ws:60.3, mtow:276500, code:'E', wake:'H', turbine:true },
  A345: { ws:63.5, mtow:372000, code:'E', wake:'H', turbine:true },
  A346: { ws:63.5, mtow:380000, code:'E', wake:'H', turbine:true },
  A359: { ws:64.8, mtow:280000, code:'E', wake:'H', turbine:true },
  A35K: { ws:64.8, mtow:308000, code:'E', wake:'H', turbine:true },
  A380: { ws:79.8, mtow:575000, code:'F', wake:'J', turbine:true },
  A388: { ws:79.8, mtow:575000, code:'F', wake:'J', turbine:true },
  // ── Freighters / misc ──
  B752: { ws:38.1, mtow:115900, code:'D', wake:'H', turbine:true },
  B753: { ws:38.1, mtow:122470, code:'D', wake:'H', turbine:true },
  B722: { ws:39.9, mtow:95028,  code:'D', wake:'H', turbine:true },
  MD11: { ws:51.7, mtow:283000, code:'D', wake:'H', turbine:true },
  DC10: { ws:47.3, mtow:255825, code:'D', wake:'H', turbine:true },
  C17:  { ws:51.7, mtow:265350, code:'D', wake:'H', turbine:true },
  C130: { ws:40.4, mtow:70305,  code:'D', wake:'M', turbine:true },
  C5:   { ws:67.9, mtow:381024, code:'F', wake:'H', turbine:true },
};


/**
 * Get aircraft wingspan in metres from ICAO type designator.
 * Returns null if type is not in the database.
 * @param {string} acftType - e.g. 'B738', 'B77W', 'A321'
 * @returns {number|null}
 */
function getWingspan(acftType) {
  if (!acftType) return null;
  const d = AIRCRAFT_DATA[acftType.toUpperCase().slice(0,4)];
  return d ? d.ws : null;
}

/**
 * Build a complete aircraft profile from an ICAO type designator.
 * Used by _acftApplies() to evaluate all applicability constraints.
 *
 * The profile is derived from AIRCRAFT_DATA. For unknown types a
 * conservative (worst-case) profile is returned so NOTAMs are not
 * silently suppressed.
 *
 * @param {string} icaoType — e.g. 'B748', 'B77W', 'BLCF'
 * @returns {{
 *   type: string,
 *   ws: number,        — wingspan metres
 *   mtow: number,      — MTOW kg
 *   code: string,      — ICAO aerodrome ref code A–F
 *   wake: string,      — ICAO wake cat: L/M/H/J
 *   turbine: boolean,  — jet/turboprop = true
 *   known: boolean     — false if type not in database
 * }}
 */
function buildAcftProfile(icaoType) {
  const key = (icaoType || '').toUpperCase().slice(0, 4);
  const d = AIRCRAFT_DATA[key];
  if (d) return { type: key, ...d, known: true };
  // Unknown type — conservative: assume heavy, wide-body, turbine
  // so we never silently drop a NOTAM that might apply
  return { type: key || 'UNKN', ws: 999, mtow: 999999, code: 'F', wake: 'H', turbine: true, known: false };
}

// v1.0.0: the table is exported and shared, so it is frozen (table and each
// entry). buildAcftProfile() and getWingspan() only read it; buildAcftProfile()
// returns a new object each call, so its output is unchanged.
Object.freeze(AIRCRAFT_DATA);
for (const k of Object.keys(AIRCRAFT_DATA)) Object.freeze(AIRCRAFT_DATA[k]);

// ═══════════════════════════════════════════════════════════════
// § 3 · CALLSIGN INDEX (CS-1)
//       From src/ofp-parse.html deriveCallsign(). Behaviour identical.
// ═══════════════════════════════════════════════════════════════

// ── Radio callsign derivation ─────────────────────────────────────
// Derived from flight number prefix — not parsed from OFP text.
// All Atlas/Polar aircraft are Category HEAVY (B747, B777, B767).
// Verbal callsigns per Atlas Air SOPs:
//   GTI → GIANT  |  PAC → POLAR  |  CMB → CAMBER
//
// v1.0.0: the app's inline map is the named export CALLSIGN_INDEX
// (operator designator → verbal callsign), in the app's order. The prefix
// pattern is built from its keys in that order; it is the app's literal
// /^(GTI|PAC|CMB|QFA)(\d+)/i exactly (TC-150-004).
const CALLSIGN_INDEX = Object.freeze({ GTI: 'GIANT', PAC: 'POLAR', CMB: 'CAMBER', QFA: 'QANTAS' });
const CALLSIGN_PREFIX_RE = new RegExp('^(' + Object.keys(CALLSIGN_INDEX).join('|') + ')(\\d+)', 'i');

function deriveCallsign(fltNum) {
  if (!fltNum) return { radioCallsign: '', verbalCallsign: '', isHeavy: false };
  const m = fltNum.match(CALLSIGN_PREFIX_RE);   // v1.0.0: was the literal /^(GTI|PAC|CMB|QFA)(\d+)/i
  if (!m) return { radioCallsign: fltNum, verbalCallsign: '', isHeavy: false };
  const prefix = m[1].toUpperCase();
  const verbal = CALLSIGN_INDEX[prefix] || '';  // v1.0.0: was the inline map { GTI: 'GIANT', … }[prefix]
  return {
    radioCallsign: prefix + m[2],
    verbalCallsign: verbal,
    isHeavy: true,   // All Atlas/Polar fleet are heavies
  };
}

// ═══════════════════════════════════════════════════════════════
// § 4 · SCHEMA VALIDATION (Blueprint)
// ═══════════════════════════════════════════════════════════════

// Exports the rules-loader requires of an 'aircraft-profile' ruleset.
const REQUIRED_EXPORTS = {
  RULESET_TYPE: 'string', RULESET_VERSION: 'string', SCHEMA_VERSION: 'number',
  RULESET_SOURCE: 'string', validateSchema: 'function',
  AIRCRAFT_DATA: 'object', getWingspan: 'function', buildAcftProfile: 'function',
  CALLSIGN_INDEX: 'object', deriveCallsign: 'function',
};
// NOTAM rules stay in the NOTAM module; app logic stays in the app.
const FORBIDDEN_EXPORTS = ['_acftApplies', 'evalNotams', 'parseOFP'];
const ENTRY_FIELDS = ['ws', 'mtow', 'code', 'wake', 'turbine'];

/**
 * Check an aircraft-profile ruleset object against the schema contract.
 * @param {object} [ruleset] — defaults to this module's own exports
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSchema(ruleset) {
  const r = ruleset === undefined ? API : ruleset;
  const errors = [];
  if (!r || typeof r !== 'object') return { valid: false, errors: ['ruleset is not an object'] };
  for (const k of Object.keys(REQUIRED_EXPORTS)) {
    if (!(k in r)) errors.push(`missing export: ${k}`);
    else if (typeof r[k] !== REQUIRED_EXPORTS[k] || r[k] === null) errors.push(`${k} must be a ${REQUIRED_EXPORTS[k]}`);
  }
  for (const k of FORBIDDEN_EXPORTS) if (k in r) errors.push(`${k} must not be exported (not aircraft data)`);
  if (r.RULESET_TYPE !== 'aircraft-profile') errors.push(`RULESET_TYPE must be 'aircraft-profile', got '${r.RULESET_TYPE}'`);
  if (typeof r.RULESET_VERSION === 'string' && !/^\d+\.\d+\.\d+$/.test(r.RULESET_VERSION)) errors.push(`RULESET_VERSION '${r.RULESET_VERSION}' is not semver`);
  if (typeof r.SCHEMA_VERSION === 'number' && !(Number.isInteger(r.SCHEMA_VERSION) && r.SCHEMA_VERSION >= 1)) errors.push(`SCHEMA_VERSION ${r.SCHEMA_VERSION} must be an integer >= 1`);
  if (typeof r.RULESET_SOURCE === 'string' && !r.RULESET_SOURCE.trim()) errors.push('RULESET_SOURCE is empty');
  if (r.AIRCRAFT_DATA && typeof r.AIRCRAFT_DATA === 'object') {
    for (const t of Object.keys(r.AIRCRAFT_DATA)) {
      const d = r.AIRCRAFT_DATA[t];
      if (!/^[A-Z0-9]{2,4}$/.test(t)) errors.push(`AIRCRAFT_DATA.${t}: not an ICAO type designator`);
      if (!d || typeof d !== 'object') { errors.push(`AIRCRAFT_DATA.${t}: entry is not an object`); continue; }
      if (Object.keys(d).join() !== ENTRY_FIELDS.join()) errors.push(`AIRCRAFT_DATA.${t}: fields must be ${ENTRY_FIELDS.join(', ')}`);
      if (!(typeof d.ws === 'number' && d.ws > 0)) errors.push(`AIRCRAFT_DATA.${t}.ws must be a positive number`);
      if (!(typeof d.mtow === 'number' && d.mtow > 0)) errors.push(`AIRCRAFT_DATA.${t}.mtow must be a positive number`);
      if (!/^[A-F]$/.test(d.code)) errors.push(`AIRCRAFT_DATA.${t}.code must be A–F`);
      if (!/^[LMHJ]$/.test(d.wake)) errors.push(`AIRCRAFT_DATA.${t}.wake must be L, M, H or J`);
      if (typeof d.turbine !== 'boolean') errors.push(`AIRCRAFT_DATA.${t}.turbine must be a boolean`);
    }
  }
  if (r.CALLSIGN_INDEX && typeof r.CALLSIGN_INDEX === 'object') {
    for (const k of Object.keys(r.CALLSIGN_INDEX)) {
      if (!/^[A-Z]{3}$/.test(k)) errors.push(`CALLSIGN_INDEX.${k}: not a 3-letter ICAO operator designator`);
      if (!(typeof r.CALLSIGN_INDEX[k] === 'string' && /^[A-Z]+$/.test(r.CALLSIGN_INDEX[k]))) errors.push(`CALLSIGN_INDEX.${k}: callsign must be upper-case letters`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

const API = {
  RULESET_TYPE, RULESET_VERSION, SCHEMA_VERSION, RULESET_SOURCE,
  validateSchema,
  AIRCRAFT_DATA,      // { [icaoType]: { ws, mtow, code, wake, turbine } } — frozen
  getWingspan,        // (acftType) → metres | null
  buildAcftProfile,   // (icaoType) → { type, ws, mtow, code, wake, turbine, known }
  CALLSIGN_INDEX,     // { [designator]: verbal callsign } — CS-1, frozen
  deriveCallsign,     // (fltNum) → { radioCallsign, verbalCallsign, isHeavy }
};
return API;
});
