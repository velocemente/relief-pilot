/**
 * icao-fpl.js — ICAO Filed Flight Plan Reader  (v1.0.0)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1 "ICAO flight plan", §2.2): reads the
 * filed ICAO flight plan block "(FPL- … )" as it appears in an OFP
 * package, whatever the OFP format (NavBlue, eOFP print, FlightKeys).
 *
 * v1.0.0 is NEW. It is not built into the app. Its users are the
 * FlightKeys parser (sprint step 6) and the D41 equipment check (later).
 * The NavBlue parser keeps its own FPL patterns (FLIGHT_ID_FPL,
 * AIRCRAFT_TYPE, FPL_WAKE, DATE_DOF; D47 lock); test/rules/icao-fpl.test.js
 * (TC-152) checks that this reader gives the same flight ID, aircraft
 * type, wake category and date of flight on every NavBlue fixture.
 *
 * Field rules: ICAO Doc 4444 (PANS-ATM) Appendix 2 (FPL form) and
 * Appendix 3 (ATS message fields 7, 8, 9, 10, 13, 15, 16, 18, 19).
 *   – A hyphen separates fields; it never appears inside a field.
 *   – A line break inside a field is a line wrap: in fields 7, 8, 9, 10
 *     and 13 (no spaces in their syntax) it is removed; in fields 15, 16
 *     and 18 it is read as one space.
 *   – A field that does not meet its Doc 4444 syntax is returned empty,
 *     with a WARN finding. Nothing is guessed or completed.
 *
 * DUAL CONTEXT
 *   Node / rules-loader: module.exports = the API object below.
 *   Browser (a plain script): no `module` → the API object is published
 *   once as the global IcaoFpl. Every declaration stays in the factory
 *   scope. No window, no DOM, no storage, no clock, no app state.
 *   Strict, like the app's main inline script.
 *
 * All times are UTC (EOBT, EET, DOF are as filed; nothing is converted).
 * ─────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.IcaoFpl = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · RULESET SCHEMA IDENTITY (Blueprint / rules-loader contract)
// ═══════════════════════════════════════════════════════════════

const RULESET_TYPE    = 'icao-fpl';
const RULESET_VERSION = '1.0.0';
const SCHEMA_VERSION  = 1;
const RULESET_SOURCE  = 'ICAO Doc 4444 (PANS-ATM) Appendix 2 and Appendix 3 (FPL message fields 7, 8, 9, 10, 13, 15, 16, 18); ICAO Doc 7030 (EUR) and EUROCONTROL IFPS for the regional field 18 indicators RVR, EUR, IFP, AWR, RFP';

// ═══════════════════════════════════════════════════════════════
// § 2 · RESULT SHAPE AND FIELD 18 INDICATORS
// ═══════════════════════════════════════════════════════════════

// The result, in this order. Strings are '' when empty; alternates [];
// other {} (field 18 indicator → text); findings [] ({ level, field, message }).
const RESULT_FIELDS = Object.freeze([
  'found', 'raw',
  'flightId',                              // field 7
  'flightRules', 'flightType',             // field 8
  'aircraftType', 'wake',                  // field 9
  'equipment', 'surveillance',             // field 10a, 10b
  'departure', 'eobt',                     // field 13
  'route',                                 // field 15
  'destination', 'eet', 'alternates',      // field 16
  'dof', 'reg', 'sel', 'rmk', 'other',     // field 18
  'findings',
]);

// Field 18 indicators. Doc 4444 Appendix 2 Item 18, in its order, then the
// regional indicators (Doc 7030 EUR / IFPS). Only these start a new item:
// any other "XXX/" is text of the item before it (RMK free text may contain
// an oblique stroke), reported as an INFO finding.
const FIELD18_INDICATORS = Object.freeze([
  'STS', 'PBN', 'NAV', 'COM', 'DAT', 'SUR', 'DEP', 'DEST', 'DOF', 'REG',
  'EET', 'SEL', 'TYP', 'CODE', 'DLE', 'OPR', 'ORGN', 'PER', 'ALTN', 'RALT',
  'TALT', 'RIF', 'RMK',
  'RVR', 'EUR', 'IFP', 'AWR', 'RFP',
]);
const F18_ITEM_RE = new RegExp('(?:^| )(' + FIELD18_INDICATORS.join('|') + ')\\/', 'g');
const F18_OTHER_SLASH_RE = /(?:^| )([A-Z]{2,5})\//g;

// Field syntax (Doc 4444 Appendix 3).
const FIELD_RE = {
  f7:    /^([A-Z0-9]{2,7})(?:\/[AC]\d{4})?$/,               // aircraft identification [/SSR mode and code]
  f8:    /^([IVYZ])([SNGMX]?)$/,                            // flight rules, type of flight
  f9:    /^(\d{1,2})?([A-Z][A-Z0-9]{1,3})\/([A-Z])$/,       // [number] type / wake turbulence category
  f10:   /^((?:[A-Z]\d?)+)\/((?:[A-Z]\d?)+)$/,              // 10a equipment / 10b surveillance
  f13:   /^([A-Z]{4})(\d{2})(\d{2})$/,                      // departure aerodrome, EOBT HHMM
  f15:   /^(?:[KN]\d{4}|M\d{3})(?:F\d{3}|S\d{4}|A\d{3}|M\d{4}|VFR)(?= |$)/,  // cruising speed + level first
  f16:   /^([A-Z]{4})(\d{2})(\d{2})$/,                      // destination aerodrome, total EET HHMM
  aerodrome: /^[A-Z]{4}$/,
  dof:   /^(\d{2})(\d{2})(\d{2})$/,
};
const WAKE_CATEGORIES = 'LMHJ';
// Field 19 starts with one of these single-letter indicators after a hyphen.
const FIELD19_START_RE = /-(?=\s*[EPRSJDANC]\/)/;

// ═══════════════════════════════════════════════════════════════
// § 3 · READER
// ═══════════════════════════════════════════════════════════════

function emptyResult() {
  return {
    found: false, raw: '',
    flightId: '',
    flightRules: '', flightType: '',
    aircraftType: '', wake: '',
    equipment: '', surveillance: '',
    departure: '', eobt: '',
    route: '',
    destination: '', eet: '', alternates: [],
    dof: '', reg: '', sel: '', rmk: '', other: {},
    findings: [],
  };
}

const squash = s => s.replace(/\s+/g, ' ').trim();   // line breaks → one space
const solid  = s => s.replace(/\s+/g, '');           // line breaks removed (no spaces in the syntax)

// Every complete block "(FPL-" … ")" in the text, in order.
// A block with no ")" before the next "(FPL-" (or the end) is not complete.
function findBlocks(text) {
  const blocks = [];
  let unclosed = 0;
  let i = text.indexOf('(FPL-');
  while (i >= 0) {
    const next = text.indexOf('(FPL-', i + 5);
    const end  = text.indexOf(')', i + 5);
    if (end >= 0 && (next < 0 || end < next)) {
      blocks.push(text.slice(i, end + 1));
    } else {
      unclosed++;
    }
    i = next;
  }
  return { blocks, unclosed };
}

// A real calendar date from DOF/YYMMDD → 'YYYY-MM-DD' (20YY, as the NavBlue parser reads it), or ''.
function dofToISO(v) {
  const m = FIELD_RE.dof.exec(v);
  if (!m) return '';
  const y = 2000 + parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1) return '';
  const days = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (d > days) return '';
  return `${y}-${m[2]}-${m[3]}`;
}

/**
 * Read the filed ICAO flight plan block from the text of an OFP package.
 * The first complete "(FPL- … )" block is read; later copies are only compared with it.
 * @param {string} text — raw text of the OFP package (or of the block alone)
 * @returns {object} the fields of RESULT_FIELDS (see the SPEC); never throws
 */
