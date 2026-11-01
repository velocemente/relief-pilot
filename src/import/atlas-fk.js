'use strict';
// atlas-fk.js — FlightKeys format profile (Layer 3 of ADR-004).
//
// Extracts Canonical Briefing Model (CBM) from a Doc (FlightKeys format).
// P2a implementation: OFP pages only (rows 1-42 of the field map).
// P2b (NOTAMs, weather, briefing) deferred; returns empty/nil for those fields.

const { REGISTRY } = require('./registry.js');

// ── Row number → field mapping (field map rows 1-42) ─────────────────────────
// Rows 1-8: Flight identity & header (2.1)
// Rows 9-19: Fuel (2.2)
// Rows 20-23: Weights (2.3)
// Rows 24-32: Remarks / release page (2.4)
// Rows 33-42: Route, nav log, sections (2.5)

// FlightKeys-specific patterns for rows 1-42
const PATTERNS = {
  // Row 1-2: Flight identity
  FLIGHT_ID: /\b([A-Z]{2,3}\d{3,5})\/(\d{2})\b/,
  FLIGHT_HEADER: /\b[A-Z]{2,3}\d{3,5}\/(\d{2,6})\s+([A-Z]{4})\s*-\s*([A-Z]{4})/,

  // Row 2: Aircraft type from FPL line
  AIRCRAFT_TYPE: /\(FPL-[A-Z0-9]+-[A-Z]+\s*\n?-([A-Z0-9]{2,4})\/[A-Z]/,
  FPL_WAKE: /\(FPL-[A-Z0-9]+-[A-Z]+\s*\n?-[A-Z0-9]{2,4}\/([A-Z])-/,

  // Row 3: Weight unit (flexible pattern for B744, B747-400F, etc.)
  WEIGHT_UNIT: /[A-Z]\d{3}[A-Z\d-]*\s*\/\s*[A-Z0-9\-]+\s*\/\s*(KGS?|LBS?)\s*\//i,

  // Row 4: Date of flight
  DATE_DOF: /DOF\/(\d{2})(\d{2})(\d{2})/i,

  // Rows 5-7: ORIG/DEST/PALT lines with Q marker and multi-word airport names
  APT_LINE: /^(ORIG|DEST|PALT)\s+([A-Z]{4})\/\S*\s+.+?\s+(Q\s+)?([NS]\d+[EW]\d+)\s+(\d{4}Z)/im,

  // Rows 9-12: Fuel lines
  BLOCK_FUEL: /^BLOCK\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,
  MINF_FUEL: /^MINF\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,
  FRES_FUEL: /^FRES\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,
  TAXI_FUEL: /^TAXI\s+(\d{3,7})\s+(\d{2})\.(\d{2})/im,
  TRIP_FUEL: /^TRIP\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,
  ALT1_FUEL: /^ALT1\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,
  TOF_FUEL: /^TOF\s+(\d{5,7})/im,
  REMF_FUEL: /^REMF\s+(\d{5,7})\s+(\d{2})\.(\d{2})/im,

  // Row 18: ZFW INC factor
  ZFW_INCR_FACTOR: /ZFW\s+INC\/(\d+)\s+X\s+(\d+)/i,

  // Row 19: Additional FF adjustment
  ADDL_FF_ADJ: /\*ADDL\s+FF\s+ADJ\s+([\+\-]\d+\.\d+)\s*\*/i,

  // Rows 20-23: Weights (with optional dots and limit)
  WEIGHTS: /^(DOW|PYLD|ZFW|RAMP|TOGW|LDGW)\s+(\d+)(?:\s+\.+)?(?:\s+([SL])(\d+))?/im,

  // Row 24: CAT II/III approaches
  CAT_II_III: /^([A-Z]{4})\s+CAT\s+(II|III|II\/III)\s*-?\s*RWY\s+([0-9R\/LC]+)/im,

  // Row 25: MEL items
  MEL_ITEM: /^MEL\s+([0-9A-Z\-]+)\s*-\s*(.+)/im,

  // Row 26: Crew members (ROLE EMPNUM LAST, FIRST [..]) — names may include parens, dots may follow directly
  CREW_MEMBER: /^(CA|FO|SEN)\s+(\d{6})\s+([A-Z][A-Z\s,\(\)]*?)(?:\s*\.\.|\s+TO\/LNDG|$)/im,

  // Row 33: Nav log header
  NAVLOG_START: /^AWY\s+WPT\s+MTK/im,

  // Row 37: Overflight permits
  OVERFLIGHT_START: /^---\s+(TAKEOFF PERMIT|OVERFLIGHT PERMITS)/im,

  // Row 38: OFP format/source indicator
  FUFI_LINE: /^FUFI:\s+([0-9A-F\-]+)\s+PAGE\s+(\d+)\/(\d+)/im,

  // Row 46: POR (Point of Reconjunction) from the FMC Reserves line
  POR_HEADER: /\bPOR:\s+([A-Z][A-Z0-9]*)\s+(\d{2})\.(\d{2})\b/i,
  // Row 46b: POR min fuel from 3-column MINF row (separator "....")
  POR_MINF: /^MINF\s+\d+\s+[\d.]+\s+\.{2,}\s+(\d+)/im,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function hhmmToMins(hhmm) {
  const s = String(hhmm || '').replace('Z', '');
  if (!/^\d{4}$/.test(s)) return null;
  return parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2, 4), 10);
}

function extractFuelField(pattern, text) {
  const match = pattern.exec(text);
  return match ? match[1] : null;
}

function extractTimeField(pattern, text) {
  const match = pattern.exec(text);
  if (!match) return null;
  const hh = match[2];
  const mm = match[3];
  return hh && mm ? (parseInt(hh) * 60 + parseInt(mm)) : null;
}

function extractAircraft(text) {
  const match = PATTERNS.AIRCRAFT_TYPE.exec(text);
  return match ? match[1] : null;
}

function extractWakeCategory(text) {
  const match = PATTERNS.FPL_WAKE.exec(text);
  return match ? match[1] === 'H' : false;
}

function parseAptLine(keyword, text) {
  const regex = new RegExp(`^${keyword}\\s+([A-Z]{4})/\\S*\\s+.+?\\s+(Q\\s+)?([NS]\\d+[EW]\\d+)\\s+(\\d{4}Z)`, 'im');
  const match = regex.exec(text);
  if (!match) return null;
  return {
    icao: match[1],
    hasQualAirport: !!match[2],
    coords: match[3],
    time: match[4],
  };
}

function extractWeights(text) {
  const weights = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = PATTERNS.WEIGHTS.exec(line);
    if (!match) continue;
    const field = match[1];
    const value = parseInt(match[2], 10);
    const limit = match[4] ? parseInt(match[4], 10) : null;

    switch (field) {
      case 'ZFW':
        weights.zfwActual = value;
        if (limit) weights.zfwLimit = limit;
        break;
      case 'RAMP':
        weights.rampWeight = value;
        break;
      case 'TOGW':
        weights.togwActual = value;
        if (limit) weights.togwLimit = limit;
        if (/VZFW/.test(text)) weights.hasVzfwCkLimit = true;
        break;
      case 'LDGW':
        weights.ldgwActual = value;
        if (limit) weights.ldgwLimit = limit;
        break;
    }
  }
  return weights;
}

