'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { adaptItems } = require('../../src/import/adapter-pdf');
const {
  extractCbm,
  isFkHeaderLine,
  findFkWeatherStart,
  parseFkCompanyNotams,
  parseFkNotamBriefingItems,
  parseFkAptSentinels,
  parseFkWeatherSection,
  parseFkFirBlocks,
  parseFkEtpSection,
  buildFkColStreams,
} = require('../../src/import/atlas-fk');
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
    // UAAA CAT II + CAT III are merged into one II/III entry (dedup rule).
    assert.equal(cbm.catIiIiiApproaches.length, 3, 'should have 3 CAT approaches after II/III merge');
    const uaaaEntry = cbm.catIiIiiApproaches.find(a => a.airport === 'UAAA');
    assert.ok(uaaaEntry, 'should have UAAA entry');
    assert.equal(uaaaEntry.category, 'II/III', 'UAAA CAT II and III merged');
    assert.equal(uaaaEntry.runways, '23R/23L', 'UAAA merged runways');
    // Each airport appears at most once.
    const seen = new Set(cbm.catIiIiiApproaches.map(a => a.airport));
    assert.equal(seen.size, cbm.catIiIiiApproaches.length, 'no duplicate airport entries');
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

  // ── P2b unit tests (row 50 header detection) ──────────────────────────
  test('P2b isFkHeaderLine: detects Page/uuid lines', () => {
    assert.ok(isFkHeaderLine('Page 3 of 10 c1466562-9aa9-4e26-b65a-1149716c894f'), 'Page N of N uuid = header');
    assert.ok(!isFkHeaderLine('ZUCK A0926/26'), 'NOTAM ID is not a header');
    assert.ok(!isFkHeaderLine('TAF ZUCK 262113Z'), 'TAF line is not a header');
    assert.ok(!isFkHeaderLine(''), 'empty string is not a header');
    assert.ok(isFkHeaderLine('GTI8153/26 ZUCK-UAAA 2026-10-27'), 'flt/route/date = header');
  });

  // ── P2b unit tests (findFkWeatherStart) ────────────────────────────────
  test('P2b NEGATIVE (findFkWeatherStart): no COMPANY NOTAMS → fullText.length', () => {
    const text = 'Some text\nPage 5 of 5 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\nMore text';
    assert.equal(findFkWeatherStart(text), text.length, 'no COMPANY NOTAMS → length');
  });

  test('P2b NEGATIVE (findFkWeatherStart): Page 1 of 1 → not weather start', () => {
    const text = 'COMPANY NOTAMS\nPage 1 of 1 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\nweather';
    assert.equal(findFkWeatherStart(text), text.length, 'Page 1 of 1 not a valid boundary');
  });

  test('P2b POSITIVE (findFkWeatherStart): Page N of N (N>1) after COMPANY NOTAMS', () => {
    const uuid = 'c1466562-9aa9-4e26-b65a-1149716c894f';
    const trailer = `Page 2 of 2 ${uuid}`;
    const text = `COMPANY NOTAMS\nPage 1 of 2 ${uuid}\nsome notam\n${trailer}\nMETAR ZUCK`;
    const start = findFkWeatherStart(text);
    assert.ok(start > 0 && start < text.length, 'weather start found within text');
    assert.ok(text.slice(start).trim().startsWith('METAR'), 'weather starts after last page marker');
  });

  // ── P2b unit tests (parseFkCompanyNotams) ─────────────────────────────
  test('P2b POSITIVE (parseFkCompanyNotams): curfew NOTAM detected', () => {
    const lines = [
      'ZUCK A0926/26 2026-Sep-01 00:00 - UFN',
      'SUBJECT: ZUCK-CURFEW',
      'CURFEW APPLIES 0000-0100 UTC DAILY',
    ];
    const result = parseFkCompanyNotams(lines);
    assert.ok(result.has('ZUCK A0926/26'), 'curfew NOTAM keyed by ID');
    const entry = result.get('ZUCK A0926/26');
    assert.equal(entry.icao, 'ZUCK', 'ICAO from subject prefix');
    assert.equal(entry.type, 'curfew', 'type = curfew');
    assert.ok(entry.body.includes('CURFEW'), 'body captured');
  });

  test('P2b POSITIVE (parseFkCompanyNotams): opsNotes NOTAM detected', () => {
    const lines = [
      'EHAM A0301/26 2026-Aug-25 00:00 - UFN',
      'SUBJECT: EHAM-OPS',
      'OPS NOTE BODY TEXT',
    ];
    const result = parseFkCompanyNotams(lines);
    const entry = result.get('EHAM A0301/26');
    assert.ok(entry, 'opsNotes NOTAM found');
    assert.equal(entry.type, 'opsNotes', 'type = opsNotes');
  });

  test('P2b NEGATIVE (parseFkCompanyNotams): fleet NOTAM (no ICAO prefix) → skipped', () => {
    const lines = [
      'ZUCK A0099/26 2026-Jan-01 00:00 - UFN',
      'SUBJECT: B747-FMDW400',
      'FALSE MAIN DECK WARNINGS',
    ];
    const result = parseFkCompanyNotams(lines);
    assert.equal(result.size, 0, 'fleet NOTAM must be skipped (no ICAO prefix)');
  });

  test('P2b NEGATIVE (parseFkCompanyNotams): no SUBJECT → not a company NOTAM', () => {
    const lines = [
      'ZUCK A0099/26 2026-Jan-01 00:00 - UFN',
      'RUNWAY 02L/20R CLOSED',
    ];
    const result = parseFkCompanyNotams(lines);
    assert.equal(result.size, 0, 'no SUBJECT = not a company NOTAM');
  });

  // ── P2b unit tests (parseFkNotamBriefingItems) ─────────────────────────
  test('P2b POSITIVE (parseFkNotamBriefingItems): briefing item captured', () => {
    const text = 'EHAM A2476/26 2026-Oct-26 06:00 - 2026-Oct-27\nRWY 04/22 CLSD FOR MAINTENANCE';
    const result = parseFkNotamBriefingItems(text, new Set());
    assert.ok(result.has('EHAM A2476/26'), 'EHAM NOTAM briefing item found');
    const item = result.get('EHAM A2476/26');
    assert.equal(item.icao, 'EHAM');
    assert.ok(item.body.includes('RWY'), 'body captured');
  });

  test('P2b NEGATIVE (parseFkNotamBriefingItems): item in companyIds → skipped', () => {
    const text = 'ZUCK A0926/26 2026-Sep-01 00:00 - UFN\nRWY CLSD';
    const result = parseFkNotamBriefingItems(text, new Set(['ZUCK A0926/26']));
    assert.equal(result.size, 0, 'item in companyIds must be excluded from briefing items');
  });

  test('P2b POSITIVE (parseFkNotamBriefingItems): NOTAM ID without dates (YTOL split)', () => {
    const text = 'ZUCK U4106/26\nRWY U4106/26 NOTAM BODY TEXT';
    const result = parseFkNotamBriefingItems(text, new Set());
    assert.ok(result.has('ZUCK U4106/26'), 'NOTAM ID without dates must still be captured');
  });

  // ── P2b unit tests (parseFkAptSentinels) ─────────────────────────────
  test('P2b POSITIVE (parseFkAptSentinels): RWYs parsed from APT sentinel', () => {
    const text = 'AMS - AMSTERDAM/SCHIPHOL   DESTINATION 27 16:06 - 27 18:06\nAPTEHAM RWYS: 04/22 06/24';
    const result = parseFkAptSentinels(text);
    assert.ok(result.has('EHAM'), 'EHAM entry created');
    assert.ok(result.get('EHAM').rwys.includes('04/22'), 'RWY 04/22 captured');
  });

  test('P2b POSITIVE (parseFkAptSentinels): role from city header attached to airport', () => {
    const text = 'BRU - BRUSSELS NATIONAL   ALTN 1 27 16:33 - 27 18:33\nAPTEBBR RWYS: 01/19 07L/25R';
    const result = parseFkAptSentinels(text);
    assert.ok(result.has('EBBR'), 'EBBR entry created');
    const roles = result.get('EBBR').roles;
    assert.ok(roles.length > 0, 'EBBR has at least one role');
  });

  test('P2b NEGATIVE (parseFkAptSentinels): no APT line → empty map', () => {
    const text = 'SOME NOTAM TEXT\nNO AIRPORT SENTINELS HERE';
    const result = parseFkAptSentinels(text);
    assert.equal(result.size, 0, 'no APT sentinels → empty map');
  });

  // ── P2b unit tests (parseFkWeatherSection) ─────────────────────────────
  test('P2b POSITIVE (parseFkWeatherSection): TAF captured', () => {
    const text = 'TAF ZUCK 262113Z 2700/2724 01003MPS 3500 -RA BR\n  TEMPO 2706/2712 5000 -RA';
    const result = parseFkWeatherSection(text);
    assert.ok(result.has('ZUCK'), 'ZUCK weather entry created');
    assert.ok(result.get('ZUCK').taf && result.get('ZUCK').taf.startsWith('TAF ZUCK'), 'TAF content captured');
  });

  test('P2b POSITIVE (parseFkWeatherSection): METAR captured', () => {
    const text = 'METAR UCFM 262200Z 24002MPS 9999 FEW020 10/04 Q1014';
    const result = parseFkWeatherSection(text);
    assert.ok(result.has('UCFM'), 'UCFM METAR entry created');
    assert.ok(result.get('UCFM').metars.length > 0, 'METAR captured');
  });

  test('P2b NEGATIVE (parseFkWeatherSection): empty text → empty map', () => {
    const result = parseFkWeatherSection('');
    assert.equal(result.size, 0, 'empty text → empty map');
  });

  // ── P2b unit tests (parseFkFirBlocks) ─────────────────────────────────
  test('P2b POSITIVE (parseFkFirBlocks): FIR sentinel detected', () => {
    const text = 'KUNMING FIR\nFIRZPKM   ZPKM A0001/26   2026-Oct-27 02:00 - UFN';
    const result = parseFkFirBlocks(text);
    assert.ok(result.length > 0, 'FIR block created');
    assert.equal(result[0].icao, 'ZPKM', 'ICAO from compact sentinel');
  });

  test('P2b POSITIVE (parseFkFirBlocks): item on same line as sentinel', () => {
    // "FIRZLHW    ZWUQ A5552/26   2026-Oct-27 02:30 - UFN" — item follows sentinel on same line
    const text = 'LANZHOU FIR\nFIRZLHW    ZWUQ A5552/26   2026-Oct-27 02:30 - UFN';
    const result = parseFkFirBlocks(text);
    assert.ok(result.length > 0, 'FIR block created');
    assert.ok(result[0].items.length > 0, 'item on sentinel line captured');
  });

  test('P2b NEGATIVE (parseFkFirBlocks): no FIR sentinel → empty array', () => {
    const text = 'SOME NOTAM TEXT WITHOUT FIR SENTINEL';
    const result = parseFkFirBlocks(text);
    assert.equal(result.length, 0, 'no FIR sentinel → empty array');
  });

  // ── P2b fixture integration tests ─────────────────────────────────────
  test('P2b (ZUCK-UAAA): ZUCK has curfew in airportData', () => {
    const doc = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.airportData, 'airportData exists');
    assert.ok(cbm.airportData.ZUCK, 'ZUCK entry exists');
    assert.ok(cbm.airportData.ZUCK.curfew, 'ZUCK curfew field is populated');
  });

  test('P2b (ZUCK-UAAA): UAAA has at least one NOTAM or weather entry', () => {
    const doc = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.airportData.UAAA, 'UAAA entry exists');
    const uaaa = cbm.airportData.UAAA;
    const hasData = (uaaa.notams && uaaa.notams.length > 0) || uaaa.weather !== null;
    assert.ok(hasData, 'UAAA has NOTAMs or weather');
  });

  test('P2b (UAAA-EHAM): EHAM has at least one briefing NOTAM', () => {
    const doc = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.airportData && cbm.airportData.EHAM, 'EHAM entry exists');
    assert.ok(cbm.airportData.EHAM.notams.length > 0, 'EHAM has at least one briefing NOTAM');
  });

  test('P2b (UAAA-EHAM): EBBR entry created (alternate airport)', () => {
    const doc = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.airportData.EBBR, 'EBBR alternate entry created');
  });

  test('P2b: enrouteNotams.fir is an array', () => {
    const doc = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.enrouteNotams, 'enrouteNotams exists');
    assert.ok(Array.isArray(cbm.enrouteNotams.fir), 'enrouteNotams.fir is array');
  });

  test('P2b (ZUCK-UAAA): at least one FIR block with items', () => {
    const doc = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    assert.ok(cbm.enrouteNotams.fir.length > 0, 'at least one FIR block');
    const withItems = cbm.enrouteNotams.fir.filter(f => f.items && f.items.length > 0);
    assert.ok(withItems.length > 0, 'at least one FIR block has items');
  });

  test('P2b: FIXTURE_PENDING_EWINS finding present', () => {
    const doc = fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc;
    const cbm = extractCbm(doc);
    const codes = (cbm._fixtureFindings || []).map(f => f.code);
    assert.ok(codes.includes('FIXTURE_PENDING_EWINS'), 'FIXTURE_PENDING_EWINS finding present');
  });

  // ── Cross-fixture comparison ───────────────────────────────────────────
  test('FK and matched pair comparison: same aircraft and crew count', () => {
    const fkDoc = fixtureData['FK_UAAA-EHAM_27OCT26_prototype'].doc;
    const fkCbm = extractCbm(fkDoc);
    // GTI8153/27 on same B744 aircraft
    assert.equal(fkCbm.acftType, 'B744', 'matched pair: B744');
    assert.ok(fkCbm.crewMembers.length > 0, 'matched pair: crew members present');
  });

  // ──────────────────────────────────────────────────────────────────────
  // KLAX-RKSI RDA-ETP fixture tests (7 defect fixes)
  // ──────────────────────────────────────────────────────────────────────

  // ── Defect 1: RAPT / RALT ─────────────────────────────────────────────
  test('D1 POSITIVE (RAPT/RALT): KLAX-RKSI altData includes RJTT and RJGG as EN ROUTE ALT', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    const icaos = cbm.altData.map(a => a.icao);
    assert.ok(icaos.includes('RJTT'), 'RJTT in altData');
    assert.ok(icaos.includes('RJGG'), 'RJGG in altData');
    const rjtt = cbm.altData.find(a => a.icao === 'RJTT');
    const rjgg = cbm.altData.find(a => a.icao === 'RJGG');
    assert.equal(rjtt.role, 'EN ROUTE ALT', 'RJTT role');
    assert.equal(rjgg.role, 'EN ROUTE ALT', 'RJGG role');
    assert.ok(rjtt.ofpEta && /^\d{4}$/.test(rjtt.ofpEta), 'RJTT ofpEta is 4-digit time');
    assert.ok(rjgg.ofpEta && /^\d{4}$/.test(rjgg.ofpEta), 'RJGG ofpEta is 4-digit time');
  });

  test('D1 NEGATIVE (RAPT/RALT): ZUCK-UAAA has no EN ROUTE ALT entries', () => {
    const cbm = extractCbm(fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc);
    const enRoute = cbm.altData.filter(a => a.role === 'EN ROUTE ALT');
    assert.equal(enRoute.length, 0, 'no EN ROUTE ALT for ZUCK-UAAA');
  });

  // ── Defect 2: POR ─────────────────────────────────────────────────────
  test('D2 POSITIVE (POR): KLAX-RKSI porWpt, porOffsetMins, porMinf populated', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    assert.equal(cbm.porWpt, 'EMRON', 'porWpt');
    assert.equal(cbm.porOffsetMins, 603, 'porOffsetMins (10h03m)');
    assert.equal(cbm.porMinf, '047516', 'porMinf from POR-column MINF row');
    const pendingCodes = (cbm._fixtureFindings || []).map(f => f.code);
    assert.ok(!pendingCodes.includes('FIXTURE_PENDING_POR'), 'FIXTURE_PENDING_POR suppressed');
  });

  test('D2 NEGATIVE (POR): ZUCK-UAAA has empty POR fields', () => {
    const cbm = extractCbm(fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc);
    assert.equal(cbm.porWpt, '', 'porWpt empty');
    assert.equal(cbm.porOffsetMins, 0, 'porOffsetMins zero');
    assert.equal(cbm.porMinf, '', 'porMinf empty');
    const pendingCodes = (cbm._fixtureFindings || []).map(f => f.code);
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_POR'), 'FIXTURE_PENDING_POR present for non-POR fixture');
  });

  // ── Defect 3: ETP (safety-critical — positive AND negative required) ──
  test('D3 POSITIVE (ETP): KLAX-RKSI etpPoints has ETP1 and ETP2 with correct values', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    assert.equal(cbm.etpPoints.length, 2, 'two ETP points');
    const etp1 = cbm.etpPoints.find(e => e.name === 'ETP1');
    const etp2 = cbm.etpPoints.find(e => e.name === 'ETP2');
    assert.ok(etp1, 'ETP1 present');
    assert.ok(etp2, 'ETP2 present');
    assert.equal(etp1.lat, 'N39 04.3', 'ETP1 lat');
    assert.equal(etp1.lon, 'W147 53.0', 'ETP1 lon');
    assert.equal(etp1.elapsedMins, 193, 'ETP1 elapsedMins (3h13m)');
    assert.equal(etp2.lat, 'N39 51.0', 'ETP2 lat');
    assert.equal(etp2.lon, 'E167 42.5', 'ETP2 lon');
    assert.equal(etp2.elapsedMins, 478, 'ETP2 elapsedMins (7h58m)');
    const pendingCodes = (cbm._fixtureFindings || []).map(f => f.code);
    assert.ok(!pendingCodes.includes('FIXTURE_PENDING_ETP'), 'FIXTURE_PENDING_ETP suppressed');
  });

  test('D3 POSITIVE (ETP): KLAX-RKSI altData includes CFS ALT entries for KSFO, PACD, RJCC', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    const cfsAlts = cbm.altData.filter(a => a.role === 'CFS ALT');
    const cfsIcaos = cfsAlts.map(a => a.icao);
    assert.ok(cfsIcaos.includes('KSFO'), 'KSFO CFS ALT present');
    assert.ok(cfsIcaos.includes('PACD'), 'PACD CFS ALT present');
    assert.ok(cfsIcaos.includes('RJCC'), 'RJCC CFS ALT present');
    const ksfo = cfsAlts.find(a => a.icao === 'KSFO');
    assert.equal(ksfo.etpName, 'ETP1', 'KSFO etpName');
    assert.ok(ksfo.wxWindow, 'KSFO wxWindow populated');
    assert.strictEqual(ksfo.ofpEta, null, 'CFS ALT ofpEta is null');
  });

  test('D3 NEGATIVE (ETP): ZUCK-UAAA has no etpPoints', () => {
    const cbm = extractCbm(fixtureData['FK_ZUCK-UAAA_27OCT26_prototype'].doc);
    assert.equal(cbm.etpPoints.length, 0, 'no ETP points for ZUCK-UAAA');
    const pendingCodes = (cbm._fixtureFindings || []).map(f => f.code);
    assert.ok(pendingCodes.includes('FIXTURE_PENDING_ETP'), 'FIXTURE_PENDING_ETP present for non-ETP fixture');
  });

  test('D3 UNIT (parseFkEtpSection): compact ETP nav log elapsed time extraction', () => {
    const text = [
      'DCT (GOPACD) ETP1',
      'N39 04.3   368 452 499 00.47   P07   1188',
      'W147 53.0   307 840 03.13 F320  -41 286/038',
      'Critical Fuel Scenario',
      '2EO',
      '(GOPACD) ETP1 KSFO-PACD N39 04.3 W147 53.0',
      'GCD TIME A/I REMF PAD MINF WX WINDOW',
      'KSFO 1203 03:05 5-008PC 118830 93756 025074 06:28-10:31',
    ].join('\n');
    const result = parseFkEtpSection(text);
    assert.equal(result.etpPoints.length, 1, 'one ETP point');
    assert.equal(result.etpPoints[0].name, 'ETP1', 'ETP1 name');
    assert.equal(result.etpPoints[0].elapsedMins, 193, 'elapsedMins from nav log');
    assert.equal(result.altData.length, 1, 'one CFS alt');
    assert.equal(result.altData[0].icao, 'KSFO', 'KSFO CFS alt');
  });

  test('D3 UNIT NEGATIVE (parseFkEtpSection): normal nav log lon line not matched as ETP', () => {
    // Normal lon line has 4 integers before HH.MM — must NOT be matched as ETP elapsed time.
    const text = [
      'DCT (GOPACD) ETP1',
      'N39 04.3   368 452 499 00.47   P07   1188',
      'W147 53.0 310 294 319 837 00.17 F300', // 4 integers — normal format, not ETP
      'Critical Fuel Scenario',
      '(GOPACD) ETP1 KSFO-PACD N39 04.3 W147 53.0',
    ].join('\n');
    const result = parseFkEtpSection(text);
    // elapsedMins should be null (no compact lon line found)
    assert.strictEqual(result.etpPoints[0].elapsedMins, null, 'normal lon line not matched as ETP elapsed time');
  });

  test('D3 UNIT NEGATIVE (parseFkEtpSection): no CFS section → empty result', () => {
    const result = parseFkEtpSection('some text without Critical Fuel Scenario header');
    assert.equal(result.etpPoints.length, 0, 'no ETP points');
    assert.equal(result.altData.length, 0, 'no CFS alts');
  });

  // ── Defect 4: Weather ─────────────────────────────────────────────────
  test('D4 POSITIVE (weather): KLAX-RKSI all release airports have weather entries', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    for (const icao of ['KLAX', 'RKSI', 'RJBB', 'RJTT', 'RJGG', 'KSFO', 'PACD', 'RJCC']) {
      assert.ok(cbm.airportData[icao], icao + ' has airportData entry');
      assert.ok(cbm.airportData[icao].weather !== null, icao + ' has weather (not null)');
    }
  });

  // ── Defect 5: NOTAMs ─────────────────────────────────────────────────
  test('D5 POSITIVE (NOTAMs): KLAX has departure NOTAMs', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    assert.ok(cbm.airportData.KLAX, 'KLAX has airportData entry');
    assert.ok(cbm.airportData.KLAX.notams.length > 0, 'KLAX has at least one NOTAM');
  });

  test('D5 POSITIVE (NOTAMs): KSFO has departure NOTAMs', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    assert.ok(cbm.airportData.KSFO, 'KSFO has airportData entry');
    assert.ok(cbm.airportData.KSFO.notams.length > 0, 'KSFO has at least one NOTAM');
  });

  test('D5 UNIT (NOTAM ID regex): 3-letter FAA code format matched', () => {
    // parseFkNotamBriefingItems must parse "KLAX LAX A3108/26" format.
    const text = [
      'APTKLAX RWYS: 06L',
      'KLAX LAX A3108/26   2026-May-27 18:26 - 2027-May-28 16:00',
      'AD AP CLSD TO NON SKED TRANSIENT GA ACFT',
    ].join('\n');
    const result = parseFkNotamBriefingItems(text, new Set());
    assert.ok(result.size > 0, 'NOTAM with 3-letter FAA code parsed');
    const entry = [...result.values()][0];
    assert.equal(entry.icao, 'KLAX', 'ICAO correctly extracted');
  });

  // ── Defect 6: Airport list filter ────────────────────────────────────
  test('D6 POSITIVE (airport list): KLAX-RKSI airportData contains only release airports', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    const keys = Object.keys(cbm.airportData);
    const expected = new Set(['KLAX', 'RKSI', 'RJBB', 'RJTT', 'RJGG', 'KSFO', 'PACD', 'RJCC']);
    for (const k of keys) assert.ok(expected.has(k), k + ' should be a release airport');
    for (const e of expected) assert.ok(keys.includes(e), e + ' should be in airportData');
  });

  test('D6 NEGATIVE (airport list): RKJK, RKPC, RJSM not in airportData', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    assert.ok(!cbm.airportData.RKJK, 'RKJK excluded from airportData');
    assert.ok(!cbm.airportData.RKPC, 'RKPC excluded from airportData');
    assert.ok(!cbm.airportData.RJSM, 'RJSM excluded from airportData');
  });

  test('D6 NEGATIVE (airport list): FIR codes not in airportData', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    for (const fir of ['KZLA', 'KZOA', 'KZAK', 'RJJJ', 'RKRR', 'ZSHA']) {
      assert.ok(!cbm.airportData[fir], fir + ' FIR not in airportData');
    }
  });

  // ── Defect 7: CAT II/III dedup ───────────────────────────────────────
  test('D7 POSITIVE (CAT II/III dedup): RJGG appears once with II/III in KLAX-RKSI', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    const rjgg = cbm.catIiIiiApproaches.filter(a => a.airport === 'RJGG');
    assert.equal(rjgg.length, 1, 'RJGG appears exactly once');
    assert.equal(rjgg[0].category, 'II/III', 'RJGG category merged to II/III');
  });

  test('D7 NEGATIVE (CAT II/III dedup): no airport appears more than once in KLAX-RKSI', () => {
    const cbm = extractCbm(fixtureData['FK_KLAX-RKSI_31OCT26_rda-etp_prototype'].doc);
    const airports = cbm.catIiIiiApproaches.map(a => a.airport);
    const seen = new Set(airports);
    assert.equal(seen.size, airports.length, 'no duplicate airport in catIiIiiApproaches');
  });
}
