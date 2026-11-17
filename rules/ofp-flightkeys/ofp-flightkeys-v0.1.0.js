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
  // Fuel table row, first column (rows 9–16): "NAME nnnnnn [HH.MM] …"
  FUEL_ROW:        /^(TRIP|CONT|ALT1|FRES|ADD\.AL|ADD\.LD|PCF|BALST|MINF|EXTRA|TOF|TAXI|BLOCK|REMF)\s+(\d{3,7})(?:\s+(\d{2})\.(\d{2}))?(?=\s|$)/,
  // Row 17: MINF second column (POR)-DEST — "MINF nnnnnn HH.MM .... nnnnnn HH.MM …"
  POR_MINF:        /^MINF\s+\d{3,7}\s+\d{2}\.\d{2}\s+\.+\s+(\d{3,7})\s+\d{2}\.\d{2}/,
  // Row 19: "*ADDL FF ADJ +n.nn *" (space before the closing asterisk allowed)
  ADDL_FF_ADJ:     /^\*\s*ADDL\s+FF\s+ADJ\s+([+\-]\d+(?:\.\d+)?)\s*\*\s*$/,
  // Rows 20–22: "ZFW|TOGW|LDGW actual [......] Llimit" (L = limit code S/P/L/I)
  ZFW:             /^ZFW\s+(\d{5,7})\s*(?:\.+\s*)?[SPLI](\d{5,7})\b/,
  TOGW:            /^TOGW\s+(\d{5,7})\s*(?:\.+\s*)?[SPLI](\d{5,7})\b/,
  LDGW:            /^LDGW\s+(\d{5,7})\s*(?:\.+\s*)?[SPLI](\d{5,7})\b/,
  // Row 18: "ZFW INC/1000 X nnn MINF ADJ" (FlightKeys "INC"; NavBlue "INCR")
  ZFW_INC:         /\bZFW\s+INCR?\/1000\s+X\s+(\d+)\s+MINF\s+ADJ\b/,
  // Row 23: inline on the TOGW row, with or without the NavBlue asterisks
  VZFW_CK_LIMIT:   /\*?MTOW\s+LTD\s+BY\s+VZFW\/CK\s+LIMITS\*?/,
  // SME-8: service weight adjustment between DOW and PYLD
  SWA:             /^SWA\s+\((\d{3,7})\)\s*$/,
  // Remarks block of the release (rows 29–31): "Remarks" … "Flight Release Authorization"
  REMARKS_START:   /^Remarks\s*$/,
  REMARKS_END:     /^Flight Release Authorization\b/,
  // Row 29: "FLIGHT RELEASED UNDER [POLAR ]EXEMPTION NO nnnnnX. ALTERNATE AIRPORT REQUIRED."
  // — the sentence may wrap over two lines (L08); the NavBlue DOT-SP form is kept.
  EXEMPTION_NO:    /\bEXEMPTION NO\s+(\d+[A-Z]?)\b/,
  EXEMPTION_ALT:   /\bEXEMPTION NO\s+\d+[A-Z]?\b[^\n]*?(?:\n[^\n]*?)?\bALTERNATE\s+AIRPORT\s*(?:\n\s*)?REQUIRED\b/,
  DOT_EXEMPT:      /\*OPERATING UNDER EXEMPTION\s+(DOT-SP\d+)\*/i,
  DOT_RESTRICT:    /\*OPERATING UNDER EXEMPTION\s+DOT-SP\d+\*[^\n]*\nRESTRICTIONS:\s*([^\n]+(?:\n(?![\n\-\*])[^\n]+)?)/i,
  // Row 30: the NavBlue wheels-up / slot forms, unchanged
  SLOT_TIME_WINDOW:     /WHEELS\s+UP\s+MUST\s+BE\s+BETWEEN\s+(\d{4}Z?)\s+AND\s+(\d{4}Z?)/i,
  SLOT_TIME_NOT_BEFORE: /WHEELS\s+UP\s+NOT\s+BEFORE\s+(\d{4}Z?)/i,
  SLOT_TIME_BEFORE:     /WHEELS\s+UP\s+(?:MUST\s+BE\s+)?BEFORE\s+(\d{4}Z?)/i,
  SLOT_TIME_EARLIEST:   /EARLIEST\s+WHEELS\s+UP\s+(\d{4}Z?)/i,
  SLOT_TIME_CURFEW:     /NO\s+EARLY\s+DEPARTURE\b[\s\S]{0,200}?CLOSED?\s+TILL?\s+(\d{1,2}:\d{2}Z?|\d{4}Z?)/i,
  SLOT_TIME_AT:         /\bWHEELS\s+UP\s+(\d{4}Z?)\b(?!\s*(?:MUST|NOT|BEFORE|BETWEEN))/i,
  // Row 31: the NavBlue verbal callsign remark, unchanged
  VERBAL_CALLSIGN: /VERBAL\s+CALLSIGN\s*[-\u2013]\s*([A-Z]+)/i,
  // Nav log (rows 33, 34, 39–41): column headers repeated on every page, then
  // three lines per fix — "AWY WPT [name] [freq]" / "[^MORA] Nnn nn.n MTK NM …"
  // / "Ennn nn.n TTK MH IAS .M TOT-T [ATA] FL …". TOT-T is HH.MM (not decimal).
  NAVLOG_HDR1:     /^AWY\s+WPT\s+MTK\b/,
  NAVLOG_HDR2:     /^MORA\s+TTK\s+MH\b/,
  NAVLOG_LAT:      /^(?:\^\d+\s+)?([NS]\d{2} \d{2}\.\d)(?=\s|$)/,
  NAVLOG_LON:      /^([EW]\d{3} \d{2}\.\d)(?=\s|$)(.*)$/,
  NAVLOG_TOT:      /(?:^|\s)(\d{2})\.(\d{2})(?=\s|$)/,
  NAVLOG_TOC:      /(?:^|\s)TOC$/,
  NAVLOG_EENT:     /\(E\.ENT\)$/,
  NAVLOG_EEXT:     /\(E\.EXT\)$/,
  NAVLOG_ETP:      /\(GO([A-Z]{4})\)\s+(ETP\d+)$/,
  NAVLOG_POR:      /\(POR\)\s+AT\s+(\S+)/,
  // Row 39: type line "… FF +n.n ETOPS Entry HH.MM" (dot); an exit on the type line is unseen
  ETOPS_ENTRY:     /\bETOPS\s+Entry\s+(\d{2})[.:](\d{2})\b/,
  ETOPS_EXIT:      /\bETOPS\s+Exit\s+(\d{2})[.:](\d{2})\b/,
  ETOPS_SPEC:      /^Critical Fuel Scenario\s+ETOPS\s+(\d{2,3}\/\d{2,3})\b/,
  // Row 40: OFP p1 "… ADIS: nnnn POR: <WPT>[+nnNM] HH.MM"
  POR_P1:          /\bPOR:\s+(\S+)\s+(\d{2})\.(\d{2})\b/,
  // Row 41: Critical Fuel Scenario block
  CFS_START:       /^Critical Fuel Scenario\b/,
  CFS_ETP:         /^\(GO([A-Z]{4})\)\s+(ETP\d+)\s+([A-Z]{4})-([A-Z]{4})\s+([NS]\d{2} \d{1,2}\.\d)\s+([EW]\d{3} \d{1,2}\.\d)\s*$/,
  CFS_EENT:        /^\(GO([A-Z]{4})\)\s+E\.ENT\s+([A-Z]{4})\s+([NS]\d{2} \d{1,2}\.\d)\s+([EW]\d{3} \d{1,2}\.\d)\s*$/,
  CFS_EEXIT:       /^(?:\(GO([A-Z]{4})\)\s+)?E\.EXIT\s+([A-Z]{4})\s+([NS]\d{2} \d{1,2}\.\d)\s+([EW]\d{3} \d{1,2}\.\d)\s*$/,
  // Table row "IIII GCD HH:MM A/I REMF PAD MINF HH:MM-HH:MM" (window without Z)
  CFS_ROW:         /^([A-Z]{4})\s+\d+\s+\d{2}:\d{2}\s+\S+\s+\d+\s+\d+\s+\d+\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})\s*$/,
  // Row 36: alternate route blocks on the last OFP page
  ALT_ROUTE_TITLE: /^(Destination Primary Alternate Route|Initial Airport Route|Initial Alternate Route)\s*$/,
  ALT_ROUTE_END:   /^(?:[A-Z]{4}\/\d{3,4}\s*$|GCD\s+\d+\s+GDIS\b|MORA\s+\d+)/,
  ALT_ROUTE_MORA:  /^MORA\s+(\d+)\s*$/,
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

