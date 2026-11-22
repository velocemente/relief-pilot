/**
 * advisory-rules.js — Volcanic ash and RAIM advisory rules  (v1.0.0)
 * ─────────────────────────────────────────────────────────────────
 * Standalone shared module (ADR-005 §2.1, §2.2; Exec answer O-173, 22 Nov
 * 2026): the interpretation of what an OFP prints about volcanic ash and RAIM.
 * D88: the format parsers only extract and normalise; the same content gives
 * the same result whatever the format. The app calls evaluateAdvisories() in
 * parseOFP() AFTER the format parser, on the parser's contract object, so the
 * NavBlue parser and its 30 golden snapshots are untouched (D47, D118).
 *
 * WHAT IT DECIDES (Exec answers O-169 … O-181; D115, D116):
 *   § 3  Volcanic ash (O-169, O-170, O-177, O-178, D116)
 *        - An advisory = the FlightKeys Volcanic Ash Advisories page with an
 *          actual advisory listed (volcanicAsh.state ADVISORY, ofp-flightkeys
 *          v1.1.0). The "no advisories" page is none.
 *        - A VA remark = an OFP remark that carries a term of the closed VA
 *          term list (VA_TERMS). It is NEGATIVE when, after every form of the
 *          closed negative list (VA_NEGATIVE_FORMS) is taken out, no VA term is
 *          left; otherwise POSITIVE.
 *        - An advisory is linked to a positive remark that names its volcano.
 *        - Advisory + linked remark → WARN VA_WARN.ADVISORY (D116).
 *          Advisory, no linked remark → nothing (O-170, Exec-decided).
 *          Positive remark not linked to an advisory (no page, NONE page, an
 *          UNREADABLE page, or another volcano) → WARN VA_WARN.ROUTING (O-177).
 *   § 4  RAIM (O-171, D115)
 *        - Any PASSED form printed (plain or ETOPS ALTN) → no RAIM output for
 *          the flight, even if another RAIM remark is printed too (Exec-decided).
 *        - No PASSED form + any other RAIM remark (outage, unreadable, unknown
 *          form) → a RAIM attention record per remark, text as printed. Never an
 *          OFP Alerts line (O-171).
 *   § 5  Volcanic FIR items (O-180): the FIR NOTAMs (ASHTAM included) and the FIR
 *        hazards whose text carries a term of the same closed list are flagged,
 *        "no ash cloud" items too; the display opens their groups by default.
 *   § 6  The OFP Remarks group flag (O-179): a positive VA remark or a RAIM
 *        attention record.
 *
 * NOT IN THIS MODULE — reading the page or the remarks (ofp-flightkeys), the
 * display (the integration PR), the 1.10.0 open conditions of the OFP Remarks
 * group (O-181: the display keeps them), the Dispatch contact (D131, O-173).
 * NOT BUILT INTO index.html (D90): rules/advisory-rules-next until the
 * integration PR.
 *
 * DUAL CONTEXT
 *   Node / rules-loader: module.exports = the API object below.
 *   Browser (a plain script): no `module` → the API object is published once as
 *   the global AdvisoryRules. Every declaration stays in the factory scope. No
 *   window, no DOM, no storage, no clock, no app state, no network.
 *
 * All times are UTC; the module reads no time.
 * ─────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.AdvisoryRules = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · RULESET SCHEMA IDENTITY
// ═══════════════════════════════════════════════════════════════

var RULESET_TYPE    = 'advisory-rules';
var RULESET_VERSION = '1.0.0';
var SCHEMA_VERSION  = 1;
var RULESET_SOURCE  = 'Exec answers O-169 … O-181 (22 Nov 2026), D115, D116; the OFP contract of ofp-flightkeys v1.1.0 (contract 2.5: volcanicAsh, ofpRemarks raim, firNotams, hazards) and of the locked NavBlue parser (no such fields)';

// ═══════════════════════════════════════════════════════════════
// § 2 · CLOSED LISTS AND CREW TEXTS
// ═══════════════════════════════════════════════════════════════

// The VA term list (O-177, O-180): one list for the remarks, the FIR NOTAMs and
// the hazards. "VA" counts in capitals only (a word of its own); the other terms
// in any case, as whole words. Adding a term later is safe; a term is never
// taken out to quiet an item.
var VA_TERMS = Object.freeze([
  { term: 'VA',        re: /\bVA\b/ },
  { term: 'VOLCANO',   re: /\bvolcano(?:es)?\b/i },
  { term: 'VOLCANIC',  re: /\bvolcanic\b/i },
  { term: 'ASH',       re: /\bash\b/i },
  { term: 'ASHTAM',    re: /\bashtam\b/i },
  { term: 'ERUPTION',  re: /\beruptions?\b/i },
  { term: 'VAAC',      re: /\bvaac\b/i },
]);
// The closed negative list (O-177): a remark form that says the flight is NOT
// affected. Only the form seen in the corpus (L14). Matched as whole words,
// line breaks and runs of spaces read as one space, a full stop after it allowed.
var VA_NEGATIVE_FORMS = Object.freeze([
  'NO VA ACTIVITY AFFECTING FLIGHT',
]);
// O-171: the closed list of the RAIM PASSED forms (the two seen in both corpora).
var RAIM_PASSED_FORMS = Object.freeze([
  /^RAIM VALIDATION PASSED$/,
  /^RAIM VALIDATION FOR ETOPS ALTN [A-Z]{4} PASSED$/,
]);
// The OFP remarks never read for a VA term: the dispatcher line (a name), the
// FlightKeys boilerplate (fixed text), the CDC attestation (signatures) and the
// RAIM remarks (§ 4).
var VA_SKIPPED_CATEGORIES = Object.freeze(['dispatcher', 'boilerplate', 'cdcAttestation', 'raim']);
// O-178 (Exec, 22 Nov): the crew texts, exact (capitals, en dash, no full stop; D79). No
// internal reference (D103) and no version number (D99).
var VA_WARN = Object.freeze({
  ADVISORY: 'VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB',
  ROUTING:  'VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE',
});
// The findings this module adds. Every entry: { level, field: 'volcanicAsh', code, message }.
var FINDING_CODES = Object.freeze({
  'VA-ADVISORY-REMARK': 'WARN',   // D116: an advisory with a linked OFP remark
  'VA-REMARK-ROUTING':  'WARN',   // O-177: a positive VA remark with no linked advisory
});

// A text as one line: line breaks and runs of white space → one space; capitals.
function _flat(s) { return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function _escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// The VA terms a text carries, in list order (the case rule of each term applies to
// the text as printed, line breaks read as spaces).
function vaTerms(text) {
  var t = String(text || '').replace(/\s+/g, ' ');
  return VA_TERMS.filter(function (x) { return x.re.test(t); }).map(function (x) { return x.term; });
}

// ═══════════════════════════════════════════════════════════════
// § 3 · VOLCANIC ASH
// ═══════════════════════════════════════════════════════════════

// A VA remark → POSITIVE / NEGATIVE / null (no VA term).
function remarkPolarity(text) {
  if (!vaTerms(text).length) return null;
  var t = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' ';
  VA_NEGATIVE_FORMS.forEach(function (f) {
    t = t.replace(new RegExp('(^|[^A-Za-z0-9])' + _escRe(f).replace(/ /g, '\\s+') + '\\.?(?=[^A-Za-z0-9]|$)', 'g'), '$1 ');
  });
  return vaTerms(t).length ? 'POSITIVE' : 'NEGATIVE';
}
// Does a remark name the volcano? Whole words, any case, line breaks read as spaces.
function namesVolcano(text, volcano) {
  var v = _flat(volcano);
  if (!v) return false;
  return new RegExp('(^|[^A-Z0-9])' + _escRe(v) + '(?=[^A-Z0-9]|$)').test(_flat(text));
}

function _volcanicAsh(ofp, add) {
  var page = ofp && ofp.volcanicAsh && typeof ofp.volcanicAsh === 'object' ? ofp.volcanicAsh : null;
  var state = page ? page.state : null;
  var remarks = [];
  (Array.isArray(ofp && ofp.ofpRemarks) ? ofp.ofpRemarks : []).forEach(function (r, i) {
    if (!r || typeof r.text !== 'string' || VA_SKIPPED_CATEGORIES.indexOf(r.category) >= 0) return;
    var pol = remarkPolarity(r.text);
    if (pol) remarks.push({ index: i, text: r.text, page: r.page, line: r.line, polarity: pol, terms: vaTerms(r.text), advisories: [] });
  });
  var advisories = (page && Array.isArray(page.advisories) ? page.advisories : []).map(function (a, k) {
    return { index: k, volcano: a.volcano || null, vaac: a.vaac || null, number: a.number || null, remarks: [] };
  });
  // O-169: the link is by volcano name, from a POSITIVE remark, on an ADVISORY page only
  // (an UNREADABLE page links nothing: its positive remarks are O-177 routing remarks).
  if (state === 'ADVISORY') {
    remarks.forEach(function (r) {
      if (r.polarity !== 'POSITIVE') return;
      advisories.forEach(function (a) {
        if (a.volcano && namesVolcano(r.text, a.volcano)) { a.remarks.push(r.index); r.advisories.push(a.index); }
      });
    });
  }
  var noted = advisories.some(function (a) { return a.remarks.length > 0; });
  var routing = remarks.some(function (r) { return r.polarity === 'POSITIVE' && !r.advisories.length; });
  if (noted) add('WARN', 'VA-ADVISORY-REMARK', VA_WARN.ADVISORY);
  if (routing) add('WARN', 'VA-REMARK-ROUTING', VA_WARN.ROUTING);
  return {
    state: state,                               // null (no page), NONE, ADVISORY, UNREADABLE
    page: page ? page.page : null,
    advisories: advisories,                     // with the indexes of their linked remarks
    remarks: remarks,                           // every VA remark, POSITIVE or NEGATIVE
    noted: noted,                               // D116: an advisory with a linked remark
    routing: routing,                           // O-177: a positive remark with no linked advisory
  };
}

// ═══════════════════════════════════════════════════════════════
// § 4 · RAIM
// ═══════════════════════════════════════════════════════════════

function isRaimPassed(text) {
  var t = String(text || '').trim();
  return RAIM_PASSED_FORMS.some(function (re) { return re.test(t); });
}

function _raim(ofp) {
  var records = [];
  (Array.isArray(ofp && ofp.ofpRemarks) ? ofp.ofpRemarks : []).forEach(function (r, i) {
    if (r && r.category === 'raim' && typeof r.text === 'string') records.push({ index: i, text: r.text, page: r.page, line: r.line, passed: isRaimPassed(r.text) });
  });
  var passed = records.some(function (r) { return r.passed; });
  return {
    passed: passed,                             // a PASSED form printed → no RAIM output (O-171)
    records: records,
    attention: passed ? [] : records.map(function (r) { return { text: r.text, page: r.page, line: r.line }; }),
  };
}

// ═══════════════════════════════════════════════════════════════
// § 5 · VOLCANIC FIR ITEMS (O-180)
// ═══════════════════════════════════════════════════════════════

// A SIGMET product of a hazard block starts at "<id> SIGMET <n> VALID …"; any product
// (SIGMET, AIRMET "<id> WA <ddhhmm>", TWC) ends the one before it.
var SIGMET_START  = /^\S+ SIGMET\b.*\bVALID\b/;
var PRODUCT_START = /^(?:\S+ SIGMET\b.*\bVALID\b|TWC\b|\S+ WA \d{6}\b|\S+ AIRMET\b)/;
function vaSigmetCount(text) {
  var n = 0, cur = null;
  var done = function () { if (cur !== null && vaTerms(cur).length) n++; };
  String(text || '').split('\n').forEach(function (l) {
    var t = l.trim();
    if (PRODUCT_START.test(t)) { done(); cur = SIGMET_START.test(t) ? t : null; return; }
    if (cur !== null) cur += '\n' + t;
  });
  done();
  return n;
}

function _volcanicFir(ofp) {
  var notams = [], hazards = [];
  (Array.isArray(ofp && ofp.firNotams) ? ofp.firNotams : []).forEach(function (b, i) {
    (b && Array.isArray(b.items) ? b.items : []).forEach(function (it, k) {
      var terms = vaTerms(it && it.text);
      if (terms.length) notams.push({ fir: b.code, name: b.name, block: i, item: k, id: it.id || null, origin: it.origin || null, terms: terms });
    });
  });
  (Array.isArray(ofp && ofp.hazards) ? ofp.hazards : []).forEach(function (h, i) {
    var terms = vaTerms(h && h.text);
    if (terms.length) hazards.push({ fir: h.code, name: h.name, index: i, vaSigmets: vaSigmetCount(h.text), terms: terms });
  });
  var uniq = function (a) { return a.filter(function (x, k) { return a.indexOf(x) === k; }); };
  return {
    notams: notams,                             // flagged FIR NOTAM items (ASHTAM included)
    hazards: hazards,                           // flagged hazard blocks
    notamFirs: uniq(notams.map(function (x) { return x.fir; })),     // groups to open by default
    hazardFirs: uniq(hazards.map(function (x) { return x.fir; })),
  };
}

// ═══════════════════════════════════════════════════════════════
// § 6 · ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * evaluateAdvisories(ofp) → { volcanicAsh, raim, volcanicFir, openOfpRemarks, findings }
 *
 * ofp – the format parser's contract object (ofp-flightkeys v1.1.0, or the NavBlue
 *       parser: its missing volcanicAsh / ofpRemarks / firNotams / hazards read as
 *       empty, D118). Never changed.
 * findings – the crew WARNs (OFP Alerts), { level, field: 'volcanicAsh', code, message };
 *       at most one per code. RAIM adds none (O-171).
 * openOfpRemarks – O-179: a positive VA remark or a RAIM attention record.
 * null / not an object → null.
 */