function parseIcaoFpl(text) {
  const r = emptyResult();
  const warn = (field, message) => r.findings.push({ level: 'WARN', field, message });
  const info = (field, message) => r.findings.push({ level: 'INFO', field, message });

  if (typeof text !== 'string') { info('found', 'input is not text'); return r; }
  const { blocks, unclosed } = findBlocks(text);
  if (!blocks.length) {
    if (unclosed) warn('found', `"(FPL-" found ${unclosed} time(s) but no closing ")": no complete FPL block`);
    else info('found', 'no ICAO FPL block "(FPL-" in the text');
    return r;
  }
  r.found = true;
  r.raw = blocks[0];
  if (unclosed) warn('raw', `${unclosed} "(FPL-" without a closing ")" ignored`);
  const differ = blocks.slice(1).filter(b => squash(b) !== squash(blocks[0])).length;
  if (differ) warn('raw', `${blocks.length} FPL blocks, ${differ} differ from the first; the first is read`);

  // Fields: "(FPL" - 7 - 8 - 9 - 10 - 13 - 15 - 16 - 18 [- 19] ")"
  const parts = r.raw.slice(1, -1).split('-');
  if (parts.length < 9) {
    warn('raw', `FPL block has ${parts.length - 1} field(s); expected 8 (fields 7, 8, 9, 10, 13, 15, 16, 18): not read`);
    return r;
  }
  const [, f7, f8, f9, f10, f13, f15, f16] = parts;
  let f18 = parts.slice(8).join('-');
  const f19at = f18.search(FIELD19_START_RE);
  if (f19at >= 0) {
    info('other', 'field 19 (supplementary information) present; not read');
    f18 = f18.slice(0, f19at);
  }
  if (f18.includes('-')) warn('other', 'a hyphen (the field separator) inside field 18; kept as text');

  // ── Field 7 — aircraft identification ───────────────────────────────
  let m = FIELD_RE.f7.exec(solid(f7));
  if (m) r.flightId = m[1];
  else warn('flightId', 'field 7 (aircraft identification) not readable');

  // ── Field 8 — flight rules, type of flight ──────────────────────────
  m = FIELD_RE.f8.exec(solid(f8));
  if (m) { r.flightRules = m[1]; r.flightType = m[2]; }
  else warn('flightRules', 'field 8 (flight rules / type of flight) not readable');
  if (m && !m[2]) info('flightType', 'field 8: no type of flight filed');

  // ── Field 9 — [number of aircraft] type / wake turbulence category ──
  m = FIELD_RE.f9.exec(solid(f9));
  if (m) {
    r.aircraftType = m[2];
    if (m[1]) info('aircraftType', `field 9: number of aircraft ${m[1]}`);
    if (r.aircraftType === 'ZZZZ') info('aircraftType', 'field 9: type ZZZZ (see TYP/ in field 18)');
    if (WAKE_CATEGORIES.includes(m[3])) r.wake = m[3];
    else warn('wake', 'field 9: wake turbulence category is not L, M, H or J');
  } else {
    warn('aircraftType', 'field 9 (aircraft type / wake turbulence category) not readable');
  }

  // ── Field 10 — equipment and capabilities / surveillance ────────────
  m = FIELD_RE.f10.exec(solid(f10));
  if (m) { r.equipment = m[1]; r.surveillance = m[2]; }
  else warn('equipment', 'field 10 (equipment / surveillance) not readable');

  // ── Field 13 — departure aerodrome and EOBT ─────────────────────────
  m = FIELD_RE.f13.exec(solid(f13));
  if (m) {
    r.departure = m[1];
    if (m[1] === 'ZZZZ' || m[1] === 'AFIL') info('departure', `field 13: departure ${m[1]} (see DEP/ in field 18)`);
    if (parseInt(m[2], 10) < 24 && parseInt(m[3], 10) < 60) r.eobt = m[2] + m[3];
    else warn('eobt', 'field 13: EOBT is not a time HHMM');
  } else {
    warn('departure', 'field 13 (departure aerodrome / EOBT) not readable');
  }

  // ── Field 15 — route (cruising speed, level, route) ─────────────────
  const route = squash(f15);
  if (FIELD_RE.f15.test(route)) r.route = route;
  else warn('route', 'field 15 does not start with a cruising speed and level: not read');

  // ── Field 16 — destination, total EET, alternates ───────────────────
  const t16 = squash(f16).split(' ').filter(Boolean);
  m = FIELD_RE.f16.exec(t16[0] || '');
  if (m) {
    r.destination = m[1];
    if (m[1] === 'ZZZZ') info('destination', 'field 16: destination ZZZZ (see DEST/ in field 18)');
    if (parseInt(m[3], 10) < 60) r.eet = m[2] + m[3];
    else warn('eet', 'field 16: total EET is not a duration HHMM');
    for (const a of t16.slice(1)) {
      if (FIELD_RE.aerodrome.test(a)) r.alternates.push(a);
      else warn('alternates', 'field 16: an alternate that is not a 4-letter aerodrome was not read');
    }
    if (r.alternates.length > 2) warn('alternates', `field 16: ${r.alternates.length} alternates (Doc 4444 allows 2)`);
    if (r.alternates.includes('ZZZZ')) info('alternates', 'field 16: alternate ZZZZ (see ALTN/ in field 18)');
  } else {
    warn('destination', 'field 16 (destination / total EET / alternates) not readable');
  }

  // ── Field 18 — other information ────────────────────────────────────
  const t18 = squash(f18);
  if (t18 === '0') {
    info('other', 'field 18: 0 (no other information)');
  } else {
    const items = [];
    F18_ITEM_RE.lastIndex = 0;
    let im;
    while ((im = F18_ITEM_RE.exec(t18)) !== null) {
      items.push({ key: im[1], start: im.index + im[0].length, at: im.index });
    }
    const lead = (items.length ? t18.slice(0, items[0].at) : t18).trim();
    if (lead) warn('other', 'field 18: text before the first indicator not read');
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      const value = t18.slice(it.start, k + 1 < items.length ? items[k + 1].at : t18.length).trim();
      if (!value) warn(`other.${it.key}`, `field 18: ${it.key}/ has no text`);
      if (Object.prototype.hasOwnProperty.call(r.other, it.key)) {
        warn(`other.${it.key}`, `field 18: ${it.key}/ filed more than once; the texts are joined`);
        r.other[it.key] = squash(r.other[it.key] + ' ' + value);
      } else {
        r.other[it.key] = value;
      }
      F18_OTHER_SLASH_RE.lastIndex = 0;
      let om;
      while ((om = F18_OTHER_SLASH_RE.exec(value)) !== null) {
        info(`other.${it.key}`, `field 18: "${om[1]}/" is not a field 18 indicator; kept in ${it.key}/`);
      }
    }
  }

  // DOF / REG / SEL / RMK
  if ('DOF' in r.other) {
    r.dof = dofToISO(r.other.DOF);
    if (!r.dof && r.other.DOF) warn('dof', 'field 18: DOF/ is not a date YYMMDD');
  }
  r.reg = r.other.REG || '';
  r.sel = r.other.SEL || '';
  r.rmk = r.other.RMK || '';
  const absent = ['DOF', 'REG', 'SEL', 'RMK'].filter(k => !(k in r.other));
  if (absent.length) info('other', `field 18: not filed: ${absent.join(', ')}`);

  return r;
}

