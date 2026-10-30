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

  // Row 3: Weight unit
  WEIGHT_UNIT: /\bB\d{3}-\d+[A-Z]*\s*\/\s*[A-Z\d]+\s*\/\s*(KGS?|LBS?)\s*\//i,

  // Row 4: Date of flight
  DATE_DOF: /DOF\/(\d{2})(\d{2})(\d{2})/i,

  // Rows 5-7: ORIG/DEST/PALT lines with Q marker
  APT_LINE: /^(ORIG|DEST|PALT)\s+([A-Z]{4})\/\S*\s+\S+\s+(Q\s+)?[NS]\d+[EW]\d+\s+(\d{4}Z)/im,

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

  // Rows 20-23: Weights
  WEIGHTS: /^(DOW|PYLD|ZFW|RAMP|TOGW|LDGW)\s+(\d+)(?:\s+\.+\s+([SL])?(\d+))?/im,

  // Row 24: CAT II/III approaches
  CAT_II_III: /^([A-Z]{4})\s+CAT\s+(II|III|II\/III)\s*-?\s*RWY\s+([0-9R\/LC]+)/im,

  // Row 25: MEL items
  MEL_ITEM: /^MEL\s+([0-9A-Z\-]+)\s*-\s*(.+)/im,

  // Row 26: Crew members (ROLE EMPNUM LAST, FIRST [..])
  CREW_MEMBER: /^(CA|FO|SEN)\s+(\d{6})\s+([A-Z][A-Z\s,]*?)(?:\s\.\.|\s+TO\/LNDG|$)/im,

  // Row 33: Nav log header
  NAVLOG_START: /^AWY\s+WPT\s+MTK/im,

  // Row 37: Overflight permits
  OVERFLIGHT_START: /^---\s+(TAKEOFF PERMIT|OVERFLIGHT PERMITS)/i,

  // Row 38: OFP format/source indicator
  FUFI_LINE: /^FUFI:\s+([0-9A-F\-]+)\s+PAGE\s+(\d+)\/(\d+)/im,
};

function extractFuelField(pattern, text) {
  const match = pattern.exec(text);
  if (!match) return null;
  // Match group 1 is the fuel value, groups 2-3 are hour.minute
  const fuelStr = match[1];
  return fuelStr;
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
  if (!match) return null;
  return match[1];
}

function extractWakeCategory(text) {
  const match = PATTERNS.FPL_WAKE.exec(text);
  if (!match) return null;
  return match[1] === 'H';
}

function parseAptLine(keyword, text) {
  // Find ORIG/DEST/PALT line
  const regex = new RegExp(`^${keyword}\\s+([A-Z]{4})/\\S*\\s+\\S+\\s+(Q\\s+)?([NS]\\d+[EW]\\d+)\\s+(\\d{4}Z)`, 'im');
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
    const limitCode = match[3];
    const limit = match[4] ? parseInt(match[4], 10) : null;

    switch (field) {
      case 'DOW':
        // Derived, not in CBM but useful for validation
        break;
      case 'PYLD':
        // Derived, not in CBM
        break;
      case 'ZFW':
        weights.zfwActual = value;
        if (limit) weights.zfwLimit = limit;
        break;
      case 'RAMP':
        // Canonical-only, not in legacy
        weights.rampWeight = value;
        break;
      case 'TOGW':
        weights.togwActual = value;
        if (limit) weights.togwLimit = limit;
        // Check for VZFW alert flag
        if (/VZFW/.test(text)) {
          weights.hasVzfwCkLimit = true;
        }
        break;
      case 'LDGW':
        weights.ldgwActual = value;
        if (limit) weights.ldgwLimit = limit;
        break;
    }
  }
  return weights;
}