// ── Fuel (rows 9–19; SME-6, SME-7) ─────────────────────────────────────
// OFP p1 fuel table: "NAME nnnnnn [HH.MM] [GDIS] …" — the first column is
// ORIG-DEST; redispatch packages add (POR)-DEST and ORIG-RAPT columns.
function _readFuel(ctx) {
  const { out, add, p1 } = ctx;
  const rows = {};
  for (const l of p1) {
    const m = PATTERNS.FUEL_ROW.exec(l);
    if (m && !rows[m[1]]) rows[m[1]] = { fuel: m[2], hh: m[3], mm: m[4], line: l };
  }
  const num = r => String(parseInt(r.fuel, 10));   // NavBlue form: leading zeros dropped
  const mins = r => (r && r.hh !== undefined && +r.mm < 60) ? (+r.hh) * 60 + (+r.mm) : null;
  const need = (key, field) => { if (!rows[key]) add('WARN', field, `${key} row not found in the OFP page-1 fuel table`); return rows[key]; };
  let r;
  if ((r = need('BLOCK', 'blockFuelRaw'))) out.blockFuelRaw = num(r);
  if ((r = need('MINF', 'minfFuelRaw'))) {
    out.minfFuelRaw = num(r);
    const pm = PATTERNS.POR_MINF.exec(r.line);    // row 17: second column (POR)-DEST
    if (pm) out.porMinf = String(parseInt(pm[1], 10));
  }
  if ((r = need('FRES', 'fresFuelRaw'))) out.fresFuelRaw = num(r);
  if ((r = need('TAXI', 'taxiFuelRaw'))) { out.taxiFuelRaw = num(r); out.taxiMins = mins(r); }
  if ((r = need('TRIP', 'tripMinutes'))) out.tripMinutes = mins(r);
  if ((r = need('ALT1', 'alt1Fuel'))) out.alt1Fuel = num(r);
  if ((r = need('REMF', 'destRemf'))) out.destRemf = num(r);
  if (rows.BALST) out.ballastFuel = parseInt(rows.BALST.fuel, 10);   // row 16: FlightKeys "BALST"
  for (const l of p1) {
    const m = PATTERNS.ADDL_FF_ADJ.exec(l);                          // row 19, as printed (SME-6)
    if (m) { out.addlFfAdj = m[1]; break; }
  }
}

