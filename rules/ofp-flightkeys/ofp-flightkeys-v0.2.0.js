/**
 * ofp-flightkeys.js — FlightKeys OFP Parser  (v0.2.0, development version, contract v2.2)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1–2.4): the FlightKeys OFP parser. It reads
 * an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns
 * the briefing contract — the same 57 core fields, with the same names, types
 * and meanings, as the locked NavBlue parser (FK-P), plus the Appendix B
 * extensions and findings[].
 *
 * v0.2.0 (D58) is a DEVELOPMENT version. It is not built into index.html, not
 * used by the app and not published to the master folder. It reads the OFP
 * release: identity and header, airports and times, fuel, weights, DOT
 * exemption, slot, ETOPS, POR, ETP/CFS, nav log (for TOC and the ETOPS/ETP/POR
 * times) and alternate routes (v0.1.0: field map v1.1 rows 1–23, 29–31, 33,
 * 34, 36, 39–41) and, new in v0.2.0, the release and remarks pages: crew and
 * the operating-pilot count (row 26, D62), CAT II/III authorisations and
 * restrictions (24), MEL/CDL/DDG items (25), perishables (27), temperature
 * control (28), permits (35), the TLR (32, 32a), the OFP Remarks with their
 * categories and sub-headings, airport remarks and remarks weather, security
 * messages, extra fuel, PCF and the revision. The briefing package (NOTAMs,
 * weather, curfew, Company NOTAMs, NAT, sections) is returned as an explicit
 * empty value with one INFO finding ("read in 5d"). v0.2.0 must not be
 * integrated: an explicit empty is not a value.
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
const RULESET_VERSION  = '0.2.0';
const SCHEMA_VERSION   = 2;
// Contract v2.0 (ADR-005 Appendix A + B) plus the extension fields of the
// Appendix B addenda: specialQualification, swa (Exec SME answers 13 Nov,
// contract 2.1); operatingPilots (D62) and the crew-record extensions
// firstName, toLndgExpiry (SME-9) (contract 2.2). Adding fields is a minor
// contract version (ADR-005 §2.4).
const CONTRACT_VERSION = '2.2';
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
// (addendum 1) and `operatingPilots` (addendum 2, D62) added before `sections`).
const EXTENSION_FIELDS = Object.freeze([
  'revision', 'companyNotams', 'ofpRemarks', 'fplEquipment',
  'catIiIiiRestrictions', 'securityMessages', 'extraFuel', 'pcf', 'permits',
  'designator', 'swa', 'operatingPilots', 'sections', 'findings',
]);
// Extensions on core records. specialQualification: addendum (SME-2).
const AIRPORT_EXTENSION_FIELDS = Object.freeze(['remarks', 'remarksWeather', 'specialQualification']);
const DDG_EXTENSION_FIELDS     = Object.freeze(['type', 'notes']);
// Extensions on crewMembers[i] (addendum 2): the full first name as printed and
// the TO/LNDG currency expiry ("Not Reported" when blank, SME-9).
const CREW_EXTENSION_FIELDS    = Object.freeze(['firstName', 'toLndgExpiry']);

// Fields v0.2.0 does not read: the explicit empty is returned and one INFO
// finding names the step that reads the field (field map v1.1 rows). Step
// 'open' = in no brief yet. The airportData entries carry no curfew / opsNotes
// keys until 5d (NavBlue also leaves them out when nothing is printed); the
// INFO names them (QA F3).
const DEFERRED_FIELDS = Object.freeze({
  enrouteNotams:          '5d',    // row 49
  natTrack:               '5d',    // row 42
  'airportData.weather':  '5d',    // rows 43, 45, 48
  'airportData.notams':   '5d',    // rows 44, 45
  'airportData.curfew':   '5d',    // row 46
  'airportData.opsNotes': '5d',    // row 47
  companyNotams:          '5d',
  fplEquipment:           'open',  // D41 field 10a + MEL removals: not in the v0.2.0 brief (icao-fpl reads field 10)
  sections:               '5d',
});
const DEFERRED_STEPS = Object.freeze({ '5d': 'read in 5d', open: 'not in any brief yet (open item)' });

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

  // ── v0.2.0: release and remarks pages ───────────────────────────
  // Release title (revision extension): "OPERATIONAL FLIGHT PLAN RLS nn DDMONYY HH:MM"
  // (L20–L23: "REV nn"; prototypes "-- NOT RELEASED --").
  RELEASE_KIND:    /^OPERATIONAL FLIGHT PLAN\s+(?:(RLS|REV)\s+(\d{1,3})\s+(\d{2}[A-Z]{3}\d{2})\s+(\d{2}:\d{2})\b|(--\s*NOT RELEASED\s*--))/,
  REVISION_NO:     /\bRevision:\s+(\d+\.\d+|-\.-)(?=\s|$)/,
  VALID_UNTIL:     /\bRelease Valid Until\s+(\d{4}Z)\s+(\d{2}[A-Z]{3}\d{2})\b/,
  MEL_START:       /^MEL\/CDL\s*$/,
  // Row 26: crew list, OFP p2 end / p3 — "Fit for Duty Affirmation" … "TIME FUEL"
  CREW_START:      /^Fit for Duty Affirmation\b/,
  CREW_STOP:       /^TIME FUEL\b/,
  CREW_HDR:        /^(?:FIT FOR DUTY\/\s+RELIEF PIC|JS VERIFY\s+START-END\(Z\))\s*$/,
  // pilot "ROLE <EMPNO> [*] <LAST>, <FIRST …> .. .. .." (the NavBlue pilot roles)
  CREW_PILOT:      /^(CA|FO1?|FO2|SO|AO|RO)\s+(\d{1,7})\s+(\*\s*)?([^,.]+?),\s*(.*?)\s*\.\.(?:\s*\.\.)*\s*$/,
  CREW_EXPIRY:     /^TO\/LNDG Expiry:\s*(\S*)\s*$/,
  // other crew "ROLE <EMPNO> <NAME …>" (no dots): DH, JS are returned (NavBlue); MX LM FA PU are not
  CREW_OTHER:      /^(DH|JS|MX|LM|FA|PU)\s+(\d{1,7})\s+(\S.*?)\s*$/,
  CREW_ANY_ROLE:   /^[A-Z]{2}\d?\s+\d{1,7}\s+\S/,
  // Row 24: CAT II/III — the NavBlue AIRPORT_ENTRY form, bare in the FlightKeys Remarks.
  CAT_AUTH:        /^([A-Z]{4})\s+CAT\s+(II\/III|II|III)\s*-\s*(?:ALL\s+RWYS?|RWY\s+([A-Z0-9\/]+))\s*$/,
  // Restrictions (never authorisations): any CAT line that says NOT AUTHORIZED / PROHIBITED / RESTRICTED.
  CAT_ANY:         /^([A-Z]{4})\s+CAT\s+(II\/III|II|III)\b/,
  CAT_NEGATIVE:    /\bNOT\s+AUTHORI[SZ]ED\b|\bPROHIBITED\b|\bRESTRICT(?:ED|ION)\b|\bNOT\s+APPROVED\b/i,
  CAT_RWYS:        /\bRWYS?\s+((?:\d{1,2}[LCR]?)(?:\s*\/\s*\d{1,2}[LCR]?)*)\b/,
  // MEL note / title "- CAT III Restricted", "- CAT II / CAT III Restricted", "CAT II/III Restriction"
  CAT_MEL:         /\bCAT\s+(II|III)(?:\s*\/\s*(?:CAT\s+)?(II|III))?\s+Restrict(?:ed|ion)\b/i,
  // Row 25: MEL/CDL block — "MEL nn-nn-nn[-nn][A] - <title>" / "CDL Cnn-nn-nn - <title>"
  MEL_ITEM:        /^(MEL|CDL)\s+(C?\d{2}(?:-[0-9A-Z]+)+)\s+-\s*(.*)$/,
  MEL_NOTE:        /^(?:RMK\s+-|-)\s*\S/,
  ADHOC_PENALTY:   /^Dispatcher applied ADHOC penalty:?\s*$/,
  // SME-19: an MEL named only in a late-addition remark ("HHMMZ STR ADD M<ATA>",
  // "ADD MEL <ATA> …", "MEL ADDED" + "<ATA>" on the next line)
  LATE_MEL_ADD:    /\bADD\s+M(?:EL)?\s*(C?\d{2}(?:-[0-9A-Z]+)+)(?:\s+(.*))?$/,
  LATE_MEL_ADDED:  /^MEL\s+ADDED\s*$/,
  ATA_ALONE:       /^(C?\d{2}(?:-[0-9A-Z]+)+)\s*$/,
  // Row 32a: TLR "RMKS <ATA>" — the code at the start of the RMKS line (NavBlue) and of
  // its continuation lines (FlightKeys prints further codes on the lines below)
  TLR_RMKS_LINE:   /^RMKS\s+(C?[\d][\d-]+[A-Z]?)\b/,          // NavBlue TLR_RMKS_ATA, one line
  TLR_ATA:         /^(C?\d{2}(?:-\d+)+[A-Z]?)\b/,             // a code on a continuation line
  TLR_RMKS_END:    /^(?:-{3,}|\/\/\/|RWY\s|APT\s)/,
  // TLR pages: header "REL n/n DDMONYYYY HHMMZ CCC#### ORIG/DEST DDMONYY", footer "FUFI<uuid> PAGE n/N"
  TLR_PAGE_HDR:    /^REL\s+\d+\/\d+\s+\d{2}[A-Z]{3}\d{2}\s+\d{4}Z\s+\S+\s+[A-Z]{4}\/[A-Z]{4}\b/,
  TLR_PAGE_FOOTER: /^FUFI[0-9A-F-]+ PAGE (\d+)\/(\d+)$/,
  TLR_PAGE_TITLE:  /^TAKEOFF AND LANDING REPORT\b.*\bPAGE\s+\d+\s*$/,
  TLR_SEQ:         /^TLR-(\d+)\s+SEQ-/,
  // NavBlue TLR_PATTERNS, unchanged (row 32: oeiData as NavBlue)
  TLR_SECTION_START:    /TAKEOFF AND LANDING REPORT/,
  TLR_SECTION_END:      /^END TAKEOFF AND LANDING REPORT/m,
  TLR_TKOFF_SECTION:    /\/\/\/ TAKEOFF DATA \/\/\//,
  TLR_LAND_SECTION:     /\/\/\/ LANDING DATA \/\/\//,
  TLR_RUNWAY_INFO_HDR:  /RUNWAY INFO\s*-+\s*\nRWY\s+LENGTH\s+EFP\s+NOTES\s*\n([\s\S]*?)(?=-{5})/,
  TLR_RUNWAY_INFO_LINE: /^(\d{2}[LRC]?(?:-\w+)?(?:\s+[A-Z]+)?)\s+\d+\s+(SPECIAL|DT\s+\S+|LT\s+\S+|RT\s+\S+)/,
  TLR_SPECIAL_EFP_HDR:  /SPECIAL ENG FAIL TAKEOFF PROCEDURES\s*-+\s*\nRWY\s+CLB\s+VIA[^\n]*\n([\s\S]*?)(?=-{5})/,
  TLR_SPECIAL_EFP_LINE: /^(\d{2}[LRC]?(?:-\w+)?(?:\s+[A-Z]+)?)\s+(.*)/,
  TLR_SHIPS_SUFFIX:     /\s+SHIPS$/,
  // Rows 27, 28: the NavBlue rules (D55), read in the release Remarks only; FlightKeys
  // also prints the bare line "PERISHABLES ONBOARD" (row 27)
  PERISHABLE:      /PERISHABLE[^\n]*O\/B[^\n]*YES|O\/B[^\n]*PERISHABLE[^\n]*YES|LIVE\s+ANIMALS\s*:\s*YES|TEMPERATURE\s+REQUIREMENTS\s*:\s*YES/i,
  PERISHABLES_ONBOARD: /^PERISHABLES?\s+ON\s*BOARD\b/,
  TEMPERATURE_CONTROL: /TEMPERATURE\s+CONTROL[^\n]*YES|TEMPERATURE\s+REQUIREMENTS\s*:\s*YES/i,
  // Row 35: "Overflight/Landing Permits" … the nav-log header; groups "--- OVERFLIGHT PERMITS" etc.
  PERMITS_START:   /^Overflight\/Landing Permits?\s*$/,
  PERMIT_GROUP:    /^---\s+(OVERFLIGHT|LANDING|TAKEOFF)\s+PERMITS?\s*$/,
  PERMIT_REG_ONLY: /^([A-Z0-9-]{3,8})\s+(?:AUTH\s+)?ONLY\s*$/,
  PERMIT_MISSING:  /\/{3,}\s*PERMIT MISSING\s*\/{3,}/,
  PERMIT_ADC:      /^([A-Z][A-Z ]*?[A-Z])\s+(ADC\s+NO\.?\s*-?\s*\S+)\s*$/,
  // Remarks categories (field map §2.4 table) — start lines
  // CDC attestation (5 US-bound packages): after the Flight Release Authorization text,
  // not in the Remarks run; heading to the "Signed by PIC" line
  CDC_START:       /^\*{3}\s*CDC ATTESTATION\b/,
  CDC_END:         /^Signed by PIC\b|^Fit for Duty Affirmation\b/,
  RMK_DISPATCHER:  /\bDESK:\s*\S+/,
  RMK_BOILERPLATE: /^This OFP prepared with FlightKeys\b/,
  RMK_BOILER_END:  /questions\.\s*$/,
  RMK_CARGO:       /^(DANGEROUS GOODS|COMAT|LIVE ANIMALS|TEMPERATURE REQUIREMENTS):\s*(YES|NO)\s*$/,
  RMK_SECURITY:    /\bSECURITY\b/,
  RMK_SLOT:        /\bWHEELS\s+UP\b|\bSLOT\s+TIME\b/,
  RMK_EWINS:       /\bE-?WINS\b/i,
  RMK_RAIM:        /^RAIM VALIDATION\b/,
  RMK_EXEMPTION:   /\bEXEMPTION\b/,
  RMK_FLEET_NOTE:  /^B7\d7-\d+[A-Z]*\/\s*\S/,
  RMK_STATION:     /^(?:\*\*\s*([A-Z]{4})(?:\/[A-Z]{3})?\s+FLIGHT\s+OP(?:S|ERATIONS)\s+RESTRICTIONS?\s*\*\*|([A-Z]{4})(?:\/[A-Z]{3})?\s+FLIGHT\s+OP(?:S|ERATIONS)\s+RESTRICTIONS?:?|([A-Z]{4})\s+(?:B?(7\d7)\s+)?(?:ARRIVALS|DEPARTURES|OPERATIONS):)\s*$/,
  RMK_DASHES:      /^-{10,}\s*$/,
  RMK_SUBHEAD:     /^(ARRIVALS|DEPARTURES)\s*$|^[A-Za-z][A-Za-z ,]*:\s*$/,
  RMK_FLEET_SUB:   /^B?(7\d7)\s+Operations\b(.*)$/i,
  // D63: the item markers of a marked block (a sub-heading is the third marker)
  RMK_ITEM_DASH:   /^-\s+\S/,
  RMK_ITEM_NUMBER: /^\d{1,2}[.)]\s+\S/,
  RMK_WEATHER:     /^(?:GOV\s+)?TAF\s+UPDATED\b|^(?:WSI|TWC)\b|^(?:TAF|METAR|SPECI)\s+(?:AMD\s+|COR\s+)?[A-Z]{4}\s+\d{6}Z\b/,
  RMK_WX_REPORT:   /^(TAF|METAR|SPECI)\s+(?:AMD\s+|COR\s+)?([A-Z]{4})\s+\d{6}Z\b/,
  RMK_MEL_CHANGE:  /^MEL\s+ADDED\b|\bADD\s+M(?:EL)?\s*C?\d{2}-/,
  RMK_PCF:         /\bPCF\b|^-?\s*CF\b|\bADDITIONAL\s+FUEL\b/,
  RMK_EXTRA:       /\bTANKER\b|\bPRE-?FUELED\b|\bFINAL\s+FUEL\b|\bEXTRA\s+FUEL\b/,
  RMK_BALLAST:     /\bBALLAST\b/,
  RMK_ROUTE:       /\bROUTED?\b|\bAVOID\b|\bNAT\s+TRACK\b|\bRANDOM\s+ROUTE\b|\bVA\s+(?:ACTIVITY|FROM)\b|\bATLANTIC\s+CROSSING\b/,
  // SME-18: a station restriction that requires a takeoff alternate
  TKOF_ALT_REQ:    /\bTAKE-?\s*OFF\s+ALTERNATE\s+(?:IS\s+)?REQUIRED\b/i,
  // D39: extra fuel that is tanker fuel for this flight
  TANKER_FUEL:     /\b(?:ECON\s+)?TANKER(?:ING)?\s+FUEL\b|\bTANKERING\b/,
  NO_TANKER:       /\bNO\s+TANKER/,
  EXTRA_PREFUEL:   /\bPRE-?FUELED\b/,
  EXTRA_CAPTAIN:   /\bCAPT(?:AIN)?\b/,
};

// Alternate keywords → crew roles: the NavBlue rule (ALT_PATTERNS), unchanged
// (rows 7, 8; D55 for SALT/TALT). The ORDER of altData is the order of the
// OFP p1 lines (SME-1), not this table's order.
const ALT_ROLES = Object.freeze({
  PALT: 'DEST ALT', SALT: 'DEST ALT', RALT: 'EN ROUTE ALT', RAPT: 'EN ROUTE ALT', TALT: 'TKOF ALT',
});

const MONTHS = Object.freeze({ JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 });
const MON_NAMES = Object.freeze(['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']);

// Row 35: a permit entry starts with the state's name, as printed in English
// capitals ("SAUDI ARABIA SGF-…", "CHINA CAD/…"). A line that does not start
// with a state name is the route (or a registration restriction) of the entry
// above it ("RULAD A343 POSOT …"). Longest names are tried first.
const PERMIT_STATES = Object.freeze([
  'AFGHANISTAN','ALBANIA','ALGERIA','ANDORRA','ANGOLA','ANTIGUA AND BARBUDA','ARGENTINA','ARMENIA','ARUBA',
  'AUSTRALIA','AUSTRIA','AZERBAIJAN','BAHAMAS','BAHRAIN','BANGLADESH','BARBADOS','BELARUS','BELGIUM','BELIZE',
  'BENIN','BERMUDA','BHUTAN','BOLIVIA','BOSNIA AND HERZEGOVINA','BOTSWANA','BRAZIL','BRUNEI','BULGARIA',
  'BURKINA FASO','BURUNDI','CABO VERDE','CAPE VERDE','CAMBODIA','CAMEROON','CANADA','CAYMAN ISLANDS',
  'CENTRAL AFRICAN REPUBLIC','CHAD','CHILE','CHINA','COLOMBIA','COMOROS','CONGO','COSTA RICA',"COTE D'IVOIRE",
  'CROATIA','CUBA','CURACAO','CYPRUS','CZECH REPUBLIC','CZECHIA','DEMOCRATIC REPUBLIC OF THE CONGO','DENMARK',
  'DJIBOUTI','DOMINICA','DOMINICAN REPUBLIC','ECUADOR','EGYPT','EL SALVADOR','EQUATORIAL GUINEA','ERITREA',
  'ESTONIA','ESWATINI','ETHIOPIA','FIJI','FINLAND','FRANCE','FRENCH GUIANA','FRENCH POLYNESIA','GABON','GAMBIA',
  'GEORGIA','GERMANY','GHANA','GREECE','GREENLAND','GRENADA','GUAM','GUATEMALA','GUINEA','GUINEA-BISSAU',
  'GUYANA','HAITI','HONDURAS','HONG KONG','HUNGARY','ICELAND','INDIA','INDONESIA','IRAN','IRAQ','IRELAND',
  'ISRAEL','ITALY','IVORY COAST','JAMAICA','JAPAN','JORDAN','KAZAKHSTAN','KENYA','KIRIBATI','KOSOVO','KUWAIT',
  'KYRGYZSTAN','LAOS','LATVIA','LEBANON','LESOTHO','LIBERIA','LIBYA','LIECHTENSTEIN','LITHUANIA','LUXEMBOURG',
  'MACAO','MACAU','MADAGASCAR','MALAWI','MALAYSIA','MALDIVES','MALI','MALTA','MARSHALL ISLANDS','MAURITANIA',
  'MAURITIUS','MEXICO','MICRONESIA','MOLDOVA','MONACO','MONGOLIA','MONTENEGRO','MOROCCO','MOZAMBIQUE','MYANMAR',
  'NAMIBIA','NAURU','NEPAL','NETHERLANDS','NEW CALEDONIA','NEW ZEALAND','NICARAGUA','NIGER','NIGERIA',
  'NORTH KOREA','NORTH MACEDONIA','NORWAY','OMAN','PAKISTAN','PALAU','PANAMA','PAPUA NEW GUINEA','PARAGUAY',
  'PERU','PHILIPPINES','POLAND','PORTUGAL','PUERTO RICO','QATAR','ROMANIA','RUSSIA','RUSSIAN FEDERATION','RWANDA',
  'SAINT KITTS AND NEVIS','SAINT LUCIA','SAINT VINCENT AND THE GRENADINES','SAMOA','SAN MARINO',
  'SAO TOME AND PRINCIPE','SAUDI ARABIA','SENEGAL','SERBIA','SEYCHELLES','SIERRA LEONE','SINGAPORE','SLOVAKIA',
  'SLOVENIA','SOLOMON ISLANDS','SOMALIA','SOUTH AFRICA','SOUTH KOREA','SOUTH SUDAN','SPAIN','SRI LANKA','SUDAN',
  'SURINAME','SWEDEN','SWITZERLAND','SYRIA','TAIWAN','TAJIKISTAN','TANZANIA','THAILAND','TIMOR-LESTE','TOGO',
  'TONGA','TRINIDAD AND TOBAGO','TUNISIA','TURKEY','TURKIYE','TURKMENISTAN','TUVALU','UGANDA','UKRAINE',
  'UNITED ARAB EMIRATES','UNITED KINGDOM','UNITED STATES','URUGUAY','UZBEKISTAN','VANUATU','VENEZUELA','VIETNAM',
  'YEMEN','ZAMBIA','ZIMBABWE',
].sort((a, b) => b.length - a.length));

// SME-12 / SME-18a: the fleet an aircraft type belongs to, as fleet sub-headings
// name it ("747 Operations Prohibited", "767 Operations", "VHHH B747 DEPARTURES:").
function _fleetOf(acftType) {
  const t = String(acftType || '').toUpperCase();
  if (t === 'BLCF') return '747';
  const m = /^B7([0-9])[0-9A-Z]$/.exec(t);
  return m ? '7' + m[1] + '7' : null;
}

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
    const page = { pdfPage: i + 1, n, of, title: lines[1], body: lines.slice(2, -1) };
    if (n === 1) { cur = { pages: [page], of }; copies.push(cur); }
    else if (cur && cur.of === of && cur.pages[cur.pages.length - 1].n === n - 1) cur.pages.push(page);
  });
  return copies.map(c => ({
    pages: c.pages, of: c.of, complete: c.pages.length === c.of,
    lines: [].concat(...c.pages.map(p => p.body)),
    // provenance of each body line: PDF page and 1-based line on that page's text
    // (lines 1–2 are the running header and the title line)
    pos: [].concat(...c.pages.map(p => p.body.map((_, j) => ({ page: p.pdfPage, line: j + 3 })))),
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
    designator: '', swa: null, operatingPilots: null, sections: [], findings: [],
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

  // The FPL block is read from the release (first copy) only, never from the first
  // "(FPL-" anywhere in the package (5b-1 QA F4): an FPL quoted in a Company NOTAM or
  // a briefing page is not this flight's filed plan. No release → no FPL.
  const copies = _releaseCopies(textPages);
  const rel = copies[0] || null;
  const fplMod = opts.icaoFpl && typeof opts.icaoFpl.parseIcaoFpl === 'function' ? opts.icaoFpl : null;
  const fpl = fplMod ? fplMod.parseIcaoFpl(rel ? rel.lines.join('\n') : '') : null;
  if (!fplMod) add('WARN', 'icaoFpl', 'icao-fpl module not supplied: aircraft type, wake and FPL date not read');
  else if (!fpl.found) add('WARN', 'icaoFpl', 'no ICAO flight plan (FPL) block found in the release');
  else if (!fpl.complete) add('WARN', 'icaoFpl', 'ICAO flight plan block incomplete: field 18 (DOF) not read');
  const acp = opts.aircraftProfile && typeof opts.aircraftProfile === 'object' ? opts.aircraftProfile : null;
  if (!acp) add('INFO', 'aircraftProfile', 'aircraft-profile module not supplied');

  // ── Release ─────────────────────────────────────────────────────────
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
  const ctx = { out, ext, add, fpl, acp, rel, p1, pagesIn, textPages, copies };

  _readIdentity(ctx);
  _readAirports(ctx);
  _readPending(ctx);

  // ── Deferred fields: explicit empties, one INFO each ───────────────
  for (const f of Object.keys(DEFERRED_FIELDS)) add('INFO', f, `not read in v${RULESET_VERSION}: ${DEFERRED_STEPS[DEFERRED_FIELDS[f]]}`);
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

// ═══════════════════════════════════════════════════════════════
// § 5b · v0.2.0 · RELEASE AND REMARKS PAGES
// ═══════════════════════════════════════════════════════════════

function _idx(lines, re, from) {
  for (let i = from || 0; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}
const _isoReal = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return !!m && _isRealDate(+m[1], +m[2], +m[3]); };

// Positioned items: the x of the first item of a text line on its PDF page, found
// by the line's characters (white space ignored). null when the items cannot answer.
function _lineX(ctx, pdfPage, text) {
  if (!ctx.pagesIn) return null;
  ctx.rowCache = ctx.rowCache || {};
  if (!ctx.rowCache[pdfPage]) {
    const pg = ctx.pagesIn.find(p => p && p.page === pdfPage);
    const rows = [];
    for (const it of (pg && Array.isArray(pg.items) ? pg.items : [])) {
      if (!it || typeof it.str !== 'string' || !it.str.trim() || typeof it.x !== 'number' || typeof it.y !== 'number') continue;
      let r = rows.find(x => Math.abs(x.y - it.y) <= 1);
      if (!r) { r = { y: it.y, items: [] }; rows.push(r); }
      r.items.push(it);
    }
    ctx.rowCache[pdfPage] = rows.map(r => {
      const its = r.items.slice().sort((a, b) => a.x - b.x);
      return { key: its.map(i => i.str).join('').replace(/\s+/g, ''), x: its[0].x };
    });
  }
  const key = String(text).replace(/\s+/g, '');
  const hit = ctx.rowCache[pdfPage].find(r => r.key === key);
  return hit ? hit.x : null;
}

// Airport entry for a remark: the page-1 airports exist already; an airport the
// release names elsewhere (an alternate in altData, e.g. a CFS alternate) gets an
// entry of the same shape; any other airport is not attached (INFO).
function _airportEntry(ctx, icao, what) {
  const { out, add } = ctx;
  if (out.airportData[icao]) return out.airportData[icao];
  if (!out.altData.some(a => a.icao === icao)) {
    add('INFO', 'airportData', `${icao}: ${what} for an airport that is not in the release; kept in ofpRemarks only`);
    return null;
  }
  out.airportData[icao] = { weather: '', notams: '', remarks: [], remarksWeather: [], specialQualification: false };
  add('INFO', 'airportData', `${icao}: airport entry added for its ${what} (a release alternate not on OFP page 1)`);
  return out.airportData[icao];
}

// ── Crew (row 26; SME-3, SME-3a, SME-9; D62) ────────────────────────────
// Pilots "ROLE <EMPNO> [*] <LAST>, <FIRST …> .. .." each followed by "TO/LNDG
// Expiry: [YYYY-MM-DD]"; DH and JS lines are returned as NavBlue returns them
// (active false); MX, LM, FA, PU are not crew for the briefing (counted, INFO).
// The "*" stays with the last name and never sets isSen (SME-3/3a). Text as printed.
function _readCrew(ctx) {
  const { out, ext, add, rel } = ctx;
  const lines = rel ? rel.lines : [];
  const s = _idx(lines, PATTERNS.CREW_START);
  if (s === -1) {
    if (rel) add('WARN', 'crewMembers', 'crew list ("Fit for Duty Affirmation") not found in the release');
    return;
  }
  let e = _idx(lines, PATTERNS.CREW_STOP, s + 1);
  if (e === -1) e = lines.length;
  const nameParts = raw => {
    const c = raw.indexOf(',');
    return c === -1 ? { last: raw.trim(), first: '' } : { last: raw.slice(0, c).trim(), first: raw.slice(c + 1).trim() };
  };
  const rec = (role, num, last, first, active, expiry) => {
    const initial = ((first.match(/[A-Za-z]/) || [''])[0]).toUpperCase();
    return { role, empNum: /^\d{2,7}$/.test(num) ? num : '', lastName: last, initial,
      displayName: initial ? `${last} ${initial}` : last, active, isSen: false, firstName: first, toLndgExpiry: expiry };
  };
  const notCrew = {};
  let lastPilot = null, blank = 0, star = 0;
  const pilots = [];
  for (let i = s + 1; i < e; i++) {
    const l = lines[i].trim();
    let m;
    if ((m = PATTERNS.CREW_PILOT.exec(l))) {
      const last = m[4].trim();
      if (m[3]) star++;
      lastPilot = rec(m[1], m[2], m[3] ? '* ' + last : last, m[5].trim(), true, null);
      out.crewMembers.push(lastPilot);
      pilots.push(lastPilot);
    } else if ((m = PATTERNS.CREW_EXPIRY.exec(l))) {
      if (!lastPilot || lastPilot.toLndgExpiry !== null) { add('WARN', 'crewMembers', 'TO/LNDG Expiry line without a pilot line above it'); continue; }
      if (!m[1]) { lastPilot.toLndgExpiry = 'Not Reported'; blank++; }
      else if (_isoReal(m[1])) lastPilot.toLndgExpiry = m[1];
      else { lastPilot.toLndgExpiry = 'Not Reported'; add('WARN', 'crewMembers', `TO/LNDG Expiry "${m[1]}" is not a date: Not Reported`); }
    } else if ((m = PATTERNS.CREW_OTHER.exec(l))) {
      if (m[1] === 'DH' || m[1] === 'JS') {
        const n = nameParts(m[3]);
        out.crewMembers.push(rec(m[1], m[2], n.last, n.first, false, ''));
      } else notCrew[m[1]] = (notCrew[m[1]] || 0) + 1;
      lastPilot = null;
    } else if (PATTERNS.CREW_ANY_ROLE.test(l) && !PATTERNS.CREW_HDR.test(l)) {
      add('WARN', 'crewMembers', 'a crew line in the release was not read (unknown role or form)');
    }
  }
  for (const p of pilots) if (p.toLndgExpiry === null) { p.toLndgExpiry = 'Not Reported'; add('WARN', 'crewMembers', 'pilot printed without a TO/LNDG Expiry line: Not Reported'); }
  const nc = Object.keys(notCrew).sort().map(k => `${k} ${notCrew[k]}`);
  if (nc.length) add('INFO', 'crewMembers', `crew lines not returned as crew (not shown): ${nc.join(', ')}`);
  if (blank) add('INFO', 'crewMembers', `TO/LNDG Expiry blank for ${blank} pilot(s): "Not Reported" (SME-9)`);
  if (star) add('INFO', 'crewMembers', `"*" printed for ${star} pilot(s): kept with the last name; not seniority (SME-3, SME-3a)`);
  // D62: the number of operating pilots, for the crew rest module (no names).
  if (pilots.length) {
    ext.operatingPilots = pilots.length;
    if (pilots.length < 2 || pilots.length > 4) add('WARN', 'operatingPilots', `${pilots.length} operating pilot(s) printed; 2, 3 or 4 expected`);
  } else add('WARN', 'operatingPilots', 'no operating pilot found in the crew list');
}

// ── MEL / CDL / DDG block (row 25; SME-4) ───────────────────────────────
// "MEL|CDL <code> - <title>" (title wraps onto the next line), notes "- …" /
// "RMK - …" under the item (their wrapped lines join the note), until the next
// item or the block end. Every printed item is kept, a repeated one included (Exec,
// 17 Nov). "Dispatcher applied ADHOC penalty:" and its lines are
// not item notes (kept in ofpRemarks). Indentation comes from the positioned
// items (the text has none): a note further right than its item → indent 1.
function _readMelBlock(ctx, from, to) {
  const { out, ext, add, rel } = ctx;
  const lines = rel.lines, pos = rel.pos;
  const items = [];
  const adhoc = [];
  let cur = null, note = null, inAdhoc = false;
  for (let i = from; i < to; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    let m;
    if ((m = PATTERNS.MEL_ITEM.exec(l))) {
      cur = { code: m[2], desc: m[3].trim(), tlr: '', type: m[1], notes: [], at: i };
      items.push(cur); note = null; inAdhoc = false;
    } else if (PATTERNS.ADHOC_PENALTY.test(l)) {
      inAdhoc = true; cur = null; note = null; adhoc.push(i);
    } else if (inAdhoc) {
      adhoc.push(i);
    } else if (!cur) {
      add('WARN', 'ddgItems', 'a line in the MEL/CDL block before any item was not read');
    } else if (PATTERNS.MEL_NOTE.test(l)) {
      note = { text: l, indent: 1, at: i };
      cur.notes.push(note);
    } else if (note) note.text += ' ' + l;
    else cur.desc = (cur.desc + ' ' + l).trim();
  }
  // Indentation from the positioned items (positions win over the text rule + WARN).
  for (const it of items) {
    const ix = _lineX(ctx, pos[it.at].page, lines[it.at]);
    for (const n of it.notes) {
      const nx = _lineX(ctx, pos[n.at].page, lines[n.at]);
      if (ix === null || nx === null) continue;
      const ind = nx > ix + 2 ? 1 : 0;
      if (ind !== n.indent) { add('WARN', 'ddgItems', `${it.code}: a note is not indented in the positioned items; indent ${ind} used`); n.indent = ind; }
    }
  }
  // CAT II/III restrictions printed by the MEL (SME-10): notes, else the item title.
  for (const it of items) {
    let found = false;
    for (const n of it.notes) {
      const cm = PATTERNS.CAT_MEL.exec(n.text);
      if (!cm) continue;
      found = true;
      ext.catIiIiiRestrictions.push({ airport: null, category: cm[2] ? `${cm[1]}/${cm[2]}` : cm[1], runways: [],
        text: n.text.replace(/^(?:RMK\s+-|-)\s*/, ''), source: `${it.type} ${it.code}` });
    }
    const tm = !found && PATTERNS.CAT_MEL.exec(it.desc);
    if (tm) ext.catIiIiiRestrictions.push({ airport: null, category: tm[2] ? `${tm[1]}/${tm[2]}` : tm[1], runways: [],
      text: it.desc, source: `${it.type} ${it.code}` });
  }
  ctx.adhocLines = adhoc;
  ctx.melBlockItems = items;
  if (!items.length) add('INFO', 'ddgItems', 'MEL/CDL block printed with no item');
}