function parseCrew(remarksText) {
  const crew = [];
  const lines = remarksText.split('\n');
  for (const line of lines) {
    const match = PATTERNS.CREW_MEMBER.exec(line);
    if (!match) continue;
    const role = match[1];
    const empNum = match[2];
    const nameRaw = match[3].trim();

    // Parse "LAST, FIRST" or "LAST, FIRST (MIDDLE.." format
    // Examples: "MAGGIO, MARTIN", "CORREA HINCAPIE, JUAN (PABLO"
    const commaIdx = nameRaw.indexOf(',');
    let lastName = '';
    let firstName = '';

    if (commaIdx > 0) {
      lastName = nameRaw.substring(0, commaIdx).trim();
      // Everything after comma until opening paren or end of string
      const afterComma = nameRaw.substring(commaIdx + 1);
      const parenIdx = afterComma.indexOf('(');
      firstName = (parenIdx > 0 ? afterComma.substring(0, parenIdx) : afterComma).trim();
    } else {
      // No comma found, treat whole thing as name (shouldn't happen but be safe)
      lastName = nameRaw;
    }

    crew.push({
      role,
      empNum,
      lastName,
      firstName,
      // Legacy fields
      name: `${lastName}, ${firstName}`.trim(),
      type: role,
      id: empNum,
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
    const icao = match[1];
    const category = match[2];
    const runways = match[3];

    approaches.push({
      airport: icao,
      category: category,
      runways: runways,
    });
  }
  return approaches;
}

function extractMelItems(remarksText) {
  const items = [];
  const lines = remarksText.split('\n');
  for (const line of lines) {
    const match = PATTERNS.MEL_ITEM.exec(line);
    if (!match) continue;
    const ataCode = match[1];
    const description = match[2];

    items.push({
      ataCode,
      description,
    });
  }
  return items;
}

// Main profile extraction function
function extractCbm(doc) {
  if (!doc || !doc.pages || doc.pages.length === 0) {
    return {};
  }

  // Reconstruct text from doc for pattern matching
  let fullText = '';
  for (const page of doc.pages) {
    for (const line of page.lines) {
      fullText += line.text + '\n';
    }
    fullText += '\n'; // page break
  }

  const cbm = {};

  // ── Row 1: Flight identity ────────────────────────────────────────────────
  const flightMatch = PATTERNS.FLIGHT_ID.exec(fullText);
  if (flightMatch) {
    cbm.fltNum = flightMatch[1];
    cbm.dateStr = '20' + flightMatch[2]; // Simplified; should be full date
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
    const yy = dateMatch[1];
    const mm = dateMatch[2];
    const dd = dateMatch[3];
    cbm.flightDateISO = `20${yy}-${mm}-${dd}`;
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
  if (palt) {
    cbm.altData = cbm.altData || {};
    cbm.altData[palt.icao] = {
      icao: palt.icao,
    };
  }

  // ── Row 9-12: Fuel fields ─────────────────────────────────────────────────
  const blockFuel = extractFuelField(PATTERNS.BLOCK_FUEL, fullText);
  if (blockFuel) {
    cbm.blockFuelRaw = blockFuel;
  }

  const minfFuel = extractFuelField(PATTERNS.MINF_FUEL, fullText);
  if (minfFuel) {
    cbm.minfFuelRaw = minfFuel;
  }

  const fresFuel = extractFuelField(PATTERNS.FRES_FUEL, fullText);
  if (fresFuel) {
    cbm.fresFuelRaw = fresFuel;
  }

  const taxiFuel = extractFuelField(PATTERNS.TAXI_FUEL, fullText);
  if (taxiFuel) {
    cbm.taxiFuelRaw = taxiFuel;
    const taxiTime = extractTimeField(PATTERNS.TAXI_FUEL, fullText);
    if (taxiTime) cbm.taxiMins = taxiTime;
  }

  const tripFuel = extractFuelField(PATTERNS.TRIP_FUEL, fullText);
  const tripTime = extractTimeField(PATTERNS.TRIP_FUEL, fullText);
  if (tripTime) {
    cbm.tripMinutes = tripTime;
    cbm.tripFuelRaw = tripFuel ? parseInt(tripFuel, 10) : null;
  }

  const alt1Fuel = extractFuelField(PATTERNS.ALT1_FUEL, fullText);
  if (alt1Fuel) {
    cbm.alt1Fuel = alt1Fuel;
  }

  const tofFuel = extractFuelField(PATTERNS.TOF_FUEL, fullText);
  if (tofFuel) {
    cbm.tofFuelRaw = parseInt(tofFuel, 10);
  }

  const remfFuel = extractFuelField(PATTERNS.REMF_FUEL, fullText);
  if (remfFuel) {
    cbm.destRemf = remfFuel;
  }

  // ── Row 18: ZFW INC factor ────────────────────────────────────────────────
  const zfwIncMatch = PATTERNS.ZFW_INCR_FACTOR.exec(fullText);
  if (zfwIncMatch) {
    cbm.zfwIncrFactor = parseFloat(zfwIncMatch[2]) / 1000;
  } else {
    // Field is 🔴 SILENT in FlightKeys — return legacy empty
    cbm.zfwIncrFactor = null;
  }

  // ── Row 19: Additional FF adjustment ──────────────────────────────────────
  const ffAdjMatch = PATTERNS.ADDL_FF_ADJ.exec(fullText);
  if (ffAdjMatch) {
    cbm.addlFfAdj = parseFloat(ffAdjMatch[1]);
  } else {
    // Field is 🔴 SILENT in FlightKeys — space before closing * → return empty
    cbm.addlFfAdj = 0;
  }

  // ── Rows 20-23: Weights ──────────────────────────────────────────────────
  const weights = extractWeights(fullText);
  Object.assign(cbm, weights);

  // ── Rows 24-26: Remarks section ──────────────────────────────────────────
  // Find remarks section (between "Remarks" and "Flight Release Authorization")
  const remarksStart = fullText.search(/\nRemarks\n/i);
  const flightReleaseStart = fullText.search(/\nFlight Release Authorization\n/i);
  const remarksEnd = flightReleaseStart > remarksStart && remarksStart >= 0
    ? flightReleaseStart
    : fullText.length;

  if (remarksStart >= 0) {
    const remarksText = fullText.substring(remarksStart, remarksEnd);

    // Row 24: CAT II/III approaches
    cbm.catIiIiiApproaches = extractCatApproaches(remarksText);

    // Row 25: MEL items
    cbm.melItems = extractMelItems(remarksText);
  }

  // ── Crew section (between "Fit for Duty" and "TO/LNDG currency") ──────────
  const fitForDutyStart = fullText.search(/\nFit for Duty[^:]*:\n/i);
  const crewEnd = fullText.search(/TO\/LNDG currency questions\?/i);
  const crewStart = fitForDutyStart > 0 ? fitForDutyStart : -1;

  if (crewStart >= 0) {
    const crewText = fullText.substring(crewStart, crewEnd > 0 ? crewEnd : fullText.length);
    cbm.crewMembers = parseCrew(crewText);
  }

  // ── Rows 27-32: Special fields (fixture pending or N/A) ────────────────────
  // Row 27: hasPerishables — not in FK fixtures
  cbm.hasPerishables = false;

  // Row 28: hasTemperatureControl — not in FK fixtures
  cbm.hasTemperatureControl = false;

  // Row 29: dotExemption — not in FK fixtures
  cbm.dotExemption = null;

  // Row 30: slotTime — not in FK fixtures
  cbm.slotTime = null;

  // Row 31: parsedVerbalCallsign — not in FK fixtures
  cbm.parsedVerbalCallsign = null;

  // Row 32: oeiData/TLR — not in FK fixtures
  cbm.oeiData = [];

  // ── Rows 33-42: Route, nav log, sections (🔴 SILENT, deferred) ──────────────
  // Row 33: navLog — 🔴 SILENT
  cbm.navLog = [];

  // Row 34: tocOffsetMins — 🟡 ADAPT (returns value but unverified)
  cbm.tocOffsetMins = 0;

  // Row 35: overflightPerms — 🔴 SILENT
  cbm.overflightPerms = [];

  // Row 36: altRoutes — 🔴 SILENT
  cbm.altRoutes = [];

  // Row 37: ofpSections — 🔴 SILENT
  // Return profile ID for FlightKeys
  cbm.ofpFormat = 'atlas-fk';
  cbm.ofpSource = 'company'; // FlightKeys has embedded outline

  // Row 39-42: ETOPS, POR, ETP, NAT — ❓ BLOCKER/UNVERIFIED
  // ETOPS fields — not in fixtures
  cbm.etopsEntry = '';
  cbm.etopsSpec = '';
  cbm.etopsEntryMins = 0;
  cbm.etopsExit = '';
  cbm.etopsExitMins = 0;

  // POR fields — not in fixtures
  cbm.porWpt = '';
  cbm.porOffsetMins = 0;
  cbm.porMinf = '';

  // ETP fields — not in fixtures
  cbm.etpPoints = [];

  // NAT track — not in fixtures
  cbm.natTrack = null;

  // ── P2b fields (NOTAMs, weather, briefing) — not in P2a scope ───────────────
  cbm.enrouteNotams = null;
  cbm.airportData = {};
  cbm.ddgItems = [];

  // ── Raw OFP text ──────────────────────────────────────────────────────────
  cbm.rawOFP = fullText;

  // ── Provenance tracking (attached by the engine) ────────────────────────────
  // cbm._prov = { fieldKey: { page, line, quote } }
  // Will be populated by the caller

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
};