// ── Weights (rows 20–23; SME-8) ─────────────────────────────────────────
function _readWeights(ctx) {
  const { out, ext, add, p1 } = ctx;
  const first = re => { for (const l of p1) { const m = re.exec(l); if (m) return m; } return null; };
  const w = (re, a, b, field) => {
    const m = first(re);
    if (m) { out[a] = parseInt(m[1], 10); out[b] = parseInt(m[2], 10); }
    else add('WARN', field, `${field.replace(/Actual$/, '').toUpperCase()} row not found in the OFP page-1 weight table`);
    return m;
  };
  w(PATTERNS.ZFW, 'zfwActual', 'zfwLimit', 'zfwActual');
  w(PATTERNS.LDGW, 'ldgwActual', 'ldgwLimit', 'ldgwActual');
  const tm = w(PATTERNS.TOGW, 'togwActual', 'togwLimit', 'togwActual');
  // Row 23: "MTOW LTD BY VZFW/CK LIMITS" inline on the TOGW row (no asterisks
  // in FlightKeys), or on its own line with asterisks (the NavBlue form).
  out.hasVzfwCkLimit = !!(tm && PATTERNS.VZFW_CK_LIMIT.test(tm.input)) || p1.some(l => PATTERNS.VZFW_CK_LIMIT.test(l));
  const zi = first(PATTERNS.ZFW_INC);                                // row 18: "ZFW INC/1000 X nnn MINF ADJ"
  if (zi) out.zfwIncrFactor = parseInt(zi[1], 10);
  const sw = first(PATTERNS.SWA);                                    // SME-8: "SWA (nnnnnn)"
  if (sw) ext.swa = { value: parseInt(sw[1], 10), unit: out.weightUnit };
}

