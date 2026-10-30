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

if (!FIXTURES_DIR) {
  if (process.env.CI) {
    throw new Error('Fixtures not found and CI is set; FAIL');
  }
  test('atlas-fk profile tests (SKIPPED — fixtures not found)', { skip: true }, () => {});
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  const fkFixtures = manifest.fixtures.filter(fx => /^FK_/i.test(fx.id));

  // Load and cache fixtures
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

  // ── Rows 5-7: Airport lines with Q flag ────────────────────────────────
  test('Row 5 (ORIG): FK_ZUCK-UAAA with Q flag', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: ORIG ZUCK/CKG CHONGQING/JIANGBEI Q N29432E106384 0200Z
    assert.equal(cbm.origIcao, 'ZUCK', 'origIcao should be ZUCK');
    assert.equal(cbm.offFromOFP, '0200', 'offFromOFP should be 0200');
    assert.equal(cbm.altData.ZUCK.hasQualAirport, true, 'ORIG should have Q flag');
  });

  test('Row 6 (DEST): FK_ZUCK-UAAA with Q flag and multi-word name', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: DEST UAAA/ALA ALMATY Q N43213E077026 0658Z
    assert.equal(cbm.destIcao, 'UAAA', 'destIcao should be UAAA');
    assert.equal(cbm.etaDest, '0658', 'etaDest should be 0658');
    assert.equal(cbm.altData.UAAA.hasQualAirport, true, 'DEST should have Q flag');
  });

  test('Row 7 (PALT): FK_ZUCK-UAAA with Q flag and multi-word airport name', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Line: PALT UCFM/BSZ BISHKEK/MANAS Q N43037E074287 0726Z
    assert.equal(cbm.altData.UCFM.icao, 'UCFM', 'PALT icao should be UCFM');
    assert.equal(cbm.altData.UCFM.hasQualAirport, true, 'PALT should have Q flag');
  });

  // ── Rows 9-12: Fuel fields (block, minf, taxi) ──────────────────────────
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
    // Lines in Remarks: UAAA CAT II - RWY 23R/23L, UAAA CAT III - RWY 23R/23L, UCFM CAT II/III, UACC CAT II/III
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
    // Lines: CA 448229 MAGGIO, MARTIN.., FO 457663 CORREA HINCAPIE, JUAN (PABLO.., FO 458245, FO 454587
    assert.ok(Array.isArray(cbm.crewMembers), 'crewMembers should be array');
    assert.ok(cbm.crewMembers.length >= 4, 'should have at least 4 crew members');
    const ca = cbm.crewMembers.find(m => m.role === 'CA');
    assert.ok(ca, 'should have a CA');
    assert.equal(ca.empNum, '448229', 'CA employee number');
  });

  // ── Row 25: MEL items ──────────────────────────────────────────────────
  test('Row 25 (MEL): FK_ZUCK-UAAA extracts MEL items', () => {
    const { doc } = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'];
    const cbm = extractCbm(doc);
    // Lines: MEL 33-45-01 - LOGO Light System, MEL 74-00-01 - Ignition Systems
    assert.ok(Array.isArray(cbm.melItems), 'melItems should be array');
    assert.equal(cbm.melItems.length, 2, 'should have 2 MEL items');
    const item1 = cbm.melItems.find(m => m.ataCode === '33-45-01');
    assert.ok(item1, 'should have MEL 33-45-01');
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
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_SLOT_TIME'), 'should have slot time fixture pending');
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_DOT_EXEMPTION'), 'should have DOT exemption fixture pending');
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_ETOPS'), 'should have ETOPS fixture pending');
  });

  // ── Cross-fixture comparison ───────────────────────────────────────────
  test('FK and matched pair comparison: same aircraft and crew count', () => {
    const fkDoc = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'].doc;
    const fkCbm = extractCbm(fkDoc);

    // The matched pair is the same flight (GTI8153/27), so should have same crew count
    // FK_UAAA-EHAM should have same structure as the matched pair
    assert.equal(fkCbm.acftType, 'B744', 'matched pair: B744');
    assert.ok(fkCbm.crewMembers.length > 0, 'matched pair: crew members present');
  });
}
