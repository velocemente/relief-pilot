/**
 * ofp-flightkeys.js — FlightKeys OFP Parser  (v0.1.0, development version, contract v2.1)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1–2.4): the FlightKeys OFP parser. It reads
 * an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns
 * the briefing contract — the same 57 core fields, with the same names, types
 * and meanings, as the locked NavBlue parser (FK-P), plus the Appendix B
 * extensions and findings[].
 *
 * v0.1.0 (D58) is a DEVELOPMENT version. It is not built into index.html, not
 * used by the app and not published to the master folder. It reads the OFP
 * release (page 1 and the route): identity and header, airports and times,
 * fuel, weights, DOT exemption, slot, ETOPS, POR, ETP/CFS, nav log (for TOC
 * and the ETOPS/ETP/POR times) and alternate routes (field map v1.1 rows
 * 1–23, 29–31, 33, 34, 36, 39–41). Every other field is returned as an
 * explicit empty value with one INFO finding naming the step that reads it
 * ("read in 5b-2" — the rest of the release; "read in 5d" — the briefing
 * package). v0.1.0 must not be integrated: an explicit empty is not a value.
 *
 * INPUT  parseFlightKeys(input, options)
 *   input   { text, pages:[{ page, width, height, items:[{ str, x, y, w, h,
 *             font, order }] }] } — exactly what the app's extractor produces
 *             (tools/extract: the fixtures' text/ and items/ files). Mapping
 *             from an extractor items file: page = pages[i].n; width/height
 *             as stored; each item's str/x/y/w/h/font as stored (y measured
 *             from the TOP of the page); order = the item's index in its
 *             page's items array (pdf.js source order). inputFromExtractor()
 *             does exactly this.
 *   options { icaoFpl, aircraftProfile, parseNatTrack } — the shared modules,
 *             passed in. The module never reads window, document, storage,
 *             the clock or any app global.
 *
 * DUAL CONTEXT
 *   Node / rules-loader: module.exports = the API object below.
 *   Browser (a plain script): no `module` → the API object is published once
 *   as the global OfpFlightKeys. Every declaration stays in the factory scope.
 *
 * All times are UTC. OFP times are Z; no time-zone suffix is ever converted.
 * ─────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.OfpFlightKeys = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · RULESET SCHEMA IDENTITY (Blueprint / rules-loader contract)
// ═══════════════════════════════════════════════════════════════

const RULESET_TYPE     = 'ofp';
const OFP_FORMAT       = 'flightkeys';
const RULESET_VERSION  = '0.1.0';
const SCHEMA_VERSION   = 2;
// Contract v2.0 (ADR-005 Appendix A + B) plus two extension fields added by
// the Appendix B addendum (Exec SME answers 13 Nov: specialQualification, swa).
// Adding fields is a minor contract version (ADR-005 §2.4) → 2.1.
const CONTRACT_VERSION = '2.1';
const RULESET_SOURCE   = 'FlightKeys OFP issued by Atlas Air / Polar Air Cargo dispatch (release, ICAO FPL and briefing package); field map SPRINT-OFP-FlightKeysMigration v1.1; ICAO Doc 4444 App 2/3 through icao-fpl';

// ═══════════════════════════════════════════════════════════════
// § 2 · CONTRACT FIELD LISTS (ADR-005 Appendix A and B)
// ═══════════════════════════════════════════════════════════════

// Appendix A — the 57 core fields, in the NavBlue parser's order.
const CORE_FIELDS = Object.freeze([
  'fltNum', 'acftType', 'weightUnit', 'isHeavy', 'dateStr', 'flightDateISO',
  'origIcao', 'destIcao', 'offFromOFP', 'etaDest', 'destEtaOffsetMins',
  'tripMinutes', 'taxiMins', 'etopsEntry', 'etopsSpec', 'etopsEntryMins',
  'etopsExit', 'etopsExitMins', 'porWpt', 'porOffsetMins', 'porMinf',
  'alt1Fuel', 'destRemf', 'blockFuelRaw', 'minfFuelRaw', 'fresFuelRaw',
  'ballastFuel', 'crewMembers', 'tocOffsetMins', 'togwActual', 'togwLimit',
  'zfwActual', 'zfwLimit', 'ldgwActual', 'ldgwLimit', 'hasPerishables',
  'dotExemption', 'hasTemperatureControl', 'hasVzfwCkLimit', 'slotTime',
  'catIiIiiApproaches', 'addlFfAdj', 'ddgItems', 'melItems', 'overflightPerms',
  'altRoutes', 'altData', 'oeiData', 'etpPoints', 'navLog', 'enrouteNotams',
  'natTrack', 'airportData', 'parsedVerbalCallsign', 'zfwIncrFactor',
  'taxiFuelRaw', 'rawOFP',
]);

// Appendix B — top-level extensions, in order (contract v2.0 list with `swa`
// added before `sections` by the addendum).
const EXTENSION_FIELDS = Object.freeze([
  'revision', 'companyNotams', 'ofpRemarks', 'fplEquipment',
  'catIiIiiRestrictions', 'securityMessages', 'extraFuel', 'pcf', 'permits',
  'designator', 'swa', 'sections', 'findings',
]);
// Extensions on core records. specialQualification: addendum (SME-2).
const AIRPORT_EXTENSION_FIELDS = Object.freeze(['remarks', 'remarksWeather', 'specialQualification']);
const DDG_EXTENSION_FIELDS     = Object.freeze(['type', 'notes']);

// Fields v0.1.0 does not read: the explicit empty is returned and one INFO
// finding names the step that reads the field (field map v1.1 rows).
const DEFERRED_FIELDS = Object.freeze({
  crewMembers:            '5b-2',  // row 26
  hasPerishables:         '5b-2',  // row 27
  hasTemperatureControl:  '5b-2',  // row 28 (D55)
  catIiIiiApproaches:     '5b-2',  // row 24
  ddgItems:               '5b-2',  // row 25
  melItems:               '5b-2',  // row 25
  overflightPerms:        '5b-2',  // row 35
  oeiData:                '5b-2',  // row 32
  enrouteNotams:          '5d',    // row 49
  natTrack:               '5d',    // row 42
  'airportData.weather':  '5d',    // rows 43, 45, 48
  'airportData.notams':   '5d',    // rows 44, 45
  'airportData.curfew':   '5d',    // row 46
  'airportData.opsNotes': '5d',    // row 47
  'airportData.remarks':  '5b-2',  // Appendix B
  'airportData.remarksWeather': '5b-2',
  revision:               '5b-2',
  companyNotams:          '5d',
  ofpRemarks:             '5b-2',
  fplEquipment:           '5b-2',
  catIiIiiRestrictions:   '5b-2',
  securityMessages:       '5b-2',
  extraFuel:              '5b-2',
  pcf:                    '5b-2',
  permits:                '5b-2',
  sections:               '5d',
});

// ═══════════════════════════════════════════════════════════════
// § 3 · PATTERNS (FlightKeys release, structure per field map v1.1)
// ═══════════════════════════════════════════════════════════════

const PATTERNS = {
  // Release page: running header "CCC####/DDMON/ORIG-DEST/REG", then
  // "OPERATIONAL FLIGHT PLAN …", footer "FUFI: <uuid> PAGE n/N".
  RELEASE_HEADER:  /^[A-Z]{2,3}\d{1,5}\/\d{2}[A-Z]{3}\/[A-Z]{4}-[A-Z]{4}\//,
  RELEASE_TITLE:   /^OPERATIONAL FLIGHT PLAN\b/,
  RELEASE_FOOTER:  /^FUFI: [0-9A-F-]+ PAGE (\d+)\/(\d+)$/,
  // Identity line, OFP p1 (row 1, 4): "CCC####/DD ORIG - DEST DD MON YY REG"
  IDENTITY_LINE:   /^([A-Z]{2,3})(\d{1,5})\/(\d{2})\s+([A-Z]{4})\s+-\s+([A-Z]{4})\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})(?:\s|$)/,
  // Type line, OFP p1 (row 3): "MODEL / ENGINE / KG|LB / IFR / FF +n.n [ETOPS Entry HH.MM]"
  TYPE_LINE:       /^\S[^\/\n]*\/[^\/\n]*\/\s*(KGS?|LBS?)\s*\/\s*IFR\b/,
  // Airport line, OFP p1 (rows 5–8a): "KW IIII/AAA NAME [Q] LATLON HHMMZ";
  // the 3-letter code may be absent ("IIII/ NAME", L22) — the correct rule,
  // not the NavBlue template (NB-F1).
  APT_LINE:        /^(ORIG|DEST|PALT|SALT|RAPT|RALT|TALT)\s+([A-Z]{4})\/([A-Z0-9]{3})?(?:\s+(.*?))?\s+([NS]\d{5}[EW]\d{6})\s+(\d{4})Z\s*$/,
};

// Alternate keywords → crew roles: the NavBlue rule (ALT_PATTERNS), unchanged
// (rows 7, 8; D55 for SALT/TALT). The ORDER of altData is the order of the
// OFP p1 lines (SME-1), not this table's order.
const ALT_ROLES = Object.freeze({
  PALT: 'DEST ALT', SALT: 'DEST ALT', RALT: 'EN ROUTE ALT', RAPT: 'EN ROUTE ALT', TALT: 'TKOF ALT',
});

const MONTHS = Object.freeze({ JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 });
const MON_NAMES = Object.freeze(['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']);

// ═══════════════════════════════════════════════════════════════
// § 4 · SMALL HELPERS
// ═══════════════════════════════════════════════════════════════

// A real calendar date (no Date object, no clock).
function _isRealDate(yyyy, mo1, dd) {
  if (!(mo1 >= 1 && mo1 <= 12) || !(dd >= 1)) return false;
  const leap = (yyyy % 4 === 0 && yyyy % 100 !== 0) || yyyy % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo1 - 1];
  return dd <= days;
}
function _pad2(n) { return String(n).padStart(2, '0'); }
// 'HHMM' clock time → minutes, or null when not a time.
function _hhmmToMins(s) {
  const m = /^(\d{2})(\d{2})$/.exec(s || '');
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  return hh < 24 && mm < 60 ? hh * 60 + mm : null;
}

// Input mapping from the extractor's files (tools/extract) to the API input.
function inputFromExtractor(rawText, itemsDoc) {
  const pages = (itemsDoc && Array.isArray(itemsDoc.pages) ? itemsDoc.pages : []).map(p => ({
    page: p.n, width: p.width, height: p.height,
    items: (p.items || []).map((it, i) => ({ str: it.str, x: it.x, y: it.y, w: it.w, h: it.h, font: it.font, order: i })),
  }));
  return { text: rawText, pages };
}

// Text pages: the extractor writes each page's lines and one blank line per
// page break, so blank lines separate pages exactly (an image-only page is an
// empty page).
function _textPages(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const pages = [];
  let cur = [];
  for (const l of lines) {
    if (l === '') { pages.push(cur); cur = []; } else cur.push(l);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

// The release copies: runs of release pages PAGE 1/N … N/N. Body lines are the
// page lines without the running header, the title line and the footer.
function _releaseCopies(pages) {
  const copies = [];
  let cur = null;
  pages.forEach((lines, i) => {
    if (lines.length < 3 || !PATTERNS.RELEASE_HEADER.test(lines[0]) || !PATTERNS.RELEASE_TITLE.test(lines[1])) return;
    const fm = PATTERNS.RELEASE_FOOTER.exec(lines[lines.length - 1]);
    if (!fm) return;
    const n = +fm[1], of = +fm[2];
    const page = { pdfPage: i + 1, n, of, body: lines.slice(2, -1) };
    if (n === 1) { cur = { pages: [page], of }; copies.push(cur); }
    else if (cur && cur.of === of && cur.pages[cur.pages.length - 1].n === n - 1) cur.pages.push(page);
  });
  return copies.map(c => ({
    pages: c.pages, of: c.of, complete: c.pages.length === c.of,
    lines: [].concat(...c.pages.map(p => p.body)),
  }));
}

// ═══════════════════════════════════════════════════════════════
// § 5 · THE PARSE
// ═══════════════════════════════════════════════════════════════

function _emptyCore(text) {
  return {
    fltNum: '', acftType: '', weightUnit: 'KGS', isHeavy: false, dateStr: '', flightDateISO: '',
    origIcao: '', destIcao: '', offFromOFP: '', etaDest: '', destEtaOffsetMins: null,
    tripMinutes: null, taxiMins: null, etopsEntry: '', etopsSpec: '', etopsEntryMins: null,
    etopsExit: '', etopsExitMins: null, porWpt: '', porOffsetMins: null, porMinf: '',
    alt1Fuel: '', destRemf: '', blockFuelRaw: '', minfFuelRaw: '', fresFuelRaw: '',
    ballastFuel: null, crewMembers: [], tocOffsetMins: null, togwActual: 0, togwLimit: 0,
    zfwActual: 0, zfwLimit: 0, ldgwActual: 0, ldgwLimit: 0, hasPerishables: false,
    dotExemption: null, hasTemperatureControl: false, hasVzfwCkLimit: false, slotTime: null,
    catIiIiiApproaches: null, addlFfAdj: null, ddgItems: [], melItems: '', overflightPerms: '',
    altRoutes: [], altData: [], oeiData: [], etpPoints: [], navLog: [],
    enrouteNotams: { route: '', fir: '', airway: '', waypoint: '', geographic: '' },
    natTrack: null, airportData: {}, parsedVerbalCallsign: null, zfwIncrFactor: null,
    taxiFuelRaw: '', rawOFP: text,
  };
}

function _emptyExtensions() {
  return {
    revision: null, companyNotams: [], ofpRemarks: [], fplEquipment: null,
    catIiIiiRestrictions: [], securityMessages: [], extraFuel: null, pcf: null, permits: [],
    designator: '', swa: null, sections: [], findings: [],
  };
}

/**
 * Parse a FlightKeys package into the briefing contract (v2.1).
 * @param {{text:string, pages?:Array}} input — see the file header
 * @param {{icaoFpl?:object, aircraftProfile?:object, parseNatTrack?:function}} [options]
 * @returns {object|null} null when input.text is not a non-empty string
 */