// ── Remarks items (rows 29–31) ─────────────────────────────────────────
// Read only from the release Remarks block (first copy): never from the
// Company NOTAMs or the briefing.
function _readRemarksItems(ctx) {
  const { out, add, rel } = ctx;
  const lines = rel ? rel.lines : [];
  const s = lines.findIndex(l => PATTERNS.REMARKS_START.test(l));
  if (s === -1) { if (rel) add('WARN', 'dotExemption', 'Remarks block not found in the release: rows 29–31 not read'); return; }
  let e = lines.findIndex((l, i) => i > s && PATTERNS.REMARKS_END.test(l));
  if (e === -1) e = lines.length;
  const rem = lines.slice(s + 1, e).join('\n');

  // Row 29 (SC): DOT / Polar exemption. NavBlue value form.
  const dot = PATTERNS.DOT_EXEMPT.exec(rem);
  if (dot) {
    const rm = PATTERNS.DOT_RESTRICT.exec(rem);
    out.dotExemption = { number: dot[1], restrictions: rm ? rm[1].trim() : null, altRequired: false };
  } else {
    const ex = PATTERNS.EXEMPTION_NO.exec(rem);
    if (ex) {
      const alt = PATTERNS.EXEMPTION_ALT.test(rem);
      out.dotExemption = { number: 'Exemption ' + ex[1], restrictions: alt ? "ALT REQ'D" : null, altRequired: alt };
      if (!alt) add('WARN', 'dotExemption', 'exemption printed without "ALTERNATE AIRPORT REQUIRED"');
    }
  }

  // Row 30 (SC): wheels-up / slot — the NavBlue chain and value forms.
  const fmt = v => v ? v.replace(/z$/i, 'Z').toUpperCase() : v;
  let m;
  if ((m = PATTERNS.SLOT_TIME_WINDOW.exec(rem)))          out.slotTime = `${fmt(m[1])} – ${fmt(m[2])}`;
  else if ((m = PATTERNS.SLOT_TIME_NOT_BEFORE.exec(rem))) out.slotTime = `NOT BEFORE ${fmt(m[1])}`;
  else if ((m = PATTERNS.SLOT_TIME_BEFORE.exec(rem)))     out.slotTime = `BEFORE ${fmt(m[1])}`;
  else if ((m = PATTERNS.SLOT_TIME_EARLIEST.exec(rem)))   out.slotTime = `NOT BEFORE ${fmt(m[1])}`;
  else if ((m = PATTERNS.SLOT_TIME_AT.exec(rem)))         out.slotTime = 'AT ' + m[1];
  else if ((m = PATTERNS.SLOT_TIME_CURFEW.exec(rem))) {
    const raw = m[1].replace(':', '').toUpperCase();
    out.slotTime = `NOT BEFORE ${raw.endsWith('Z') ? raw : raw + 'Z'}`;
  }

  // Row 31: verbal callsign remark (none in the 26 packages; SME-5: the
  // callsign itself comes from the flight number through CS-1).
  const vc = PATTERNS.VERBAL_CALLSIGN.exec(rem);
  if (vc) out.parsedVerbalCallsign = vc[1].toUpperCase();
}