function evaluateAdvisories(ofp) {
  if (!ofp || typeof ofp !== 'object') return null;
  var findings = [];
  var add = function (level, code, message) { findings.push({ level: level, field: 'volcanicAsh', code: code, message: message }); };
  var va = _volcanicAsh(ofp, add);
  var raim = _raim(ofp);
  var positive = va.remarks.some(function (r) { return r.polarity === 'POSITIVE'; });
  return {
    volcanicAsh: va,
    raim: raim,
    volcanicFir: _volcanicFir(ofp),
    openOfpRemarks: positive || raim.attention.length > 0,
    findings: findings,
  };
}

// ═══════════════════════════════════════════════════════════════
// § 7 · SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════

var REQUIRED_EXPORTS = {
  RULESET_TYPE: 'string', RULESET_VERSION: 'string', SCHEMA_VERSION: 'number', RULESET_SOURCE: 'string',
  evaluateAdvisories: 'function', validateSchema: 'function', FINDING_CODES: 'object', VA_TERMS: 'object',
  VA_NEGATIVE_FORMS: 'object', RAIM_PASSED_FORMS: 'object', VA_WARN: 'object',
};
// No parser and no app logic belongs to this module.
var FORBIDDEN_EXPORTS = ['parseFlightKeys', 'parseNavBlue', 'parseOFP', '_ofpRulesetParse', 'parseNatTrack'];