function parseFlightKeys(input, options) {
  const text = input && typeof input === 'object' ? input.text : undefined;
  if (typeof text !== 'string' || !text.trim()) return null;
  const opts = options && typeof options === 'object' ? options : {};
  const findings = [];
  const add = (level, field, message) => findings.push({ level, field, message });

  const out = _emptyCore(text);
  const ext = _emptyExtensions();

  // ── Inputs ──────────────────────────────────────────────────────────
  const pagesIn = Array.isArray(input.pages) ? input.pages : null;
  const textPages = _textPages(text);
  if (!pagesIn) add('WARN', 'input', 'positioned items (input.pages) not supplied; read from text only');
  else if (pagesIn.length !== textPages.length) add('WARN', 'input', `input.pages has ${pagesIn.length} pages, the text ${textPages.length}`);

  const fplMod = opts.icaoFpl && typeof opts.icaoFpl.parseIcaoFpl === 'function' ? opts.icaoFpl : null;
  const fpl = fplMod ? fplMod.parseIcaoFpl(text) : null;
  if (!fplMod) add('WARN', 'icaoFpl', 'icao-fpl module not supplied: aircraft type, wake and FPL date not read');
  else if (!fpl.found) add('WARN', 'icaoFpl', 'no ICAO flight plan (FPL) block found');
  else if (!fpl.complete) add('WARN', 'icaoFpl', 'ICAO flight plan block incomplete: field 18 (DOF) not read');
  const acp = opts.aircraftProfile && typeof opts.aircraftProfile === 'object' ? opts.aircraftProfile : null;
  if (!acp) add('INFO', 'aircraftProfile', 'aircraft-profile module not supplied');

  // ── Release ─────────────────────────────────────────────────────────
  const copies = _releaseCopies(textPages);
  const rel = copies[0] || null;
  if (!rel) {
    add('WARN', 'release', 'no FlightKeys release (OPERATIONAL FLIGHT PLAN pages with a FUFI footer) found');
  } else {
    if (!rel.complete) add('WARN', 'release', `release incomplete: ${rel.pages.length} of ${rel.of} pages`);
    if (copies.length > 1) {
      const same = copies.every(c => c.lines.length === rel.lines.length && c.lines.every((l, i) => l === rel.lines[i]));
      add(same ? 'INFO' : 'WARN', 'release',
        `release printed ${copies.length} times; ${same ? 'copies identical' : 'copies DIFFER — the first copy is read'}`);
    }
  }
  const p1 = rel ? rel.pages[0].body : [];
  const ctx = { out, ext, add, fpl, acp, rel, p1, pagesIn, textPages };

  _readIdentity(ctx);
  _readAirports(ctx);
  _readPending(ctx);

  // ── Deferred fields: explicit empties, one INFO each ───────────────
  for (const f of Object.keys(DEFERRED_FIELDS)) add('INFO', f, `not read in v${RULESET_VERSION}: read in ${DEFERRED_FIELDS[f]}`);
  if (typeof opts.parseNatTrack === 'function') add('INFO', 'natTrack', `NAT parser supplied; not called in v${RULESET_VERSION} (row 42, 5d)`);

  // ── Assemble: core fields in CORE_FIELDS order, then the extensions ─
  const res = {};
  for (const k of CORE_FIELDS) res[k] = out[k];
  for (const k of EXTENSION_FIELDS) res[k] = k === 'findings' ? findings : ext[k];
  return res;
}