// ── Nav log (rows 33, 34) ───────────────────────────────────────────────
// The nav log of the first release copy, from the first column header to the
// alternate routes. Page headers, footers and the repeated column headers are
// already out (release body lines) or skipped here, so a fix split by a page
// break is read whole. navLog itself stays [] — what the NavBlue parser gives
// on every NavBlue package (FK-P, field map row 33): a filled navLog would
// change the en-route screen. The rows feed TOC, ETOPS, ETP and POR.
function _readNavLog(ctx) {
  const lines = (ctx.rel ? ctx.rel.lines : []).filter(l => !PATTERNS.NAVLOG_HDR2.test(l));
  const start = lines.findIndex(l => PATTERNS.NAVLOG_HDR1.test(l));
  const rows = [];
  if (start === -1) return rows;
  let end = lines.findIndex((l, i) => i > start && (PATTERNS.ALT_ROUTE_TITLE.test(l) || PATTERNS.CFS_START.test(l)));
  if (end === -1) end = lines.length;
  const body = lines.slice(start, end).filter(l => !PATTERNS.NAVLOG_HDR1.test(l));
  for (let i = 0; i + 2 < body.length; i++) {
    const la = PATTERNS.NAVLOG_LAT.exec(body[i + 1]);
    const lo = la && PATTERNS.NAVLOG_LON.exec(body[i + 2]);
    if (!lo) continue;
    const tm = PATTERNS.NAVLOG_TOT.exec(lo[2]);
    const tot = tm && +tm[2] < 60 ? (+tm[1]) * 60 + (+tm[2]) : null;
    rows.push({ label: body[i].trim(), lat: la[1], lon: lo[1], tot, totStr: tm ? tm[1] + ':' + tm[2] : '' });
    i += 2;
  }
  return rows;
}

const _hhmm = mins => `${_pad2(Math.floor(mins / 60))}:${_pad2(mins % 60)}`;

// ── TOC, ETOPS, POR (rows 34, 39, 40; SME-11) ───────────────────────────
function _readRoutePoints(ctx) {
  const { out, add, p1, rel } = ctx;
  const nav = ctx.nav;
  if (rel && !nav.length) add('WARN', 'navLog', 'nav log not found in the release');
  const find = re => nav.find(r => re.test(r.label)) || null;

  // Row 34: TOC — TOT-T of the first "<AWY> TOC" row.
  const toc = find(PATTERNS.NAVLOG_TOC);
  if (toc && toc.tot !== null) out.tocOffsetMins = toc.tot;
  else if (nav.length) add('WARN', 'tocOffsetMins', 'no TOC row with a TOT-T in the nav log');

  // Row 39 (SC): ETOPS entry from the OFP p1 type line (HH.MM → "HH:MM", the
  // NavBlue form); cross-checked with the nav-log (E.ENT) TOT-T.
  const typeLine = p1.find(l => PATTERNS.TYPE_LINE.test(l)) || '';
  const ee = PATTERNS.ETOPS_ENTRY.exec(typeLine);
  const eent = find(PATTERNS.NAVLOG_EENT);
  if (ee && +ee[2] < 60) {
    out.etopsEntryMins = (+ee[1]) * 60 + (+ee[2]);
    out.etopsEntry = ee[1] + ':' + ee[2];
    if (eent && eent.tot !== null && eent.tot !== out.etopsEntryMins) add('WARN', 'etopsEntry', 'ETOPS entry on OFP page 1 and the nav-log (E.ENT) time differ; page 1 is used');
    if (!eent) add('WARN', 'etopsEntry', 'ETOPS entry on OFP page 1 but no (E.ENT) row in the nav log');
  } else if (eent && eent.tot !== null) {
    out.etopsEntryMins = eent.tot;
    out.etopsEntry = _hhmm(eent.tot);
    add('WARN', 'etopsEntry', 'no ETOPS entry on OFP page 1; the nav-log (E.ENT) time is used');
  }
  // Exit: the type line if it ever carries it, else the nav-log (E.EXT) TOT-T (as NavBlue).
  const ex = PATTERNS.ETOPS_EXIT.exec(typeLine);
  const eext = find(PATTERNS.NAVLOG_EEXT);
  if (ex && +ex[2] < 60) { out.etopsExitMins = (+ex[1]) * 60 + (+ex[2]); out.etopsExit = ex[1] + ':' + ex[2]; }
  else if (eext && eext.tot !== null) { out.etopsExitMins = eext.tot; out.etopsExit = _hhmm(eext.tot); }
  if (out.etopsEntry && !out.etopsExit) add('WARN', 'etopsExit', 'ETOPS entry without an exit');
  // Spec: "Critical Fuel Scenario ETOPS 60/nnn".
  for (const l of rel ? rel.lines : []) { const m = PATTERNS.ETOPS_SPEC.exec(l); if (m) { out.etopsSpec = m[1]; break; } }
  if (out.etopsEntry && !out.etopsSpec) add('WARN', 'etopsSpec', 'ETOPS entry without a "Critical Fuel Scenario ETOPS" spec');

  // Row 40: POR — OFP p1 "POR: <WPT>[+nnNM] HH.MM"; the nav-log row
  // "(POR) AT <WPT>[+nnNM]" gives its lat/long. A fix-plus-distance POR is
  // shown "(<WPT>+nnNM) <lat> <lon>" (SME-11); a plain fix as its name.
  let pp = null;
  for (const l of p1) { pp = PATTERNS.POR_P1.exec(l); if (pp) break; }
  const pr = nav.find(r => PATTERNS.NAVLOG_POR.test(r.label)) || null;
  const prTok = pr ? PATTERNS.NAVLOG_POR.exec(pr.label)[1] : '';
  let tok = '', mins = null;
  if (pp && +pp[3] < 60) {
    tok = pp[1]; mins = (+pp[2]) * 60 + (+pp[3]);
    if (!pr) add('WARN', 'porWpt', 'POR on OFP page 1 but no (POR) row in the nav log');
    else {
      if (prTok !== tok) add('WARN', 'porWpt', 'POR on OFP page 1 and in the nav log differ; page 1 is used');
      if (pr.tot !== null && pr.tot !== mins) add('WARN', 'porOffsetMins', 'POR time on OFP page 1 and the nav-log TOT-T differ; page 1 is used');
    }
  } else if (pr) {
    tok = prTok; mins = pr.tot;
    add('WARN', 'porWpt', 'no POR on OFP page 1; the nav-log (POR) row is used');
  }
  if (tok) {
    out.porOffsetMins = mins;
    if (/\+\d+NM$/.test(tok)) {
      out.porWpt = pr && prTok === tok ? `(${tok}) ${pr.lat} ${pr.lon}` : `(${tok})`;
      if (!(pr && prTok === tok)) add('WARN', 'porWpt', 'POR lat/long not found in the nav log');
    } else out.porWpt = tok;
  }
}