function parseCrew(crewText) {
  const crew = [];
  const lines = crewText.split('\n');
  for (const line of lines) {
    const match = PATTERNS.CREW_MEMBER.exec(line);
    if (!match) continue;
    const role = match[1];
    const empNum = match[2];
    const nameRaw = match[3].trim();

    const commaIdx = nameRaw.indexOf(',');
    let lastName = '';
    let firstName = '';
    if (commaIdx > 0) {
      lastName = nameRaw.substring(0, commaIdx).trim();
      const afterComma = nameRaw.substring(commaIdx + 1);
      const parenIdx = afterComma.indexOf('(');
      firstName = (parenIdx > 0 ? afterComma.substring(0, parenIdx) : afterComma).trim();
    } else {
      lastName = nameRaw;
    }

    crew.push({
      role, empNum, lastName, firstName,
      name: `${lastName}, ${firstName}`.trim(),
      type: role, id: empNum,
    });
  }
  return crew;
}

function extractCatApproaches(remarksText) {
  const approaches = [];
  const lines = remarksText.split('\n');
  for (const line of lines) {
    const match = PATTERNS.CAT_II_III.exec(line);
    if (!match) continue;
    approaches.push({ airport: match[1], category: match[2], runways: match[3] });
  }
  return approaches;
}

function extractMelItems(remarksText) {
  const items = [];
  const lines = remarksText.split('\n');
  for (const line of lines) {
    const match = PATTERNS.MEL_ITEM.exec(line);
    if (!match) continue;
    items.push({ ataCode: match[1], description: match[2] });
  }
  return items;
}

// Row 33/34: Parse nav log; return {navLog, tocOffsetMins}.
// Each nav log row in FK is:
//   line 1 (AWY WPT): airway + waypoint name
//   line 2 (lat data): N/S lat + MTK NM GS TAS LEG-T ETA ...
//   line 3 (lon data): E/W lon + MORA TTK MH IAS TOT-T FL TEMP WIND
// TOT-T (total elapsed time) is the 5th value after the lon prefix.
function parseNavLog(fullText) {
  const startMatch = /^AWY\s+WPT\s+MTK[^\n]*\n[^\n]*MORA[^\n]*/im.exec(fullText);
  if (!startMatch) return { navLog: [], tocOffsetMins: null };

  const afterHeader = fullText.slice(startMatch.index + startMatch[0].length);
  // Stop at the alternate route section (marks the end of the nav log waypoints)
  const altRouteEnd = /^Destination Primary Alternate Route/im.exec(afterHeader);
  const navSection = altRouteEnd ? afterHeader.slice(0, altRouteEnd.index) : afterHeader;

  const entries = [];
  const lines = navSection.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Skip bare coordinate lines: N29 42.4 or E106 38.5 (no data columns)
    if (/^[NSEW]\d{2,3}\s+\d+\.\d+\s*$/.test(line.trim())) continue;

    // Skip origin airport descriptor: ICAO altitude FT name
    if (/^[A-Z]{4}\s+\d{4,5}\s+FT\b/.test(line)) continue;

    // Match waypoint line: optional airway + waypoint name, nothing else
    const wptMatch = /^(?:\S+\s+)?([A-Z][A-Z0-9]{1,7})\s*$/.exec(line.trim());
    if (!wptMatch) continue;

    const wpt = wptMatch[1];

    // Find the lon data line (E/W with data columns) within next 4 lines
    let eLine = null;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (/^[EW]\d{3}\s+\d+\.\d+\s+\d+/.test(lines[j])) {
        eLine = lines[j];
        break;
      }
    }
    if (!eLine) continue;

    // TOT-T is the 5th value after lon prefix: E/W DDD DD.D n n n n HH.MM
    const totMatch = /^[EW]\d{3}\s+\d+\.\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d{2})\.(\d{2})/.exec(eLine);
    if (!totMatch) continue;

    const elapsedMins = parseInt(totMatch[1], 10) * 60 + parseInt(totMatch[2], 10);
    entries.push({ wpt, elapsedMins });
  }

  const tocEntry = entries.find(e => e.wpt === 'TOC');
  return {
    navLog: entries,
    tocOffsetMins: tocEntry ? tocEntry.elapsedMins : null,
  };
}

// Row 36: Extract alternate routes from "Destination Primary Alternate Route" sections.
// Shape: [{title, route, mora}]
function extractAltRoutes(text) {
  const routes = [];
  const titleRe = /^(Destination Primary Alternate Route)\s*\n([^\n]+)/gim;
  let match;
  while ((match = titleRe.exec(text)) !== null) {
    const title = match[1];
    const route = match[2].trim();
    // Look ahead up to 5 lines for MORA
    const following = text.slice(match.index + match[0].length);
    const nextLines = following.split('\n').slice(0, 5).join('\n');
    const moraMatch = /^MORA\s+(\d+)$/im.exec(nextLines);
    routes.push({ title, route, mora: moraMatch ? moraMatch[1] : null });
  }
  return routes;
}