// Finishes ddgItems: the block's items, then late additions (SME-19); melItems (NavBlue form).
// Every item is kept as this OFP prints it, including an item printed more than once:
// that is possible and not an anomaly (Exec, 17 Nov, PR #62; SME-4). No dedup, no finding.
function _finishDdg(ctx) {
  const { out } = ctx;
  const items = (ctx.melBlockItems || []).concat(ctx.lateMel || []);
  out.ddgItems = items.map(it => ({ code: it.code, desc: it.desc, tlr: it.tlr, type: it.type,
    notes: it.notes.map(n => ({ text: n.text, indent: n.indent })) }));
  out.melItems = out.ddgItems.map(i => i.code + ' ' + i.desc).join(' | ').substring(0, 600);
}

// ── OFP Remarks (field map §2.4 categories; D34, D45, D39, D63, SME-7, SME-10,
//    SME-18, SME-18a, SME-19, SME-23) ─────────────────────────────────────
// Every line from the dispatcher line to "MEL/CDL" goes into ofpRemarks
// { text, category, airport, subHeading, page, line }, one record per remark.
// D63a (Exec, 17 Nov) for the unmarked run: a remark runs until a blank line, a
// sub-heading, or the start of a recognised item (a line that starts a category,
// _remarkStart); a fixed-form item also ends where its form ends (a one-line
// category; the boilerplate at its "questions." line). Its lines are joined with
// their printed line breaks ("\n"); nothing is added, removed or reflowed. A
// sub-heading is a record of its own and opens a new remark.
// A station restriction block runs until a RAIM, CAT, exemption, fleet-note,
// E-WINS line or another station heading (it has no end marker).
// D63 (Exec, 17 Nov): in a station block a new remark starts ONLY at the block's
// own item marker — the first of "- " (dash) or "n." / "n)" (number) the block
// uses — or after a sub-heading. Any other line continues the remark above it;
// the joined remark keeps its printed line breaks ("\n"; nothing reflowed). The
// heading, a sub-heading and a dashed rule line are records of their own.
// page/line are those of the remark's first line.
function _itemMarker(t) {
  if (PATTERNS.RMK_ITEM_DASH.test(t)) return 'dash';
  if (PATTERNS.RMK_ITEM_NUMBER.test(t)) return 'number';
  return null;
}
const _RMK_HARD = new Set(['raim', 'catIiIii', 'stationRestriction', 'fleetNote', 'ewins', 'exemption']);
const _RMK_INHERIT = new Set(['boilerplate', 'pcf', 'extraFuel', 'ballast', 'melChange', 'route', 'slot',
  'weather', 'stationRestriction', 'exemption', 'fleetNote', 'other']);