// ── ETP points and CFS alternates (row 41; SME-13) ──────────────────────
function _readCfs(ctx) {
  const { out, add, rel } = ctx;
  const lines = rel ? rel.lines : [];
  const s = lines.findIndex(l => PATTERNS.CFS_START.test(l));
  if (s === -1) return;
  let e = lines.findIndex((l, i) => i > s && PATTERNS.ALT_ROUTE_TITLE.test(l));
  if (e === -1) e = lines.length;
  // Scenarios: each starts at an ETP / E.ENT / E.EXIT line; its table rows follow.
  const scen = [];
  for (const l of lines.slice(s, e)) {
    let m;
    if ((m = PATTERNS.CFS_ETP.exec(l))) scen.push({ kind: 'ETP', name: m[2], apts: [m[3], m[4]], lat: m[5], lon: m[6], win: {} });
    else if ((m = PATTERNS.CFS_EENT.exec(l))) scen.push({ kind: 'E.ENT', name: 'E.ENT', apts: [m[2]], win: {} });
    else if ((m = PATTERNS.CFS_EEXIT.exec(l))) scen.push({ kind: 'E.EXIT', name: 'E.EXIT', apts: [m[2]], win: {} });
    else if ((m = PATTERNS.CFS_ROW.exec(l)) && scen.length) {
      const sc = scen[scen.length - 1];
      const ok = +m[2] < 24 && +m[3] < 60 && +m[4] < 24 && +m[5] < 60;
      if (ok && !sc.win[m[1]]) sc.win[m[1]] = `${m[2]}${m[3]}Z-${m[4]}${m[5]}Z`;
    }
  }
  // ETP points: name, lat, lon (+ elapsedMins from the nav-log ETP row, the
  // NavBlue rule: first row, 0 < elapsed, hours ≤ 23).
  for (const sc of scen.filter(x => x.kind === 'ETP')) {
    if (out.etpPoints.find(p => p.name === sc.name)) continue;
    const pt = { name: sc.name, lat: sc.lat, lon: sc.lon };
    const nr = ctx.nav.find(r => { const m = PATTERNS.NAVLOG_ETP.exec(r.label); return m && m[2] === sc.name; });
    if (nr && nr.tot !== null && nr.tot > 0 && nr.tot < 24 * 60) pt.elapsedMins = nr.tot;
    else add('WARN', 'etpPoints', `${sc.name}: no nav-log TOT-T found`);
    out.etpPoints.push(pt);
  }
  // CFS alternates: the ETP airports first (NavBlue order: return, continue),
  // then the E.ENT / E.EXIT airports (SME-13: alternates for consideration).
  const cfs = [];
  for (const kind of ['ETP', 'E.ENT', 'E.EXIT']) {
    for (const sc of scen.filter(x => x.kind === kind)) {
      for (const icao of sc.apts) {
        if (cfs.find(c => c.icao === icao)) continue;
        const wxWindow = sc.win[icao] || null;
        if (!wxWindow) add('WARN', 'altData', `${icao} (${sc.name}): no weather window in its scenario table`);
        cfs.push({ icao, wxWindow, etpName: sc.name });
      }
    }
  }
  for (const c of cfs) {
    if (out.altData.find(a => a.icao === c.icao)) continue;
    let currentEta = null;
    const wm = c.wxWindow && /^(\d{4})Z-(\d{4})Z$/.exec(c.wxWindow);
    if (wm) currentEta = _wxWindowMidpoint(wm[1], wm[2]);
    out.altData.push({ icao: c.icao, role: 'CFS ALT', ofpEta: currentEta, ofpOffsetMins: null, currentEta,
      wxWindow: c.wxWindow, etpName: c.etpName });
  }
}

