'use strict';
// validate.js — Layer 4 CBM validation (ADR-004 §4).
//
// validate(cbm) → { status: 'OK'|'WARN'|'FAIL', findings: [{code, severity, message}] }
//
// Three classes of checks:
//   1. Field validation  — per-field validators from the registry
//   2. Cross-checks      — arithmetic: TOF+TAXI=BLOCK, ZFW+TOF=TOGW, TOGW+TAXI=RAMP,
//                          TOGW−TRIP=LDGW, MINF≤TOF
//   3. Completeness      — CA present; airport NOTAM+weather; ETOPS SC fields
//
// Cross-checks 1–4 only run when the relevant canonical-only field is explicitly
// present in the CBM (tofFuelRaw, tripFuelRaw, rampWeight).  When a profile does
// not extract those fields independently the arithmetic is trivially consistent
// and running the check would always pass; the test fixtures supply all 8 values
// explicitly to exercise each check independently.
//
// All cross-check findings have severity WARN (not FAIL): the OFP carries the
// authoritative fuel load; a mismatch is a data-quality signal, not a ground stop.

const { REGISTRY } = require('./registry.js');

function _toInt(raw) {
  if (typeof raw === 'number') return raw;
  if (raw == null) return null;
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function validate(cbm) {
  const findings = [];

  // ── 0. Fixture pending findings ────────────────────────────────────────────
  // If the profile attached fixture pending findings, add them to the results
  if (cbm._fixtureFindings && Array.isArray(cbm._fixtureFindings)) {
    findings.push(...cbm._fixtureFindings);
  }

  // ── 1. Field validation ───────────────────────────────────────────────────
  for (const [key, def] of Object.entries(REGISTRY)) {
    if (!(key in cbm)) continue;
    if (!def.validate) continue;
    const err = def.validate(cbm[key]);
    if (err) {
      findings.push({
        code:     `FIELD_${key.toUpperCase()}`,
        severity: def.safetyClass === 'SC' ? 'FAIL' : 'WARN',
        message:  `${key}: ${err}`,
      });
    }
  }

  // ── 2. Cross-checks ───────────────────────────────────────────────────────
  const blockInt = _toInt(cbm.blockFuelRaw);
  const taxiInt  = _toInt(cbm.taxiFuelRaw);
  const minfInt  = _toInt(cbm.minfFuelRaw);
  const togw     = cbm.togwActual != null ? _toInt(cbm.togwActual) : null;
  const zfw      = cbm.zfwActual  != null ? _toInt(cbm.zfwActual)  : null;
  const ldgw     = cbm.ldgwActual != null ? _toInt(cbm.ldgwActual) : null;

  // Canonical-only fields — only used in checks when explicitly provided.
  const hasTof  = 'tofFuelRaw'  in cbm && cbm.tofFuelRaw  != null;
  const hasTrip = 'tripFuelRaw' in cbm && cbm.tripFuelRaw != null;
  const hasRamp = 'rampWeight'  in cbm && cbm.rampWeight  != null;

  const tofInt  = hasTof  ? _toInt(cbm.tofFuelRaw)  : null;
  const tripInt = hasTrip ? _toInt(cbm.tripFuelRaw) : null;
  const rampInt = hasRamp ? _toInt(cbm.rampWeight)  : null;

  // Check 1: TOF + TAXI = BLOCK
  if (hasTof && tofInt !== null && taxiInt !== null && blockInt !== null) {
    if (tofInt + taxiInt !== blockInt) {
      findings.push({
        code: 'XCHK_TOF_TAXI_BLOCK', severity: 'WARN',
        message: `TOF(${tofInt}) + TAXI(${taxiInt}) = ${tofInt + taxiInt} ≠ BLOCK(${blockInt})`,
      });
    }
  }

  // Check 2: ZFW + TOF = TOGW
  if (hasTof && zfw !== null && tofInt !== null && togw !== null) {
    if (zfw + tofInt !== togw) {
      findings.push({
        code: 'XCHK_ZFW_TOF_TOGW', severity: 'WARN',
        message: `ZFW(${zfw}) + TOF(${tofInt}) = ${zfw + tofInt} ≠ TOGW(${togw})`,
      });
    }
  }

  // Check 3: TOGW + TAXI = RAMP
  if (hasRamp && togw !== null && taxiInt !== null && rampInt !== null) {
    if (togw + taxiInt !== rampInt) {
      findings.push({
        code: 'XCHK_TOGW_TAXI_RAMP', severity: 'WARN',
        message: `TOGW(${togw}) + TAXI(${taxiInt}) = ${togw + taxiInt} ≠ RAMP(${rampInt})`,
      });
    }
  }

  // Check 4: TOGW − TRIP = LDGW
  if (hasTrip && togw !== null && tripInt !== null && ldgw !== null) {
    if (togw - tripInt !== ldgw) {
      findings.push({
        code: 'XCHK_TOGW_TRIP_LDGW', severity: 'WARN',
        message: `TOGW(${togw}) − TRIP(${tripInt}) = ${togw - tripInt} ≠ LDGW(${ldgw})`,
      });
    }
  }

  // Check 5: MINF ≤ TOF (tofInt derived from block−taxi when not explicit)
  const tofForMinf = hasTof ? tofInt :
    (blockInt !== null && taxiInt !== null) ? blockInt - taxiInt : null;
  if (minfInt !== null && tofForMinf !== null && minfInt > tofForMinf) {
    findings.push({
      code: 'XCHK_MINF_GT_TOF', severity: 'WARN',
      message: `MINF(${minfInt}) > TOF(${tofForMinf}): minimum fuel exceeds takeoff fuel`,
    });
  }

  // ── 3. Completeness checks ────────────────────────────────────────────────

  // 3a. CA must be present
  const crew = cbm.crewMembers;
  if (Array.isArray(crew) && !crew.some(m => m && m.role === 'CA')) {
    findings.push({
      code: 'COMPLETENESS_NO_CA', severity: 'FAIL',
      message: 'crewMembers: no CA found',
    });
  }

  // 3b. Each release airport must have NOTAM and weather or explicit nil ('').
  // Release airports: origin, destination, and altData airports (if present).
  const airports = new Set();
  if (cbm.origIcao) airports.add(cbm.origIcao);
  if (cbm.destIcao) airports.add(cbm.destIcao);
  if (cbm.altData && typeof cbm.altData === 'object') {
    for (const k of Object.keys(cbm.altData)) airports.add(k);
  }
  const apData = cbm.airportData;
  if (apData && typeof apData === 'object') {
    for (const icao of airports) {
      const ad = apData[icao];
      if (ad === undefined) continue; // profile has not provided this airport yet
      if (ad.notams === undefined || ad.notams === null) {
        findings.push({
          code: `COMPLETENESS_NOTAM_${icao}`, severity: 'WARN',
          message: `${icao}: NOTAM not provided (use empty string '' for explicit nil)`,
        });
      }
      if (ad.weather === undefined || ad.weather === null) {
        findings.push({
          code: `COMPLETENESS_WEATHER_${icao}`, severity: 'WARN',
          message: `${icao}: weather not provided (use empty string '' for explicit nil)`,
        });
      }
    }
  }

  // 3c. When ETOPS section present all ETOPS SC fields are required.
  if (cbm.etopsEntry) {
    for (const f of ['etopsSpec', 'etopsEntryMins', 'etopsExit', 'etopsExitMins']) {
      if (cbm[f] == null || cbm[f] === '') {
        findings.push({
          code: `COMPLETENESS_ETOPS_${f.toUpperCase()}`, severity: 'FAIL',
          message: `${f}: required when ETOPS section present but absent`,
        });
      }
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const hasFail = findings.some(f => f.severity === 'FAIL');
  const hasWarn = findings.some(f => f.severity === 'WARN');
  const status  = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'OK';
  return { status, findings };
}

module.exports = { validate };