function _remarkStart(t, first) {
  if (first && PATTERNS.RMK_DISPATCHER.test(t)) return 'dispatcher';
  if (PATTERNS.RMK_BOILERPLATE.test(t)) return 'boilerplate';
  if (PATTERNS.RMK_RAIM.test(t)) return 'raim';
  if (PATTERNS.CAT_ANY.test(t)) return 'catIiIii';
  if (PATTERNS.RMK_STATION.test(t)) return 'stationRestriction';
  if (PATTERNS.RMK_FLEET_NOTE.test(t)) return 'fleetNote';
  if (PATTERNS.RMK_EWINS.test(t)) return 'ewins';
  if (PATTERNS.RMK_EXEMPTION.test(t)) return 'exemption';
  if (PATTERNS.RMK_CARGO.test(t)) return 'cargoDeclaration';
  if (PATTERNS.PERISHABLES_ONBOARD.test(t)) return 'perishables';
  if (PATTERNS.RMK_SECURITY.test(t)) return 'security';
  if (PATTERNS.PERMIT_ADC.test(t)) return 'permit';
  if (PATTERNS.RMK_SLOT.test(t)) return 'slot';
  if (PATTERNS.RMK_WEATHER.test(t)) return 'weather';
  if (PATTERNS.RMK_MEL_CHANGE.test(t)) return 'melChange';
  if (PATTERNS.RMK_PCF.test(t)) return 'pcf';
  if (PATTERNS.RMK_EXTRA.test(t)) return 'extraFuel';
  if (PATTERNS.RMK_BALLAST.test(t)) return 'ballast';
  if (PATTERNS.RMK_ROUTE.test(t)) return 'route';
  return null;
}