function validateSchema(ruleset) {
  var r = ruleset === undefined ? API : ruleset;
  var errors = [];
  if (!r || typeof r !== 'object') return { valid: false, errors: ['ruleset is not an object'] };
  Object.keys(REQUIRED_EXPORTS).forEach(function (k) {
    if (!(k in r)) errors.push('missing export: ' + k);
    else if (typeof r[k] !== REQUIRED_EXPORTS[k] || r[k] === null) errors.push(k + ' must be a ' + REQUIRED_EXPORTS[k]);
  });
  FORBIDDEN_EXPORTS.forEach(function (k) { if (k in r) errors.push(k + ' must not be exported'); });
  if (r.RULESET_TYPE !== 'advisory-rules') errors.push("RULESET_TYPE must be 'advisory-rules'");
  if (typeof r.RULESET_VERSION === 'string' && !/^\d+\.\d+\.\d+$/.test(r.RULESET_VERSION)) errors.push('RULESET_VERSION is not semver');
  var msgs = r.VA_WARN && typeof r.VA_WARN === 'object' ? Object.keys(r.VA_WARN).map(function (k) { return r.VA_WARN[k]; }) : [];
  msgs.forEach(function (m) {
    if (typeof m !== 'string' || m !== m.toUpperCase() || /\.$/.test(m) || m.indexOf('–') < 0) errors.push('VA_WARN text not in the alert style (capitals, en dash, no full stop): ' + m);
    if (/\b[OD]-?\d|\bSME-|\bv?\d+\.\d+\.\d+\b/.test(m)) errors.push('VA_WARN text carries an internal reference or a version: ' + m);
  });
  if (r.FINDING_CODES && typeof r.FINDING_CODES === 'object') {
    Object.keys(r.FINDING_CODES).forEach(function (k) { if (r.FINDING_CODES[k] !== 'WARN' && r.FINDING_CODES[k] !== 'INFO') errors.push('FINDING_CODES.' + k + ' must be WARN or INFO'); });
  }
  return { valid: errors.length === 0, errors: errors };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

var API = {
  RULESET_TYPE: RULESET_TYPE, RULESET_VERSION: RULESET_VERSION, SCHEMA_VERSION: SCHEMA_VERSION, RULESET_SOURCE: RULESET_SOURCE,
  validateSchema: validateSchema,
  evaluateAdvisories: evaluateAdvisories,   // (ofp) → { volcanicAsh, raim, volcanicFir, openOfpRemarks, findings } | null
  remarkPolarity: remarkPolarity,           // (text) → 'POSITIVE' | 'NEGATIVE' | null
  namesVolcano: namesVolcano,               // (text, volcano) → boolean
  isRaimPassed: isRaimPassed,               // (text) → boolean
  vaTerms: vaTerms,                         // (text) → the VA terms it carries
  vaSigmetCount: vaSigmetCount,             // (hazard text) → the number of SIGMETs with a VA term
  FINDING_CODES: FINDING_CODES, VA_TERMS: VA_TERMS, VA_NEGATIVE_FORMS: VA_NEGATIVE_FORMS,
  RAIM_PASSED_FORMS: RAIM_PASSED_FORMS, VA_WARN: VA_WARN, VA_SKIPPED_CATEGORIES: VA_SKIPPED_CATEGORIES,
};
return API;
});