// ── Identity, type, date (rows 1–4; SME-5, SME-16; D57) ───────────────
function _readIdentity(ctx) {
  const { out, ext, add, fpl, acp, p1 } = ctx;

  // Flight ID: the release identity line; else the FPL flight ID. Never the
  // briefing running header (SME-16: L22 prints another number there).
  let idM = null;
  for (const l of p1) { idM = PATTERNS.IDENTITY_LINE.exec(l); if (idM) break; }
  const fplId = fpl && fpl.flightId ? fpl.flightId : '';
  if (idM) {
    out.fltNum = idM[1] + idM[2] + '/' + idM[3];
    ext.designator = idM[1];
    if (fplId && fplId !== idM[1] + idM[2]) {
      add('WARN', 'fltNum', 'release flight number and FPL flight ID differ; the release number is used');
    }
  } else if (/^[A-Z]{2,3}\d{1,5}$/.test(fplId)) {
    out.fltNum = fplId;
    ext.designator = fplId.replace(/\d+$/, '');
    add('WARN', 'fltNum', 'release identity line not found; flight number from the FPL (no day suffix)');
  } else {
    add('WARN', 'fltNum', 'flight number not found in the release or the FPL');
  }
  if (ext.designator && acp && acp.CALLSIGN_INDEX && typeof acp.CALLSIGN_INDEX === 'object'
      && !Object.prototype.hasOwnProperty.call(acp.CALLSIGN_INDEX, ext.designator)) {
    add('INFO', 'designator', `designator ${ext.designator} is not in the callsign index (CS-1): no verbal callsign`);
  }

  // Aircraft type and wake: FPL field 9 through icao-fpl (as NavBlue reads FPL 9).
  if (fpl && fpl.aircraftType) out.acftType = fpl.aircraftType;
  else if (fpl) add('WARN', 'acftType', 'aircraft type not read from the FPL');
  if (fpl && fpl.wake) out.isHeavy = fpl.wake === 'H' || fpl.wake === 'J';
  else if (fpl) add('WARN', 'isHeavy', 'wake category not read from the FPL');
  if (out.acftType && acp && acp.AIRCRAFT_DATA && typeof acp.AIRCRAFT_DATA === 'object'
      && !Object.prototype.hasOwnProperty.call(acp.AIRCRAFT_DATA, out.acftType)) {
    add('INFO', 'acftType', `aircraft type ${out.acftType} is not in the aircraft table`);
  }

  // Weight unit: OFP p1 type line (row 3). NavBlue default KGS when unreadable.
  let wu = null;
  for (const l of p1) { const m = PATTERNS.TYPE_LINE.exec(l); if (m) { wu = m[1]; break; } }
  if (wu) out.weightUnit = wu.charAt(0) === 'K' ? 'KGS' : 'LBS';
  else add('WARN', 'weightUnit', 'weight unit not found on the OFP type line; KGS assumed (NavBlue default)');

  // Date (row 4, D57): ONLY the FPL DOF (icao-fpl, a real calendar date) or
  // the OFP header date on the identity line, checked as a real date. Never
  // free text, never the release print time. Neither → '' + WARN.
  let hdrISO = '';
  if (idM) {
    const dd = +idM[6], mon = MONTHS[idM[7]], yy = 2000 + (+idM[8]);
    if (mon !== undefined && _isRealDate(yy, mon + 1, dd)) hdrISO = `${yy}-${_pad2(mon + 1)}-${_pad2(dd)}`;
    else add('WARN', 'flightDateISO', 'OFP header date is not a real date');
  }
  const fplFiled = !!(fpl && fpl.other && Object.prototype.hasOwnProperty.call(fpl.other, 'DOF'));
  const dofISO = fpl && /^\d{4}-\d{2}-\d{2}$/.test(fpl.dof) ? fpl.dof : '';
  if (fplFiled && !dofISO) add('WARN', 'flightDateISO', 'FPL DOF is not a real date');
  let iso = '';
  if (dofISO) {
    iso = dofISO;
    if (hdrISO && hdrISO !== dofISO) add('WARN', 'flightDateISO', 'FPL DOF and OFP header date differ; the DOF is used');
  } else if (hdrISO) {
    iso = hdrISO;
    add('INFO', 'flightDateISO', 'no valid FPL DOF; date from the OFP header');
  } else {
    add('WARN', 'flightDateISO', 'no valid flight date (FPL DOF or OFP header): left empty');
  }
  if (iso) {
    out.flightDateISO = iso;
    out.dateStr = `${iso.slice(8, 10)} ${MON_NAMES[+iso.slice(5, 7) - 1]} ${iso.slice(2, 4)}`;
  }
}