// ═══════════════════════════════════════════════════════════════
// § 4 · SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════

const REQUIRED_EXPORTS = {
  RULESET_TYPE: 'string', RULESET_VERSION: 'string', SCHEMA_VERSION: 'number',
  RULESET_SOURCE: 'string', validateSchema: 'function',
  RESULT_FIELDS: 'object', FIELD18_INDICATORS: 'object', parseIcaoFpl: 'function',
};
// Format parsers and app logic are not part of a shared module.
const FORBIDDEN_EXPORTS = ['parseNavBlue', '_ofpRulesetParse', 'parseOFP', 'parseFlightKeys'];

/**
 * Check an icao-fpl ruleset object against the schema contract.
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
  for (const k of FORBIDDEN_EXPORTS) if (k in r) errors.push(`${k} must not be exported (not part of the ICAO FPL reader)`);
  if (r.RULESET_TYPE !== 'icao-fpl') errors.push(`RULESET_TYPE must be 'icao-fpl', got '${r.RULESET_TYPE}'`);
  if (typeof r.RULESET_VERSION === 'string' && !/^\d+\.\d+\.\d+$/.test(r.RULESET_VERSION)) errors.push(`RULESET_VERSION '${r.RULESET_VERSION}' is not semver`);
  if (typeof r.SCHEMA_VERSION === 'number' && !(Number.isInteger(r.SCHEMA_VERSION) && r.SCHEMA_VERSION >= 1)) errors.push(`SCHEMA_VERSION ${r.SCHEMA_VERSION} must be an integer >= 1`);
  if (typeof r.RULESET_SOURCE === 'string' && !r.RULESET_SOURCE.trim()) errors.push('RULESET_SOURCE is empty');
  if (Array.isArray(r.FIELD18_INDICATORS)) {
    const seen = new Set();
    for (const k of r.FIELD18_INDICATORS) {
      if (typeof k !== 'string' || !/^[A-Z]{3,4}$/.test(k)) errors.push(`FIELD18_INDICATORS: '${k}' is not a 3–4 letter indicator`);
      if (seen.has(k)) errors.push(`FIELD18_INDICATORS: '${k}' listed twice`);
      seen.add(k);
    }
  } else if (r.FIELD18_INDICATORS && typeof r.FIELD18_INDICATORS === 'object') {
    errors.push('FIELD18_INDICATORS must be an array');
  }
  if (r.RESULT_FIELDS && typeof r.RESULT_FIELDS === 'object' && (!Array.isArray(r.RESULT_FIELDS) || r.RESULT_FIELDS.join() !== RESULT_FIELDS.join())) {
    errors.push(`RESULT_FIELDS must be ${RESULT_FIELDS.join(', ')}`);
  }
  if (typeof r.parseIcaoFpl === 'function') {
    let e;
    try { e = r.parseIcaoFpl(''); } catch (x) { errors.push(`parseIcaoFpl('') throws: ${x && x.message}`); }
    if (e !== undefined) {
      if (!e || typeof e !== 'object' || Object.keys(e).join() !== RESULT_FIELDS.join()) errors.push(`parseIcaoFpl('') must return the fields ${RESULT_FIELDS.join(', ')}`);
      else if (e.found !== false) errors.push(`parseIcaoFpl('') must return found: false`);
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
  RESULT_FIELDS,        // the result's field names, in order — frozen
  FIELD18_INDICATORS,   // field 18 indicators that start an item — frozen
  parseIcaoFpl,         // (text) → { found, raw, flightId, … other, findings }
};
return API;
});