function _readRemarks(ctx, from, to) {
  const { out, ext, add, rel } = ctx;
  const lines = rel.lines, pos = rel.pos;
  const acFleet = _fleetOf(out.acftType);
  const entries = [];
  let mode = null, boilerOpen = false, station = null, entry = null, fleetWarned = false;
  let blank = false, afterSub = false, genSub = null;   // D63a paragraph state (unmarked run)
  for (let i = from; i < to; i++) {
    const t = lines[i].trim();
    if (!t) { blank = true; continue; }
    let c = _remarkStart(t, i === from);
    if (c === null && PATTERNS.RMK_DASHES.test(t) && i + 1 < to && PATTERNS.RMK_STATION.test(lines[i + 1].trim())) c = 'dashes';
    let cont = false, isSub = false;
    if (mode === 'stationRestriction' && !(c && _RMK_HARD.has(c))) { c = 'stationRestriction'; cont = true; }
    else if (c === 'dashes') { c = 'stationRestriction'; station = { icao: null, heading: '', fleet: null, subHeading: null, subFleet: null, marker: null, cur: null }; }
    else if (c === null && PATTERNS.RMK_SUBHEAD.test(t)) { c = 'other'; isSub = true; }   // D63a: a sub-heading
    else if (c === null && mode && (mode !== 'boilerplate' || boilerOpen) && !blank && !afterSub) { c = mode; cont = true; }
    else if (c === null) c = 'other';
    if (c !== 'stationRestriction') {
      if (isSub) genSub = t.replace(/:\s*$/, '');
      else if (!cont && (blank || !afterSub)) genSub = null;
    }
    blank = false; afterSub = isSub;
    // station block state
    const isHeader = c === 'stationRestriction' && PATTERNS.RMK_STATION.test(t);
    if (isHeader) {
      const hm = PATTERNS.RMK_STATION.exec(t);
      const prev = station && !station.icao ? station : null;   // a dashed line opened it
      station = { icao: hm[1] || hm[2] || hm[3], heading: t, fleet: hm[4] || null, subHeading: null, subFleet: null, marker: null, cur: null };
      cont = !!prev;
    } else if (c !== 'stationRestriction') station = null;
    if (c === 'boilerplate') boilerOpen = !PATTERNS.RMK_BOILER_END.test(t);
    let airport = null, subHeading = null, joined = false;
    if (c === 'stationRestriction' && station) {
      airport = station.icao;
      let item = !isHeader && !PATTERNS.RMK_DASHES.test(t), startsItem = true;
      const fm = PATTERNS.RMK_FLEET_SUB.exec(t);
      if (item && fm) { station.subHeading = t; station.subFleet = fm[1]; item = !!fm[2].trim(); }
      else if (item && PATTERNS.RMK_SUBHEAD.test(t)) { station.subHeading = t.replace(/:\s*$/, ''); station.subFleet = null; item = false; }
      else if (item) {
        // D63: a new remark only at the block's own item marker; otherwise it continues
        const mk = _itemMarker(t);
        if (mk && !station.marker) station.marker = mk;
        startsItem = !station.cur || (mk !== null && mk === station.marker);
      }
      subHeading = station.subHeading;
      if (item && !startsItem) {
        const cur = station.cur;
        cur.text += '\n' + t;
        if (cur.item) cur.item.text = cur.text;
        cur.record.text = cur.text;
        joined = true;
      } else {
        station.cur = null;
        if (item) station.cur = { text: t, item: null, record: null };
        if (item && airport) {
          const fleet = station.subFleet || station.fleet || null;
          if (fleet && !acFleet && !fleetWarned) { add('WARN', 'airportData', `aircraft type ${out.acftType || '(none)'} has no known fleet: fleet restrictions attached unfiltered`); fleetWarned = true; }
          const applies = !fleet || !acFleet || fleet === acFleet;
          station.cur.item = { text: t, heading: station.heading, subHeading, fleet, applies, page: pos[i].page, line: pos[i].line };
          (station.items = station.items || []).push(station.cur.item);
          if (station.items.length === 1) (ctx.stations = ctx.stations || []).push(station);
        }
      }
    }
    const general = c !== 'stationRestriction';
    let newRec = null;
    if (general && cont && entry && entry.category === c && entry.rec) {
      entry.rec.text += '\n' + t; joined = true;   // D63a: the paragraph continues
    }
    if (!joined) {
      const rec = { text: t, category: c, airport, subHeading: general ? genSub : subHeading, page: pos[i].page, line: pos[i].line };
      ext.ofpRemarks.push(rec);
      if (station && station.cur && !station.cur.record) station.cur.record = rec;
      if (general) entry = null;
      newRec = general ? rec : null;
    }
    if (cont && entry && entry.category === c) { entry.text += '\n' + t; entry.lines.push(i); }
    else { entry = { category: c, text: t, lines: [i], page: pos[i].page, line: pos[i].line, rec: newRec || null }; entries.push(entry); }
    mode = _RMK_INHERIT.has(c) ? c : null;
  }
  // ADHOC penalty lines of the MEL/CDL block (not item notes): kept in order. The
  // block marks its items with "- " (D63): the heading line is a record of its own,
  // each dash item starts a record, and an unmarked line continues the item above.
  let adhocItem = null;
  for (const i of ctx.adhocLines || []) {
    const t = lines[i].trim();
    if (adhocItem && !PATTERNS.ADHOC_PENALTY.test(t) && !PATTERNS.RMK_ITEM_DASH.test(t)) { adhocItem.text += '\n' + t; continue; }
    const rec = { text: t, category: 'adhocPenalty', airport: null, subHeading: null, page: pos[i].page, line: pos[i].line };
    ext.ofpRemarks.push(rec);
    adhocItem = PATTERNS.ADHOC_PENALTY.test(t) ? null : rec;
  }
  ctx.remarkEntries = entries;
  const remText = lines.slice(from, to).join('\n');

  // Rows 27, 28 (D55): the NavBlue rules on the release Remarks; FlightKeys bare line.
  out.hasPerishables = PATTERNS.PERISHABLE.test(remText) || entries.some(en => en.category === 'perishables');
  out.hasTemperatureControl = PATTERNS.TEMPERATURE_CONTROL.test(remText);

  // Row 24 (SC): authorisations (NavBlue form) and restrictions (never authorisations).
  const cat = {};
  for (const en of entries.filter(x => x.category === 'catIiIii')) {
    const t = en.text, am = PATTERNS.CAT_ANY.exec(t);
    if (PATTERNS.CAT_NEGATIVE.test(t)) {
      const rm = PATTERNS.CAT_RWYS.exec(t.slice(am[0].length));
      ext.catIiIiiRestrictions.push({ airport: am[1], category: am[2], runways: rm ? rm[1].split('/').map(r => r.trim()) : [],
        text: t, source: 'OFP Remarks' });
      continue;
    }
    const m = PATTERNS.CAT_AUTH.exec(t);
    if (!m) { add('WARN', 'catIiIiiApproaches', `${am[1]}: CAT II/III line not read`); continue; }
    (cat[m[1]] = cat[m[1]] || []).push({ cat: m[2], rwys: m[3] ? m[3].trim() : 'ALL RUNWAYS' });
  }
  out.catIiIiiApproaches = Object.keys(cat).length ? cat : null;

  // Station restrictions → the airport's remarks (D34; SME-18, SME-18a fleet match).
  let skipped = 0;
  for (const st of ctx.stations || []) {
    const apt = _airportEntry(ctx, st.icao, 'station restriction');
    for (const it of st.items) {
      if (!it.applies) { skipped += it.text.split('\n').length; continue; }
      if (apt) apt.remarks.push({ text: it.text, heading: it.heading, subHeading: it.subHeading, fleet: it.fleet, page: it.page, line: it.line });
    }
    // SME-18: a takeoff alternate required (for this fleet) at the departure airport, none listed.
    if (st.icao === out.origIcao && st.items.some(it => it.applies && PATTERNS.TKOF_ALT_REQ.test(it.text))
        && !out.altData.some(a => a.role === 'TKOF ALT')) {
      add('WARN', 'altData', `${st.icao}: the station restriction requires a takeoff alternate; the release lists none (SME-18)`);
    }
  }
  if (skipped) add('INFO', 'airportData', `${skipped} station-restriction line(s) under another fleet's sub-heading not attached (aircraft ${out.acftType}; SME-18a)`);

  // Remarks weather → the airport's remarksWeather (D34, D46; SME-23): never merged
  // into the briefing weather. Source = the heading line right above the report.
  let noApt = 0;
  entries.forEach((en, k) => {
    if (en.category !== 'weather') return;
    const wm = PATTERNS.RMK_WX_REPORT.exec(en.text);
    if (!wm) { if (!(entries[k + 1] && entries[k + 1].category === 'weather' && PATTERNS.RMK_WX_REPORT.test(entries[k + 1].text))) noApt++; return; }
    const prev = entries[k - 1];
    const source = prev && prev.category === 'weather' && !PATTERNS.RMK_WX_REPORT.test(prev.text) ? prev.text : 'OFP Remarks';
    const apt = _airportEntry(ctx, wm[2], 'remarks weather');
    if (apt) apt.remarksWeather.push({ source, type: wm[1], text: en.text, page: en.page, line: en.line });
  });
  if (noApt) add('INFO', 'remarksWeather', `${noApt} weather remark(s) name no airport (e.g. an area product): kept in ofpRemarks only`);

  // D45: security messages.
  for (const en of entries.filter(x => x.category === 'security')) ext.securityMessages.push({ text: en.text, page: en.page, line: en.line });
  // E-WINS release line: no airport, no forecast — sets nothing (SME-17, SME-21).
  if (entries.some(x => x.category === 'ewins')) add('INFO', 'ewins', 'E-WINS release line names no airport and no forecast: sets nothing here (the E-WINS forecast is the * PRIO * briefing TAF, read in 5d)');
  // Air-defence clearances (row 35, permits[]).
  ctx.adc = entries.filter(x => x.category === 'permit').map(x => { const m = PATTERNS.PERMIT_ADC.exec(x.text); return { country: m[1], adc: m[2] }; });

  // SME-19: an MEL named only in a late-addition remark is added; one already in the block adds nothing.
  const inBlock = new Set((ctx.melBlockItems || []).map(x => x.code));
  ctx.lateMel = [];
  for (const en of entries.filter(x => x.category === 'melChange')) {
    const codes = [];
    const am = PATTERNS.LATE_MEL_ADD.exec(lines[en.lines[0]].trim());
    if (am) codes.push({ code: am[1], desc: (am[2] || '').trim() });
    if (PATTERNS.LATE_MEL_ADDED.test(lines[en.lines[0]].trim()) && en.lines[1] !== undefined) {
      const cm = PATTERNS.ATA_ALONE.exec(lines[en.lines[1]].trim());
      if (cm) codes.push({ code: cm[1], desc: '' });
    }
    for (const c of codes) {
      if (inBlock.has(c.code) || ctx.lateMel.some(x => x.code === c.code)) continue;
      ctx.lateMel.push({ code: c.code, desc: c.desc, tlr: '', type: 'MEL', notes: [{ text: en.text, indent: 1 }] });
      add('INFO', 'ddgItems', `MEL ${c.code} is named only in a late-addition remark: added to ddgItems (SME-19)`);
    }
  }
}