// Position check for the Q token: on the PDF page, the item "Q" sits on the
// airport line's y, just left of the lat/long item. Returns true/false, or
// null when the positioned items cannot answer.
function _qByPosition(ctx, pdfPage, keyword, latlon) {
  const pg = ctx.pagesIn && ctx.pagesIn.find(p => p && p.page === pdfPage);
  if (!pg || !Array.isArray(pg.items)) return null;
  const items = pg.items.filter(it => it && typeof it.str === 'string');
  for (const kw of items.filter(it => it.str === keyword || it.str.startsWith(keyword + ' '))) {
    const row = items.filter(it => Math.abs(it.y - kw.y) <= 2);
    const ll = row.find(it => it.str.trim() === latlon);
    if (ll) return row.some(it => it.str.trim() === 'Q' && it.x < ll.x && ll.x - it.x <= 25);
  }
  return null;
}

// ── Airports and times (rows 5–8a; SME-1, SME-2; D55) ──────────────────
function _readAirports(ctx) {
  const { out, add, p1, rel } = ctx;
  const lines = [];
  for (const l of p1) {
    const m = PATTERNS.APT_LINE.exec(l);
    if (!m) continue;
    let name = (m[4] || '').trim();
    let q = false;
    if (/(?:^|\s)Q$/.test(name)) { q = true; name = name.replace(/\s*Q$/, '').trim(); }
    const pos = rel ? _qByPosition(ctx, rel.pages[0].pdfPage, m[1], m[5]) : null;
    if (pos !== null && pos !== q) {
      add('WARN', 'specialQualification', `${m[2]}: Q token read from positions (${pos}) differs from the text (${q}); positions used`);
      q = pos;
    }
    let hhmm = m[6];
    if (_hhmmToMins(hhmm) === null) { add('WARN', m[1], `${m[2]}: time ${hhmm}Z is not a clock time`); hhmm = ''; }
    lines.push({ kw: m[1], icao: m[2], iata: m[3] || '', q, hhmm });
  }
  const first = kw => lines.find(a => a.kw === kw) || null;
  const orig = first('ORIG'), dest = first('DEST');
  if (orig) { out.origIcao = orig.icao; out.offFromOFP = orig.hhmm; }
  else add('WARN', 'origIcao', 'ORIG line not found on OFP page 1');
  if (dest) { out.destIcao = dest.icao; out.etaDest = dest.hhmm; }
  else add('WARN', 'destIcao', 'DEST line not found on OFP page 1');
  for (const a of lines) {
    if (!a.iata) add('INFO', a.kw, `${a.icao} has no 3-letter code on OFP page 1`);
  }

  const offMin = _hhmmToMins(out.offFromOFP);
  if (offMin !== null && _hhmmToMins(out.etaDest) !== null) {
    let off = _hhmmToMins(out.etaDest) - offMin;
    if (off < 0) off += 1440;
    out.destEtaOffsetMins = off;
  }

  // Alternates: the NavBlue role rule, in OFP p1 line order (SME-1).
  ctx.altLines = lines.filter(a => ALT_ROLES[a.kw]);
  ctx.offMin = offMin;
  // airportData: one entry per OFP p1 airport, carrying specialQualification
  // (SME-2). weather/notams are read in 5d.
  for (const a of lines) {
    if (!ctx.out.airportData[a.icao]) {
      ctx.out.airportData[a.icao] = { weather: '', notams: '', remarks: [], remarksWeather: [], specialQualification: a.q };
    } else if (a.q) ctx.out.airportData[a.icao].specialQualification = true;
  }
}