// Row 35: Extract overflight/takeoff permit text.
// Returns string from "---" until the nav log header (AWY WPT MTK).
function extractOverflightPerms(text) {
  const startMatch = /^(---\s*(?:TAKEOFF PERMIT|OVERFLIGHT PERMITS)[^\n]*)/im.exec(text);
  if (!startMatch) return '';
  const fromStart = text.slice(startMatch.index);
  const endMatch = /^AWY\s+WPT\s+MTK/im.exec(fromStart);
  return endMatch ? fromStart.slice(0, endMatch.index).trimEnd() : '';
}

// ── P2b: FlightKeys two-column NOTAM/weather/FIR extraction (rows 43–50) ─────
// A4 landscape pages are ~841.89pt wide; left column is x < 40% of page width.
const FK_COL_RATIO = 0.4;

function _fkColThreshold(page) {
  const w = (page && page.width > 0) ? page.width : 841.89;
  return w * FK_COL_RATIO;
}

// Row 50: Detect FlightKeys running headers/footers to be skipped.
function isFkHeaderLine(text) {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  // "Page N of N <uuid>"
  if (/^Page\s+\d+\s+of\s+\d+\s+[0-9a-f-]{36}$/i.test(t)) return true;
  // "FLTNUM/N ICAO-ICAO YYYY-MM-DD"
  if (/^[A-Z0-9]+\/\d+\s+[A-Z]{4}\s*-\s*[A-Z]{4}\s+\d{4}-\d{2}-\d{2}/.test(t)) return true;
  // Bare date-time line "YYYY-Mon-DD HH:MM"
  if (/^\d{4}-[A-Z][a-z]{2}-\d{2}\s+\d{2}:\d{2}$/.test(t)) return true;
  // FUFI: lines
  if (/^FUFI:/i.test(t)) return true;
  return false;
}

// Assemble spans whose x is in [minX, maxX) into a string, using gap sizes.
function _assembleColSpans(spans, minX, maxX) {
  const col = spans.filter(sp => sp.x >= minX && sp.x < maxX);
  if (!col.length) return '';
  col.sort((a, b) => a.x - b.x);
  let s = '';
  let prevRight = null;
  for (const sp of col) {
    const w = (sp.w != null && sp.w > 0) ? sp.w : sp.str.length * 5;
    if (prevRight !== null) {
      const gap = sp.x - prevRight;
      s += gap > 20 ? '   ' : gap > 8 ? '  ' : gap > 3 ? ' ' : '';
    }
    s += sp.str;
    prevRight = sp.x + w;
  }
  return s.trim();
}

// Build separate left and right column line arrays from all pages of a Doc.
function buildFkColStreams(doc) {
  const left = [], right = [];
  for (const page of doc.pages) {
    const thr = _fkColThreshold(page);
    for (const line of page.lines) {
      const spans = line.spans || [];
      const lText = _assembleColSpans(spans, 0, thr);
      const rText = _assembleColSpans(spans, thr, Infinity);
      if (lText && !isFkHeaderLine(lText)) left.push(lText);
      if (rText && !isFkHeaderLine(rText)) right.push(rText);
    }
  }
  return { leftLines: left, rightLines: right };
}

// Find the character offset in fullText where the weather section begins.
// Looks for "Page N of N <uuid>" (N > 1) after the main "COMPANY NOTAMS" header.
function findFkWeatherStart(fullText) {
  const companyIdx = fullText.search(/^COMPANY\s+NOTAMS\s*$/im);
  if (companyIdx < 0) return fullText.length;
  const re = /^Page\s+(\d+)\s+of\s+(\d+)\s+[0-9a-f-]{36}$/gim;
  re.lastIndex = companyIdx;
  let m;
  while ((m = re.exec(fullText)) !== null) {
    const n = parseInt(m[1], 10), total = parseInt(m[2], 10);
    if (n === total && total > 1) return m.index + m[0].length;
  }
  return fullText.length;
}

// NOTAM ID: "ICAO [FAA] XNNNN/NN [date - date/UFN]" — FAA 3-letter code and dates are OPTIONAL.
const _NOTAM_ID_RE = /^([A-Z]{4})\s+(?:[A-Z]{3}\s+)?([A-Z]\d{4}\/\d{2})(?:\s+(\d{4}-[A-Za-z]{3}-\d{2}(?:\s+\d{2}:\d{2})?)\s*-\s*(UFN(?:\s*\(EST[^)]*\))?|\d{4}-[A-Za-z]{3}-\d{2}(?:\s+\d{2}:\d{2})?))?/;
const _BARE_ID_RE  = /^[A-Z]\d{4}\/\d{2}\s/;
const _SUBJECT_RE  = /^SUBJECT:\s+(.+)$/i;

// Rows 46-47: Parse Company NOTAMs from a column line array.
// Returns Map<notamId, {icao, type, subject, notamId, body}>.
function parseFkCompanyNotams(colLines) {
  const results = new Map();
  for (let i = 0; i < colLines.length; i++) {
    const idM = _NOTAM_ID_RE.exec(colLines[i]);
    if (!idM) continue;
    const notamId = `${idM[1]} ${idM[2]}`;
    if (results.has(notamId)) continue;
    // Look ahead up to 5 lines for SUBJECT:
    let subject = null, subjectIdx = -1;
    for (let j = i + 1; j < Math.min(i + 6, colLines.length); j++) {
      const sm = _SUBJECT_RE.exec(colLines[j]);
      if (sm) { subject = sm[1].trim(); subjectIdx = j; break; }
    }
    if (!subject) continue;
    // Fleet NOTAMs have no 4-letter ICAO prefix in the tag — skip them.
    const tagM = /^([A-Z]{4})-(.+)$/.exec(subject);
    if (!tagM) continue;
    const tag = tagM[2].trim().toUpperCase();
    const type = (tag === 'CURFEW' || tag === 'ARRL CRF') ? 'curfew' : 'opsNotes';
    // Collect body lines from after SUBJECT until next NOTAM ID.
    const bodyLines = [];
    const bodyLimit = Math.min(subjectIdx + 50, colLines.length);
    for (let k = subjectIdx + 1; k < bodyLimit; k++) {
      const line = colLines[k];
      if (_NOTAM_ID_RE.test(line) || _BARE_ID_RE.test(line)) break;
      if (line.trim()) bodyLines.push(line.trim());
    }
    results.set(notamId, { icao: tagM[1], type, subject, notamId, body: bodyLines.join('\n') });
  }
  return results;
}