// ── Extra fuel and PCF (D39; SME-7) ─────────────────────────────────────
// OFP p1 "EXTRA|PCF nnnnnn HH.MM" (first column) with the reasons the Remarks give.
function _readFuelReasons(ctx) {
  const { out, ext, add, p1 } = ctx;
  const row = key => { for (const l of p1) { const m = PATTERNS.FUEL_ROW.exec(l); if (m && m[1] === key) return m; } return null; };
  const mins = m => m && m[3] !== undefined && +m[4] < 60 ? (+m[3]) * 60 + (+m[4]) : null;
  const entries = ctx.remarkEntries || [];
  const ex = row('EXTRA');
  if (ex) {
    const reasons = entries.filter(x => x.category === 'extraFuel').map(x => x.text);
    const tanker = reasons.some(r => PATTERNS.TANKER_FUEL.test(r) && !PATTERNS.NO_TANKER.test(r));
    const type = tanker ? 'TANKER' : reasons.some(r => PATTERNS.EXTRA_PREFUEL.test(r)) ? 'PRE-FUELED'
      : reasons.some(r => PATTERNS.EXTRA_CAPTAIN.test(r)) ? 'CAPTAIN' : '';
    ext.extraFuel = { fuel: String(parseInt(ex[2], 10)), minutes: mins(ex), unit: out.weightUnit, type, tanker, reasons };
  } else add('WARN', 'extraFuel', 'EXTRA row not found in the OFP page-1 fuel table');
  const pc = row('PCF');
  if (pc) {
    const reasons = entries.filter(x => x.category === 'pcf').map(x => x.text);
    ext.pcf = { fuel: String(parseInt(pc[2], 10)), minutes: mins(pc), unit: out.weightUnit, reasons };
    if (+pc[2] > 0 && !reasons.length) add('INFO', 'pcf', 'PCF added with no reason printed in the Remarks');
    if (+pc[2] === 0 && reasons.length) add('INFO', 'pcf', 'a PCF reason is printed but PCF is 0');
  } else add('WARN', 'pcf', 'PCF row not found in the OFP page-1 fuel table');
}