// Builds altData from the OFP p1 alternate lines (after tripMinutes is known,
// for the NavBlue fallback offset when a line has no time).
function _buildAltData(ctx) {
  const { out } = ctx;
  for (const a of ctx.altLines || []) {
    if (out.altData.find(x => x.icao === a.icao)) continue;
    const role = ALT_ROLES[a.kw];
    let ofpOffsetMins = null;
    const etaMin = _hhmmToMins(a.hhmm);
    if (etaMin !== null && ctx.offMin !== null) {
      let o = etaMin - ctx.offMin;
      if (o < 0) o += 1440;
      ofpOffsetMins = o;
    } else if (out.tripMinutes !== null) {
      ofpOffsetMins = role === 'EN ROUTE ALT' ? Math.round(out.tripMinutes / 2) : out.tripMinutes + 30;
    }
    out.altData.push({ icao: a.icao, role, ofpEta: a.hhmm, ofpOffsetMins, currentEta: a.hhmm });
  }
}

// Fields of the v0.1.0 scope still being built on this branch.
function _readPending(ctx) {
  _buildAltData(ctx);
}

// ═══════════════════════════════════════════════════════════════
// § 6 · SCHEMA VALIDATION (Blueprint)
// ═══════════════════════════════════════════════════════════════

const REQUIRED_EXPORTS = {
  RULESET_TYPE: 'string', OFP_FORMAT: 'string', RULESET_VERSION: 'string',
  SCHEMA_VERSION: 'number', CONTRACT_VERSION: 'string', RULESET_SOURCE: 'string',
  validateSchema: 'function', parseFlightKeys: 'function', inputFromExtractor: 'function',
  PATTERNS: 'object', CORE_FIELDS: 'object', EXTENSION_FIELDS: 'object',
  AIRPORT_EXTENSION_FIELDS: 'object', DDG_EXTENSION_FIELDS: 'object', DEFERRED_FIELDS: 'object',
};
// App logic and other formats' parsers never belong to this module.
const FORBIDDEN_EXPORTS = ['deriveCallsign', 'parseOFP', 'fuelK', 'parseNavBlue', '_ofpRulesetParse', 'parseIcaoFpl'];
const isRe = v => Object.prototype.toString.call(v) === '[object RegExp]';

