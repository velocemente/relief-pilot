'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { adaptItems } = require('../../src/import/adapter-pdf');
const { extractCbm } = require('../../src/import/atlas-fk');
const { validate } = require('../../src/import/validate');

// ── Fixtures path resolution ──────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_CANDIDATES = [
  process.env.PB_FIXTURES,
  path.join(ROOT, 'fixtures'),
  path.join(ROOT, '..', 'pilotbrief-fixtures'),
].filter(Boolean);
const FIXTURES_DIR = FIXTURES_CANDIDATES.find(d => {
  try { return fs.existsSync(path.join(d, 'manifest.json')); } catch (_) { return false; }
});

// Helper to build a minimal Doc for negative/unit tests
function makeDoc(lines) {
  return { pages: [{ lines: lines.map(text => ({ text })) }] };
}

if (!FIXTURES_DIR) {
  if (process.env.CI) {
    throw new Error('Fixtures not found and CI is set; FAIL');
  }
  test('atlas-fk profile tests (SKIPPED — fixtures not found)', { skip: true }, () => {});
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  const fkFixtures = manifest.fixtures.filter(fx => /^FK_/i.test(fx.id));

  const fixtureData = {};
  for (const fx of fkFixtures) {
    const itemsPath = path.join(FIXTURES_DIR, fx.files.items);
    if (fs.existsSync(itemsPath)) {
      const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
      const doc = adaptItems(itemsDoc);
      fixtureData[fx.id] = { doc, manifest: fx };
    }
  }

  // ── Row 1: Flight identity (fltNum, dateStr) ────────────────────────────
  test('Row 1 (FLIGHT_ID): FK_ZUCK-UAAA extracts flight number and date', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: GTI8153/26 ZUCK - UAAA 27 OCT 26 N498MC
    assert.equal(cbm.fltNum, 'GTI8153', 'fltNum should be GTI8153');
    assert.equal(cbm.dateStr, '27 OCT 26', 'dateStr should be legacy format 27 OCT 26');
  });

  test('Row 1 (FLIGHT_ID): FK_UAAA-EHAM extracts correct values', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: GTI8153/27 UAAA - EHAM 27 OCT 26 N498MC
    assert.equal(cbm.fltNum, 'GTI8153', 'fltNum should be GTI8153');
    assert.equal(cbm.dateStr, '27 OCT 26', 'dateStr should be 27 OCT 26');
  });

  // ── Row 2: Aircraft type and wake category ──────────────────────────────
  test('Row 2 (AIRCRAFT_TYPE): FK_ZUCK-UAAA extracts B744 as heavy', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // FPL: -B744/H-SDE1E2E3FGHIJ3J7M3P2RWXYZ
    assert.equal(cbm.acftType, 'B744', 'acftType should be B744');
    assert.equal(cbm.isHeavy, true, 'isHeavy should be true for wake H');
  });

  // ── Row 3: Weight unit ──────────────────────────────────────────────────
  test('Row 3 (WEIGHT_UNIT): FK fixtures use KGS', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: B747-400F / CF6-80C2-B1F / KG / IFR / FF +5.4
    assert.equal(cbm.weightUnit, 'KGS', 'weightUnit should be KGS (normalized from KG)');
  });

  // ── Rows 5-7: ORIG/DEST/PALT with Q flag ──────────────────────────────
  test('Row 5 (ORIG): FK_ZUCK-UAAA extracts icao, offFromOFP, Q flag', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: ORIG ZUCK/CKG CHONGQING/JIANGBEI Q N29432E106384 0200Z
    assert.equal(cbm.origIcao, 'ZUCK', 'origIcao should be ZUCK');
    assert.equal(cbm.offFromOFP, '0200', 'offFromOFP should be 0200');
    assert.ok(Array.isArray(cbm.qualAirports), 'qualAirports should be array');
    assert.ok(cbm.qualAirports.includes('ZUCK'), 'ZUCK should be in qualAirports (has Q)');
  });

  test('Row 6 (DEST): FK_ZUCK-UAAA extracts icao, etaDest, Q flag', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: DEST UAAA/ALA ALMATY Q N43213E077026 0658Z
    assert.equal(cbm.destIcao, 'UAAA', 'destIcao should be UAAA');
    assert.equal(cbm.etaDest, '0658', 'etaDest should be 0658');
    assert.ok(cbm.qualAirports.includes('UAAA'), 'UAAA should be in qualAirports (has Q)');
  });

  test('Row 7 (PALT): FK_ZUCK-UAAA altData array shape, role, ofpOffsetMins, Q flag', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: PALT UCFM/BSZ BISHKEK/MANAS Q N43037E074287 0726Z
    assert.ok(Array.isArray(cbm.altData), 'altData should be array');
    const ucfm = cbm.altData.find(a => a.icao === 'UCFM');
    assert.ok(ucfm, 'UCFM should be in altData');
    assert.equal(ucfm.role, 'DEST ALT', 'role should be DEST ALT');
    assert.equal(ucfm.ofpEta, '0726', 'ofpEta should be 0726');
    assert.equal(ucfm.currentEta, '0726', 'currentEta should equal ofpEta in P2a');
    assert.equal(ucfm.ofpOffsetMins, 326, 'ofpOffsetMins: 0726-0200 = 326 min');
    assert.ok(cbm.qualAirports.includes('UCFM'), 'UCFM should be in qualAirports (has Q)');
  });

  test('Row 7 (PALT): ORIG and DEST must NOT be in altData', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.ok(!cbm.altData.find(a => a.icao === 'ZUCK'), 'ORIG should not be in altData');
    assert.ok(!cbm.altData.find(a => a.icao === 'UAAA'), 'DEST should not be in altData');
  });

  // ── Finding 3: EBBR alternate (multi-word name BRUSSELS NATIONAL) ──────
  test('Row 7 (PALT): FK_UAAA-EHAM has EBBR alternate with role and ETA', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: PALT EBBR/BRU BRUSSELS NATIONAL N50541E004291 1733Z  (no Q)
    assert.ok(Array.isArray(cbm.altData), 'altData should be array');
    const ebbr = cbm.altData.find(a => a.icao === 'EBBR');
    assert.ok(ebbr, 'EBBR should be in altData');
    assert.equal(ebbr.role, 'DEST ALT', 'role should be DEST ALT');
    assert.equal(ebbr.ofpEta, '1733', 'ofpEta should be 1733');
    assert.equal(ebbr.ofpOffsetMins, 493, 'ofpOffsetMins: 1733-0920 = 493 min');
  });

  // ── Q flag absent for EHAM and EBBR ────────────────────────────────────
  test('qualAirports: EHAM and EBBR absent; UAAA present (FK_UAAA-EHAM)', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // DEST EHAM/AMS AMSTERDAM/SCHIPHOL N52185E004459 1706Z (no Q)
    // PALT EBBR/BRU BRUSSELS NATIONAL N50541E004291 1733Z  (no Q)
    // ORIG UAAA/ALA ALMATY Q N43213E077026 0920Z (has Q)
    assert.ok(!cbm.qualAirports.includes('EHAM'), 'EHAM should NOT be in qualAirports');
    assert.ok(!cbm.qualAirports.includes('EBBR'), 'EBBR should NOT be in qualAirports');
    assert.ok(cbm.qualAirports.includes('UAAA'), 'UAAA should be in qualAirports (has Q)');
  });

  // ── Rows 9-12: Fuel fields ─────────────────────────────────────────────
  test('Row 9 (BLOCK_FUEL): FK_ZUCK-UAAA extracts correct value', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: BLOCK 078200 07.28
    assert.equal(cbm.blockFuelRaw, '078200', 'blockFuelRaw should be 078200');
  });

  test('Row 10 (MINF_FUEL): FK_ZUCK-UAAA extracts correct value', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: MINF 064387 05.52
    assert.equal(cbm.minfFuelRaw, '064387', 'minfFuelRaw should be 064387');
  });

  test('Row 12 (TAXI_FUEL): FK_ZUCK-UAAA extracts fuel and time', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: TAXI 001350 00.30
    assert.equal(cbm.taxiFuelRaw, '001350', 'taxiFuelRaw should be 001350');
    assert.equal(cbm.taxiMins, 30, 'taxiMins should be 30 (from 00.30)');
  });

  // ── Rows 20-22: Weights ────────────────────────────────────────────────
  test('Row 20 (ZFW): FK_ZUCK-UAAA extracts actual and limit', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: ZFW 270718 ...... S288031
    assert.equal(cbm.zfwActual, 270718, 'zfwActual should be 270718');
    assert.equal(cbm.zfwLimit, 288031, 'zfwLimit should be 288031');
  });

  test('Row 21 (TOGW): FK_ZUCK-UAAA with VZFW alert flag', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: TOGW 347568 ...... L352676 MTOW LTD BY VZFW/CK LIMITS
    assert.equal(cbm.togwActual, 347568, 'togwActual should be 347568');
    assert.equal(cbm.togwLimit, 352676, 'togwLimit should be 352676');
    assert.equal(cbm.hasVzfwCkLimit, true, 'hasVzfwCkLimit should be true');
  });

  test('Row 22 (LDGW): FK_ZUCK-UAAA extracts actual and limit', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: LDGW 296984 S302092
    assert.equal(cbm.ldgwActual, 296984, 'ldgwActual should be 296984');
    assert.equal(cbm.ldgwLimit, 302092, 'ldgwLimit should be 302092');
  });

  // ── Row 24: CAT II/III approaches ──────────────────────────────────────
  test('Row 24 (CAT_II_III): FK_ZUCK-UAAA extracts all approaches', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.catIiIiiApproaches), 'catIiIiiApproaches should be array');
    assert.equal(cbm.catIiIiiApproaches.length, 4, 'should have 4 CAT approaches');
    const uaaaIi = cbm.catIiIiiApproaches.find(a => a.airport === 'UAAA' && a.category === 'II');
    assert.ok(uaaaIi, 'should have UAAA CAT II');
    assert.equal(uaaaIi.runways, '23R/23L', 'UAAA CAT II runways');
  });

  // ── Row 26: Crew members ───────────────────────────────────────────────
  test('Row 26 (CREW): FK_ZUCK-UAAA extracts crew with CA present', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.crewMembers), 'crewMembers should be array');
    assert.ok(cbm.crewMembers.length >= 4, 'should have at least 4 crew members');
    const ca = cbm.crewMembers.find(m => m.role === 'CA');
    assert.ok(ca, 'should have a CA');
    assert.ok(/^\d{6}$/.test(ca.empNum), 'CA empNum is 6 digits');
  });

  // ── Row 25: MEL items ──────────────────────────────────────────────────
  test('Row 25 (MEL): FK_ZUCK-UAAA extracts MEL items', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.melItems), 'melItems should be array');
    assert.equal(cbm.melItems.length, 2, 'should have 2 MEL items');
    assert.ok(cbm.melItems.find(m => m.ataCode === '33-45-01'), 'should have MEL 33-45-01');
  });

  // ── Row 33/34: navLog and tocOffsetMins ────────────────────────────────
  test('Row 33/34 (NAVLOG/TOC): FK_ZUCK-UAAA navLog has TOC at 18 min', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Nav log: W80 TOC ... E105 15.7 ... 00.18 (TOT-T=18 min)
    assert.ok(Array.isArray(cbm.navLog) && cbm.navLog.length > 0, 'navLog should have entries');
    const toc = cbm.navLog.find(e => e.wpt === 'TOC');
    assert.ok(toc, 'TOC should be in navLog');
    assert.equal(toc.elapsedMins, 18, 'TOC elapsed should be 18 min');
    assert.equal(cbm.tocOffsetMins, 18, 'tocOffsetMins should be 18');
  });

  test('Row 33/34 (NAVLOG/TOC): FK_UAAA-EHAM tocOffsetMins=14', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Nav log: TIPSA1A TOC ... E075 33.4 ... 00.14 (TOT-T=14 min)
    assert.equal(cbm.tocOffsetMins, 14, 'tocOffsetMins should be 14');
    const toc = cbm.navLog.find(e => e.wpt === 'TOC');
    assert.ok(toc, 'TOC should be in navLog');
    assert.equal(toc.elapsedMins, 14, 'TOC elapsed should be 14 min');
  });

  // ── Row 35: overflightPerms ────────────────────────────────────────────
  test('Row 35 (OVERFLIGHT_PERMS): FK_ZUCK-UAAA has takeoff permit', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Section: --- TAKEOFF PERMIT\nCHINA CAD/2026W0508\n...
    assert.equal(typeof cbm.overflightPerms, 'string', 'overflightPerms should be string');
    assert.ok(cbm.overflightPerms.startsWith('---'), 'should start with ---');
    assert.ok(cbm.overflightPerms.includes('CHINA'), 'should include CHINA permit');
  });

  test('Row 35 (OVERFLIGHT_PERMS): FK_UAAA-EHAM has overflight permits', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Section: --- OVERFLIGHT PERMITS\nUZBEKISTAN 09/26/433\n...
    assert.equal(typeof cbm.overflightPerms, 'string', 'overflightPerms should be string');
    assert.ok(cbm.overflightPerms.includes('UZBEKISTAN'), 'should include UZBEKISTAN permit');
  });

  // ── Row 36: altRoutes ──────────────────────────────────────────────────
  test('Row 36 (ALT_ROUTES): FK_ZUCK-UAAA extracts alternate route with MORA', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Section: Destination Primary Alternate Route\nUAAA R05R EKLAT...UCFM\nMORA 9900
    assert.ok(Array.isArray(cbm.altRoutes) && cbm.altRoutes.length >= 1, 'altRoutes should have at least 1 entry');
    const destAlt = cbm.altRoutes.find(r => r.title === 'Destination Primary Alternate Route');
    assert.ok(destAlt, 'should have Destination Primary Alternate Route');
    assert.ok(destAlt.route.includes('UAAA'), 'route should include departure airport');
    assert.ok(destAlt.route.endsWith('UCFM'), 'route should end at UCFM');
    assert.equal(destAlt.mora, '9900', 'MORA should be 9900');
  });

  test('Row 36 (ALT_ROUTES): FK_UAAA-EHAM extracts alternate route', () => {
    const { doc } = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Section: Destination Primary Alternate Route\nEHAM L18R WOODY WOODY9A EBBR
    const destAlt = cbm.altRoutes.find(r => r.title === 'Destination Primary Alternate Route');
    assert.ok(destAlt, 'should have Destination Primary Alternate Route');
    assert.ok(destAlt.route.includes('EBBR'), 'route should end at EBBR');
  });

  // ── Fixture pending findings ───────────────────────────────────────────
  test('Fixture pending findings: all missing fields generate WARN findings', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    const validation = validate(cbm);

    const pendingCodes = validation.findings
      .filter(f => f.severity === 'WARN' && f.code.startsWith('FIXTURE_PENDING'))
      .map(f => f.code);

    assert.ok(pendingCodes.length > 0, 'should have fixture pending findings');
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_SLOT_TIME'), 'FIXTURE_PENDING_SLOT_TIME');
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_DOT_EXEMPTION'), 'FIXTURE_PENDING_DOT_EXEMPTION');
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_ETOPS'), 'FIXTURE_PENDING_ETOPS');
  });

  // ── Negative tests — safety-critical fields ────────────────────────────
  // For each SC field: missing/doctored input → empty value + finding, never wrong value.

  test('NEGATIVE (block fuel): missing BLOCK line → empty string + FAIL finding', () => {
    const doc = makeDoc(['GTI8153/26 ZUCK - UAAA 27 OCT 26', 'MINF 064387 05.52']);
    const cbm = extractCbm(doc);
    assert.equal(cbm.blockFuelRaw, '', 'blockFuelRaw should be empty when BLOCK line missing');
    const v = validate(cbm);
    const failCodes = v.findings.filter(f => f.severity === 'FAIL').map(f => f.code);
    assert.ok(failCodes.includes('FIELD_BLOCKFUELRAW'), 'should have FIELD_BLOCKFUELRAW FAIL');
  });

  test('NEGATIVE (min fuel): missing MINF line → empty string + FAIL finding', () => {
    const doc = makeDoc(['GTI8153/26 ZUCK - UAAA 27 OCT 26', 'BLOCK 078200 07.28']);
    const cbm = extractCbm(doc);
    assert.equal(cbm.minfFuelRaw, '', 'minfFuelRaw should be empty when MINF line missing');
    const v = validate(cbm);
    const failCodes = v.findings.filter(f => f.severity === 'FAIL').map(f => f.code);
    assert.ok(failCodes.includes('FIELD_MINFFUELRAW'), 'should have FIELD_MINFFUELRAW FAIL');
  });

  test('NEGATIVE (taxi fuel): missing TAXI line → empty string + FAIL finding', () => {
    const doc = makeDoc(['GTI8153/26 ZUCK - UAAA 27 OCT 26', 'BLOCK 078200 07.28']);
    const cbm = extractCbm(doc);
    assert.equal(cbm.taxiFuelRaw, '', 'taxiFuelRaw should be empty when TAXI line missing');
    const v = validate(cbm);
    const failCodes = v.findings.filter(f => f.severity === 'FAIL').map(f => f.code);
    assert.ok(failCodes.includes('FIELD_TAXIFUELRAW'), 'should have FIELD_TAXIFUELRAW FAIL');
  });

  test('NEGATIVE (crew/CA): no CA line → COMPLETENESS_NO_CA FAIL finding', () => {
    // Fit for Duty section with only FO — no CA. Leading line ensures regex finds \n before header.
    // Synthetic crew line uses invented number and name — no fixture data.
    const doc = makeDoc([
      'GTI8153/26 ZUCK - UAAA 27 OCT 26',
      'Fit for Duty Attestation:',
      'FO 999001 SMITH TO/LNDG',
      'TO/LNDG currency questions?',
    ]);
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.crewMembers), 'crewMembers should be array');
    assert.ok(!cbm.crewMembers.find(m => m.role === 'CA'), 'no CA should be found');
    const v = validate(cbm);
    const failCodes = v.findings.filter(f => f.severity === 'FAIL').map(f => f.code);
    assert.ok(failCodes.includes('COMPLETENESS_NO_CA'), 'should have COMPLETENESS_NO_CA FAIL');
  });

  test('NEGATIVE (CAT II/III): no CAT lines → empty array, no bogus value', () => {
    const doc = makeDoc([
      'Remarks', 'Nothing here.', 'Flight Release Authorization',
    ]);
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.catIiIiiApproaches), 'catIiIiiApproaches should be array');
    assert.equal(cbm.catIiIiiApproaches.length, 0, 'should be empty when no CAT lines');
  });

  test('NEGATIVE (slot time): FK fixture has no slot time → null + FIXTURE_PENDING finding', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.equal(cbm.slotTime, null, 'slotTime should be null (not in FK fixture)');
    const v = validate(cbm);
    const warnCodes = v.findings.map(f => f.code);
    assert.ok(warnCodes.includes('FIXTURE_PENDING_SLOT_TIME'), 'should have FIXTURE_PENDING_SLOT_TIME');
  });

  test('NEGATIVE (DOT exemption): FK fixture has no DOT exemption → null + FIXTURE_PENDING finding', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.equal(cbm.dotExemption, null, 'dotExemption should be null (not in FK fixture)');
    const v = validate(cbm);
    const warnCodes = v.findings.map(f => f.code);
    assert.ok(warnCodes.includes('FIXTURE_PENDING_DOT_EXEMPTION'), 'should have FIXTURE_PENDING_DOT_EXEMPTION');
  });

  test('NEGATIVE (ETOPS): FK fixture has no ETOPS section → empty fields + FIXTURE_PENDING finding', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    assert.equal(cbm.etopsEntry, '', 'etopsEntry should be empty string');
    // No ETOPS entry means COMPLETENESS_ETOPS_* not triggered (entry guards the check)
    const v = validate(cbm);
    const warnCodes = v.findings.map(f => f.code);
    assert.ok(warnCodes.includes('FIXTURE_PENDING_ETOPS'), 'should have FIXTURE_PENDING_ETOPS');
  });

  test('navLog: TOP OF STEP CLB/DSC and FIR boundary rows excluded; flanking waypoints kept', () => {
    // navLog holds only {wpt, elapsedMins} waypoints.  Multi-word step markers
    // (e.g. "W195 TOP OF STEP CLB") and slash FIR pairs ("URRV/UUWW") do not
    // match the single-token waypoint regex, so they are silently excluded by
    // design (FIR is row 49, P2b scope).
    const doc = makeDoc([
      'AWY WPT MTK NM GS TAS LEG-T ETA ATA',
      '                            MORA TTK MH IAS TOT-T FL TEMP WIND',
      // normal waypoint before TOP OF STEP CLB
      'A599 NAPOD',
      'N49 48.2',
      'E046 12.7 270 273 300 791 01.30',
      // TOP OF STEP CLB — multi-word, must not appear in navLog
      'W195 TOP OF STEP CLB',
      'N50 22.2',
      'E047 00.0 270 273 300 791 01.45',
      // normal waypoint right after TOP OF STEP CLB
      'A599 SUNOT',
      'N51 11.1',
      'E048 00.0 270 273 300 791 02.00',
      // FIR boundary — slash pair, must not appear in navLog
      'URRV/UUWW',
      'N51 22.3',
      'E049 00.0 270 273 300 791 02.15',
      // normal waypoint right after FIR boundary
      'A599 RATAM',
      'N52 00.0',
      'E050 00.0 270 273 300 791 02.30',
      // TOP OF STEP DSC — multi-word, must not appear in navLog
      'NORKU2A TOP OF STEP DSC',
      'N53 00.0',
      'E051 00.0 270 273 300 791 02.45',
      // normal waypoint right after TOP OF STEP DSC
      'A599 ARTKO',
      'N54 00.0',
      'E052 00.0 270 273 300 791 03.00',
    ]);
    const cbm = extractCbm(doc);
    assert.ok(Array.isArray(cbm.navLog), 'navLog should be array');
    const wpts = cbm.navLog.map(e => e.wpt);
    // flanking waypoints present
    assert.ok(wpts.includes('NAPOD'), 'NAPOD (before TOP OF STEP CLB) should be in navLog');
    assert.ok(wpts.includes('SUNOT'), 'SUNOT (after TOP OF STEP CLB) should be in navLog');
    assert.ok(wpts.includes('RATAM'), 'RATAM (after FIR boundary) should be in navLog');
    assert.ok(wpts.includes('ARTKO'), 'ARTKO (after TOP OF STEP DSC) should be in navLog');
    // step and FIR tokens absent
    assert.ok(!wpts.some(w => w === 'TOP' || w === 'STEP' || w === 'CLB' || w === 'DSC'),
      'TOP/STEP/CLB/DSC tokens must not appear as wpt names');
    assert.ok(!wpts.some(w => w.includes('/')), 'slash FIR pairs must not appear as wpt names');
    // elapsed times match expected values
    assert.equal(cbm.navLog.find(e => e.wpt === 'NAPOD').elapsedMins, 90,  'NAPOD 01.30 = 90 min');
    assert.equal(cbm.navLog.find(e => e.wpt === 'SUNOT').elapsedMins, 120, 'SUNOT 02.00 = 120 min');
    assert.equal(cbm.navLog.find(e => e.wpt === 'RATAM').elapsedMins, 150, 'RATAM 02.30 = 150 min');
    assert.equal(cbm.navLog.find(e => e.wpt === 'ARTKO').elapsedMins, 180, 'ARTKO 03.00 = 180 min');
  });

  test('NEGATIVE (dateStr): absent/malformed flight-header → empty string + FIELD_DATESTR WARN', () => {
    // No flight-header line matching "FLTNUM/N ICAO - ICAO DD MMM YY"
    const doc = makeDoc([
      'BLOCK 078200 07.28',
      'MINF 064387 05.52',
    ]);
    const cbm = extractCbm(doc);
    assert.equal(cbm.dateStr, '', 'dateStr must be empty string, not a guessed date');
    const v = validate(cbm);
    const warnCodes = v.findings.filter(f => f.severity === 'WARN').map(f => f.code);
    assert.ok(warnCodes.includes('FIELD_DATESTR'), 'should have FIELD_DATESTR WARN');
  });

  // ── Cross-fixture comparison ───────────────────────────────────────────
  test('FK and matched pair comparison: same aircraft and crew count', () => {
    const fkDoc = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'].doc;
    const fkCbm = extractCbm(fkDoc);
    // GTI8153/27 on same B744 aircraft
    assert.equal(fkCbm.acftType, 'B744', 'matched pair: B744');
    assert.ok(fkCbm.crewMembers.length > 0, 'matched pair: crew members present');
  });
}