// ── Permits (row 35; Appendix B permits[]) ──────────────────────────────
// "Overflight/Landing Permits" … the nav-log header. overflightPerms = the block
// as NavBlue gives it (white space collapsed, at most 300 characters).
function _readPermits(ctx) {
  const { out, ext, add, rel } = ctx;
  const lines = rel ? rel.lines : [];
  const s = _idx(lines, PATTERNS.PERMITS_START);
  if (s === -1) { if (rel) add('INFO', 'overflightPerms', 'no "Overflight/Landing Permits" heading in the release'); }
  else {
    let e = _idx(lines, PATTERNS.NAVLOG_HDR1, s + 1);
    if (e === -1) { add('WARN', 'overflightPerms', 'permits block has no end (nav-log header not found): 20 lines read'); e = Math.min(lines.length, s + 21); }
    const body = lines.slice(s + 1, e).map(l => l.trim()).filter(Boolean);
    const joined = body.join(' ').replace(/\s+/g, ' ').trim();
    out.overflightPerms = joined ? joined.substring(0, 300) : '';
    let group = '', cur = null;
    for (const t of body) {
      const g = PATTERNS.PERMIT_GROUP.exec(t);
      if (g) { group = g[1]; cur = null; continue; }
      const st = PERMIT_STATES.find(x => t === x || t.startsWith(x + ' '));
      const ro = PATTERNS.PERMIT_REG_ONLY.exec(t);
      if (st) {
        cur = { type: group, country: st, reference: t.slice(st.length).trim(), route: '', restriction: '', adc: '', missing: PATTERNS.PERMIT_MISSING.test(t) };
        ext.permits.push(cur);
        if (cur.missing) add('WARN', 'permits', `${group.toLowerCase()} permit for ${st} printed as PERMIT MISSING`);
        if (!group) add('WARN', 'permits', `${st}: permit printed before any group heading`);
      } else if (cur && ro) cur.restriction = cur.restriction ? cur.restriction + ' ' + t : t;
      else if (cur) cur.route = cur.route ? cur.route + ' ' + t : t;
      else add('WARN', 'permits', 'a line in the permits block was not read');
    }
  }
  // Air-defence clearances from the Remarks: with that state's permit, else on their own.
  for (const a of ctx.adc || []) {
    const p = ext.permits.find(x => x.country === a.country && !x.adc);
    if (p) p.adc = a.adc;
    else ext.permits.push({ type: 'ADC', country: a.country, reference: '', route: '', restriction: '', adc: a.adc, missing: false });
  }
}