/**
 * Check an OFP parser object against the schema contract.
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
  for (const k of FORBIDDEN_EXPORTS) if (k in r) errors.push(`${k} must not be exported`);
  if (r.RULESET_TYPE !== 'ofp') errors.push(`RULESET_TYPE must be 'ofp', got '${r.RULESET_TYPE}'`);
  if (r.OFP_FORMAT !== 'flightkeys') errors.push(`OFP_FORMAT must be 'flightkeys', got '${r.OFP_FORMAT}'`);
  if (typeof r.RULESET_VERSION === 'string' && !/^\d+\.\d+\.\d+$/.test(r.RULESET_VERSION)) errors.push(`RULESET_VERSION '${r.RULESET_VERSION}' is not semver`);
  if (typeof r.SCHEMA_VERSION === 'number' && !(Number.isInteger(r.SCHEMA_VERSION) && r.SCHEMA_VERSION >= 2)) errors.push(`SCHEMA_VERSION ${r.SCHEMA_VERSION} must be an integer >= 2`);
  if (typeof r.CONTRACT_VERSION === 'string' && !/^2\.\d+$/.test(r.CONTRACT_VERSION)) errors.push(`CONTRACT_VERSION '${r.CONTRACT_VERSION}' is not a v2 contract`);
  if (typeof r.RULESET_SOURCE === 'string' && !r.RULESET_SOURCE.trim()) errors.push('RULESET_SOURCE is empty');
  if (r.PATTERNS && typeof r.PATTERNS === 'object') {
    for (const k of Object.keys(r.PATTERNS)) if (!isRe(r.PATTERNS[k])) errors.push(`PATTERNS.${k} is not a RegExp`);
  }
  const list = (k, n) => {
    const v = r[k];
    if (!Array.isArray(v)) { if (k in r) errors.push(`${k} must be an array`); return; }
    if (v.length !== n) errors.push(`${k} must list ${n} fields, has ${v.length}`);
    if (new Set(v).size !== v.length || v.some(x => typeof x !== 'string' || !x)) errors.push(`${k} must be unique non-empty names`);
  };
  list('CORE_FIELDS', 57);
  list('EXTENSION_FIELDS', 13);
  list('AIRPORT_EXTENSION_FIELDS', 3);
  list('DDG_EXTENSION_FIELDS', 2);
  if (Array.isArray(r.CORE_FIELDS) && Array.isArray(r.EXTENSION_FIELDS)) {
    for (const k of r.EXTENSION_FIELDS) if (r.CORE_FIELDS.includes(k)) errors.push(`${k} is both a core field and an extension`);
    if (r.EXTENSION_FIELDS[r.EXTENSION_FIELDS.length - 1] !== 'findings') errors.push('EXTENSION_FIELDS must end with findings');
  }
  if (r.DEFERRED_FIELDS && typeof r.DEFERRED_FIELDS === 'object') {
    for (const [k, v] of Object.entries(r.DEFERRED_FIELDS)) {
      const top = k.split('.')[0];
      const known = (Array.isArray(r.CORE_FIELDS) && r.CORE_FIELDS.includes(top)) || (Array.isArray(r.EXTENSION_FIELDS) && r.EXTENSION_FIELDS.includes(top));
      if (!known) errors.push(`DEFERRED_FIELDS.${k} is not a contract field`);
      if (v !== '5b-2' && v !== '5d') errors.push(`DEFERRED_FIELDS.${k}: step '${v}' is not 5b-2 or 5d`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

const API = {
  RULESET_TYPE, OFP_FORMAT, RULESET_VERSION, SCHEMA_VERSION, CONTRACT_VERSION, RULESET_SOURCE,
  validateSchema,
  parseFlightKeys,          // (input, options?) → contract object | null
  inputFromExtractor,       // (rawText, itemsDoc) → input (documented mapping)
  PATTERNS,
  CORE_FIELDS, EXTENSION_FIELDS, AIRPORT_EXTENSION_FIELDS, DDG_EXTENSION_FIELDS,
  DEFERRED_FIELDS,
};
return API;
});
