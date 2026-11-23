/**
 * ofp-flightkeys.js — FlightKeys OFP Parser  (v1.1.1, contract v2.5)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1–2.4): the FlightKeys OFP parser. It reads
 * an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns
 * the briefing contract — the same 57 core fields, with the same names, types
 * and meanings, as the locked NavBlue parser (FK-P), plus the Appendix B
 * extensions and findings[].
 *
 * v1.1.1 (DEF-013 patch; Exec rulings R1–R5, R2a–R2e, R4 as amended and O-C, O-D, 23 Nov) changes only
 * dispatchContact: R1 only the OFP Remarks decide it — the cover-page notice and the Company NOTAM sentences
 * ("Contact Dispatch for a preflight briefing." / "…if you have any questions.") are ignored; R2 the Dispatch
 * sentence of the OFP Remarks is carried as printed (wrapped lines joined by one space, the final full stop
 * dropped, nothing else from the paragraph); R2a it has a category — REQUIRED (an instruction to contact or call
 * Dispatch) or SUGGESTION (contact only if there are questions); R2b both categories printed → only the REQUIRED
 * sentence is kept; R2c several of one category → only the first printed; R2e a sentence telling the crew NOT to
 * contact or call Dispatch is ignored (no category, no row, counts for neither R2b nor R2c); R3 no such sentence → null;
 * R4 dispatchContact = { category, remark } (no label, text or company); R5 "Contact Dispatch" inside a NOTAM body
 * is not a Dispatch remark. Its INFO finding is reworded to match. Every other output is byte-identical to v1.1.0.
 * Not built into index.html: rules/ofp-flightkeys-next until the integration PR (D90, D96).
 *
 * v1.1.0 (step 5f, module PR A; Exec answers O-169 … O-181, 22 Nov; D115,
 * D116, D88) extracts, and never interprets (D88: the shared advisory-rules
 * engine does that): the Volcanic Ash Advisories page as the new top-level
 * extension volcanicAsh { page, state NONE | ADVISORY | UNREADABLE, text as
 * printed, advisories[] { volcano, vaac, number } } (contract 2.5, addendum 5;
 * O-169); a remark whose first line names RAIM and matches no other category
 * is category raim — the two PASSED forms one line, any other with its
 * continuation lines up to the D63/D63a paragraph end — and a remark of another
 * category that names RAIM keeps it, flagged raim: true (O-172, QA F-01);
 * dispatchContact carries every
 * Contact Dispatch text printed — the Company NOTAM line and the whole OFP
 * remark, every line (O-175, O-183; the label stays the internal short-form /
 * long-form flag); the deferred-field INFO and
 * step texts carry no internal phrase (O-117); hasPerishables only when the
 * package prints YES — never for ": NO" or the bare "PERISHABLES ONBOARD" line,
 * as the NavBlue rule (O-129, O-182). Every other output is byte-identical to
 * v1.0.1 (frozen as test/oracle/ofp-flightkeys-v1.0.1.js). Not built into
 * index.html: rules/ofp-flightkeys-next until the integration PR (D90, D96).
 *
 * v1.0.1 (step 5e-2, module PR; Exec answers O-100, O-103, O-115) changes
 * only the crew-facing finding texts: the internal references ("(SME-n)",
 * "(O-n)", "(D63a)", "(CS-1)", "rows 29–31", "read in 5d", "(§A.8)" and
 * combinations) are removed from the 11 WARN and 20 INFO templates that
 * carried them; meaning, wording and capitals are unchanged.
 * The references stay in the comments, the SPEC and the tests. Every other
 * output is byte-identical to v1.0.0 (TC-175). Not built into index.html:
 * rules/ofp-flightkeys-next until the integration PR (D90).
 *
 * v1.0.0 (D58; step 5e-1, Exec answer O-74) is the first release version. It
 * is NOT built into index.html and not used by the app until the switch PR
 * (5e-1 PR 2, O-74); its master copy is published to the Drive between the two
 * PRs (CLAUDE.md rule 14). New in v1.0.0 (O-68, module side): the filed NAT
 * track letter is worked out BEFORE the NAT call, and the NAT ruleset
 * (rules/nat-rules-next v1.2.0) is called with { filed, findings }; its findings
 * (NAT-FILED-NOT-IN-MESSAGE, D79; NAT-RANDOM-ROUTE, D81; …) are forwarded into
 * findings[] with their code. The deferred-field INFO is version-free ("not
 * read: …", O-84). Everything else is byte-identical to v0.4.0.
 * v0.2.0 read the OFP
 * release: identity and header, airports and times, fuel, weights, DOT
 * exemption, slot, ETOPS, POR, ETP/CFS, nav log (for TOC and the ETOPS/ETP/POR
 * times) and alternate routes (v0.1.0: field map v1.1 rows 1–23, 29–31, 33,
 * 34, 36, 39–41) and, new in v0.2.0, the release and remarks pages: crew and
 * the operating-pilot count (row 26, D62), CAT II/III authorisations and
 * restrictions (24), MEL/CDL/DDG items (25), perishables (27), temperature
 * control (28), permits (35), the TLR (32, 32a), the OFP Remarks with their
 * categories and sub-headings, airport remarks and remarks weather, security
 * messages, extra fuel, PCF and the revision. New in v0.3.0 (step 5d, D64):
 * the BRIEFING READER (§ 7) reads the briefing documents from the positioned
 * items only — never from the joined text — and returns, per airport, the
 * NOTAM items in the form NOTAM ruleset v1.13.0 splits (notams), each item's
 * ID, printed type and source positions (notamItems), the NOTAM section as
 * printed (notamsRaw), the TAF / METAR / ATIS reports (weather) with the
 * * PRIO * TAF as the E-WINS (ewins*), the role windows (briefing), an entry
 * for every briefing airport in card order (SME-1), and sections[]. New in
 * v0.4.0 (step 5d-2, § 7b; Exec answers O-33 … O-45): airportData notams keep
 * the printed type headings for NOTAM ruleset v1.14.0 (D67); the Company NOTAMs
 * (companyNotams[], HSCN included); curfews (airportData curfew, CURFEW key
 * only, aircraft type by a closed table, season effectivity); ops notes
 * (airportData opsNotes); the FIR NOTAM blocks (enrouteNotams.fir, firNotams[],
 * firRaw[], D64); the NAT track messages (natMessages[], natTrack through the
 * injected NAT parser) and the PACOTS sections; the Hazard Briefing per FIR
 * (hazards[], text as printed, never evaluated). Exec answers O-46 … O-49
 * (19 Nov, same development version): the Dispatch contact lines stay in the
 * Company NOTAM text and give dispatchContact (O-46); the filed NAT track from
 * the OFP page 1 route and the ICAO FPL route (O-47); curfew lines by aircraft
 * family and variant (O-48); FIR NOTAM repeats kept only under the FIRs on the
 * OFP (O-49).
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
 *   options { icaoFpl, aircraftProfile, notamRules, parseNatTrack } — the
 *             shared modules, passed in. parseNatTrack is the NAT ruleset's
 *             parseNatTrack (rules/nat-rules-next v1.2.0, D77), called once per
 *             package with the chosen NAT message (O-42, O-43) and, from
 *             v1.0.0, options { filed, findings } (O-68): filed = the letter
 *             read from the OFP page 1 and ICAO FPL routes (D78), or null;
 *             findings = an array the NAT ruleset pushes { level, field:
 *             'natTrack', code, message } to, forwarded into findings[].
 *             A parser that ignores the options (src/nat.html v1.1.0) still
 *             works: assignedId and the marked track are set here as in
 *             v0.4.0. notamRules (v0.3.0) is the NOTAM
 *             ruleset: its _splitNotams / _fkHeader cut an airport's NOTAM
 *             text into items and read each item's ID, so the NOTAM grammar
 *             exists once (ADR-005 §2.5). The module never reads window,
 *             document, storage, the clock or any app global.
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
const RULESET_VERSION  = '1.1.1';
const SCHEMA_VERSION   = 2;
// Contract v2.0 (ADR-005 Appendix A + B) plus the extension fields of the
// Appendix B addenda: specialQualification, swa (Exec SME answers 13 Nov,
// contract 2.1); operatingPilots (D62) and the crew-record extensions
// firstName, toLndgExpiry (SME-9) (contract 2.2); the airport extensions
// notamItems, notamsRaw (D64), briefing (SME-1) and weatherRaw (D65) (contract 2.3, addendum 3);
// the top-level extensions firNotams, firRaw (D64, O-41), natMessages (O-43), hazards (O-45)
// and dispatchContact (O-46) (contract 2.4, addendum 4); the top-level extension volcanicAsh (O-169)
// and dispatchContact.company / .remark (O-175) (contract 2.5, addendum 5); v1.1.1: dispatchContact = { remark } only (DEF-013).
// Adding fields is a minor contract version (ADR-005 §2.4).
const CONTRACT_VERSION = '2.5';
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
// (addendum 1), `operatingPilots` (addendum 2, D62) and `firNotams`, `firRaw`,
// `natMessages`, `hazards`, `dispatchContact` (addendum 4, v0.4.0) and `volcanicAsh` (addendum 5,
// v1.1.0) added before `sections`).
const EXTENSION_FIELDS = Object.freeze([
  'revision', 'companyNotams', 'ofpRemarks', 'fplEquipment',
  'catIiIiiRestrictions', 'securityMessages', 'extraFuel', 'pcf', 'permits',
  'designator', 'swa', 'operatingPilots', 'firNotams', 'firRaw', 'natMessages', 'hazards',
  'dispatchContact', 'volcanicAsh', 'sections', 'findings',
]);
// Extensions on core records. specialQualification: addendum (SME-2).
// notamItems, notamsRaw (D64), briefing (SME-1) and weatherRaw (D65): addendum 3 (v0.3.0).
const AIRPORT_EXTENSION_FIELDS = Object.freeze(['remarks', 'remarksWeather', 'specialQualification',
  'notamItems', 'notamsRaw', 'briefing', 'weatherRaw']);
const DDG_EXTENSION_FIELDS     = Object.freeze(['type', 'notes']);
// Extensions on crewMembers[i] (addendum 2): the full first name as printed and
// the TO/LNDG currency expiry ("Not Reported" when blank, SME-9).
const CREW_EXTENSION_FIELDS    = Object.freeze(['firstName', 'toLndgExpiry']);

// Fields this version does not read: the explicit empty is returned and one INFO
// finding names the step that reads the field (field map v1.1 rows). Step
// 'open' = in no brief yet. airportData.weather, .notams and sections are read
// since v0.3.0; enrouteNotams, natTrack, airportData.curfew / .opsNotes and
// companyNotams since v0.4.0 (step 5d-2). An airportData entry carries a curfew /
// opsNotes key only when the package prints one for it (NavBlue also leaves them
// out when nothing is printed).
const DEFERRED_FIELDS = Object.freeze({
  fplEquipment:           'open',  // D41 field 10a + MEL removals: not in the v0.2.0 brief (icao-fpl reads field 10)
});
// v1.1.0 (O-117): no internal phrase in the step text — "(open item)" and "brief" are out, and the
// unused '5d' step ("read in 5d"; no field was deferred to it) is removed.
const DEFERRED_STEPS = Object.freeze({ open: 'not yet read from FlightKeys packages' });

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
  // v1.1.0 (O-129, O-182; QA F-03): the printed value of that line — YES or NO after any punctuation or
  // spacing (": YES", "- YES", " YES", "=YES" …). YES → perishables; NO, the bare line (7 of the 26 print it
  // so, one item, nothing after it) or any other value → none (the NavBlue rule).
  PERISHABLES_VALUE:   /^PERISHABLES?\s+ON\s*BOARD[^A-Za-z0-9]*(YES|NO)\b/,
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
  // v1.1.0 (O-172; QA F-01): a remark whose first line names RAIM (RMK_RAIM at the start, RMK_RAIM_WORD
  // anywhere) is a raim remark only when it matches no other category; otherwise it keeps its category
  // and is flagged raim: true. The two PASSED forms (the only forms in both corpora, O-171) stay one line;
  // any other raim remark takes its continuation lines.
  RMK_RAIM:        /^RAIM\b/,
  RMK_RAIM_WORD:   /\bRAIM\b/,
  RMK_RAIM_PASSED: /^RAIM VALIDATION (?:FOR ETOPS ALTN [A-Z]{4} )?PASSED\s*$/,
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

  // ── Briefing documents (v0.3.0, § 7; grammar §A.2–§A.9). Each pattern is
  // matched against ONE line rebuilt from the positioned items of ONE column
  // (never against the joined text, grammar §A.3).
  // §A.3: running header (shape only — the briefing callsign can differ from the
  // release, L22) and footer "Page n of N <uuid>" / VA "Page1of1 <uuid>".
  BR_RUNNING_HDR:  /^\S+?\s*\/\s*[A-Z0-9]{3,4}\s*-\s*[A-Z0-9]{3,4}\s*\/\s*\d{4}-\d{2}-\d{2}\s*\/\s*\S+\s+\d{4}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}$/,
  BR_FOOTER:       /^Page\s*(\d+)\s*of\s*(\d+)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
  // §A.2: the document headings that identify a document by content
  BR_HSCN_HEAD:    /^HIGH SEVERITY COMPANY NOTAMS$/,
  BR_CN_HEAD:      /^COMPANY NOTAMS$/,
  BR_VA_TEXT:      /\bVOLCANIC ASH\b/,
  // v1.1.0 (O-169): the Volcanic Ash Advisories page (one document, footer "Page1of1"). Closed forms:
  // NONE = the page reads exactly VA_NONE (its lines joined with single spaces); ADVISORY = the heading,
  // the INTERSECTS column and at least one "VA ADVISORY" block, one list row per block, every volcano
  // readable; anything else is UNREADABLE. Lines trimmed; matched one line at a time.
  VA_NONE:         /^NO VOLCANIC ASH ADVISORIES FOUND FOR THIS FLIGHT$/,
  VA_HEAD:         /^VOLCANIC ASH ADVISORIES$/,
  VA_INTERSECTS:   /^INTERSECTS$/,
  VA_LIST_ROW:     /^VAA\s*(\d{4}\/\d+)\s+(\S(?:.*?\S)?)(?:\s{2,}FLIGHT)?$/,
  VA_ADVISORY:     /^VA ADVISORY$/,
  VA_VAAC:         /^VAAC:\s*(\S(?:.*\S)?)\s*$/,
  VA_VOLCANO:      /^VOLCANO:\s*(\S(?:.*?\S)?)(?:\s+\d{3,6}(?:-\d{2})?)?\s*$/,
  VA_NUMBER:       /^ADVISORY NR:\s*(\d{4}\/\d+)\s*$/,
  // §A.4: airport block. Name cell "[<IATA>] - <NAME>" (clipped by FlightKeys,
  // may be glued to the role) and the role cell "<ROLE> DD HH:MM - DD HH:MM".
  // The role is taken from the closed list, anchored to the window at the end of
  // the line (never split on spaces); the longest names are tried first.
  BR_APT_NAME:     /^\s*(?:([A-Z0-9]{3})\s+)?-\s+(.*?)\s*(dest2AltnPlanned|dest2Altn|dest2|DESTINATION|DEPARTURE|ALTN 1|ALTN|IA|TA|EA)\s*(\d{2} \d{2}:\d{2})\s*-\s*(\d{2} \d{2}:\d{2})\s*$/,
  BR_APT_LINE:     /^\s*APT([A-Z0-9]{4})(?=RWYS:|\s|$)(.*)$/,
  BR_ROLE_TAIL:    /(dest2AltnPlanned|dest2Altn|dest2|DESTINATION|DEPARTURE|ALTN 1|ALTN|IA|TA|EA)\s*(\d{2} \d{2}:\d{2})\s*-\s*(\d{2} \d{2}:\d{2})\s*$/,
  BR_RWY_CELL:     /^\s*(?:RWYS:\s*)?((?:[0-9A-Z]{1,3}\/[0-9A-Z]{1,3}\s*)*)$/,
  // §A.8: FIR block "<NAME> FIR|UIR|…" + "FIR<ICAO>" (glued)
  BR_FIR_CODE:     /^\s*FIR([A-Z0-9]{4})\s*$/,
  // §A.6 / §A.9: centred headings (indent >= BRIEF.HEADING_MIN_INDENT characters)
  BR_WX_HEAD:      /^(TAF|METAR|ATIS|SIGMET)$/,
  // §A.6, §A.8, §A.9: the empty-state box: "THERE ARE NO ACTIVE …", "NIL" (between
  // its two lines in reading order) and the closing line
  BR_EMPTY_START:  /^THERE ARE NO ACTIVE (NOTAMS|ATIS|METAR|TAF|SIGMET)\b/,
  BR_EMPTY_NIL:    /^NIL$/,
  BR_EMPTY_END:    /^(?:(?:GIVEN\s+)?TIME\s+)?PERIOD\b.*\.$/,
  // §A.9: report starts (indent 0–2): TAF [AMD|COR] / "* PRIO * TAF" (E-WINS,
  // D55, SME-17/21) / METAR [SPECI|COR] / ATIS "AD <AAA> /OS"
  BR_TAF_START:    /^(\* PRIO \* )?TAF\b/,
  BR_METAR_START:  /^METAR\b/,
  BR_ATIS_START:   /^AD\s+\S+\s+\/OS\b/,
  BR_PRIO_PREFIX:  /^\* PRIO \* /,
  // Sections (rows 37, 38): pages identified by content (text pages)
  SEC_NAT_PAGE:    /^NAT-TRACKS\b/,
  SEC_CHART_PAGE:  /^(?:Chart Alert\b|\+ JEPPESEN\b)/,
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
    designator: '', swa: null, operatingPilots: null, firNotams: [], firRaw: [], natMessages: [], hazards: [], dispatchContact: null,
    volcanicAsh: null, sections: [], findings: [],
  };
}

/**
 * Parse a FlightKeys package into the briefing contract (v2.4).
 * @param {{text:string, pages?:Array}} input — see the file header
 * @param {{icaoFpl?:object, aircraftProfile?:object, notamRules?:object, parseNatTrack?:function}} [options]
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
  const ctx = { out, ext, add, findings, fpl, acp, rel, p1, pagesIn, textPages, copies, opts, p1Icaos: [] };

  _readIdentity(ctx);
  _readAirports(ctx);
  _readPending(ctx);
  _readBriefing(ctx);      // § 7 (v0.3.0): airportData weather / notams, card order
  _readCompany(ctx);       // § 7b (v0.4.0): companyNotams[] (§A.7)
  _readDispatchContact(ctx); // § 7b (v0.4.0 O-46; v1.1.0 O-175; v1.1.1 DEF-013): dispatchContact
  _readCurfews(ctx);       // § 7b (v0.4.0): airportData curfew (row 46; O-33 … O-37)
  _readOpsNotes(ctx);      // § 7b (v0.4.0): airportData opsNotes (row 47; O-38, O-39)
  _readFirs(ctx);          // § 7b (v0.4.0): enrouteNotams, firNotams[], firRaw[] (row 49; O-40, O-41)
  _readHazards(ctx);       // § 7b (v0.4.0): hazards[] (O-45)
  _readVolcanicAsh(ctx);   // § 7b (v1.1.0): volcanicAsh (O-169)
  _readNat(ctx);          // § 7b (v0.4.0): natMessages[], natTrack (row 42; O-42, O-43); v1.0.0: NAT findings (O-68)
  _readSections(ctx);      // § 7 (v0.3.0): sections[] (rows 37, 38); PACOTS (v0.4.0, O-44)

  // ── Deferred fields: explicit empties, one INFO each ───────────────
  // v1.0.0 (O-84): the text is version-free, so a version bump does not change it.
  for (const f of Object.keys(DEFERRED_FIELDS)) add('INFO', f, `not read: ${DEFERRED_STEPS[DEFERRED_FIELDS[f]]}`);

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
    add('INFO', 'designator', `designator ${ext.designator} is not in the callsign index: no verbal callsign`);
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
    if (!ctx.p1Icaos.includes(m[2])) ctx.p1Icaos.push(m[2]);
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
  if (s === -1) { if (rel) add('WARN', 'dotExemption', 'Remarks block not found in the release: not read'); return; }
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

// D63a blank lines (QA F1, 17 Nov). The app's reader writes no empty line inside a
// page (src/pdf.html processPDF: a line is written only `if (lineStr.trim())`), so a
// printed blank line exists only in the positioned items: a vertical gap between two
// consecutive lines of the same page. The release is one column in one font. On the
// 26 FlightKeys fixtures the median line pitch of the first release copy is 13.20 pt
// in every package; one printed line is 0.90–1.10 × that pitch, a blank line 1.99–2.04 ×
// (two blank lines 3.00–3.23 ×), and nothing lies in between. A blank line is
// therefore a gap of at least BLANK_LINE_PITCHES × the release copy's median pitch.
// The median is taken over the whole copy, not the block: in 6 of the 26 packages
// the Remarks block has more blank lines than single steps. Lines on different pages
// are never compared (O-10: a page break is not a blank line).
const BLANK_LINE_PITCHES = 1.6;

// The y of every text line of a PDF page, from the page's items, grouped exactly as
// processPDF groups them (source order; a line is the first one within 2 pt of the
// item's y; lines top to bottom; empty lines dropped). null when the items are missing
// or their lines do not match the text page line for line.
function _pageLineYs(ctx, pdfPage) {
  ctx.lineYCache = ctx.lineYCache || {};
  if (Object.prototype.hasOwnProperty.call(ctx.lineYCache, pdfPage)) return ctx.lineYCache[pdfPage];
  let ys = null;
  const pg = ctx.pagesIn && ctx.pagesIn.find(p => p && p.page === pdfPage);
  const textLines = ctx.textPages[pdfPage - 1];
  if (pg && Array.isArray(pg.items) && textLines) {
    const src = pg.items.map((it, k) => ({ it, k: it && typeof it.order === 'number' ? it.order : k }))
      .filter(o => o.it && typeof o.it.str === 'string' && o.it.str && typeof o.it.x === 'number' && typeof o.it.y === 'number')
      .sort((a, b) => a.k - b.k);
    const buckets = [];
    for (const { it } of src) {
      let b = buckets.find(l => Math.abs(l.y - it.y) <= 2);
      if (!b) { b = { y: it.y, items: [] }; buckets.push(b); }
      b.items.push(it);
    }
    buckets.sort((a, b) => a.y - b.y);
    const rows = buckets.map(b => ({ y: b.y, key: b.items.slice().sort((a, c) => a.x - c.x).map(i => i.str).join('').replace(/\s+/g, '') }))
      .filter(r => r.key);
    if (rows.length === textLines.length && rows.every((r, j) => r.key === textLines[j].replace(/\s+/g, ''))) ys = rows.map(r => r.y);
  }
  ctx.lineYCache[pdfPage] = ys;
  return ys;
}

// Median pitch of the first release copy: consecutive body lines on the same page.
function _releasePitch(ctx) {
  if (ctx.relPitch !== undefined) return ctx.relPitch;
  const d = [];
  for (const p of ctx.rel ? ctx.rel.pages : []) {
    const ys = _pageLineYs(ctx, p.pdfPage);
    if (!ys) continue;
    for (let j = 3; j < 2 + p.body.length; j++) d.push(ys[j] - ys[j - 1]);
  }
  d.sort((a, b) => a - b);
  ctx.relPitch = d.length ? d[Math.floor((d.length - 1) / 2)] : null;
  return ctx.relPitch;
}

// Is a printed blank line between release lines a and b (a above b)? true / false, or
// null when the positions cannot tell (the page is then noted for one WARN).
function _blankBetween(ctx, a, b) {
  const pa = ctx.rel.pos[a], pb = ctx.rel.pos[b];
  if (pa.page !== pb.page) return false;   // O-10: a page break is not a blank line
  const ys = _pageLineYs(ctx, pa.page), pitch = _releasePitch(ctx);
  if (!ys || !(pitch > 0)) { (ctx.blankUnknown = ctx.blankUnknown || new Set()).add(pa.page); return null; }
  return ys[pb.line - 1] - ys[pa.line - 1] >= BLANK_LINE_PITCHES * pitch;
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
  if (blank) add('INFO', 'crewMembers', `TO/LNDG Expiry blank for ${blank} pilot(s): "Not Reported"`);
  if (star) add('INFO', 'crewMembers', `"*" printed for ${star} pilot(s): kept with the last name; not seniority`);
  // D62: the number of operating pilots, for the crew rest module (no names).
  if (pilots.length) {
    ext.operatingPilots = pilots.length;
    if (pilots.length < 2 || pilots.length > 4) add('WARN', 'operatingPilots', `${pilots.length} operating pilot(s) printed; 2, 3 or 4 expected`);
  } else add('WARN', 'operatingPilots', 'no operating pilot found in the crew list');
}

// ── MEL / CDL / DDG block (row 25; SME-4) ───────────────────────────────
// "MEL|CDL <code> - <title>" (title wraps onto the next line), notes "- …" /
// "RMK - …" under the item (their wrapped lines join the note with their printed
// line breaks, "\n", nothing reflowed; QA F3), until the next
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
    } else if (note) note.text += '\n' + l;   // the note keeps its printed line breaks, as remarks do (D63a; QA F3)
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
// D63a (Exec, 17 Nov) for the unmarked run: a remark runs until a blank line (seen in
// the positioned items, _blankBetween; never across a page break), a
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
  // v1.1.0 (QA F-01): raim only when no other category matches; a remark of another category that names
  // RAIM keeps its category and its field, and its record is flagged raim: true (_readRemarks).
  if (PATTERNS.RMK_RAIM.test(t)) return 'raim';
  return null;
}

function _readRemarks(ctx, from, to) {
  const { out, ext, add, rel } = ctx;
  const lines = rel.lines, pos = rel.pos;
  const acFleet = _fleetOf(out.acftType);
  const entries = [];
  let mode = null, boilerOpen = false, station = null, entry = null, fleetWarned = false;
  let blank = false, afterSub = false, genSub = null;   // D63a paragraph state (unmarked run)
  let prevLine = -1;
  for (let i = from; i < to; i++) {
    const t = lines[i].trim();
    if (!t) continue;   // the app writes no empty line; a blank line is a gap in the positions
    blank = prevLine !== -1 && _blankBetween(ctx, prevLine, i) === true;
    prevLine = i;
    let c = _remarkStart(t, i === from);
    if (c === null && PATTERNS.RMK_DASHES.test(t) && i + 1 < to && PATTERNS.RMK_STATION.test(lines[i + 1].trim())) c = 'dashes';
    let cont = false, isSub = false;
    // a line starting with RAIM ends a station block whatever its category (as v1.0.1's RAIM VALIDATION line)
    if (mode === 'stationRestriction' && !(c && _RMK_HARD.has(c)) && !PATTERNS.RMK_RAIM.test(t)) { c = 'stationRestriction'; cont = true; }
    else if (c === 'dashes') { c = 'stationRestriction'; station = { icao: null, heading: '', fleet: null, subHeading: null, subFleet: null, marker: null, cur: null }; }
    else if (c === null && PATTERNS.RMK_SUBHEAD.test(t)) { c = 'other'; isSub = true; }   // D63a: a sub-heading
    else if (c === null && mode && (mode !== 'boilerplate' || boilerOpen) && !blank && !afterSub) { c = mode; cont = true; }
    else if (c === null) c = 'other';
    // v1.1.0 (O-172; QA F-01): a new remark whose first line names RAIM anywhere and that matches NO other
    // category is category raim, a sub-heading too (it then opens the remark). A remark of another category
    // keeps it (and its field) and is flagged raim: true below. A RAIM word on a continuation line starts
    // nothing. NOTAM text never reaches this reader.
    if (!cont && c === 'other' && PATTERNS.RMK_RAIM_WORD.test(t)) { c = 'raim'; isSub = false; }
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
      // QA F-01: a remark of another category whose first line names RAIM — an additional RAIM flag, never
      // a replacement (the key is present only when true). The dispatcher line and the boilerplate excepted.
      if (c !== 'raim' && c !== 'dispatcher' && c !== 'boilerplate' && PATTERNS.RMK_RAIM_WORD.test(t)) rec.raim = true;
      ext.ofpRemarks.push(rec);
      if (station && station.cur && !station.cur.record) station.cur.record = rec;
      if (general) entry = null;
      newRec = general ? rec : null;
    }
    if (cont && entry && entry.category === c) { entry.text += '\n' + t; entry.lines.push(i); }
    else { entry = { category: c, text: t, lines: [i], page: pos[i].page, line: pos[i].line, rec: newRec || null }; entries.push(entry); }
    // O-172: a raim remark that is not one of the two PASSED forms takes its continuation lines; it ends by
    // the D63/D63a paragraph rule (a blank line, a sub-heading or a recognised item; a page break is no
    // blank line). The PASSED forms stay one line (as v1.0.1).
    mode = _RMK_INHERIT.has(c) ? c : c === 'raim' && (cont || !PATTERNS.RMK_RAIM_PASSED.test(t)) ? 'raim' : null;
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
  // v1.1.0 (O-129, O-182, Exec 22 Nov): perishables only when the package prints YES — the NavBlue pattern
  // or "PERISHABLES ONBOARD: YES"; ": NO" and the bare "PERISHABLES ONBOARD" line set nothing (v1.0.1: the
  // bare line set it).
  out.hasPerishables = PATTERNS.PERISHABLE.test(remText) || entries.some(en => {
    if (en.category !== 'perishables') return false;
    const v = PATTERNS.PERISHABLES_VALUE.exec(lines[en.lines[0]].trim());
    return !!v && v[1] === 'YES';
  });
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
      add('WARN', 'altData', `${st.icao}: the station restriction requires a takeoff alternate; the release lists none`);
    }
  }
  if (skipped) add('INFO', 'airportData', `${skipped} station-restriction line(s) under another fleet's sub-heading not attached (aircraft ${out.acftType})`);

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
  if (entries.some(x => x.category === 'ewins')) add('INFO', 'ewins', 'E-WINS release line names no airport and no forecast: sets nothing here (the E-WINS forecast is the * PRIO * briefing TAF)');
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
      add('INFO', 'ddgItems', `MEL ${c.code} is named only in a late-addition remark: added to ddgItems`);
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
          let rec = null, afterSub = false, prevLine = -1;
          for (let i = cs; i < end; i++) {
            const t = lines[i].trim();
            if (!t) continue;   // a blank line is a gap in the positions (see _blankBetween)
            if (prevLine !== -1 && _blankBetween(ctx, prevLine, i) === true) rec = null;
            prevLine = i;
            const isSub = PATTERNS.RMK_SUBHEAD.test(t);
            if (rec && !isSub && !afterSub && !PATTERNS.CDC_START.test(t)) rec.text += '\n' + t;
            else ctx.ext.ofpRemarks.push(rec = { text: t, category: 'cdcAttestation', airport: null, subHeading: null, page: rel.pos[i].page, line: rel.pos[i].line });
            afterSub = isSub;
          }
        }
      }
      if (ctx.blankUnknown) ctx.add('WARN', 'ofpRemarks', `positioned items missing or not matching the text on PDF page(s) ${[...ctx.blankUnknown].sort((a, b) => a - b).join(', ')}: a printed blank line cannot be seen there, so a remark after one may be joined to the remark above it`);
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
// § 7 · BRIEFING READER (v0.3.0, step 5d; grammar §A.1–§A.11; D54, D64)
// ═══════════════════════════════════════════════════════════════
//
// The briefing documents are read from the POSITIONED ITEMS only. The joined text
// cannot be segmented: one line from each column is joined in it (grammar §A.3,
// 9,132 lines). Reading order per page (§A.1): running header, left column top to
// bottom, right column top to bottom, footer. The running header and footer are
// removed by position AND shape (§A.3, §A.10 row 10); a row in the header or
// footer band that does not have the shape is kept as text (fail-safe) with a WARN.
// Items within Y_TOL of the same y form one line, sorted by x; indentation and
// gaps are kept as spaces on the 4.8 pt grid of the monospaced briefing font
// (8 pt Courier), counted from the column's left edge (D54).
//
// Thresholds, measured on the 567 briefing pages of the 26 FlightKeys packages
// (541 briefing pages + 26 VA pages; every page 841.9 x 595.3 pt, y from the top):
//   running header row y = 19.88 on every page; first body row y >= 35.03
//     → HEADER_MAX_Y 27.5 (the middle of the gap)
//   footer row y = 579.40 on every page; last body row y <= 563.88
//     → FOOTER_MIN_Y 571.6 (the middle of the gap)
//   left-column items start at x 30.35 … 404.75, right-column items at x >= 430.03
//     → the column split is the page middle (width / 2 = 420.9 pt), inside the gap
//   column edges (smallest x): left 30.35, right 430.03 → LEFT_X0, RIGHT_X0
const BRIEF = Object.freeze({
  HEADER_MAX_Y: 27.5,
  FOOTER_MIN_Y: 571.6,
  LEFT_X0: 30.35,
  RIGHT_X0: 430.03,
  CHAR_W: 4.8,
  Y_TOL: 2,
  // Centred headings (§A.6 category headings, §A.9 TAF/METAR/ATIS/SIGMET): indent
  // >= 100 pt in every package (§A.6) = 21 characters. Body lines are at indent
  // 0–2; the 12 body lines at 87–89 pt (18 characters) are wraps of centred text.
  HEADING_MIN_INDENT: 21,
  // Report starts (§A.9) and NOTAM item text sit at indent 0–2.
  REPORT_MAX_INDENT: 2,
});

// §A.6: the closed list of the 17 category (type) headings.
const BRIEF_CATEGORIES = Object.freeze(['RUNWAY', 'TAXIWAY', 'APPROACH AND LANDING', 'AIRPORT', 'OBSTACLE',
  'NAVIGATION', 'COMMUNICATION', 'AIRSPACE', 'WARNING', 'GENERAL', 'RAMP', 'DEPARTURE PROCEDURES',
  'ARRIVAL PROCEDURES', 'FACILITIES', 'N/A', 'HAZARD', 'SERVICE']);
// §A.4 / SME-1: the roles that make an airport an intermediate / terrain /
// en-route alternate only. Briefing-only airports with any other role come first.
const BRIEF_LAST_ROLES = Object.freeze(['IA', 'TA', 'EA']);

// One band of one page → lines [{ page, col, y, yMax, indent, text }].
function _briefLines(items, x0, page, col) {
  const its = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const it of its) {
    const r = rows.length ? rows[rows.length - 1] : null;
    if (r && Math.abs(it.y - r.y) <= BRIEF.Y_TOL) { r.items.push(it); r.yMax = Math.max(r.yMax, it.y); }
    else rows.push({ y: it.y, yMax: it.y, items: [it] });
  }
  return rows.map(r => {
    r.items.sort((a, b) => a.x - b.x);
    const indent = Math.max(0, Math.round((r.items[0].x - x0) / BRIEF.CHAR_W));
    let s = ' '.repeat(indent), right = null;
    for (const it of r.items) {
      if (right !== null) {
        const gap = it.x - right;
        s += gap <= 1 ? '' : ' '.repeat(Math.max(1, Math.round(gap / BRIEF.CHAR_W)));
      }
      s += it.str;
      right = it.x + (it.w || it.str.length * BRIEF.CHAR_W);
    }
    return { page, col, y: r.y, yMax: r.yMax, indent, text: s.replace(/\s+$/, '') };
  });
}

// One PDF page → { page, header[], footer[], left[], right[], footerM }.
function _briefPage(pg) {
  const bands = { header: [], footer: [], left: [], right: [] };
  const mid = (pg.width || 841.89) / 2;
  for (const it of pg.items || []) {
    if (!it || typeof it.str !== 'string' || !it.str.trim()) continue;
    const b = it.y < BRIEF.HEADER_MAX_Y ? 'header' : it.y > BRIEF.FOOTER_MIN_Y ? 'footer' : it.x < mid ? 'left' : 'right';
    bands[b].push(it);
  }
  const p = {
    page: pg.page,
    header: _briefLines(bands.header, BRIEF.LEFT_X0, pg.page, 'H'),
    footer: _briefLines(bands.footer, BRIEF.LEFT_X0, pg.page, 'F'),
    left:   _briefLines(bands.left, BRIEF.LEFT_X0, pg.page, 'L'),
    right:  _briefLines(bands.right, BRIEF.RIGHT_X0, pg.page, 'R'),
  };
  p.footerM = p.footer.length === 1 ? PATTERNS.BR_FOOTER.exec(p.footer[0].text.trim()) : null;
  return p;
}

// §A.2: briefing documents — runs of pages whose footer counts "Page 1 of N" …
// "Page N of N" with one uuid. Each document's lines in reading order, with the
// running header and footer removed by shape.
function _briefDocs(ctx) {
  const { add } = ctx;
  const docs = [];
  let cur = null;
  for (const pg of ctx.pagesIn) {
    if (!pg || !Array.isArray(pg.items)) { cur = null; continue; }
    const p = _briefPage(pg);
    const m = p.footerM;
    if (!m) { if (cur) { add('WARN', 'briefing', `briefing document from PDF p${cur.pages[0].page} ends at p${cur.pages[cur.pages.length - 1].page} before its page ${cur.N}`); cur = null; } continue; }
    const n = +m[1], N = +m[2], uuid = m[3];
    if (n === 1) {
      if (cur) add('WARN', 'briefing', `briefing document from PDF p${cur.pages[0].page} ends at p${cur.pages[cur.pages.length - 1].page} before its page ${cur.N}`);
      cur = { N, uuid, pages: [], vaFooter: /^Page\d+of\d+/.test(p.footer[0].text.trim()) };
      docs.push(cur);
    } else if (!cur || cur.N !== N || cur.uuid !== uuid || cur.pages.length !== n - 1) {
      add('WARN', 'briefing', `PDF p${p.page}: footer "Page ${n} of ${N}" does not continue a briefing document; page not read`);
      cur = null; continue;
    }
    cur.pages.push(p);
    if (n === N) cur = null;
  }
  if (cur) add('WARN', 'briefing', `briefing document from PDF p${cur.pages[0].page} ends before its page ${cur.N}`);
  for (const d of docs) {
    d.lines = [];
    for (const p of d.pages) {
      const keep = (ls, what) => {
        for (const l of ls) {
          const ok = what === 'header' ? PATTERNS.BR_RUNNING_HDR.test(l.text.trim()) : PATTERNS.BR_FOOTER.test(l.text.trim());
          if (ok) continue;
          add('WARN', 'briefing', `PDF p${p.page}: a line in the page ${what} band is not the running ${what}; kept as text`);
          d.lines.push(Object.assign({}, l, { col: 'L' }));
        }
      };
      keep(p.header, 'header');
      d.lines.push(...p.left, ...p.right);
      keep(p.footer, 'footer');
    }
    d.first = d.pages[0].page;
    d.last = d.pages[d.pages.length - 1].page;
    const t0 = d.lines.length ? d.lines[0].text.trim() : '';
    d.kind = PATTERNS.BR_HSCN_HEAD.test(t0) ? 'HSCN'
      : PATTERNS.BR_CN_HEAD.test(t0) ? 'NOTAM'
      : d.vaFooter && d.lines.some(l => PATTERNS.BR_VA_TEXT.test(l.text)) ? 'VA'
      : _briefBlockAt(d.lines, 0) && d.lines.some(_isWxHeading) ? 'WX'
      : _briefBlockAt(d.lines, 0) && d.lines.some(l => _isCategory(l)) ? 'NOTAM'
      : 'UNKNOWN';
    if (d.kind === 'UNKNOWN') add('WARN', 'briefing', `briefing document PDF p${d.first}-${d.last}: not recognised by content; not read`);
  }
  return docs;
}

const _isHeading = l => l.indent >= BRIEF.HEADING_MIN_INDENT;
const _isCategory = l => _isHeading(l) && BRIEF_CATEGORIES.includes(l.text.trim());
const _isWxHeading = l => _isHeading(l) && PATTERNS.BR_WX_HEAD.test(l.text.trim()) && l.text.trim() !== 'SIGMET';

// §A.4: an airport block starts at line i (name/role line + APT<ICAO> line).
function _briefBlockAt(lines, i) {
  const a = lines[i], b = lines[i + 1];
  if (!a || !b) return null;
  const nm = PATTERNS.BR_APT_NAME.exec(a.text);
  const ap = nm && PATTERNS.BR_APT_LINE.exec(b.text);
  return ap ? { nm, ap } : null;
}
// §A.8: a FIR block starts at line i (name line + FIR<ICAO> line).
const _firBlockAt = (lines, i) => !!(lines[i + 1] && PATTERNS.BR_FIR_CODE.test(lines[i + 1].text) && lines[i].text.trim());

// One airport block's header (§A.4): name/role line, APT line, then the wrapped
// runway / role lines. Returns { icao, iata, name, roles[], next } (next = the
// index of the first body line).
function _briefBlockHeader(lines, i, blk) {
  const { nm, ap } = blk;
  const roles = [{ role: nm[3], start: nm[4], end: nm[5] }];
  const tail = s => {
    const m = PATTERNS.BR_ROLE_TAIL.exec(s);
    if (m) roles.push({ role: m[1], start: m[2], end: m[3] });
    return m ? s.slice(0, m.index) : s;
  };
  tail(ap[2]);
  let j = i + 2;
  for (; j < lines.length; j++) {
    const l = lines[j];
    if (_isCategory(l) || _isWxHeading(l) || _briefBlockAt(lines, j) || _firBlockAt(lines, j)) break;
    const m = PATTERNS.BR_ROLE_TAIL.exec(l.text);
    const rest = m ? l.text.slice(0, m.index) : l.text;
    const rw = PATTERNS.BR_RWY_CELL.exec(rest);
    if (!rw || (!m && !rw[1].trim())) break;      // not a runway / role line
    if (m) roles.push({ role: m[1], start: m[2], end: m[3] });
  }
  return { icao: ap[1], iata: nm[1] || '', name: nm[2].trim(), roles, next: j };
}

// Consumes an empty-state box starting at line j (§A.10 row 8): the "THERE ARE NO
// ACTIVE …" line, the "NIL" between its lines and the closing line. Returns the
// index after the box.
function _briefEmptyEnd(lines, j) {
  let k = j + 1;
  for (let n = 0; n < 2 && k < lines.length; n++) {
    const t = lines[k].text.trim();
    if (PATTERNS.BR_EMPTY_NIL.test(t) || (lines[k].indent > BRIEF.REPORT_MAX_INDENT && PATTERNS.BR_EMPTY_END.test(t))) k++;
    else break;
  }
  return k;
}

// The blocks of one NOTAM or WX document: { pre: [lines before the first airport
// block], airports: [{ hdr, body: [lines], firstLine }], fir: { line } | null }.
function _briefBlocks(lines) {
  const out = { pre: [], airports: [], fir: null };
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    if (_firBlockAt(lines, i) && (cur || out.airports.length)) { out.fir = { line: lines[i], icao: PATTERNS.BR_FIR_CODE.exec(lines[i + 1].text)[1] }; break; }
    const blk = _briefBlockAt(lines, i);
    if (blk) {
      const hdr = _briefBlockHeader(lines, i, blk);
      cur = { hdr, firstLine: lines[i], aptLine: lines[i + 1], body: [] };
      out.airports.push(cur);
      i = hdr.next - 1;
      continue;
    }
    if (cur) cur.body.push(lines[i]); else out.pre.push(lines[i]);
  }
  return out;
}

// Source positions of a run of lines: one span per page and column, in reading
// order: { page, column: 'L' | 'R', y: [top, bottom] } (pt from the page top).
function _briefSource(lines) {
  const out = [];
  for (const l of lines) {
    const s = out[out.length - 1];
    if (s && s.page === l.page && s.column === l.col) s.y[1] = Math.round(l.yMax * 100) / 100;
    else out.push({ page: l.page, column: l.col, y: [Math.round(l.y * 100) / 100, Math.round(l.yMax * 100) / 100] });
  }
  return out;
}

// §A.5 / §A.6 / D54 / D64: one airport's (or FIR's) NOTAM block body → { items,
// notams, notamsRaw, empty, texts }. The type heading is kept as the item's
// category; inside a heading the NOTAM ruleset cuts the text at its item headers
// (ADR-005 §2.5); line breaks and indentation are kept. v0.4.0 (D67, step 5d-2
// scope 0): `notams` keeps the printed type heading lines, in printed order and
// with their centring, before the items under them — NOTAM ruleset v1.14.0 reads
// them (its §5b: a heading is never item content; it is the category of the items
// after it). Without the heading lines the text is v0.3.0's, byte for byte.
// texts[i] = item i's text (field: the findings' field name).
function _briefNotams(ctx, icao, body, field) {
  const { add } = ctx;
  field = field || 'airportData.notams';
  const nr = ctx.opts.notamRules;
  const runs = [];
  let cat = '', run = null, empty = false;
  const raw = [];
  const withHeadings = [];
  for (let j = 0; j < body.length; j++) {
    const l = body[j];
    if (_isCategory(l)) { raw.push(l); withHeadings.push(l); cat = l.text.trim(); run = null; continue; }
    if (PATTERNS.BR_EMPTY_START.test(l.text.trim())) {
      const k = _briefEmptyEnd(body, j);
      raw.push(...body.slice(j, k));
      empty = true; run = null; j = k - 1; continue;
    }
    raw.push(l);
    withHeadings.push(l);
    if (!run) { run = { category: cat, lines: [] }; runs.push(run); }
    run.lines.push(l);
  }
  const items = [];
  const texts = [];
  for (const r of runs) {
    const text = r.lines.map(l => l.text).join('\n');
    if (!nr) continue;
    const pieces = nr._splitNotams(text);
    let at = 0;
    pieces.forEach((pc, k) => {
      const n = pc.replace(/\n$/, '').split('\n').length;
      const ls = r.lines.slice(at, at + n);
      at += n;
      const h = nr._fkHeader(pc);
      if (!h || !h.id) add('WARN', field, `${icao}: NOTAM text under ${r.category || 'no heading'} (PDF p${ls[0].page}) does not start with a NOTAM item header; kept as an item with no ID`);
      if (k === 0 && h === null && runs.indexOf(r) > 0) add('WARN', field, `${icao}: text under ${r.category || 'no heading'} joins the item above it when the airport's NOTAM text is split`);
      items.push({ id: h && h.id ? h.id : null, category: r.category, source: _briefSource(ls) });
      texts.push(pc.replace(/\n$/, ''));
    });
    if (at !== r.lines.length) add('WARN', field, `${icao}: NOTAM split under ${r.category || 'no heading'} does not give back its ${r.lines.length} lines`);
  }
  // A block with an empty-state box only (no item) keeps notams '' (as v0.3.0).
  const notams = runs.length ? withHeadings.map(l => l.text).join('\n') : '';
  return { items, notams, notamsRaw: raw.map(l => l.text).join('\n'), empty, texts };
}

// §A.9: one airport's weather block body → { metar[], taf[], atis[], prio[], orphan }
// Each report is its lines as printed (line breaks and indentation kept; wrapped
// TAF groups as printed). A report starts at indent 0–2 with its keyword; every
// other line continues the report above it.
function _briefWeather(ctx, icao, body) {
  const { add } = ctx;
  const rep = { TAF: [], METAR: [], ATIS: [] };
  let sub = null, cur = null, orphans = 0;
  for (let j = 0; j < body.length; j++) {
    const l = body[j], t = l.text.trim();
    if (_isWxHeading(l)) { sub = t; cur = null; continue; }
    if (PATTERNS.BR_EMPTY_START.test(t)) { j = _briefEmptyEnd(body, j) - 1; cur = null; continue; }
    const start = l.indent <= BRIEF.REPORT_MAX_INDENT && sub &&
      (sub === 'TAF' ? PATTERNS.BR_TAF_START : sub === 'METAR' ? PATTERNS.BR_METAR_START : PATTERNS.BR_ATIS_START).test(t);
    if (start) { cur = { type: sub, prio: sub === 'TAF' && PATTERNS.BR_PRIO_PREFIX.test(t), lines: [l] }; rep[sub].push(cur); continue; }
    if (cur) { cur.lines.push(l); continue; }
    // A line with no report above it is kept as a report of its own (fail-safe).
    orphans++;
    cur = { type: sub || 'TAF', prio: false, lines: [l] };
    rep[sub || 'TAF'].push(cur);
  }
  if (orphans) add('WARN', 'airportData.weather', `${icao}: ${orphans} weather line(s) with no report keyword above them; kept as printed`);
  const noPrio = l => l.text.replace(/^(\s*)\* PRIO \* /, '$1');
  const txt = r => r.lines.map((l, k) => k === 0 ? noPrio(l) : l.text).join('\n');
  // NavBlue's form (rows 43, 48): METAR before TAF; the TAF last (the app reads
  // from the first TAF to the end of the text). ATIS between them. D65: kept so.
  const all = [...rep.METAR, ...rep.ATIS, ...rep.TAF];
  // D65 (Exec, 18 Nov): weatherRaw = the block as printed, for the RAW view only —
  // TAF, METAR, ATIS in printed order with their sub-headings, line breaks and
  // indentation, wrapped TAF groups and the empty-state text; page / column breaks
  // and running headers are already removed (D54). Only the "* PRIO *" prefix is
  // removed from its report's first line (D55). No evaluation reads it.
  const prioStarts = new Set(rep.TAF.filter(r => r.prio).map(r => r.lines[0]));
  const raw = body.map(l => prioStarts.has(l) ? noPrio(l) : l.text).join('\n');
  return { reports: rep, weather: all.map(txt).join('\n'), weatherRaw: raw, prio: rep.TAF.filter(r => r.prio).map(txt) };
}

// Steps 5d-1 … 5d-5: read the briefing documents into airportData (rows 43–45,
// 48; SME-1, SME-17, SME-21, SME-23; D46, D54, D55, D64).
function _readBriefing(ctx) {
  const { out, add } = ctx;
  ctx.briefDocs = [];
  if (!ctx.pagesIn) {
    for (const e of Object.values(out.airportData)) { e.notamItems = []; e.notamsRaw = ''; e.briefing = null; e.weatherRaw = ''; }
    add('WARN', 'briefing', 'no positioned items: the briefing (NOTAMs, weather, sections) is read from positions only; not read');
    return;
  }
  const docs = ctx.briefDocs = _briefDocs(ctx);
  const notamDocs = docs.filter(d => d.kind === 'NOTAM'), wxDocs = docs.filter(d => d.kind === 'WX');
  if (!notamDocs.length && !wxDocs.length) {
    for (const e of Object.values(out.airportData)) { e.notamItems = []; e.notamsRaw = ''; e.briefing = null; e.weatherRaw = ''; }
    add('WARN', 'briefing', 'no NOTAM Briefing and no Weather Briefing document found: airport NOTAMs and weather not read');
    return;
  }
  if (notamDocs.length !== 1) add('WARN', 'briefing', `${notamDocs.length} NOTAM Briefing documents found (1 expected)`);
  if (wxDocs.length !== 1) add('WARN', 'briefing', `${wxDocs.length} Weather Briefing documents found (1 expected)`);

  const apts = new Map();   // icao → { iata, name, roles[], notam, wx, order }
  const roleIn = (a, r, where) => {
    const x = a.roles.find(y => y.role === r.role && y.start === r.start && y.end === r.end);
    if (x) { if (!x.in.includes(where)) x.in.push(where); }
    else a.roles.push({ role: r.role, start: r.start, end: r.end, in: [where] });
  };
  const visit = (doc, where) => {
    const b = _briefBlocks(doc.lines);
    doc.blocks = b;
    for (const blk of b.airports) {
      const h = blk.hdr;
      let a = apts.get(h.icao);
      if (!a) { a = { icao: h.icao, iata: h.iata, name: h.name, roles: [], notam: null, wx: null }; apts.set(h.icao, a); }
      if (a[where === 'NOTAM' ? 'notam' : 'wx']) {
        add('WARN', 'briefing', `${h.icao}: two blocks in the ${where === 'NOTAM' ? 'NOTAM' : 'Weather'} Briefing; both read`);
        a[where === 'NOTAM' ? 'notam' : 'wx'].body.push(...blk.body);
      } else a[where === 'NOTAM' ? 'notam' : 'wx'] = blk;
      for (const r of h.roles) roleIn(a, r, where);
    }
  };
  // The Weather Briefing lists every briefing airport (§A.4: ALTN / dest2Altn are
  // weather only), so its block order is the briefing order; an airport with a
  // NOTAM block only follows.
  for (const d of wxDocs) visit(d, 'WX');
  for (const d of notamDocs) visit(d, 'NOTAM');

  // ── Assemble the entries; card order (SME-1) ─────────────────────────
  const entryFor = icao => out.airportData[icao] ||
    { weather: '', notams: '', remarks: [], remarksWeather: [], specialQualification: false };
  const built = new Map();
  let nItems = 0;
  for (const a of apts.values()) {
    const e = entryFor(a.icao);
    let nt = { items: [], notams: '', notamsRaw: '', empty: false };
    if (a.notam) nt = _briefNotams(ctx, a.icao, a.notam.body);
    else add('INFO', 'airportData.notams', `${a.icao}: no NOTAM block in the FlightKeys briefing`);
    if (nt.empty && !nt.items.length) add('INFO', 'airportData.notams', `${a.icao}: the NOTAM Briefing prints no active NOTAMs`);
    let wx = { weather: '', weatherRaw: '', prio: [] };
    if (a.wx) wx = _briefWeather(ctx, a.icao, a.wx.body);
    else add('WARN', 'airportData.weather', `${a.icao}: no block in the Weather Briefing`);
    e.weather = wx.weather;
    e.notams = nt.notams;
    e.notamItems = nt.items;
    e.notamsRaw = nt.notamsRaw;
    e.briefing = { iata: a.iata, name: a.name, roles: a.roles, notamBlock: !!a.notam, weatherBlock: !!a.wx };
    nItems += nt.items.length;
    // E-WINS (row 48; D55, SME-17/21/23; D46; Exec D66, 18 Nov): the "* PRIO *" TAF
    // is the E-WINS forecast. ewinsWeather = the forecast, prefix not shown; the TAF
    // stays in weather too (both kept, D46).
    // ewinsWindow = '' (D66): no window is built from the forecast's validity, so the
    // app (src/airports.html line 297, `ewinsWindow || wxWindowOverride`) uses the
    // airport's normal window, as for any TAF.
    // ewinsRole = the airport's actual role (D66): its briefing role codes (§A.4) in
    // printed order, each once, joined by "/" (e.g. "DEPARTURE/IA", "EA").
    // FK-P does not copy a logged NavBlue fault: NavBlue's extractEwins() builds
    // "HH00Z-HH00Z" from DDHH/DDHH, dropping the days (NB-F6, test/known-gaps.json
    // G-NB-6), and takes the role from free text with ALT by default (NB-F7, G-NB-7).
    if (wx.prio.length) {
      e.ewinsWeather = wx.prio[0];
      e.ewinsRole = [...new Set(a.roles.map(r => r.role))].join('/');
      e.ewinsWindow = '';
      add('INFO', 'ewins', `${a.icao}: "* PRIO *" TAF in the Weather Briefing = the E-WINS forecast; sets the airport's E-WINS fields`);
      if (wx.prio.length > 1) add('WARN', 'ewins', `${a.icao}: ${wx.prio.length} "* PRIO *" TAFs; the first is the E-WINS forecast`);
    }
    e.weatherRaw = wx.weatherRaw;   // D65; the last key of the entry
    built.set(a.icao, e);
  }
  if (!ctx.opts.notamRules && [...apts.values()].some(a => a.notam)) {
    add('WARN', 'notamRules', 'NOTAM ruleset not supplied: airport NOTAM text read, but not cut into items (notamItems empty)');
  }
  // Release airports (OFP page 1) and v0.2.0 entries with no briefing block keep
  // their entry; the airport extensions are explicit empties.
  for (const [icao, e] of Object.entries(out.airportData)) {
    if (built.has(icao)) continue;
    e.notamItems = []; e.notamsRaw = ''; e.briefing = null; e.weatherRaw = '';
    add(ctx.p1Icaos.includes(icao) ? 'WARN' : 'INFO', 'airportData', `${icao}: not in the FlightKeys briefing (no NOTAM or weather block)`);
  }
  // Card order (SME-1, rows 43–45): the OFP page-1 airports in line order, then the
  // other airports — release alternates and briefing airports with a role other
  // than IA / TA / EA in briefing order, then the IA / TA / EA-only airports.
  const order = [...ctx.p1Icaos.filter(i => out.airportData[i])];
  const rest = [...apts.keys(), ...Object.keys(out.airportData)].filter((i, k, arr) => !order.includes(i) && arr.indexOf(i) === k);
  const lastOnly = i => { const a = apts.get(i); return !!a && a.roles.every(r => BRIEF_LAST_ROLES.includes(r.role)); };
  order.push(...rest.filter(i => !lastOnly(i)), ...rest.filter(lastOnly));
  const ad = {};
  for (const i of order) ad[i] = built.get(i) || out.airportData[i];
  out.airportData = ad;
  ctx.briefStats = { airports: apts.size, notamBlocks: [...apts.values()].filter(a => a.notam).length,
    wxBlocks: [...apts.values()].filter(a => a.wx).length, items: nItems };
  add('INFO', 'briefing', `read from positions: ${docs.length} briefing documents; ${ctx.briefStats.notamBlocks} airport blocks in the NOTAM Briefing (${nItems} NOTAM items), ${ctx.briefStats.wxBlocks} in the Weather Briefing; ${apts.size} briefing airports`);
}

// ═══════════════════════════════════════════════════════════════
// § 7b · v0.4.0 (step 5d-2): COMPANY NOTAMS, CURFEWS, OPS NOTES, FIR NOTAMS,
//        HAZARDS, NAT / PACOTS (grammar §A.7–§A.9; field map rows 42, 46, 47, 49;
//        Exec answers O-33 … O-45, 19 Nov; D54, D64)
// ═══════════════════════════════════════════════════════════════
//
// Read from the same positioned lines as § 7 (never the joined text), except the
// NAT track message, which FlightKeys prints on its own text pages (no footer,
// one column; § 7 _readSections finds them the same way).

// §A.7: a Company key that names no location (O-40: "PUBS- is not an airport").
const COMPANY_NON_LOCATION_KEYS = Object.freeze(['PUBS']);

// O-33, O-48 (Exec, 19 Nov): the closed table from the OFP aircraft type (ICAO
// designator, FPL field 9) to its family and variant names (field map row 46,
// SME-12). A curfew line by aircraft type lists names; a FAMILY name (B747, B767,
// B777) applies to every variant of that family, a VARIANT name (B763, B748,
// B747-400/F …) only to the designator(s) it names. "B767, B777, B748" → all 767s,
// all 777s, the 747-8 only; "B747-400/F" → B744 and BLCF. A registration list is
// never matched. No line for the OFP type (or a type not in the table) → every
// line and a note + WARN (a planned FK-P exception: NavBlue applies every line).
const CURFEW_TYPES = Object.freeze({
  B762: Object.freeze({ family: 'B767', variants: Object.freeze(['B762']) }),
  B763: Object.freeze({ family: 'B767', variants: Object.freeze(['B763']) }),
  B764: Object.freeze({ family: 'B767', variants: Object.freeze(['B764']) }),
  B744: Object.freeze({ family: 'B747', variants: Object.freeze(['B744', 'B747-400/F']) }),
  BLCF: Object.freeze({ family: 'B747', variants: Object.freeze(['BLCF', 'B747-400/F']) }),
  B748: Object.freeze({ family: 'B747', variants: Object.freeze(['B748']) }),
  B772: Object.freeze({ family: 'B777', variants: Object.freeze(['B772']) }),
  B773: Object.freeze({ family: 'B777', variants: Object.freeze(['B773']) }),
  B77L: Object.freeze({ family: 'B777', variants: Object.freeze(['B77L']) }),
  B77W: Object.freeze({ family: 'B777', variants: Object.freeze(['B77W']) }),
  B77F: Object.freeze({ family: 'B777', variants: Object.freeze(['B77F']) }),
});
// Every family and variant name of the table: a list token that is one of these is
// an aircraft-type token (so "B77L" is never read as a registration).
const CURFEW_TYPE_NAMES = Object.freeze([...new Set(Object.values(CURFEW_TYPES).flatMap(t => [t.family, ...t.variants]))]);
// O-48: does a type-line token name the OFP type? Family name → every variant of
// the family; variant name → only the designators it is listed for.
const _curfewTypeMatch = (token, acftType) => {
  const t = Object.prototype.hasOwnProperty.call(CURFEW_TYPES, acftType) ? CURFEW_TYPES[acftType] : null;
  return !!t && (token === t.family || t.variants.includes(token));
};
// The notes added to a curfew string (O-33, O-34). No digits: the app reads every
// "HHMM-HHMM" in the string as a window (src/render-descent.html parseCurfewWindows).
const CURFEW_NOTES = Object.freeze({
  type:       'NOTE: NO CURFEW LINE FOR THIS AIRCRAFT TYPE - ALL LINES SHOWN',
  dates:      'NOTE: EFFECTIVE DATES NOT STATED - ALL WINDOWS SHOWN',
  changeover: 'NOTE: SEASON CHANGES THIS MONTH - BOTH WINDOWS SHOWN',
});
const CURFEW = Object.freeze({
  // A curfew window: HHMM[Z]-HHMM with Z or UTC (NavBlue's genM, plus "UTC").
  WINDOW:     /\b\d{4}Z?\s*[-–]\s*\d{4}\s*(?:Z|UTC)\b/,
  // O-35: a local-time bracket, e.g. "(2300-0700 LCL)" — dropped from the string.
  LCL:        /\s*\([^()]*\bL(?:CL|OCAL)\)/g,
  // O-36: a departure-only / arrival qualifier line (no window) — kept.
  QUAL_FLOW:  /\b(?:DEPARTURES?|DEPARTING|ARRIVALS?|ARRIVING)\b/,
  QUAL_WORD:  /\b(?:ONLY|NOT APPLICABLE)\b/,
  // A line by aircraft type or registration: "<list> CURFEW = <window> …".
  BY_LIST:    /^(.+?)\s+CURFEW\s*=/,
  TYPE_TOKEN: /^B7\d{2}\b/,
  REG_TOKEN:  /^[A-Z]{1,2}\d{1,5}[A-Z]{0,3}$/,
  SEASON:     /\b(SUMMER|WINTER)\b/,
  SEASON_HEAD:/^-?\s*(SUMMER|WINTER)\s*:?\s*$/,
  MONTHS:     /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s*(?:TO|-|–|THRU|THROUGH)\s*(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\b/,
  // O-37: curfew-like wording in an item under another key (reported, not read).
  LIKE:       /\bCURFEW\b|\bQUIET HOURS\b|\bNOISE (?:RESTRICTIONS?|ABATEMENT)\b|\bNOT ALLOWED BETWEEN\b|\bNOT AVAILABLE FOR (?:TAKEOFF|LANDING)\b|\bCLOSED\b[^\n]*\b\d{2}:?\d{2}Z\b/,
});

// The lines of one Company document part (HSCN or Company NOTAMs) → records.
// Headings (the document title, GENERAL and the type headings) are no item text.
function _companyFrom(ctx, lines, origin) {
  const { add } = ctx;
  const nr = ctx.opts.notamRules;
  const title = l => _isHeading(l) && (PATTERNS.BR_HSCN_HEAD.test(l.text.trim()) || PATTERNS.BR_CN_HEAD.test(l.text.trim()));
  const body = lines.filter(l => !title(l) && !_isCategory(l));
  if (!body.length) return [];
  const text = body.map(l => l.text).join('\n');
  const pieces = nr._splitNotams(text);
  const out = [];
  let at = 0;
  for (const pc of pieces) {
    const n = pc.replace(/\n$/, '').split('\n').length;
    const ls = body.slice(at, at + n);
    at += n;
    const h = nr._fkHeader(pc);
    const sm = /^SUBJECT:\s*(.*?)\s*$/m.exec(pc);
    if (!h || !h.id) add('WARN', 'companyNotams', `${origin} (PDF p${ls[0].page}): Company NOTAM text does not start with an item header; kept as an item with no ID`);
    if (!sm) add('WARN', 'companyNotams', `${origin} ${h && h.id ? h.id : '(no ID)'}: no SUBJECT line`);
    const end = !h || h.dateUnreadable ? null : h.endKind === 'UFN' ? 'UFN' : h.endKind === 'UFN_EST' ? `UFN(EST ${h.end})` : h.end;
    out.push({
      id: h && h.id ? h.id : null,
      location: h && h.locations.length ? h.locations.join(' ') : 'GENERAL',
      subject: sm ? sm[1] : '',
      start: h && !h.dateUnreadable ? h.start : null,
      end,
      severity: origin === 'HSCN' ? 'high' : 'normal',
      origin,
      text: pc.replace(/\n$/, ''),
      source: _briefSource(ls),
      _subjectRow: h ? h.subjectRow : -1,
    });
  }
  if (at !== body.length) add('WARN', 'companyNotams', `${origin}: the Company NOTAM split does not give back its ${body.length} lines`);
  return out;
}

// Scope 1 (§A.7; O-40): every Company NOTAM as printed — the High Severity page
// first (severity 'high'), then the Company NOTAMs in printed order. The P0110 pair
// (HSCN and Company) is kept as two records, never merged (D43).
function _readCompany(ctx) {
  const { add, ext } = ctx;
  ctx.company = [];
  const docs = ctx.briefDocs || [];
  if (!ctx.pagesIn || !docs.length) { add('WARN', 'companyNotams', 'no briefing documents read: Company NOTAMs not read'); return; }
  if (!ctx.opts.notamRules) { add('WARN', 'companyNotams', 'NOTAM ruleset not supplied: Company NOTAMs not cut into items (companyNotams empty)'); return; }
  const recs = [];
  for (const d of docs.filter(x => x.kind === 'HSCN')) recs.push(..._companyFrom(ctx, d.lines, 'HSCN'));
  for (const d of docs.filter(x => x.kind === 'NOTAM')) {
    if (!PATTERNS.BR_CN_HEAD.test((d.lines[0] || { text: '' }).text.trim())) continue;
    const pre = d.blocks ? d.blocks.pre : _briefBlocks(d.lines).pre;
    recs.push(..._companyFrom(ctx, pre, 'COMPANY'));
  }
  ctx.company = recs;
  ext.companyNotams = recs.map(r => { const o = Object.assign({}, r); delete o._subjectRow; return o; });
  const n = o => recs.filter(r => r.origin === o).length;
  add('INFO', 'companyNotams', `${recs.length} Company NOTAMs read (${n('HSCN')} High Severity, ${n('COMPANY')} Company), as printed`);
}

// DEF-013 (v1.1.1; Exec rulings R1–R5, R2a–R2e, R4 as amended, 23 Nov): dispatchContact =
// { category, remark } — the Dispatch sentence of the OFP Remarks, as printed, with its category, or null.
// Read from ext.ofpRemarks only (R1): the cover-page notice and the Company NOTAM sentences are never read
// here, and a NOTAM body is not an OFP remark (R5).
//   - a remark record is its lines joined by one space (wrapped lines), cut into sentences at
//     ". ", "! " or "? " followed by an upper-case letter (so "ext. 12" and "e.g. next" do not cut a sentence);
//   - a sentence is a Dispatch sentence when it has the words "contact dispatch" or "call dispatch" (any case);
//   - R2e a sentence telling the crew NOT to contact or call Dispatch ("Do not contact Dispatch", "Don't call
//     Dispatch", "No need to contact Dispatch", "Contact Dispatch is not required", "Dispatch contact not
//     required") is not a Dispatch remark: it is ignored — no category, no row, and it counts for neither R2b nor
//     R2c. The negation must stand directly before "contact / call Dispatch" (or "not required / necessary /
//     needed" directly after it), so "Do not hesitate to contact Dispatch" or "If you do not have the release,
//     contact Dispatch" are still Dispatch sentences;
//   - R2a category: SUGGESTION when the sentence is about questions ("… with questions", "… if you have any
//     questions" — the word question or questions); every other Dispatch sentence is REQUIRED (an instruction
//     to contact or call Dispatch, "Contact Dispatch before departure"; the module never reads a condition
//     other than questions as a suggestion);
//   - R2b both categories printed → only the first REQUIRED sentence is kept; R2c two or more of one category
//     → only the first printed is kept; so one sentence is kept, never several (R2d);
//   - R2d the kept sentence is as printed: the final full stop dropped, the case and every other character kept;
//   - none → dispatchContact null, no row (R3). R4: { category, remark }, no other key.
const DISPATCH_SENTENCE = /\b(?:contact|call)\s+dispatch\b/i;
const DISPATCH_QUESTIONS = /\bquestions?\b/i;
const DISPATCH_NEGATIVE = Object.freeze([
  // a negation directly before the verb: do not / don't / must not / never / need not / no need to / not required to …
  /\b(?:(?:do|does|did|must|should|shall|will|can|could|may|need)\s*(?:not|n['’]t)|won['’]?t|can['’]?t|cannot|never|no\s+need\s+to|(?:do|does)\s*(?:not|n['’]t)\s+(?:need|have)\s+to|not\s+(?:necessary|required|needed)\s+to|no\s+requirement\s+to|unnecessary\s+to)\s+(?:please\s+)?(?:contact|call)\s+dispatch\b/i,
  // "Contact Dispatch is not required / necessary / needed"
  /\b(?:contact|call)\s+dispatch\b[^.!?]*?\b(?:(?:is|are)\s+)?not\s+(?:required|necessary|needed)\b/i,
  // "Dispatch contact not required", "Dispatch contact is no longer necessary"
  /\bdispatch\s+contact\s+(?:(?:is|are)\s+)?(?:not|no\s+longer)\s+(?:required|necessary|needed)\b/i,
]);
function _dispatchSentences(text) {
  return String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(t => DISPATCH_SENTENCE.test(t) || DISPATCH_NEGATIVE.some(re => re.test(t))).map(t => t.replace(/\.$/, '').trim()).filter(Boolean);
}
function _readDispatchContact(ctx) {
  const { add, ext } = ctx;
  const found = [];
  let ignored = 0;
  for (const r of ext.ofpRemarks) {
    for (const t of _dispatchSentences(r.text)) {
      if (DISPATCH_NEGATIVE.some(re => re.test(t))) { ignored++; continue; }    // R2e: not a Dispatch remark
      found.push({ category: DISPATCH_QUESTIONS.test(t) ? 'SUGGESTION' : 'REQUIRED', remark: t, at: `PDF p${r.page} line ${r.line}` });
    }
  }
  const kept = found.find(f => f.category === 'REQUIRED') || found[0] || null;   // R2b, R2c: the first REQUIRED, else the first
  ext.dispatchContact = kept ? { category: kept.category, remark: kept.remark } : null;
  const neg = ignored ? ` (${ignored} negative sentence(s) ignored)` : '';
  if (kept) add('INFO', 'dispatchContact', `Dispatch contact as printed in the OFP Remarks: ${kept.category}, ${kept.at}; ${found.length} Dispatch sentence(s) read, 1 kept${neg}`);
  else add('INFO', 'dispatchContact', `no sentence about contacting Dispatch in the OFP Remarks${neg}: dispatchContact null`);
}

// An item's text lines after its SUBJECT row (the item's own text, §A.7).
const _companyBody = r => (r._subjectRow >= 0 ? r.text.split('\n').slice(r._subjectRow + 1) : r.text.split('\n'));
const _hasWord = s => /[A-Za-z0-9]/.test(s);

// One CURFEW item → { lines, notes, warns } (field map row 46; O-33 … O-36).
function _curfewOf(r, acftType, flightISO) {
  const notes = [], warns = [];
  const src = _companyBody(r).map(l => l.trim()).filter(_hasWord);
  // 1. The lines kept: windows (LCL bracket dropped, O-35), departure / arrival
  //    qualifiers (O-36) and season sub-headings (no digits).
  const kept = [];
  let season = null;
  for (const t of src) {
    const head = CURFEW.SEASON_HEAD.exec(t);
    if (head) { season = head[1]; kept.push({ text: t, kind: 'season', season }); continue; }
    if (CURFEW.WINDOW.test(t)) {
      const text = t.replace(CURFEW.LCL, '').trim();
      const sm = CURFEW.SEASON.exec(t);
      const lm = CURFEW.BY_LIST.exec(t);
      let kind = 'general', wording = null;
      if (lm) {
        const toks = lm[1].split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
        if (toks.length && toks.every(x => CURFEW_TYPE_NAMES.includes(x) || CURFEW.TYPE_TOKEN.test(x))) { kind = 'type'; wording = toks; }
        else if (toks.length && toks.every(x => CURFEW.REG_TOKEN.test(x))) kind = 'registration';
      }
      kept.push({ text, kind, wording, season: sm ? sm[1] : season, months: CURFEW.MONTHS.exec(t) });
      continue;
    }
    if (CURFEW.QUAL_FLOW.test(t) && CURFEW.QUAL_WORD.test(t) && !/\d/.test(t)) kept.push({ text: t, kind: 'qualifier' });
  }
  let out = kept;
  // 2. Lines by aircraft type (O-33, O-48): the line(s) with a token naming the OFP
  //    type (its family, or its variant); other type lines and registration lists
  //    out. None for the type → all + note.
  const byList = out.filter(x => x.kind === 'type' || x.kind === 'registration');
  if (byList.length) {
    const mine = out.filter(x => x.kind === 'type' && x.wording.some(tok => _curfewTypeMatch(tok, acftType)));
    if (mine.length) out = out.filter(x => (x.kind !== 'type' && x.kind !== 'registration') || mine.includes(x));
    else { notes.push(CURFEW_NOTES.type); warns.push(`no curfew line for aircraft type ${acftType || '(none read)'}; all lines shown with a note`); }
  }
  // 3. Seasons (O-34, SME-22a): each season's months must be stated; the month in
  //    which a stated season ends is a changeover month (both windows + note).
  const seasonal = out.filter(x => x.kind !== 'season' && x.season);
  if (seasonal.length) {
    const seasons = [...new Set(seasonal.map(x => x.season))];
    const range = {};
    for (const s of seasons) {
      const m = seasonal.find(x => x.season === s && x.months);
      if (m) range[s] = [MONTHS[m.months[1].slice(0, 3)], MONTHS[m.months[2].slice(0, 3)]];
    }
    const mo = /^\d{4}-(\d{2})-\d{2}$/.exec(flightISO || '');
    const month = mo ? +mo[1] - 1 : null;
    const readable = seasons.every(s => range[s]) && month !== null;
    const inRange = (r, m) => r[0] <= r[1] ? m >= r[0] && m <= r[1] : m >= r[0] || m <= r[1];
    if (!readable) {
      notes.push(CURFEW_NOTES.dates);
      warns.push(month === null && seasons.every(s => range[s]) ? 'no flight date read: the season in force cannot be chosen; all windows shown with a note'
        : `effective dates of ${seasons.join(' / ')} not stated; all windows shown with a note`);
    } else if (seasons.some(s => range[s][1] === month)) {
      notes.push(CURFEW_NOTES.changeover);
    } else {
      const now = seasons.filter(s => inRange(range[s], month));
      if (now.length === 1) out = out.filter(x => !x.season || x.season === now[0]);
      else { notes.push(CURFEW_NOTES.dates); warns.push(`the stated seasons do not give one season for the flight month; all windows shown with a note`); }
    }
    // A season sub-heading with no window left under it is dropped.
    out = out.filter((x, k) => x.kind !== 'season' || out.slice(k + 1).some(y => y.kind !== 'season' && y.season === x.season));
  }
  return { lines: out.map(x => x.text), notes, warns };
}

// Scope 2 (row 46; O-33 … O-37; SME-12, SME-22, SME-22a): a curfew is read only
// from an item whose subject is "IIII-CURFEW" (O-37); into airportData[IIII].curfew
// in NavBlue's form: the curfew lines, one per line, UTC only (O-35); notes last.
function _readCurfews(ctx) {
  const { out, add } = ctx;
  const recs = (ctx.company || []).filter(r => r.origin === 'COMPANY');
  for (const r of recs) {
    const m = /^([A-Z0-9]{4})-CURFEW$/.exec(r.subject);
    if (!m) {
      if (r.location !== 'GENERAL' && CURFEW.LIKE.test(_companyBody(r).join('\n')))
        add('INFO', 'airportData.curfew', `${r.location}: Company NOTAM ${r.id} (SUBJECT: ${r.subject}) reads like a curfew; not read as one: curfews come from the CURFEW key only`);
      continue;
    }
    const icao = m[1];
    const e = out.airportData[icao];
    if (!e) { add('INFO', 'airportData.curfew', `${icao}: CURFEW Company NOTAM ${r.id} for an airport with no airportData entry; kept in companyNotams[] only`); continue; }
    const cf = _curfewOf(r, out.acftType, out.flightDateISO);
    for (const w of cf.warns) add('WARN', 'airportData.curfew', `${icao} ${r.id}: ${w}`);
    const lines = [...cf.lines, ...cf.notes];
    if (!cf.lines.length) { add('WARN', 'airportData.curfew', `${icao} ${r.id}: CURFEW item with no curfew window read; see companyNotams[]`); if (!lines.length) continue; }
    e.curfew = e.curfew ? e.curfew + '\n' + lines.join('\n') : lines.join('\n');
    add('INFO', 'airportData.curfew', `${icao}: curfew read from Company NOTAM ${r.id} (${cf.lines.length} line(s)${cf.notes.length ? ', ' + cf.notes.length + ' note(s)' : ''})`);
  }
}

// O-38: the words of a text (letters and digits), capitals.
const _words = s => (String(s || '').toUpperCase().match(/[A-Z0-9]+/g) || []);

// Scope 3 (row 47; O-38, O-39; SME-18): one opsNotes { header, body } per airport
// that has an airportData entry: every Company item located at that airport
// (SUBJECT line + text), in printed order, except its CURFEW item(s) and the items
// that repeat the OFP Remarks (O-38: every content word of the item — subject and
// title words excluded — is in that airport's OFP Remarks). No entry is created.
function _readOpsNotes(ctx) {
  const { out, ext, add } = ctx;
  const by = new Map();
  for (const r of (ctx.company || []).filter(x => x.origin === 'COMPANY' && x.location !== 'GENERAL')) {
    const icao = r.location;
    if (/^[A-Z0-9]{4}-CURFEW$/.test(r.subject)) continue;
    const e = out.airportData[icao];
    if (!e) { add('INFO', 'airportData.opsNotes', `${icao}: Company NOTAM ${r.id} (SUBJECT: ${r.subject}) for an airport with no airportData entry; kept in companyNotams[] only`); continue; }
    // O-38 repeat check against the airport's OFP Remarks
    const rem = new Set();
    for (const x of e.remarks || []) _words([x.text, x.heading, x.subHeading].join(' ')).forEach(w => rem.add(w));
    for (const x of (ext.ofpRemarks || []).filter(y => y.airport === icao)) _words([x.text, x.subHeading].join(' ')).forEach(w => rem.add(w));
    const body = _companyBody(r).filter(_hasWord);
    const iata = e.briefing && e.briefing.iata;
    const titled = body.length && (body[0].includes(icao) || (iata && new RegExp(`\\b${iata}\\b`).test(body[0])));
    const skip = new Set([..._words(r.subject), ...(titled ? _words(body[0]) : [])]);
    const content = _words((titled ? body.slice(1) : body).join(' ')).filter(w => !skip.has(w));
    if (rem.size && content.length && content.every(w => rem.has(w))) {
      add('INFO', 'airportData.opsNotes', `${icao}: Company NOTAM ${r.id} (SUBJECT: ${r.subject}) repeats the OFP Remarks; not in opsNotes, kept in companyNotams[]`);
      continue;
    }
    if (!by.has(icao)) by.set(icao, []);
    by.get(icao).push(r);
  }
  for (const [icao, rs] of by) {
    const lines = [];
    for (const r of rs) lines.push(`SUBJECT: ${r.subject}`, ..._companyBody(r));
    out.airportData[icao].opsNotes = { header: `${icao} COMPANY NOTAMS`, body: lines.join('\n') };
  }
}

// §A.8: the FIR blocks of a NOTAM or Weather document — from the first FIR block
// after the airport blocks to the document end: [{ name, code, nameLine, body }].
function _firBlocksOf(doc) {
  const b = doc.blocks || _briefBlocks(doc.lines);
  if (!b.fir) return [];
  const out = [];
  let cur = null;
  for (let i = doc.lines.indexOf(b.fir.line); i < doc.lines.length; i++) {
    const l = doc.lines[i];
    if (_firBlockAt(doc.lines, i)) {
      cur = { name: l.text.trim(), code: PATTERNS.BR_FIR_CODE.exec(doc.lines[i + 1].text)[1], nameLine: l, body: [] };
      out.push(cur);
      i++;
      continue;
    }
    if (cur) cur.body.push(l);
  }
  return out;
}

// Scope 4 (row 49; §A.8; O-40, O-41; D64): the FIR blocks of the NOTAM Briefing.
//   firNotams[] — one record per printed FIR block, in route order: { name, code,
//     empty, items: [{ id, category, origin, text, source }] }; category = the printed
//     type heading (removed from the text); origin 'NOTAM', or 'COMPANY' for a Company
//     item keyed to this FIR (O-40; also in companyNotams[]). Repeats are kept (O-41).
//   firRaw[] — one record per printed FIR block: { name, code, raw }, raw = the block
//     exactly as printed (headings, items, empty-state box; D64). No Company item.
//   enrouteNotams.fir — the blocks with items, in route order: the block name, then
//     its items as printed (line breaks kept, no type heading), a Company item after
//     a "[COMPANY NOTAM]" line; blocks separated by a blank line. route, airway,
//     waypoint, geographic: '' (FlightKeys prints en-route NOTAMs per FIR only).
//   O-49 (Exec, 19 Nov): a FIR NOTAM printed under more than one FIR block (the same
//     ID and the same text) is kept only under the blocks whose FIR is on the OFP;
//     its other copies are left out of firNotams[] and enrouteNotams.fir. None of
//     its FIRs on the OFP → every copy left out. O-50 (Exec, 20 Nov): the departure
//     FIR — the first FIR block of the NOTAM Briefing — always counts as on the OFP,
//     whether or not the navigation log prints a line for it. One INFO lists every copy left
//     out. firRaw stays as printed (D64). A NOTAM printed under one block only
//     (twice in one block included) is unchanged.

// O-49: the FIRs on the OFP — the FIR lines of the release navigation log,
// "(IIII) <position or AT fix> <time> <FIR name>" (first release copy), and the
// FIRs of the ICAO FPL field 18 EET/ ("IIIIhhmm"). The departure FIR is printed
// in the navigation log only when the log prints its boundary; O-50: it counts as
// on the OFP all the same (_firRepeats).
const FIR_ON_OFP = Object.freeze({
  NAVLOG: /^\(([A-Z]{4})\)\s+\S/,
  EET:    /\b([A-Z]{4})\d{4}\b/g,
});
function _ofpFirs(ctx) {
  const nav = [], eet = [];
  for (const l of ctx.rel ? ctx.rel.lines : []) { const m = FIR_ON_OFP.NAVLOG.exec(l.trim()); if (m && !nav.includes(m[1])) nav.push(m[1]); }
  const e = ctx.fpl && ctx.fpl.found && ctx.fpl.other && typeof ctx.fpl.other.EET === 'string' ? ctx.fpl.other.EET : '';
  for (const m of e.matchAll(FIR_ON_OFP.EET)) if (!eet.includes(m[1])) eet.push(m[1]);
  return { nav, eet, all: new Set([...nav, ...eet]) };
}

// O-49: leave out the copies of a FIR NOTAM printed under more than one block
// whose FIR is not on the OFP and is not the departure FIR (O-50: the first FIR
// block of the NOTAM Briefing). recs: the FIR block records (items: origin NOTAM
// only at this point). Returns the copies left out: [{ id, name, code, all }].
function _firRepeats(ctx, recs) {
  const { add } = ctx;
  const groups = new Map();
  recs.forEach((b, bi) => b.items.forEach(it => {
    if (it.origin !== 'NOTAM' || !it.id) return;
    const k = it.id + '\n' + it.text;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ bi, it });
  }));
  const reps = [...groups.values()].filter(g => new Set(g.map(x => x.bi)).size > 1);
  if (!reps.length) return [];
  const firs = _ofpFirs(ctx);
  if (!firs.all.size) {
    add('WARN', 'enrouteNotams', `${reps.length} FIR NOTAM(s) printed under more than one FIR block, but no FIR of the OFP was read (navigation log FIR lines, FPL EET): every copy kept`);
    return [];
  }
  const dep = recs[0].code;   // O-50: the departure FIR, always on the OFP
  const out = [], drop = new Set();
  for (const g of reps) {
    const keep = g.filter(x => firs.all.has(recs[x.bi].code) || recs[x.bi].code === dep);
    for (const x of g) if (!keep.includes(x)) { drop.add(x.it); out.push({ id: x.it.id, name: recs[x.bi].name, code: recs[x.bi].code, all: !keep.length }); }
  }
  if (!out.length) return out;   // every copy under a FIR on the OFP: nothing left out, no finding
  for (const b of recs) b.items = b.items.filter(it => !drop.has(it));
  const ids = new Set(out.filter(x => x.all).map(x => x.id));
  add('INFO', 'enrouteNotams', `${reps.length} FIR NOTAM(s) printed under more than one FIR block; ${out.length} cop${out.length === 1 ? 'y' : 'ies'} left out of firNotams[] and enrouteNotams.fir (FIR not on the OFP and not the departure FIR ${dep}; OFP FIRs from the navigation log FIR lines and the FPL EET: ${[...firs.all].join(' ')}): ${out.map(x => `${x.id} under ${x.name} (${x.code})${x.all ? ' [all copies: none of its FIRs is on the OFP]' : ''}`).join('; ')}${ids.size ? `; ${ids.size} NOTAM(s) left out under every block` : ''}; firRaw as printed`);
  return out;
}

function _readFirs(ctx) {
  const { out, ext, add } = ctx;
  const docs = (ctx.briefDocs || []).filter(d => d.kind === 'NOTAM');
  const blocks = [];
  for (const d of docs) blocks.push(..._firBlocksOf(d));
  const recs = [];
  for (const b of blocks) {
    const nt = _briefNotams(ctx, b.code, b.body, 'enrouteNotams');
    const items = nt.items.map((it, k) => ({ id: it.id, category: it.category, origin: 'NOTAM', text: nt.texts[k], source: it.source }));
    recs.push({ name: b.name, code: b.code, empty: !items.length, items, raw: nt.notamsRaw });
  }
  const nItems = recs.reduce((n, x) => n + x.items.length, 0);   // as printed (before O-49)
  _firRepeats(ctx, recs);  // O-49
  // O-40: a general Company item keyed "IIII-…" where IIII is a FIR of this package.
  for (const r of (ctx.company || []).filter(x => x.origin === 'COMPANY' && x.location === 'GENERAL')) {
    const m = /^([A-Z]{4})-/.exec(r.subject);
    if (!m || COMPANY_NON_LOCATION_KEYS.includes(m[1])) continue;
    const fr = recs.filter(x => x.code === m[1]);
    if (!fr.length) {
      add('INFO', 'enrouteNotams', `Company NOTAM ${r.id} (SUBJECT: ${r.subject}) is keyed to ${m[1]}, which has no FIR block in the NOTAM Briefing; kept in companyNotams[] only`);
      continue;
    }
    for (const x of fr) { x.items.push({ id: r.id, category: '', origin: 'COMPANY', text: r.text, source: r.source }); x.empty = false; }
    add('INFO', 'enrouteNotams', `Company NOTAM ${r.id} (SUBJECT: ${r.subject}) also listed with FIR ${m[1]}, marked Company`);
  }
  ext.firNotams = recs.map(x => ({ name: x.name, code: x.code, empty: x.empty, items: x.items }));
  ext.firRaw = recs.map(x => ({ name: x.name, code: x.code, raw: x.raw }));
  const txt = [];
  const emptied = recs.filter(y => !y.empty && !y.items.length);   // O-49: every item a repeat left out
  if (emptied.length) add('INFO', 'enrouteNotams', `${emptied.length} FIR block(s) hold only repeats printed under another block and are left out of enrouteNotams.fir: ${emptied.map(x => x.code).join(', ')}`);
  for (const x of recs.filter(y => y.items.length)) {
    const ls = [`${x.name} (${x.code})`];
    for (const it of x.items) { if (it.origin === 'COMPANY') ls.push('[COMPANY NOTAM]'); ls.push(it.text); }
    txt.push(ls.join('\n'));
  }
  out.enrouteNotams = { route: '', fir: txt.join('\n\n'), airway: '', waypoint: '', geographic: '' };
  const empties = recs.filter(x => x.empty);
  if (!docs.length) add('WARN', 'enrouteNotams', 'no NOTAM Briefing document: FIR NOTAMs not read');
  else add('INFO', 'enrouteNotams', `${recs.length} FIR blocks in the NOTAM Briefing, ${nItems} FIR NOTAM items; route, airway, waypoint and geographic are empty: FlightKeys prints en-route NOTAMs per FIR only`);
  if (empties.length) add('INFO', 'enrouteNotams', `${empties.length} FIR block(s) print no active NOTAMs and are left out of enrouteNotams.fir: ${empties.map(x => x.code).join(', ')}`);
}

// Scope 6 (O-45): the Hazard Briefing per FIR block — { name, code, text, empty };
// text = the block exactly as printed (SIGMET sub-heading, products, empty-state
// box); never evaluated, never airport weather, weatherRaw or E-WINS; repeats kept.
function _readHazards(ctx) {
  const { ext, add } = ctx;
  const docs = (ctx.briefDocs || []).filter(d => d.kind === 'WX');
  const recs = [];
  for (const d of docs) for (const b of _firBlocksOf(d)) {
    const content = b.body.filter(l => !_isHeading(l) && !PATTERNS.BR_EMPTY_START.test(l.text.trim()) && !PATTERNS.BR_EMPTY_NIL.test(l.text.trim()) && !(l.indent > BRIEF.REPORT_MAX_INDENT && PATTERNS.BR_EMPTY_END.test(l.text.trim())));
    recs.push({ name: b.name, code: b.code, text: b.body.map(l => l.text).join('\n'), empty: !content.length });
  }
  ext.hazards = recs;
  if (docs.length) add('INFO', 'hazards', `${recs.length} FIR blocks in the Hazard Briefing (${recs.filter(x => x.empty).length} with no SIGMET); kept as printed, not evaluated`);
}

// v1.1.0 (O-169; D116, D88): the Volcanic Ash Advisories page → volcanicAsh { page, state, text,
// advisories[] }, extracted only — whether the crew is told is the advisory-rules engine's call.
// page = the PDF page of the VA document (the first, if FlightKeys ever prints more than one);
// text = its lines as printed (the RAW convention of notamsRaw / firRaw); state:
//   NONE       every VA document reads the closed "no advisories" form (VA_NONE)
//   ADVISORY   an advisory list: heading, INTERSECTS column, one list row per "VA ADVISORY" block, and
//              the volcano of every advisory readable (from its VOLCANO: line, else its list row)
//   UNREADABLE anything else (garbled, cut, unknown form); advisories[] keeps what could be read
// advisories[] = { volcano, vaac, number } per "VA ADVISORY" block, in printed order, each value as
// printed or null when not readable (the volcano without its volcano number; number "2026/370").
// No VA document → volcanicAsh null. Findings: INFO only (D92 shows parser WARNs to the crew; O-170).
function _readVolcanicAsh(ctx) {
  const { ext, add } = ctx;
  const docs = (ctx.briefDocs || []).filter(d => d.kind === 'VA');
  if (!docs.length) {
    if (ctx.briefDocs && ctx.briefDocs.length) add('INFO', 'volcanicAsh', 'no Volcanic Ash Advisories page in the briefing package: volcanicAsh null');
    return;
  }
  const advisories = [];
  const states = docs.map(d => {
    const ls = d.lines.map(l => l.text.trim()).filter(Boolean);
    if (PATTERNS.VA_NONE.test(ls.join(' ').replace(/\s+/g, ' '))) return 'NONE';
    const rows = ls.map(l => PATTERNS.VA_LIST_ROW.exec(l)).filter(Boolean);
    const starts = ls.map((l, k) => PATTERNS.VA_ADVISORY.test(l) ? k : -1).filter(k => k >= 0);
    const val = (re, a, b) => { for (let k = a; k < b; k++) { const m = re.exec(ls[k]); if (m) return m[1]; } return null; };
    const mine = starts.map((s, n) => {
      const e = n + 1 < starts.length ? starts[n + 1] : ls.length;
      const row = rows.length === starts.length ? rows[n] : null;
      return {
        volcano: val(PATTERNS.VA_VOLCANO, s, e) || (row ? row[2] : null),
        vaac: val(PATTERNS.VA_VAAC, s, e),
        number: val(PATTERNS.VA_NUMBER, s, e) || (row ? row[1] : null),
      };
    });
    advisories.push(...mine);
    const shaped = PATTERNS.VA_HEAD.test(ls[0] || '') && ls.some(l => PATTERNS.VA_INTERSECTS.test(l));
    return shaped && starts.length && rows.length === starts.length && mine.every(a => a.volcano) ? 'ADVISORY' : 'UNREADABLE';
  });
  const state = states.includes('UNREADABLE') ? 'UNREADABLE' : states.includes('ADVISORY') ? 'ADVISORY' : 'NONE';
  ext.volcanicAsh = { page: docs[0].first, state, text: docs.map(d => d.lines.map(l => l.text).join('\n')).join('\n'), advisories };
  const at = `Volcanic Ash Advisories page (PDF p${docs.map(d => d.first).join(', p')})`;
  const list = advisories.map(a => `${a.volcano || '(volcano not readable)'} (VAAC ${a.vaac || 'not readable'}, advisory ${a.number || 'number not readable'})`).join('; ');
  if (state === 'NONE') add('INFO', 'volcanicAsh', `${at}: no advisories for this flight`);
  else if (state === 'ADVISORY') add('INFO', 'volcanicAsh', `${at}: ${advisories.length} advisory(ies) listed: ${list}; kept as printed, not evaluated here`);
  else add('INFO', 'volcanicAsh', `${at}: not readable as the no-advisories form or an advisory list${advisories.length ? ` (read: ${list})` : ''}; kept as printed`);
}

// Scope 5 (row 42; SME-14 as amended by O-42, SME-20; O-43): the NAT track
// messages, complete across their pages. natMessages[] = every message: { tmi,
// direction, valid, parts, complete, pages, text, selected }. The message returned
// (natTrack, through the injected NAT parser): the flight's direction first, then
// the higher TMI (an unreadable TMI counts lowest, WARN). Only the opposite
// direction printed → that message, with a crew-alert WARN. The filed track is
// read from the OFP page 1 route and the ICAO FPL strip route only (O-43, O-47).
// v1.0.0 (O-68): the filed letter is worked out before the NAT call and passed to
// it with a findings array ({ filed, findings }); the NAT ruleset's findings
// (D79 NAT-FILED-NOT-IN-MESSAGE, D81 NAT-RANDOM-ROUTE, …) are forwarded into
// findings[] as the NAT ruleset gives them ({ level, field, code, message }).
const NAT_MSG = Object.freeze({
  PART:  /^\(NAT-(\d+)\/(\d+)\s+TRACKS\b/,
  END:   /\bEND OF PART\b.*\bPARTS?\)\s*$/,
  TMI:   /\bTMI\s+IS\s+(\d{3})\b/,
  EAST:  /^EAST LVLS\s+(.*)$/,
  WEST:  /^WEST LVLS\s+(.*)$/,
  FILED: /\bNAT([A-Z])\b/g,
  // O-47: the OFP page 1 route — from "IIII/Fnnn …" (the origin and initial level)
  // to the line before "Coldest Fuel Temp" (release page 1, first copy).
  P1_ROUTE_START: /^[A-Z]{4}\/[FA]\d{3}\s/,
  P1_ROUTE_END:   /^Coldest Fuel Temp\b/,
});
// O-47: the OFP page 1 route as one string, or null when not printed.
function _p1Route(p1) {
  const s = p1.findIndex(l => NAT_MSG.P1_ROUTE_START.test(l.trim()));
  if (s < 0) return null;
  const e = p1.findIndex((l, i) => i > s && NAT_MSG.P1_ROUTE_END.test(l.trim()));
  if (e < 0) return null;
  return p1.slice(s, e).map(l => l.trim()).join(' ');
}
// O-47: the NAT track letters a route names ("NATx"), in order, without repeats.
const _natLetters = route => (typeof route === 'string' ? [...new Set(Array.from(route.matchAll(NAT_MSG.FILED), m => m[1]))] : []);
function _readNat(ctx) {
  const { out, ext, add, fpl } = ctx;
  const lines = [];
  ctx.textPages.forEach((ls, i) => {
    if (!ls.length || !PATTERNS.SEC_NAT_PAGE.test(ls[0])) return;
    ls.slice(1).forEach(t => lines.push({ page: i + 1, text: t }));
  });
  // Parts: "(NAT-n/N TRACKS …" to "END OF PART … PARTS)".
  const parts = [];
  let cur = null, stray = 0;
  for (const l of lines) {
    const m = NAT_MSG.PART.exec(l.text.trim());
    if (m) { cur = { n: +m[1], N: +m[2], lines: [l], closed: false }; parts.push(cur); }
    else if (cur && !cur.closed) cur.lines.push(l);
    else if (l.text.trim()) stray++;
    if (cur && NAT_MSG.END.test(l.text.trim())) cur.closed = true;
  }
  if (stray) add('WARN', 'natTrack', `${stray} line(s) on the NAT-TRACKS pages outside a track message part; not read`);
  // Messages: parts 1 … N with the same N and validity line, in printed order.
  const msgs = [];
  for (const p of parts) {
    const valid = (p.lines[1] || { text: '' }).text.trim();
    const m = msgs[msgs.length - 1];
    if (p.n > 1 && m && m.N === p.N && m.valid === valid && m.parts.length === p.n - 1) m.parts.push(p);
    else msgs.push({ N: p.N, valid, parts: [p] });
  }
  ext.natMessages = msgs.map(m => {
    const ls = m.parts.flatMap(p => p.lines);
    const text = ls.map(l => l.text).join('\n');
    const tm = NAT_MSG.TMI.exec(text);
    let east = false, west = false;
    for (const l of ls) {
      const e = NAT_MSG.EAST.exec(l.text.trim()), w = NAT_MSG.WEST.exec(l.text.trim());
      if (e && !/^NIL\b/.test(e[1].trim())) east = true;
      if (w && !/^NIL\b/.test(w[1].trim())) west = true;
    }
    const complete = m.parts.length === m.N && m.parts.every((p, k) => p.n === k + 1 && p.closed);
    return { tmi: tm ? tm[1] : null, direction: east && !west ? 'EAST' : west && !east ? 'WEST' : null,
      valid: m.valid, parts: m.N, complete, pages: [ls[0].page, ls[ls.length - 1].page], text, selected: false };
  });
  const M = ext.natMessages;
  M.forEach((m, k) => {
    if (!m.complete) add('WARN', 'natTrack', `NAT message ${k + 1} (PDF p${m.pages[0]}-${m.pages[1]}): ${m.parts} part(s) expected, not all printed; kept as printed`);
    if (m.tmi === null) add('WARN', 'natTrack', `NAT message ${k + 1} (PDF p${m.pages[0]}-${m.pages[1]}): TMI not readable; counted as the lowest`);
    if (m.direction === null) add('WARN', 'natTrack', `NAT message ${k + 1} (PDF p${m.pages[0]}-${m.pages[1]}): direction (EAST / WEST levels) not readable`);
  });
  const nat = typeof ctx.opts.parseNatTrack === 'function' ? ctx.opts.parseNatTrack : null;
  if (!nat) { add('INFO', 'natTrack', 'NAT parser not supplied'); if (M.length) add('INFO', 'natTrack', `${M.length} NAT track message(s) read into natMessages[]`); return; }
  if (!M.length) return;
  // The flight's direction: the NAT parser's own (from the origin; null = not an Atlantic crossing).
  const probe = nat(M[0].text, out.origIcao, out.destIcao);
  if (!probe) { add('INFO', 'natTrack', `${M.length} NAT track message(s) in natMessages[]; the NAT parser reads ${out.origIcao}-${out.destIcao} as no Atlantic crossing: natTrack null`); return; }
  const dir = probe.flightDir;
  let cands = M.filter(m => m.direction === dir);
  if (!cands.length) {
    cands = M.slice();
    add('WARN', 'natTrack', `CREW ALERT: the package prints only the ${[...new Set(M.map(m => m.direction || 'unknown'))].join(' / ')} NAT track message (TMI ${M.map(m => m.tmi || '?').join(', ')}); none for this ${dir}BOUND flight. Returned so the crew can check it`);
  }
  const tmiNum = m => (m.tmi === null ? -1 : +m.tmi);
  const best = cands.reduce((a, b) => (tmiNum(b) > tmiNum(a) ? b : a), cands[0]);
  const same = cands.filter(m => m !== best && tmiNum(m) === tmiNum(best) && m.direction === best.direction && m.valid === best.valid);
  if (same.length) add('WARN', 'natTrack', `NAT message TMI ${best.tmi} printed ${same.length + 1} times with the same direction and validity; the first is returned`);
  best.selected = true;
  // O-43, O-47: the filed track from the OFP page 1 route and the ICAO FPL strip route
  // only (never remarks or NOTAM text). Both name one letter → that letter. Only one
  // names it → that one. They differ (or a route names two letters) → the FPL strip's
  // first letter (the plan filed with ATC) and a crew-alert WARN (open item O-50).
  // v1.0.0 (O-68): read before the NAT call, so the letter can be passed to it.
  const p1L = _natLetters(_p1Route(ctx.p1 || []));
  const fplL = _natLetters(fpl && fpl.found ? fpl.route : null);
  const src = [p1L.length ? 'OFP page 1 route' : '', fplL.length ? 'ICAO FPL route' : ''].filter(Boolean);
  const filed = fplL.length ? fplL[0] : p1L.length ? p1L[0] : null;
  const all = [...new Set([...p1L, ...fplL])];
  if (all.length > 1 || (p1L.length && fplL.length && p1L[0] !== fplL[0]))
    add('WARN', 'natTrack', `CREW ALERT: the filed NAT track differs: OFP page 1 route ${p1L.length ? p1L.map(x => 'NAT' + x).join(', ') : 'none'}, ICAO FPL route ${fplL.length ? fplL.map(x => 'NAT' + x).join(', ') : 'none'}; NAT${filed} (the FPL) is marked`);
  // O-68: the NAT call with { filed, findings }; the NAT findings forwarded as given.
  const natFindings = [];
  const r = nat(best.text, out.origIcao, out.destIcao, { filed, findings: natFindings });
  for (const f of natFindings) ctx.findings.push(f);
  if (r) {
    r.assignedId = filed;
    for (const b of r.blocks || []) for (const t of b.tracks || []) t.assigned = t.id === r.assignedId;
  }
  out.natTrack = r;
  add('INFO', 'natTrack', `${M.length} NAT track message(s); returned TMI ${best.tmi || '?'} (${best.direction || 'direction unknown'}, valid ${best.valid}) for this ${dir}BOUND flight; filed track ${r && r.assignedId ? `${r.assignedId} (${src.join(' and ')})` : 'none (random route: no NAT track in the OFP page 1 route or the ICAO FPL route)'}`);
}

// Rows 37, 38 (ADR-005 §2.6): sections[] from content — { id, title, startPage,
// endPage, anchor } with absolute PDF pages. The anchor is text printed on the
// start page. The release: the first copy only (§2.6.3; the copies are reported
// under 'release'). Bookmark names and order are confirmed by the Exec in the app
// (§2.6.5); here the sections are in page order.
function _readSections(ctx) {
  const secs = [];
  const sec = (id, title, startPage, endPage, anchor) => secs.push({ id, title, startPage, endPage, anchor });
  if (ctx.rel) sec('ofp', 'OFP', ctx.rel.pages[0].pdfPage, ctx.rel.pages[ctx.rel.pages.length - 1].pdfPage, 'OPERATIONAL FLIGHT PLAN');
  for (const d of ctx.briefDocs || []) {
    if (d.kind === 'HSCN') sec('hscn', 'High Severity Company NOTAMs', d.first, d.last, 'HIGH SEVERITY COMPANY NOTAMS');
    else if (d.kind === 'NOTAM') {
      const b = d.blocks || { airports: [] };
      const nb = b.airports.length ? b.airports[0].firstLine.page : null;
      if (PATTERNS.BR_CN_HEAD.test(d.lines[0].text.trim())) sec('companyNotams', 'Company NOTAMs', d.first, nb || d.last, 'COMPANY NOTAMS');
      if (nb) sec('notamBriefing', 'NOTAM Briefing', nb, d.last, 'APT' + b.airports[0].hdr.icao);
    } else if (d.kind === 'WX') {
      const b = d.blocks || { airports: [] };
      const hz = b.fir ? b.fir.line.page : null;
      if (b.airports.length) sec('weatherBriefing', 'Weather Briefing', b.airports[0].firstLine.page, hz || d.last, 'APT' + b.airports[0].hdr.icao);
      if (hz) sec('hazardBriefing', 'Hazard Briefing', hz, d.last, b.fir.line.text.trim());   // the first FIR block's name line
    } else if (d.kind === 'VA') sec('va', 'Volcanic Ash Advisories', d.first, d.last, 'VOLCANIC ASH');
  }
  // Text pages identified by their first line: NAT track message, charts (Jeppesen
  // attachments), TLR (first copy, as _tlrLines reads it).
  // The anchor is the heading that opens the run's first page ("NAT-TRACKS", "Chart Alert" / "+ JEPPESEN").
  const runs = (re, id, title) => {
    let s = null;
    ctx.textPages.forEach((ls, i) => {
      const hit = ls.length && re.test(ls[0]);
      if (hit && s === null) s = i;
      if ((!hit || i === ctx.textPages.length - 1) && s !== null) {
        const e = hit ? i : i - 1;
        sec(id, title, s + 1, e + 1, re.exec(ctx.textPages[s][0])[0]);
        s = null;
      }
    });
  };
  runs(PATTERNS.SEC_NAT_PAGE, 'nat', 'NAT Tracks');
  // O-44 (D42): PACOTS track messages are FIR NOTAM items whose text says "PACOTS
  // TRACKS" (anywhere, a wrapped headline included). One section per set: one
  // day's tracks, i.e. PACOTS items printed one after the other in one FIR block
  // with the same validity end (e.g. "… - 2026-Nov-04 21:00"). The anchor is the
  // set's first NOTAM ID. No track object (natTrack stays as read).
  let nPac = 0, nSets = 0;
  const endOf = t => { const m = /\d{4}-[A-Za-z]{3}-\d{1,2} \d{1,2}:\d{2}\s*-\s*(\d{4}-[A-Za-z]{3}-\d{1,2} \d{1,2}:\d{2}|UFN\S*)/.exec(t.split('\n')[0]); return m ? m[1] : null; };
  for (const b of ctx.ext.firNotams || []) {
    let set = null;
    for (const it of b.items) {
      const pac = it.origin === 'NOTAM' && /\bPACOTS\s+TRACKS\b/.test(it.text);
      if (!pac) { set = null; continue; }
      nPac++;
      const first = it.source[0].page, last = it.source[it.source.length - 1].page;
      const k = endOf(it.text);
      if (set && k && k === set.k) { set.sec.endPage = Math.max(set.sec.endPage, last); continue; }
      sec('pacots', 'PACOTS Tracks', first, last, it.id || 'PACOTS TRACKS');
      set = { k, sec: secs[secs.length - 1] };
      nSets++;
    }
  }
  if (nPac) ctx.add('INFO', 'sections', `${nPac} PACOTS track item(s) in ${nSets} set(s) in the NOTAM Briefing: a PACOTS section each; no NAT track object`);
  runs(PATTERNS.SEC_CHART_PAGE, 'charts', 'Charts');
  const tlr = _tlrPages(ctx);
  if (tlr) sec('tlr', 'Takeoff/Landing Report', tlr[0], tlr[1], 'TAKEOFF AND LANDING REPORT');
  secs.sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);
  ctx.ext.sections = secs;
}

// The PDF pages of the first TLR copy, found exactly as _tlrLines finds them.
function _tlrPages(ctx) {
  let next = 1, of = null, first = null, last = null;
  ctx.textPages.forEach((ls, i) => {
    if (of !== null && next > of) return;
    if (ls.length < 2 || !PATTERNS.TLR_PAGE_HDR.test(ls[0])) return;
    const fm = PATTERNS.TLR_PAGE_FOOTER.exec(ls[ls.length - 1]);
    if (!fm || +fm[1] !== next || (of !== null && +fm[2] !== of)) { if (first !== null) of = 0; return; }
    of = +fm[2];
    if (first === null) first = i + 1;
    last = i + 1;
    next++;
  });
  return first === null ? null : [first, last];
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
  list('EXTENSION_FIELDS', 20);
  list('AIRPORT_EXTENSION_FIELDS', 7);
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
      if (v !== 'open') errors.push(`DEFERRED_FIELDS.${k}: step '${v}' is not open`);
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
  CURFEW_TYPES, CURFEW_NOTES,   // v0.4.0: the O-33 / O-48 type table and the curfew notes (O-33, O-34)
};
return API;
});