// Row 44: Parse NOTAM briefing items (non-Company) from the NOTAM section text.
// Returns Map<notamId, {id, icao, validFrom, validTo, created, body}>.
function parseFkNotamBriefingItems(notamText, companyIds) {
  const items = new Map();
  const lines = notamText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = _NOTAM_ID_RE.exec(lines[i]);
    if (!m) continue;
    const notamId = `${m[1]} ${m[2]}`;
    if (items.has(notamId) || companyIds.has(notamId)) continue;
    // If SUBJECT follows within 5 lines it's a Company NOTAM — skip.
    let isCompany = false;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (_SUBJECT_RE.test(lines[j])) { isCompany = true; break; }
    }
    if (isCompany) continue;
    const bodyLines = [];
    let created = null;
    let j = i + 1;
    while (j < lines.length && j < i + 60) {
      const next = lines[j].trim();
      if (_NOTAM_ID_RE.test(lines[j]) || _BARE_ID_RE.test(lines[j])) break;
      if (/^APT\s*[A-Z]{4}\b/i.test(next)) break;
      if (/\bFIR[A-Z]{4}\b/.test(next)) break;
      const cm = /^CREATED:\s*(\d{4}-[A-Za-z]{3}-\d{2}(?:\s+\d{2}:\d{2})?)/.exec(next);
      if (cm) { if (!created) created = cm[1].trim(); j++; continue; }
      if (/^FL:\s/.test(next)) { j++; continue; }
      if (next) bodyLines.push(next);
      j++;
    }
    items.set(notamId, {
      id: notamId, icao: m[1],
      validFrom: m[3] || null, validTo: m[4] || null,
      created, body: bodyLines.join('\n'),
    });
    i = j - 1;
  }
  return items;
}

// APT sentinel: "APT ICAO RWYS: ..." or "APTICAO RWYS: ..."
const _APT_RE  = /^APT\s*([A-Z]{4})\s+RWYS?:\s*(.+)$/i;
const _ROLE_RE = /(DEPARTURE|DESTINATION|ALTN(?:\s*\d)?|EA|IA|TA)\s+(\d{2}\s+\d{2}:\d{2}\s*-\s*\d{2}\s+\d{2}:\d{2})/gi;
// City header: "AAA - CITY NAME   ROLE DD HH:MM - DD HH:MM"
const _CITY_RE = /^[A-Z]{3}\s+-\s+.+?(?:\s+(DEPARTURE|DESTINATION|ALTN(?:\s*\d)?|EA|IA|TA)\s+(\d{2}\s+\d{2}:\d{2}\s*-\s*\d{2}\s+\d{2}:\d{2}))\s*$/i;

// Parse APT sentinels from NOTAM section text. Returns Map<icao, {roles, rwys}>.
function parseFkAptSentinels(notamText) {
  const apts = new Map();
  const lines = notamText.split('\n');
  let pending = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const cityM = _CITY_RE.exec(line);
    if (cityM) {
      pending = { role: cityM[1].trim().toUpperCase(), window: cityM[2].trim() };
      continue;
    }
    const aptM = _APT_RE.exec(line);
    if (!aptM) { pending = null; continue; }
    const icao = aptM[1].toUpperCase();
    if (!apts.has(icao)) apts.set(icao, { roles: [], rwys: [] });
    const apt = apts.get(icao);
    const rest = aptM[2];
    // Separate RWYs (before first role keyword) from inline roles.
    const roleIdx = rest.search(/(DEPARTURE|DESTINATION|ALTN(?:\s*\d)?|EA|IA|TA)\s+\d{2}\s+\d{2}:/i);
    const rwysStr = (roleIdx >= 0 ? rest.slice(0, roleIdx) : rest).trim();
    for (const r of rwysStr.split(/\s+/)) {
      if (/^\d{2}[LCR]?(?:\/\d{2}[LCR]?)?$/.test(r) && !apt.rwys.includes(r)) apt.rwys.push(r);
    }
    // Roles from the APT sentinel line itself.
    _ROLE_RE.lastIndex = 0;
    let rm;
    while ((rm = _ROLE_RE.exec(rest)) !== null) {
      const role = rm[1].trim().toUpperCase();
      if (!apt.roles.some(r => r.role === role)) apt.roles.push({ role, window: rm[2].trim() });
    }
    // Attach city-header role that preceded this APT line.
    if (pending && !apt.roles.some(r => r.role === pending.role)) {
      apt.roles.push({ role: pending.role, window: pending.window });
    }
    pending = null;
    // Look ahead for continuation role lines.
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const next = lines[j].trim();
      const contM = /^(DEPARTURE|DESTINATION|ALTN(?:\s*\d)?|EA|IA|TA)\s+(\d{2}\s+\d{2}:\d{2}\s*-\s*\d{2}\s+\d{2}:\d{2})\s*$/i.exec(next);
      if (!contM) break;
      const role = contM[1].trim().toUpperCase();
      if (!apt.roles.some(r => r.role === role)) apt.roles.push({ role, window: contM[2].trim() });
    }
  }
  return apts;
}