// NavBlue wxWindowMidpoint(): midpoint of a HHMM–HHMM window, over midnight.
function _wxWindowMidpoint(a, b) {
  const s = (+a.slice(0, 2)) * 60 + (+a.slice(2, 4));
  const e = (+b.slice(0, 2)) * 60 + (+b.slice(2, 4));
  let mid = s + Math.round((e >= s ? e - s : e + 1440 - s) / 2);
  if (mid >= 1440) mid -= 1440;
  return _pad2(Math.floor(mid / 60)) + _pad2(mid % 60);
}

// ── Alternate routes (row 36) ───────────────────────────────────────────
// Each block: title · route (one or more lines) · [IIII/nnn] · [GCD … TIME …]
// · [MORA nnnn]. route = the route lines only, as NavBlue (spaces collapsed).
function _readAltRoutes(ctx) {
  const { out, rel } = ctx;
  const lines = rel ? rel.lines : [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const t = PATTERNS.ALT_ROUTE_TITLE.exec(lines[i]);
    if (!t) continue;
    const routeLines = [];
    let mora = '', inRoute = true;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (PATTERNS.ALT_ROUTE_TITLE.test(l) || PATTERNS.CFS_START.test(l)) break;
      const mm = PATTERNS.ALT_ROUTE_MORA.exec(l);
      if (mm) { mora = mm[1]; break; }
      if (PATTERNS.ALT_ROUTE_END.test(l)) { inRoute = false; continue; }
      if (inRoute) routeLines.push(l);
      else break;
    }
    const route = routeLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!route) continue;
    const key = t[1] + '|' + route;
    if (seen.has(key)) continue;
    seen.add(key);
    out.altRoutes.push({ title: t[1], route, mora });
  }
}

// The readers that need the full release, in order.
function _readPending(ctx) {
  _readFuel(ctx);
  _readWeights(ctx);
  _readRemarksItems(ctx);
  ctx.nav = _readNavLog(ctx);
  _readRoutePoints(ctx);
  _buildAltData(ctx);
  _readCfs(ctx);
  _readAltRoutes(ctx);
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