// ── TLR (rows 32, 32a) ──────────────────────────────────────────────────
// The first TLR copy: pages headed "REL n/n …" with the footer "FUFI<uuid> PAGE
// n/N", 1..N. The page header and footer and the repeated page title + "TLR-n
// SEQ" lines are removed first, so a page break never leaks into a procedure
// (field map §6). oeiData is then read by the NavBlue rule unchanged.
function _tlrLines(ctx) {
  const out = [];
  let next = 1, of = null;
  for (const ls of ctx.textPages) {
    if (ls.length < 2 || !PATTERNS.TLR_PAGE_HDR.test(ls[0])) continue;
    const fm = PATTERNS.TLR_PAGE_FOOTER.exec(ls[ls.length - 1]);
    if (!fm || +fm[1] !== next || (of !== null && +fm[2] !== of)) { if (out.length) break; continue; }
    of = +fm[2];
    const body = ls.slice(1, -1);
    for (let j = 0; j < body.length; j++) {
      if (PATTERNS.TLR_PAGE_TITLE.test(body[j])) { if (body[j + 1] && PATTERNS.TLR_SEQ.test(body[j + 1])) j++; continue; }
      out.push(body[j]);
    }
    if (++next > of) break;
  }
  return { lines: out, complete: of !== null && next > of, of };
}