// Row 43: Parse TAF/METAR from weather section text. Returns Map<icao, {taf, metars, atis}>.
function parseFkWeatherSection(weatherText) {
  const airports = new Map();
  const lines = weatherText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const tafM = /^TAF\s+([A-Z]{4})\s+/.exec(line);
    if (tafM) {
      const icao = tafM[1];
      if (!airports.has(icao)) airports.set(icao, { taf: null, metars: [], atis: null });
      const tafLines = [line];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].trim();
        if (!next || /^(TAF|METAR)\s+[A-Z]{4}\s+/.test(next)) break;
        if (/^[A-Z]{3}\s+-\s+/.test(next) || /^APT\s*[A-Z]{4}\b/i.test(next)) break;
        tafLines.push(next);
        j++;
      }
      airports.get(icao).taf = tafLines.join('\n');
      i = j;
      continue;
    }
    const metarM = /^METAR\s+([A-Z]{4})\s+/.exec(line);
    if (metarM) {
      const icao = metarM[1];
      if (!airports.has(icao)) airports.set(icao, { taf: null, metars: [], atis: null });
      airports.get(icao).metars.push(line);
      i++;
      continue;
    }
    const atisM = /THERE ARE NO ACTIVE ATIS FOR AIRPORT\s+([A-Z]{4})/i.exec(line);
    if (atisM) {
      const icao = atisM[1];
      if (!airports.has(icao)) airports.set(icao, { taf: null, metars: [], atis: null });
      airports.get(icao).atis = 'NIL';
    }
    i++;
  }
  return airports;
}

// Row 49: Parse FIR blocks from NOTAM section text. Returns array of {name, icao, items[]}.
function parseFkFirBlocks(notamText) {
  const firs = [];
  const seen = new Set();
  const lines = notamText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const firM = /\bFIR([A-Z]{4})\b/.exec(line);
    if (!firM) continue;
    const icao = firM[1];
    if (seen.has(icao)) continue;
    seen.add(icao);
    // Look back up to 3 lines for "... FIR" or "... UIR" name header.
    let firName = '';
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      const prev = lines[j].trim();
      if (/^.+\s+(FIR|UIR)\s*$/.test(prev)) firName = prev;
    }
    // Parse NOTAM items: check sentinel line first (item may follow sentinel on same line).
    const items = [];
    const itemsSeen = new Set();
    const _itemRe = () => /((?:[A-Z]{4}\s+)+)([A-Z]\d{4}\/\d{2})(?:\s+(\d{4}-[A-Za-z]{3}-\d{2}(?:\s+\d{2}:\d{2})?)\s*-\s*(UFN(?:\s*\(EST[^)]*\))?|\d{4}-[A-Za-z]{3}-\d{2}(?:\s+\d{2}:\d{2})?))?/g;
    const scanLine = (src) => {
      const re = _itemRe();
      let m;
      while ((m = re.exec(src)) !== null) {
        const id = `${m[1].trim()} ${m[2]}`.replace(/\s+/g, ' ');
        if (!itemsSeen.has(id)) {
          itemsSeen.add(id);
          items.push({ id, validFrom: m[3] || null, validTo: m[4] || null });
        }
      }
    };
    // Scan rest of the sentinel line.
    scanLine(line.slice(firM.index + firM[0].length));
    // Scan subsequent lines until the next FIR sentinel or APT sentinel.
    let j = i + 1;
    while (j < lines.length && j < i + 100) {
      const next = lines[j].trim();
      if (/\bFIR[A-Z]{4}\b/.test(next) || /^APT\s*[A-Z]{4}\b/i.test(next)) break;
      scanLine(next);
      j++;
    }
    firs.push({ name: firName || `FIR ${icao}`, icao, items });
    i = j - 1;
  }
  return firs;
}

// Row 41: Parse Critical Fuel Scenario section for ETP points and CFS alternates.
// Returns { etpPoints: [{name, lat, lon, elapsedMins}],
//           altData:   [{icao, role:'CFS ALT', etpName, ofpEta, currentEta, ofpOffsetMins, wxWindow}] }
function parseFkEtpSection(fullText) {
  // Step 1: Collect ETP elapsed times from nav log compact lon lines (only 2 ints before HH.MM).
  const etpTimeMap = new Map();
  const navMarkerRe = /\(GO([A-Z]{4})\)\s+(ETP\d+)\b/g;
  let nm;
  while ((nm = navMarkerRe.exec(fullText)) !== null) {
    const etpName = nm[2];
    if (etpTimeMap.has(etpName)) continue; // first (nav log) match wins
    const ahead = fullText.slice(nm.index + nm[0].length, nm.index + nm[0].length + 300);
    const lonM = /^[EW]\d{3}\s+\d+\.\d+\s+\d+\s+\d+\s+(\d{2})\.(\d{2})/m.exec(ahead);
    if (lonM) etpTimeMap.set(etpName, parseInt(lonM[1], 10) * 60 + parseInt(lonM[2], 10));
  }

  // Step 2: Parse Critical Fuel Scenario section.
  const cfsStart = /^Critical\s+Fuel\s+Scenario\s*$/im.exec(fullText);
  if (!cfsStart) return { etpPoints: [], altData: [] };

  const etpPoints = [];
  const altDataCfs = [];
  let currentEtpName = null;
  const lines = fullText.slice(cfsStart.index).split('\n');
  let i = 1; // skip header line

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line || isFkHeaderLine(line) || /^FUFI:/i.test(line)) continue;
    if (/^COMPANY\s+NOTAMS\b/i.test(line)) break;

    // ETP header: "(GOXXXX) ETPN ICAO1-ICAO2 lat lon"
    const etpM = /^\(GO([A-Z]{4})\)\s+(ETP\d+)\s+[A-Z]{4}-[A-Z]{4}\s+([NS]\d+\s+[\d.]+)\s+([EW]\d+\s+[\d.]+)/.exec(line);
    if (etpM) {
      currentEtpName = etpM[2];
      etpPoints.push({
        name: currentEtpName,
        lat:  etpM[3],
        lon:  etpM[4],
        elapsedMins: etpTimeMap.get(currentEtpName) ?? null,
      });
      continue;
    }

    // CFS alternate row: "ICAO GCD TIME A/I REMF PAD MINF HH:MM-HH:MM"
    const rowM = /^([A-Z]{4})\s+\d+\s+\d+:\d+\s+\S+\s+\d+\s+\d+\s+\d+\s+(\d{2}:\d{2}-\d{2}:\d{2})/.exec(line);
    if (rowM && currentEtpName) {
      altDataCfs.push({
        icao: rowM[1], role: 'CFS ALT', etpName: currentEtpName,
        ofpEta: null, currentEta: null, ofpOffsetMins: null, wxWindow: rowM[2],
      });
    }
  }

  return { etpPoints, altData: altDataCfs };
}

