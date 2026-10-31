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
  if (headerMatch) {
    cbm.dateStr = `${headerMatch[1]} ${headerMatch[2].toUpperCase()} ${headerMatch[3]}`;
  }

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
    cbm.catIiIiiApproaches = extractCatApproaches(remarksText);
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

  // ── Rows 39-42: ETOPS, POR, ETP, NAT — not in FK P2a fixtures ────────────
  cbm.etopsEntry = '';
  cbm.etopsSpec = '';
  cbm.etopsEntryMins = 0;
  cbm.etopsExit = '';
  cbm.etopsExitMins = 0;
  cbm.porWpt = '';
  cbm.porOffsetMins = 0;
  cbm.porMinf = '';
  cbm.etpPoints = [];
  cbm.natTrack = null;

  // ── P2b fields — not in P2a scope ─────────────────────────────────────────
  cbm.enrouteNotams = null;
  cbm.airportData = {};
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
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_POR', severity: 'WARN',
    message: 'porWpt/porOffsetMins/porMinf: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_ETP', severity: 'WARN',
    message: 'etpPoints: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_NAT_TRACK', severity: 'WARN',
    message: 'natTrack: fixture pending (FlightKeys source not yet available)',
  });
  fixtureFindings.push({
    code: 'FIXTURE_PENDING_DDG', severity: 'WARN',
    message: 'ddgItems: fixture pending (FlightKeys source not yet available)',
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
};