function _readTlr(ctx) {
  const { out, add } = ctx;
  const tl = _tlrLines(ctx);
  if (!tl.lines.length) { add('INFO', 'oeiData', 'no Takeoff and Landing Report in the package'); return; }
  if (!tl.complete) add('WARN', 'oeiData', 'Takeoff and Landing Report incomplete');
  const t = tl.lines.join('\n');
  const sq = tl.lines.map(l => PATTERNS.TLR_SEQ.exec(l)).find(Boolean);
  ctx.tlrNumber = sq ? 'TLR-' + sq[1] : null;
  // NavBlue parseTLR(), unchanged.
  (function parseTLR() {
    const tlrStart = t.search(PATTERNS.TLR_SECTION_START);
    if (tlrStart === -1) return;
    const tlrBlock = t.slice(tlrStart, tlrStart + 15000);
    const rwEfp = {};
    const riM = tlrBlock.match(PATTERNS.TLR_RUNWAY_INFO_HDR);
    if (riM) {
      for (const line of riM[1].split('\n')) {
        const m = line.match(PATTERNS.TLR_RUNWAY_INFO_LINE);
        if (m) rwEfp[m[1].trim()] = m[2].trim();
      }
    }
    const specProc = {};
    const sfM = tlrBlock.match(PATTERNS.TLR_SPECIAL_EFP_HDR);
    if (sfM) {
      let curRwy = null, curParts = [];
      for (const line of sfM[1].split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const rwM = trimmed.match(PATTERNS.TLR_SPECIAL_EFP_LINE);
        if (rwM) {
          if (curRwy) specProc[curRwy] = curParts.join(' ').trim();
          curRwy = rwM[1].trim(); curParts = rwM[2].trim() ? [rwM[2].trim()] : [];
        } else if (curRwy) curParts.push(trimmed);
      }
      if (curRwy) specProc[curRwy] = curParts.join(' ').trim();
    }
    const seen = new Set();
    Object.keys(rwEfp).forEach(rwy => {
      const base = rwy.replace(PATTERNS.TLR_SHIPS_SUFFIX, '').trim();
      if (seen.has(base)) return;
      seen.add(base);
      const efp    = rwEfp[rwy] || rwEfp[base] || '';
      const isSpec = efp === 'SPECIAL';
      const proc   = specProc[base] || specProc[rwy] || '';
      out.oeiData.push({ rwy: base, efp, special: isSpec, proc, coChart: isSpec && !proc, coChartNote: '' });
    });
  })();
  // Row 32a: TLR cross-reference (NavBlue values 'takeoff' | 'landing' | 'both' | '').
  // The codes are on the RMKS line and, in FlightKeys, on the lines below it.
  const sectionCodes = (startRe, endRes) => {
    const s = tl.lines.findIndex(l => startRe.test(l));
    const codes = new Set();
    if (s === -1) return codes;
    for (let i = s + 1; i < tl.lines.length && !endRes.some(r => r.test(tl.lines[i])); i++) {
      const m = PATTERNS.TLR_RMKS_LINE.exec(tl.lines[i]);
      if (!m) continue;
      codes.add(m[1]);
      for (let j = i + 1; j < tl.lines.length && !PATTERNS.TLR_RMKS_END.test(tl.lines[j]); j++) {
        const c = PATTERNS.TLR_ATA.exec(tl.lines[j]);
        if (c) codes.add(c[1]);
      }
    }
    return codes;
  };
  const tk = sectionCodes(PATTERNS.TLR_TKOFF_SECTION, [PATTERNS.TLR_LAND_SECTION, PATTERNS.TLR_SECTION_END]);
  const ld = sectionCodes(PATTERNS.TLR_LAND_SECTION, [PATTERNS.TLR_SECTION_END]);
  for (const it of (ctx.melBlockItems || []).concat(ctx.lateMel || [])) {
    const a = tk.has(it.code), b = ld.has(it.code);
    it.tlr = a && b ? 'both' : a ? 'takeoff' : b ? 'landing' : '';
  }
}

// ── Revision (Appendix B; D14) ──────────────────────────────────────────
function _readRevision(ctx) {
  const { ext, add, rel, p1, copies } = ctx;
  if (!rel) return;
  const m = PATTERNS.RELEASE_KIND.exec(rel.pages[0].title || '');
  const rv = p1.map(l => PATTERNS.REVISION_NO.exec(l)).find(Boolean) || null;
  const vu = p1.map(l => PATTERNS.VALID_UNTIL.exec(l)).find(Boolean) || null;
  const same = copies.every(c => c.lines.length === rel.lines.length && c.lines.every((l, i) => l === rel.lines[i]));
  ext.revision = {
    kind: m ? (m[5] ? 'NOT RELEASED' : m[1]) : '',
    number: m && m[2] ? m[2] : null,
    time: m && m[3] ? `${m[3]} ${m[4]}` : null,
    revision: rv ? rv[1] : null,
    validUntil: vu ? `${vu[1]} ${vu[2]}` : null,
    tlr: ctx.tlrNumber || null,
    copies: copies.length,
    copiesIdentical: same,
  };
  if (!m) add('WARN', 'revision', 'release title line (RLS / REV / NOT RELEASED) not read');
  if (m && m[2]) {
    const n = String(+m[2]);
    if (rv && rv[1] !== n + '.0') add('WARN', 'revision', `release number ${m[2]} and "Revision: ${rv[1]}" differ`);
    if (ctx.tlrNumber && ctx.tlrNumber !== 'TLR-' + n) add('WARN', 'revision', `release number ${m[2]} and ${ctx.tlrNumber} differ`);
  }
}

// The v0.2.0 readers, in order (each needs the ones above it).
function _readReleasePages(ctx) {
  const { rel } = ctx;
  _readCrew(ctx);
  if (rel) {
    const lines = rel.lines;
    const rs = _idx(lines, PATTERNS.REMARKS_START);
    if (rs === -1) {
      ctx.add('WARN', 'ofpRemarks', 'Remarks block not found in the release');
    } else {
      const fe0 = _idx(lines, PATTERNS.REMARKS_END, rs + 1);
      const fe = fe0 === -1 ? lines.length : fe0;
      const me0 = _idx(lines, PATTERNS.MEL_START, rs + 1);
      const me = me0 !== -1 && me0 < fe ? me0 : -1;
      if (me === -1) ctx.add('WARN', 'ddgItems', 'MEL/CDL heading not found in the Remarks page');
      else _readMelBlock(ctx, me + 1, fe);
      _readRemarks(ctx, rs + 1, me === -1 ? fe : me);
      // CDC attestation: after the release authorization text (field map §2.4 category table).
      if (fe0 !== -1) {
        const cs = _idx(lines, PATTERNS.CDC_START, fe0 + 1);
        const ce = cs === -1 ? -1 : _idx(lines, PATTERNS.CDC_END, cs + 1);
        const stop = _idx(lines, PATTERNS.CREW_START, fe0 + 1);
        if (cs !== -1 && (stop === -1 || cs < stop)) {
          const end = ce === -1 ? (stop === -1 ? lines.length : stop) : ce;
          // D63a: the attestation is one remark; a blank line, a sub-heading or another
          // "*** CDC ATTESTATION" heading (the block's only recognised item) starts a new one.
          let rec = null, afterSub = false;
          for (let i = cs; i < end; i++) {
            const t = lines[i].trim();
            if (!t) { rec = null; continue; }
            const isSub = PATTERNS.RMK_SUBHEAD.test(t);
            if (rec && !isSub && !afterSub && !PATTERNS.CDC_START.test(t)) rec.text += '\n' + t;
            else ctx.ext.ofpRemarks.push(rec = { text: t, category: 'cdcAttestation', airport: null, subHeading: null, page: rel.pos[i].page, line: rel.pos[i].line });
            afterSub = isSub;
          }
        }
      }
    }
  }
  _readTlr(ctx);
  _finishDdg(ctx);
  _readFuelReasons(ctx);
  _readPermits(ctx);
  _readRevision(ctx);
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
  _readReleasePages(ctx);
}

// ═══════════════════════════════════════════════════════════════
// § 6 · SCHEMA VALIDATION (Blueprint)
// ═══════════════════════════════════════════════════════════════

const REQUIRED_EXPORTS = {
  RULESET_TYPE: 'string', OFP_FORMAT: 'string', RULESET_VERSION: 'string',
  SCHEMA_VERSION: 'number', CONTRACT_VERSION: 'string', RULESET_SOURCE: 'string',
  validateSchema: 'function', parseFlightKeys: 'function', inputFromExtractor: 'function',
  PATTERNS: 'object', CORE_FIELDS: 'object', EXTENSION_FIELDS: 'object',
  AIRPORT_EXTENSION_FIELDS: 'object', DDG_EXTENSION_FIELDS: 'object', CREW_EXTENSION_FIELDS: 'object',
  DEFERRED_FIELDS: 'object',
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
  list('EXTENSION_FIELDS', 14);
  list('AIRPORT_EXTENSION_FIELDS', 3);
  list('DDG_EXTENSION_FIELDS', 2);
  list('CREW_EXTENSION_FIELDS', 2);
  if (Array.isArray(r.CORE_FIELDS) && Array.isArray(r.EXTENSION_FIELDS)) {
    for (const k of r.EXTENSION_FIELDS) if (r.CORE_FIELDS.includes(k)) errors.push(`${k} is both a core field and an extension`);
    if (r.EXTENSION_FIELDS[r.EXTENSION_FIELDS.length - 1] !== 'findings') errors.push('EXTENSION_FIELDS must end with findings');
  }
  if (r.DEFERRED_FIELDS && typeof r.DEFERRED_FIELDS === 'object') {
    for (const [k, v] of Object.entries(r.DEFERRED_FIELDS)) {
      const top = k.split('.')[0];
      const known = (Array.isArray(r.CORE_FIELDS) && r.CORE_FIELDS.includes(top)) || (Array.isArray(r.EXTENSION_FIELDS) && r.EXTENSION_FIELDS.includes(top));
      if (!known) errors.push(`DEFERRED_FIELDS.${k} is not a contract field`);
      if (v !== '5d' && v !== 'open') errors.push(`DEFERRED_FIELDS.${k}: step '${v}' is not 5d or open`);
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
  CREW_EXTENSION_FIELDS,
  DEFERRED_FIELDS,
};
return API;
});