// Merge all parsed data into cbm.airportData.
// Only airports in releaseIcaos receive entries; others are silently skipped.
function _mergeFkAirportData(cbm, aptSentinels, briefingItems, companyMap, weatherMap, releaseIcaos, fixtureFindings) {
  const ensure = (icao) => {
    if (!releaseIcaos.has(icao)) return null;
    if (!cbm.airportData[icao]) {
      cbm.airportData[icao] = { _roles: [], rwys: [], notams: [], weather: null, curfew: null, opsNotes: [] };
    }
    return cbm.airportData[icao];
  };
  for (const [icao, sd] of aptSentinels) {
    const ad = ensure(icao);
    if (!ad) continue;
    ad._roles = sd.roles;
    ad.rwys = sd.rwys;
    for (const r of sd.roles) {
      const roleUpper = r.role.toUpperCase();
      if (['EA', 'IA', 'TA'].includes(roleUpper)) {
        const code = `CANONICAL_ROLE_NO_LEGACY_${icao}`;
        if (!fixtureFindings.some(f => f.code === code)) {
          fixtureFindings.push({
            code, severity: 'INFO',
            message: `${icao} has role ${r.role} (${r.window}): kept in canonical model only`,
          });
        }
      }
    }
  }
  for (const [icao, w] of weatherMap) {
    const ad = ensure(icao);
    if (!ad) continue;
    ad.weather = { taf: w.taf, metars: w.metars, atis: w.atis };
  }
  for (const [, item] of briefingItems) {
    const ad = ensure(item.icao);
    if (!ad) continue;
    ad.notams.push({
      id: item.id, validFrom: item.validFrom, validTo: item.validTo,
      created: item.created, body: item.body,
    });
  }
  for (const [, entry] of companyMap) {
    const ad = ensure(entry.icao);
    if (!ad) continue;
    if (entry.type === 'curfew') {
      ad.curfew = { notamId: entry.notamId, subject: entry.subject, body: entry.body };
    } else {
      ad.opsNotes.push({ notamId: entry.notamId, subject: entry.subject, body: entry.body });
    }
  }
}

