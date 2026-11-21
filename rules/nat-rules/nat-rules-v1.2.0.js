/**
 * nat-rules.js — NAT track message ruleset  (v1.2.0)
 * ─────────────────────────────────────────────────────────────────
 * Standalone module (ADR-005 §2.1, §2.2; Exec answer O-63, 19–20 Nov 2026):
 * the Atlantic NAT track parser, for both OFP formats.
 *
 *   NavBlue / eOFP (the whole OFP text)
 *     § 3  _parseOfpText() — verbatim from src/nat.html v1.1.0 parseNatTrack()
 *          (lines 59–184). One edit, marked "v1.2.0": a gapped level list is
 *          returned as posted ("FL360 380 400"), not as the range of its first and
 *          last level ("FL360–400") — Exec answer O-65, the only permitted change of
 *          the NavBlue output. A contiguous list (every 10) is still "FL340–400".
 *          The filed track is still read from the CO ROUTE line, as in v1.1.0.
 *   FlightKeys (one NAT track message)
 *     § 4  _parseMessage() — a track message as FlightKeys prints it on its
 *          NAT-TRACKS pages ("(NAT-1/3 TRACKS …" … "END OF PART … PARTS)"), after
 *          ofp-flightkeys has chosen it (flight's direction first, then the higher
 *          TMI; D74). The result has the shape of the NavBlue natTrack (O-62).
 *          The filed track letter is passed in (options.filed, O-57); the parser
 *          never reads a route, remarks or NOTAM text for it (O-58).
 *
 * NOT IN THIS MODULE — the renderer (src/nat.html renderNatTrack, display at
 * step 5e), the choice of the message, the filed track letter (ofp-flightkeys:
 * OFP page 1 route + ICAO FPL route), the validity check (O-60, deferred).
 *
 * DUAL CONTEXT
 *   Node / rules-loader: module.exports = the API object below.
 *   Browser (a plain script): no `module` → the API object is published once as
 *   the global NatRules. Every declaration stays in the factory scope. No window,
 *   no DOM, no storage, no app state, no network.
 * ─────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.NatRules = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · RULESET SCHEMA IDENTITY
// ═══════════════════════════════════════════════════════════════

var RULESET_TYPE    = 'nat-rules';
var RULESET_VERSION = '1.2.0';
var SCHEMA_VERSION  = 1;
var RULESET_SOURCE  = 'NAT OTS track message, ICAO NAT Doc 007 (message layout) and the OFP track blocks of NavBlue / eOFP / FlightKeys as carried in the PilotBrief fixtures';

// The findings the parser can add (options.findings, § 2). Every entry has
// { level, field: 'natTrack', code, message }.
var FINDING_CODES = Object.freeze({
  'NAT-FILED-NOT-IN-MESSAGE': 'WARN',   // O-59: the filed letter is not printed in the chosen message
  'NAT-NO-TRACKS':            'WARN',   // the message has no readable track
  'NAT-TRACK-UNREADABLE':     'WARN',   // a track line that is not read (no levels, one waypoint, no direction)
  'NAT-WAYPOINT-UNREAD':      'WARN',   // a token that is neither a fix nor a coordinate; kept as printed
  'NAT-TRACK-DUPLICATE':      'WARN',   // the same track letter twice in one message
  'NAT-MULTI-MESSAGE':        'WARN',   // the input holds more than one message; the first is read
  'NAT-RANDOM-ROUTE':         'INFO',   // O-61: no filed track letter; no track marked
  'NAT-FILED-IGNORED':        'INFO',   // options.filed is not one letter A–Z
  'NAT-VALIDITY-UNREADABLE':  'INFO',   // the validity line is not read (O-60: never a WARN)
  'NAT-REMARKS-DIRECTION':    'INFO'    // the message's direction is not readable: remarks under the flight's direction
});

// ═══════════════════════════════════════════════════════════════
// § 2 · COMMON
// ═══════════════════════════════════════════════════════════════

// ICAO prefix → region sets (O-66: the Atlantic test stays NAM ↔ EUR by ICAO prefix)
var NAM = /^(?:K|CY|PA|TJ|MD|MH)/;
var EUR = /^(?:EG|EI|EH|EK|EN|EB|ED|ET|LF|LE|LP|LI|LO|EF|EE|EV|EY|ES|EP|LR|LK|LZ|LH|LD|LQ|BI|UG)/;

// Levels as posted (O-65). A list of levels every 10 is the range "FL340–400" (as
// v1.1.0 gave for every list); a list with a gap is the list as posted, "FL360 380 400".
// One level: "FL340". `levels`: strings or numbers.
function levelText(levels) {
  var v = levels.map(function (x) { return String(x); });
  if (!v.length) return '';
  if (v.length === 1) return 'FL' + v[0];
  var contiguous = true;
  for (var i = 1; i < v.length; i++) if (+v[i] - +v[i - 1] !== 10) { contiguous = false; break; }
  return contiguous ? 'FL' + v[0] + '–' + v[v.length - 1] : 'FL' + v.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// § 3 · NAVBLUE / eOFP — verbatim from src/nat.html v1.1.0 (one edit, marked)
// ═══════════════════════════════════════════════════════════════

function _parseOfpText(t, origIcao, destIcao) {
    var trackType = 'NAT';

    // Flight direction: NAM→EUR = EAST, EUR→NAM = WEST
    var flightDir = NAM.test(origIcao) ? 'EAST' : 'WEST';

    // Locate track block — broadened for Atlas Air header variations
    var BLOCK_HDR = /(?:(?:EAST|WEST)BOUND\s+NAT\s+TRACKS?|(?:EAST|WEST)\s+BOUND\s+NAT\s+TRACKS?|NAT\s+TRACK\s+MESSAGE|ORGANIZED\s+TRACK\s+SYSTEM|OCEANIC\s+TRACK\s+MESSAGE|NAT\s+OTS)/i;
    var bIdx = t.search(BLOCK_HDR);
    var rawBlock = bIdx > -1
      ? t.slice(bIdx, bIdx + 18000).replace(/^(?:ATLAS AIR BRIEF )?PAGE \d+ OF \d+\s*$/mg, '')
      : '';

    // TMI — Atlas format: "EAST BOUND NAT TRACKS TMI 071"
    var tmiHdrM  = rawBlock.match(/(?:EAST|WEST)\s+BOUND\s+NAT\s+TRACKS?\s+TMI\s+(\d{2,4})/i);
    var tmiBodyM = !tmiHdrM && rawBlock.match(/TMI(?:\s+IS)?\s*[:\s#]*(\d{2,4})/i);
    var tmiFullM = !tmiHdrM && !tmiBodyM && t.match(/TMI(?:\s+IS)?\s*[:\s#]*(\d{2,4})/i);
    var tmi = (tmiHdrM || tmiBodyM || tmiFullM) ? (tmiHdrM || tmiBodyM || tmiFullM)[1] : null;

    // Filed track ID — scoped to CO ROUTE line only to suppress NOTAM false positives
    // (e.g. CZQM "HOIST TRACK T", ZBW "NAT TFC")
    var preBlock = bIdx > 0 ? t.slice(0, bIdx) : t.slice(0, 4000);
    var coRouteM = preBlock.match(/CO\s+ROUTE[^\n]*\n([\s\S]*?)(?=\n\s*\n|\n[A-Z]{4}\/[A-Z]{3}\b|\nFMC\b|\nColdest\b)/i);
    var routeStr = coRouteM ? coRouteM[1] : '';
    var assignedM = routeStr.match(/\bNAT\s*([A-Z])\b/i)
                 || preBlock.match(/\bASSIGNED\s+(?:NAT\s+)?TRACK[:\s]+([A-Z])\b/i);
    var assignedId = assignedM ? assignedM[1].toUpperCase() : null;

    // Comment sections — "EAST/WEST BOUND NAT TRACK COMMENTS:" blocks
    var eastCmtM = rawBlock.match(/EAST\s+BOUND\s+NAT\s+TRACK\s+COMMENTS?\s*:?([\s\S]*?)(?=WEST\s+BOUND\s+NAT\s+TRACKS?\b|$)/i);
    var westCmtM = rawBlock.match(/WEST\s+BOUND\s+NAT\s+TRACK\s+COMMENTS?\s*:?([\s\S]*?)(?=EAST\s+BOUND\s+NAT\s+TRACKS?\b|$)/i);
    var eastComments = eastCmtM ? eastCmtM[1].trim().replace(/-\s*$/, '').trim() : '';
    var westComments = westCmtM ? westCmtM[1].trim().replace(/-\s*$/, '').trim() : '';

    // Split rawBlock at each direction heading — parse independently.
    // Handles both "EAST BOUND NAT TRACKS" and "EASTBOUND NAT TRACKS" (Atlas Air).
    var DIR_SPLIT_RE = /(?=(?:EAST|WEST)BOUND\s+NAT\s+TRACKS?|(?:EAST|WEST)\s+BOUND\s+NAT\s+TRACKS?)/gi;
    var dirSections = rawBlock.split(DIR_SPLIT_RE).filter(function (s) { return /\S/.test(s); });

    // ── Parse one direction section into an array of track objects ──────
    function parseSection(section) {
      var tracks = [];
      // Matches "NAT V" (Atlas format) and "TRACK A" (generic ICAO format)
      var HDR_RE = /^\s*(?:NAT\s+([A-Z])|TRACK\s+([A-Z]))\b/gm;
      var tm;
      while ((tm = HDR_RE.exec(section)) !== null) {
        var id = (tm[1] || tm[2]).toUpperCase();
        var after = section.slice(tm.index, tm.index + 1000);

        // Waypoints — "WPTS:" label (Atlas NAT format)
        var wpts = [];
        var wptSrcM = after.match(/WPTS?:\s*([\s\S]*?)(?=\r?\n(?:ENT|EXIT|CMTS?|RTE|TRACK\s+[A-Z]|NAT\s+[A-Z]|EAST|WEST)|$)/i);
        var wptSrc = wptSrcM
          ? wptSrcM[1]
          : after.split('\n').slice(1, 5).join(' ');

        // WPT_RE: named fixes + all oceanic coordinate formats
        // Matches: RIKAL, 53N050W, 5530N, 57N020W, N5700W02000, 5700N02000W
        var WPT_RE = /\b([A-Z]{3,5}|\d{2}[NS]\d{3}[EW]|\d{4}N|\d{2}[NS]\d{2}[EW]|N\d{2}[EW]\d{3}|\d{4}[NS]\d{5}[EW])\b/g;
        var wm;
        // Reserved keyword filter — prevents meta-labels from entering waypoint list
        var RESERVED = /^(?:TRACK|PAC|NAT|MACH|VALID|EAST|WEST|FROM|THRU|THEN|TMI|NOTE|RMKS?|WPTS?|CMTS?|ENT|EXIT|RTE|TRK|ATM|NOT|AVBL|ONLY|ACFT)$/;
        while ((wm = WPT_RE.exec(wptSrc)) !== null) {
          var tok = wm[1];
          if (RESERVED.test(tok)) continue;
          wpts.push(tok);
        }

        // FL: range "FL340-400" OR space-separated list "FL : 340 350 360 370 380 390 400"
        var fl = '';
        var flRangeM = after.match(/FL[:\s]*(\d{2,3})\s*[\/\-\u2013]\s*(\d{2,3})/i);
        if (flRangeM) {
          fl = 'FL' + flRangeM[1] + '\u2013' + flRangeM[2];
        } else {
          var flListM = after.match(/FL\s*:\s*((\d{3})\s+(?:\d{3}\s+)*(\d{3}))/i);
          if (flListM) {
            fl = levelText(flListM[1].split(/\s+/));   // v1.2.0 (O-65): a gapped list is posted as is; v1.1.0: 'FL' + first + '\u2013' + last
          } else {
            var flSingleM = after.match(/\bFL\s*(\d{2,3})\b/i);
            if (flSingleM) fl = 'FL' + flSingleM[1];
          }
        }

        var machM = after.match(/MACH[:\s]*\.?(\d{2})/i) || after.match(/M\.(\d{2})/i);
        var mach = machM ? 'M.' + machM[1] : '';

        // Validity: "VALID FROM: 03/12-0100 TO: 03/12-0800" or "1200Z–2000Z"
        var valM = after.match(/(?:VALID\s+FROM[:\s]*)(\S+)\s+TO[:\s]*(\S+)/i)
                || after.match(/(?:VALID[:\s]*)(\d{4}Z?)\s*[\/\-\u2013]\s*(\d{4}Z?)/i);
        var valid = valM ? (valM[1] + '\u2013' + valM[2]) : '';

        if (wpts.length >= 2) {
          tracks.push({ id: id, waypoints: wpts, fl: fl, mach: mach, valid: valid, assigned: id === assignedId });
        }
      }
      return tracks;
    }

    // Build direction blocks — deduplicate, flight direction sorted first
    var blocks = [];
    for (var i = 0; i < dirSections.length; i++) {
      var section = dirSections[i];
      var dirM = section.match(/^(EAST|WEST)(?:BOUND|\s+BOUND)/i);
      var secDir = dirM ? dirM[1].toUpperCase() : null;
      if (!secDir) continue;
      if (blocks.some(function (b) { return b.dir === secDir; })) continue;
      blocks.push({ dir: secDir, tracks: parseSection(section) });
    }
    blocks.sort(function (a, b) {
      if (a.dir === flightDir && b.dir !== flightDir) return -1;
      if (b.dir === flightDir && a.dir !== flightDir) return  1;
      return 0;
    });

    var rawFallback = (!blocks.length || !blocks.some(function (b) { return b.tracks.length; })) && rawBlock.length > 30
      ? rawBlock.slice(0, 2500) : '';

    return {
      trackType:    trackType,
      tmi:          tmi,
      flightDir:    flightDir,
      assignedId:   assignedId,
      blocks:       blocks,
      rawFallback:  rawFallback,
      eastComments: eastComments,
      westComments: westComments,
    };
}

// ═══════════════════════════════════════════════════════════════
// § 4 · FLIGHTKEYS — one track message (O-57 … O-67, D74)
// ═══════════════════════════════════════════════════════════════

var MSG = {
  PART:    /^\(NAT-(\d+)\/(\d+)\s+TRACKS\b/,
  END:     /\bEND OF PART\b.*\bPARTS?\)\s*$/,
  VALID:   /^([A-Z]{3})\s+(\d{2})\/(\d{4})Z\s+TO\s+([A-Z]{3})\s+(\d{2})\/(\d{4})Z$/,
  VALIDLK: /^[A-Z]{3}\s+\d{2}\//,
  TRACK:   /^([A-Z])\s+(\S.*)$/,
  EAST:    /^EAST LVLS\b\s*(.*)$/,
  WEST:    /^WEST LVLS\b\s*(.*)$/,
  STOP:    /^(?:WEST LVLS|EUR RTS|NAR\b|END OF PART|REMARKS|\(NAT-)/,
  REMARKS: /^REMARKS\s*[:.]\s*(.*)$/,
  TMI:     /\bTMI\s+IS\s+(\d{2,4})\b/
};
var MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

// "NOV 04/0100Z TO NOV 04/0800Z" → "11/04-0100–11/04-0800" (NavBlue's MM/DD-HHMM; UTC; O-62).
// null when the line is not in that form. No check against any time (O-60).
function _validText(line) {
  var m = MSG.VALID.exec(line);
  if (!m || !MONTHS[m[1]] || !MONTHS[m[4]]) return null;
  return MONTHS[m[1]] + '/' + m[2] + '-' + m[3] + '–' + MONTHS[m[4]] + '/' + m[5] + '-' + m[6];
}

// A waypoint token as printed → NavBlue's form (O-62): "48/50" → "48N050W"; "5630/20" → "5630N02000W";
// a named fix is kept. null: not a fix and not a coordinate.
function _wpt(tok) {
  var m;
  if (/^[A-Z]{3,5}$/.test(tok)) return tok;
  if ((m = /^(\d{2})\/(\d{2,3})$/.exec(tok))) return m[1] + 'N' + ('000' + m[2]).slice(-3) + 'W';
  if ((m = /^(\d{4})\/(\d{2,3})$/.exec(tok))) return m[1] + 'N' + ('000' + m[2]).slice(-3) + '00W';
  return null;
}

function _parseMessage(t, flightDir, options, push) {
  var lines = t.split(/\r?\n/);
  var filed = null;
  if (options && options.filed != null) {
    if (typeof options.filed === 'string' && /^[A-Z]$/.test(options.filed)) filed = options.filed;
    else push('INFO', 'NAT-FILED-IGNORED', 'FILED TRACK LETTER IS NOT ONE LETTER A-Z; IGNORED');
  }

  var tracks = [];        // { dir, track }
  var remarks = [];
  var seenPart = false, mode = 'idle', validNow = '', tmi = null, multi = false;
  var i, l, m;
  for (i = 0; i < lines.length; i++) {
    l = lines[i].trim();
    if ((m = MSG.PART.exec(l))) {
      if (+m[1] === 1 && seenPart) { multi = true; break; }
      seenPart = true; mode = 'head'; validNow = ''; continue;
    }
    if (mode === 'head') {
      if (!l) continue;
      mode = 'tracks';
      if (MSG.VALIDLK.test(l)) {
        var v = _validText(l);
        if (v === null) push('INFO', 'NAT-VALIDITY-UNREADABLE', 'NAT VALIDITY LINE NOT READ: ' + l);
        validNow = v === null ? '' : v;
        continue;
      }
    }
    if (mode === 'idle') continue;
    if (MSG.END.test(l)) { mode = 'idle'; continue; }
    if (mode === 'remarks') { remarks.push(lines[i].replace(/\s+$/, '')); continue; }
    if ((m = MSG.REMARKS.exec(l))) { mode = 'remarks'; if (m[1]) remarks.push(m[1]); continue; }
    if (!(m = MSG.TRACK.exec(l))) continue;

    // A track: "V NICSO 48/50 51/40 53/30 53/20 MALOT GISTI", then EAST LVLS, WEST LVLS.
    var id = m[1], route = m[2], j = i + 1, cont = 0;
    while (j < lines.length && !MSG.EAST.test(lines[j].trim()) && cont < 2 && lines[j].trim() && !MSG.STOP.test(lines[j].trim())) {
      route += ' ' + lines[j].trim(); j++; cont++;
    }
    var em = j < lines.length ? MSG.EAST.exec(lines[j].trim()) : null;
    if (!em) { push('WARN', 'NAT-TRACK-UNREADABLE', 'NAT TRACK ' + id + ' NOT READ: NO LEVELS LINE'); continue; }
    var wm = null, k;
    for (k = j + 1; k < Math.min(j + 4, lines.length); k++) { wm = MSG.WEST.exec(lines[k].trim()); if (wm) break; }
    var east = _levels(em[1]), west = wm ? _levels(wm[1]) : [];
    var dir = east.length && !west.length ? 'EAST' : west.length && !east.length ? 'WEST' : null;
    var wpts = [], bad = [];
    route.split(/\s+/).forEach(function (tok) {
      var w = _wpt(tok);
      if (w === null) { bad.push(tok); wpts.push(tok); } else wpts.push(w);
    });
    if (bad.length) push('WARN', 'NAT-WAYPOINT-UNREAD', 'NAT TRACK ' + id + ': WAYPOINT NOT READ, KEPT AS PRINTED: ' + bad.join(' '));
    if (wpts.length < 2) { push('WARN', 'NAT-TRACK-UNREADABLE', 'NAT TRACK ' + id + ' NOT READ: FEWER THAN TWO WAYPOINTS'); i = j; continue; }
    if (dir === null) { push('WARN', 'NAT-TRACK-UNREADABLE', 'NAT TRACK ' + id + ' NOT READ: DIRECTION (EAST / WEST LEVELS) NOT READABLE'); i = j; continue; }
    if (tracks.some(function (x) { return x.track.id === id; })) push('WARN', 'NAT-TRACK-DUPLICATE', 'NAT TRACK ' + id + ' PRINTED MORE THAN ONCE IN THE MESSAGE');
    tracks.push({ dir: dir, track: { id: id, waypoints: wpts, fl: levelText(dir === 'EAST' ? east : west), mach: '', valid: validNow, assigned: false } });
    i = j;
  }
  if (multi) push('WARN', 'NAT-MULTI-MESSAGE', 'MORE THAN ONE NAT TRACK MESSAGE IN THE INPUT: THE FIRST IS READ');

  var tm = MSG.TMI.exec(lines.join('\n'));
  tmi = tm ? tm[1] : null;

  var dirs = [];
  tracks.forEach(function (x) { if (dirs.indexOf(x.dir) < 0) dirs.push(x.dir); });
  var msgDir = dirs.length === 1 ? dirs[0] : null;
  if (!tracks.length) push('WARN', 'NAT-NO-TRACKS', 'NAT TRACK MESSAGE' + (tmi ? ' TMI ' + tmi : '') + ': NO TRACK READ');

  // Filed track (O-57, O-58, O-59, O-61): only the letter passed in, only when printed in this message.
  var assignedId = null;
  if (filed) {
    assignedId = filed;
    tracks.forEach(function (x) { x.track.assigned = x.track.id === filed; });
    if (!tracks.some(function (x) { return x.track.assigned; })) {
      push('WARN', 'NAT-FILED-NOT-IN-MESSAGE', 'FILED NAT ' + filed + ' NOT IN TRACK MESSAGE TMI ' + (tmi || '?') + ' (' + (msgDir || '?') + ') – CHECK OCEANIC CLEARANCE');
    }
  } else {
    push('INFO', 'NAT-RANDOM-ROUTE', 'NO FILED NAT TRACK LETTER: NO TRACK MARKED' + (tmi ? ' (TMI ' + tmi + ')' : ''));
  }

  // Blocks: the flight's direction first (as v1.1.0); a direction with no track has no block.
  var blocks = [];
  ['EAST', 'WEST'].forEach(function (d) {
    var ts = tracks.filter(function (x) { return x.dir === d; }).map(function (x) { return x.track; });
    if (ts.length) blocks.push({ dir: d, tracks: ts });
  });
  blocks.sort(function (a, b) {
    if (a.dir === flightDir && b.dir !== flightDir) return -1;
    if (b.dir === flightDir && a.dir !== flightDir) return  1;
    return 0;
  });

  // Remarks (O-62): as printed, line breaks kept (D54), the trailing "-" of the message removed (as v1.1.0 does
  // for the NavBlue comments); under the message's direction, the other direction empty.
  var remarksText = remarks.join('\n').trim().replace(/-\s*$/, '').trim();
  var cmtDir = msgDir;
  if (cmtDir === null && remarksText) {
    cmtDir = flightDir;
    push('INFO', 'NAT-REMARKS-DIRECTION', 'NAT MESSAGE DIRECTION NOT READABLE: REMARKS SHOWN UNDER THE FLIGHT DIRECTION (' + flightDir + ')');
  }

  return {
    trackType:    'NAT',
    tmi:          tmi,
    flightDir:    flightDir,
    assignedId:   assignedId,
    blocks:       blocks,
    rawFallback:  '',
    eastComments: cmtDir === 'EAST' ? remarksText : '',
    westComments: cmtDir === 'WEST' ? remarksText : ''
  };
}

// "340 350 360" → ['340','350','360']; "NIL" / empty → []. Anything else that is not a 3-digit level is dropped.
function _levels(s) {
  var t = String(s || '').trim();
  if (!t || /^NIL\b/.test(t)) return [];
  return t.split(/\s+/).filter(function (x) { return /^\d{3}$/.test(x); });
}

// ═══════════════════════════════════════════════════════════════
// § 5 · ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * parseNatTrack(t, origIcao, destIcao, options?) → natTrack object | null
 *
 * t        – the OFP text (NavBlue / eOFP, as v1.1.0), or one FlightKeys NAT track message as
 *            ofp-flightkeys passes it (natMessages[].text).
 * options  – optional; used only for a FlightKeys message:
 *              filed    one letter A–Z: the filed track (ofp-flightkeys: OFP page 1 route + ICAO FPL route)
 *              findings an array; the parser pushes { level, field: 'natTrack', code, message } to it
 *            NavBlue / eOFP text: options are ignored; the call is exactly v1.1.0's (O-57: 3 arguments).
 * Returns null when the flight is not an Atlantic crossing (NAM ↔ EUR by ICAO prefix, O-66).
 */
function parseNatTrack(t, origIcao, destIcao, options) {
  var isAtlantic = (NAM.test(origIcao) && EUR.test(destIcao)) || (EUR.test(origIcao) && NAM.test(destIcao));
  if (!isAtlantic) return null;
  if (typeof t === 'string' && /^\(NAT-\d+\/\d+\s+TRACKS\b/m.test(t)) {
    var out = options && Array.isArray(options.findings) ? options.findings : null;
    var push = function (level, code, message) { if (out) out.push({ level: level, field: 'natTrack', code: code, message: message }); };
    return _parseMessage(t, NAM.test(origIcao) ? 'EAST' : 'WEST', options, push);
  }
  return _parseOfpText(t, origIcao, destIcao);
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

var API = {
  RULESET_TYPE: RULESET_TYPE, RULESET_VERSION: RULESET_VERSION, SCHEMA_VERSION: SCHEMA_VERSION, RULESET_SOURCE: RULESET_SOURCE,
  FINDING_CODES: FINDING_CODES,
  parseNatTrack: parseNatTrack,   // (t, origIcao, destIcao, options?) → natTrack | null
  levelText: levelText            // (levels[]) → "FL340–400" | "FL360 380 400" | "FL340" (O-65)
};
return API;
});