// ── Main profile extraction function ─────────────────────────────────────────
function extractCbm(doc) {
  if (!doc || !doc.pages || doc.pages.length === 0) {
    return {};
  }

  let fullText = '';
  for (const page of doc.pages) {
    for (const line of page.lines) {
      fullText += line.text + '\n';
    }
    fullText += '\n';
  }

  const cbm = {};
  const fixtureFindings = [];

  // ── Row 1: Flight identity ────────────────────────────────────────────────
  const flightMatch = PATTERNS.FLIGHT_ID.exec(fullText);
  if (flightMatch) {
    cbm.fltNum = flightMatch[1];
  }

  // Extract legacy dateStr format (DD MMM YY) from flight header line
  // Format: "GTI8153/26 ZUCK - UAAA 27 OCT 26 N498MC"
  const flightHeaderRegex = /\b[A-Z0-9]+\/\d+\s+[A-Z]{4}\s*-\s*[A-Z]{4}\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})/i;
  const headerMatch = flightHeaderRegex.exec(fullText);
  cbm.dateStr = headerMatch
    ? `${headerMatch[1]} ${headerMatch[2].toUpperCase()} ${headerMatch[3]}`
    : '';

  // ── Row 2: Aircraft type and wake category ─────────────────────────────────
  const acftType = extractAircraft(fullText);
  if (acftType) {
    cbm.acftType = acftType;
    cbm.isHeavy = extractWakeCategory(fullText) || false;
  }

  // ── Row 3: Weight unit ────────────────────────────────────────────────────
  const unitMatch = PATTERNS.WEIGHT_UNIT.exec(fullText);
  if (unitMatch) {
    const unit = unitMatch[1].toUpperCase();
    cbm.weightUnit = (unit === 'KG' || unit === 'KGS') ? 'KGS' : 'LBS';
  }

  // ── Row 4: Date of flight ─────────────────────────────────────────────────
  const dateMatch = PATTERNS.DATE_DOF.exec(fullText);
  if (dateMatch) {
    cbm.flightDateISO = `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // ── Rows 5-7: Airport lines ───────────────────────────────────────────────
  const orig = parseAptLine('ORIG', fullText);
  if (orig) {
    cbm.origIcao = orig.icao;
    cbm.offFromOFP = orig.time.replace('Z', '');
  }

  const dest = parseAptLine('DEST', fullText);
  if (dest) {
    cbm.destIcao = dest.icao;
    cbm.etaDest = dest.time.replace('Z', '');
  }

  const palt = parseAptLine('PALT', fullText);

  // altData: array of alternates only (ORIG and DEST are NOT included)
  cbm.altData = [];
  if (palt) {
    const offMins = hhmmToMins(cbm.offFromOFP);
    const etaMins = hhmmToMins(palt.time.replace('Z', ''));
    let ofpOffsetMins = null;
    if (offMins !== null && etaMins !== null) {
      ofpOffsetMins = etaMins - offMins;
      if (ofpOffsetMins < 0) ofpOffsetMins += 24 * 60;
    }
    cbm.altData.push({
      icao: palt.icao,
      role: 'DEST ALT',
      ofpEta: palt.time.replace('Z', ''),
      currentEta: palt.time.replace('Z', ''),
      ofpOffsetMins,
    });
  }

  // ── Rows 5b-5c: RAPT / RALT (redispatch alternates) ─────────────────────────
  for (const [kw, role] of [['RAPT', 'EN ROUTE ALT'], ['RALT', 'EN ROUTE ALT']]) {
    const apt = parseAptLine(kw, fullText);
    if (apt) {
      const offMins = hhmmToMins(cbm.offFromOFP);
      const etaMins = hhmmToMins(apt.time.replace('Z', ''));
      let ofpOffsetMins = null;
      if (offMins !== null && etaMins !== null) {
        ofpOffsetMins = etaMins - offMins;
        if (ofpOffsetMins < 0) ofpOffsetMins += 24 * 60;
      }
      cbm.altData.push({
        icao: apt.icao, role,
        ofpEta: apt.time.replace('Z', ''),
        currentEta: apt.time.replace('Z', ''),
        ofpOffsetMins,
      });
    }
  }

  // qualAirports: array of ICAO codes that carry the Q flag (ORIG, DEST, PALT)
  const qualAirports = [];
  if (orig && orig.hasQualAirport) qualAirports.push(orig.icao);
  if (dest && dest.hasQualAirport) qualAirports.push(dest.icao);
  if (palt && palt.hasQualAirport) qualAirports.push(palt.icao);
  cbm.qualAirports = qualAirports;

  // ── Rows 9-12: Fuel fields (safety-critical: always set, even if empty) ───
  cbm.blockFuelRaw = extractFuelField(PATTERNS.BLOCK_FUEL, fullText) || '';
  cbm.minfFuelRaw  = extractFuelField(PATTERNS.MINF_FUEL,  fullText) || '';
  cbm.taxiFuelRaw  = extractFuelField(PATTERNS.TAXI_FUEL,  fullText) || '';

  const fresFuel = extractFuelField(PATTERNS.FRES_FUEL, fullText);
  if (fresFuel) cbm.fresFuelRaw = fresFuel;

  const taxiTime = extractTimeField(PATTERNS.TAXI_FUEL, fullText);
  if (taxiTime) cbm.taxiMins = taxiTime;

  const tripFuel = extractFuelField(PATTERNS.TRIP_FUEL, fullText);
  const tripTime = extractTimeField(PATTERNS.TRIP_FUEL, fullText);
  if (tripTime) {
    cbm.tripMinutes = tripTime;
    cbm.tripFuelRaw = tripFuel ? parseInt(tripFuel, 10) : null;
  }

  const alt1Fuel = extractFuelField(PATTERNS.ALT1_FUEL, fullText);
  if (alt1Fuel) cbm.alt1Fuel = alt1Fuel;

  const tofFuel = extractFuelField(PATTERNS.TOF_FUEL, fullText);
  if (tofFuel) cbm.tofFuelRaw = parseInt(tofFuel, 10);

  const remfFuel = extractFuelField(PATTERNS.REMF_FUEL, fullText);
  if (remfFuel) cbm.destRemf = remfFuel;

  // ── Row 18: ZFW INC factor ────────────────────────────────────────────────
  const zfwIncMatch = PATTERNS.ZFW_INCR_FACTOR.exec(fullText);
  cbm.zfwIncrFactor = zfwIncMatch ? parseFloat(zfwIncMatch[2]) / 1000 : null;

  // ── Row 19: Additional FF adjustment ──────────────────────────────────────
  const ffAdjMatch = PATTERNS.ADDL_FF_ADJ.exec(fullText);
  cbm.addlFfAdj = ffAdjMatch ? parseFloat(ffAdjMatch[1]) : 0;

  // ── Rows 20-23: Weights ───────────────────────────────────────────────────
  Object.assign(cbm, extractWeights(fullText));

  // ── Rows 24-26: Remarks section ───────────────────────────────────────────
  const remarksStart = fullText.search(/\nRemarks\n/i);
  const flightReleaseStart = fullText.search(/\nFlight Release Authorization\n/i);
  const remarksEnd = flightReleaseStart > remarksStart && remarksStart >= 0
    ? flightReleaseStart : fullText.length;

  if (remarksStart >= 0) {
    const remarksText = fullText.substring(remarksStart, remarksEnd);
    // Dedup: merge CAT II + CAT III entries for the same airport into II/III.
    const rawCat = extractCatApproaches(remarksText);
    const catByApt = new Map();
    for (const c of rawCat) {
      if (catByApt.has(c.airport)) {
        const prev = catByApt.get(c.airport);
        if (prev.category !== c.category && prev.category !== 'II/III') {
          prev.category = 'II/III';
          // Use the CAT II runway set (broader) as the merged value.
          if (c.category === 'II') prev.runways = c.runways;
        }
      } else {
        catByApt.set(c.airport, { ...c });
      }
    }
    cbm.catIiIiiApproaches = [...catByApt.values()];
    cbm.melItems = extractMelItems(remarksText);
  } else {
    cbm.catIiIiiApproaches = [];
    cbm.melItems = [];
  }

  // ── Crew section ──────────────────────────────────────────────────────────
  const fitForDutyStart = fullText.search(/\nFit for Duty[^:]*:\n/i);
  const crewEnd = fullText.search(/TO\/LNDG currency questions\?/i);
  if (fitForDutyStart > 0) {
    const crewText = fullText.substring(fitForDutyStart, crewEnd > 0 ? crewEnd : fullText.length);
    cbm.crewMembers = parseCrew(crewText);
  } else {
    cbm.crewMembers = [];
  }

  // ── Rows 27-32: Special fields ─────────────────────────────────────────────
  cbm.hasPerishables = false;
  cbm.hasTemperatureControl = false;
  cbm.dotExemption = null;
  cbm.slotTime = null;
  cbm.parsedVerbalCallsign = null;
  cbm.oeiData = [];

  // ── Row 33: navLog and Row 34: tocOffsetMins ──────────────────────────────
  const { navLog, tocOffsetMins } = parseNavLog(fullText);
  cbm.navLog = navLog;
  cbm.tocOffsetMins = tocOffsetMins !== null ? tocOffsetMins : 0;

  // ── Row 35: overflightPerms ───────────────────────────────────────────────
  cbm.overflightPerms = extractOverflightPerms(fullText);

  // ── Row 36: altRoutes ─────────────────────────────────────────────────────
  cbm.altRoutes = extractAltRoutes(fullText);

  // ── Row 37: ofpFormat/ofpSource ──────────────────────────────────────────
  cbm.ofpFormat = 'atlas-fk';
  cbm.ofpSource = 'company';

  // ── Rows 39-42: ETOPS, POR, ETP, NAT ─────────────────────────────────────
  cbm.etopsEntry = '';
  cbm.etopsSpec = '';
  cbm.etopsEntryMins = 0;
  cbm.etopsExit = '';
  cbm.etopsExitMins = 0;
  cbm.natTrack = null;

  // Row 46: POR fields
  const porM = PATTERNS.POR_HEADER.exec(fullText);
  if (porM) {
    cbm.porWpt = porM[1];
    cbm.porOffsetMins = parseInt(porM[2], 10) * 60 + parseInt(porM[3], 10);
    const porMinfM = PATTERNS.POR_MINF.exec(fullText);
    cbm.porMinf = porMinfM ? porMinfM[1] : '';
  } else {
    cbm.porWpt = '';
    cbm.porOffsetMins = 0;
    cbm.porMinf = '';
  }

  // Row 41: ETP section (Critical Fuel Scenario)
  const etpResult = parseFkEtpSection(fullText);
  cbm.etpPoints = etpResult.etpPoints;
  for (const alt of etpResult.altData) cbm.altData.push(alt);

  // ── P2b fields: NOTAMs, weather, FIR (rows 43–50) ────────────────────────
  // Parse from both column streams to handle two-column A4 landscape layout.
  const { leftLines, rightLines } = buildFkColStreams(doc);
  const notamText   = leftLines.join('\n') + '\n' + rightLines.join('\n');
  const companyMap  = new Map([
    ...parseFkCompanyNotams(leftLines),
    ...parseFkCompanyNotams(rightLines),
  ]);
  const companyIds  = new Set(companyMap.keys());
  const briefingMap = new Map([
    ...parseFkNotamBriefingItems(leftLines.join('\n'), companyIds),
    ...parseFkNotamBriefingItems(rightLines.join('\n'), companyIds),
  ]);
  const aptSentinels = parseFkAptSentinels(notamText);
  const weatherMap   = new Map([
    ...parseFkWeatherSection(leftLines.join('\n')),
    ...parseFkWeatherSection(rightLines.join('\n')),
  ]);

  // Release airports: ORIG + DEST + OFP-release alternates (altData) + EA/IA/TA sentinel roles.
  // ALTN-only airports that are not on the OFP release lines are excluded.
  const releaseIcaos = new Set([cbm.origIcao, cbm.destIcao]);
  for (const alt of cbm.altData) { if (alt.icao) releaseIcaos.add(alt.icao); }
  for (const [icao, sd] of aptSentinels) {
    if (sd.roles.some(r => ['EA', 'IA', 'TA'].includes(r.role.toUpperCase()))) {
      releaseIcaos.add(icao);
    }
  }

  cbm.airportData = {};
  _mergeFkAirportData(cbm, aptSentinels, briefingMap, companyMap, weatherMap, releaseIcaos, fixtureFindings);
  cbm.enrouteNotams = { fir: parseFkFirBlocks(notamText) };
  cbm.ddgItems = [];

  // ── Fixture pending findings ───────────────────────────────────────────────
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_PERISHABLES', severity: 'WARN',
    message: 'hasPerishables: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_TEMP_CONTROL', severity: 'WARN',
    message: 'hasTemperatureControl: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_DOT_EXEMPTION', severity: 'WARN',
    message: 'dotExemption: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_SLOT_TIME', severity: 'WARN',
    message: 'slotTime: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_VERBAL_CALLSIGN', severity: 'WARN',
    message: 'parsedVerbalCallsign: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_ETOPS', severity: 'WARN',
    message: 'etopsEntry/etopsSpec/etopsEntryMins/etopsExit/etopsExitMins: fixture pending (FlightKeys source not yet available)',
  });
  if (!cbm.porWpt) {
    fixtureFindings.push({
      code: 'FIXTURE_PENDING_POR', severity: 'WARN',
      message: 'porWpt/porOffsetMins/porMinf: fixture pending (FlightKeys source not yet available)',
    });
  }
  if (cbm.etpPoints.length === 0) {
    fixtureFindings.push({
      code: 'FIXTURE_PENDING_ETP', severity: 'WARN',
      message: 'etpPoints: fixture pending (FlightKeys source not yet available)',
    });
  }
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_NAT_TRACK', severity: 'WARN',
    message: 'natTrack: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_DDG', severity: 'WARN',
    message: 'ddgItems: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_EWINS', severity: 'WARN',
    message: 'airportData[*].ewins*: fixture pending (no FlightKeys source available)',
  });

  cbm._fixtureFindings = fixtureFindings;

  // ── Raw OFP text ──────────────────────────────────────────────────────────
  cbm.rawOFP = fullText;

  return cbm;
}

module.exports = {
  extractCbm,
  PATTERNS,
  // Internal helpers for testing
  parseAptLine,
  extractWeights,
  parseCrew,
  extractCatApproaches,
  extractMelItems,
  parseNavLog,
  extractAltRoutes,
  extractOverflightPerms,
  // P2b helpers for testing
  isFkHeaderLine,
  buildFkColStreams,
  findFkWeatherStart,
  parseFkCompanyNotams,
  parseFkNotamBriefingItems,
  parseFkAptSentinels,
  parseFkWeatherSection,
  parseFkFirBlocks,
  parseFkEtpSection,
};
