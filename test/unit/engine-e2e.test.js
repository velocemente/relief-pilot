'use strict';
// End-to-end test: engine import path on all FlightKeys fixtures.
// Covers the full pipeline: items → adaptItems → extractCbm → validate → toLegacyShape.
// Also verifies converted NOTAM text is in legacy grammar accepted by evalNotams.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const { adaptItems }  = require('../../src/import/adapter-pdf.js');
const { extractCbm }  = require('../../src/import/atlas-fk.js');
const { validate }    = require('../../src/import/validate.js');
const { toLegacyShape } = require('../../src/import/legacy-shape.js');

// Find fixtures directory
const fixturesDir = (() => {
  const candidates = [
    process.env.PB_FIXTURES,
    path.join(__dirname, '..', '..', 'fixtures'),
    path.join(__dirname, '..', '..', '..', 'pilotbrief-fixtures'),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
  }
  return null;
})();

if (!fixturesDir) {
  console.log('engine-e2e: Fixtures not found, skipping');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'manifest.json'), 'utf8'));
const fkFixtures = manifest.fixtures.filter(f => f.id.startsWith('FK_'));

if (fkFixtures.length === 0) {
  console.log('engine-e2e: No FlightKeys fixtures found');
  process.exit(0);
}

// ── Harness for evalNotams / _splitNotams / xNW_standalone ──────────────────
const { loadApp } = require('../harness');
const harness = loadApp();
const { _splitNotams, evalNotams, xNW_standalone } = harness;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Run the full FK pipeline for one fixture: items → shape.
function runPipeline(id) {
  const itemsPath = path.join(fixturesDir, 'items', `${id}.items.json`);
  if (!fs.existsSync(itemsPath)) return null;
  const doc   = adaptItems(JSON.parse(fs.readFileSync(itemsPath, 'utf8')));
  const cbm   = extractCbm(doc);
  validate(cbm);
  return toLegacyShape(cbm);
}

// ── NOTAM-grammar unit tests ─────────────────────────────────────────────────
// These tests use synthetic NOTAM text to verify that the legacy grammar the
// converter produces is accepted by the app's evalNotams / xNW_standalone.

test('notam-grammar: xNW_standalone returns null for UFN (always active)', () => {
  const w = xNW_standalone('- RJCC  C0001/26 28OCT2054-UFN\nTWY E9 U/S', '2026-10-31');
  assert.strictEqual(w, null, 'UFN must return null so NOTAM is always active');
});

test('notam-grammar: xNW_standalone returns null for UFN EST (always active)', () => {
  const w = xNW_standalone('- KSFO  A0001/26 18APR0149-UFN EST\nSID TEST', '2026-10-31');
  assert.strictEqual(w, null, 'UFN EST must return null so NOTAM is always active');
});

test('notam-grammar: xNW_standalone parses cross-year NOTAM correctly', () => {
  // validFrom 2026-Oct-07, validTo 2027-May-19 → endMs must be May 2027
  const w = xNW_standalone('- KLAX  A5392/26 07OCT1635-19MAY0000 2027\nILS body', '2026-10-31');
  assert.ok(w !== null, 'cross-year NOTAM must parse');
  const endDate = new Date(w.endMs);
  assert.strictEqual(endDate.getUTCFullYear(), 2027, 'end year must be 2027');
  assert.strictEqual(endDate.getUTCMonth(), 4, 'end month must be May (4)');
  assert.strictEqual(endDate.getUTCDate(), 19, 'end day must be 19');
});

test('notam-grammar: evalNotams shows active NOTAM within its window at ETA', () => {
  // Window covers Oct 31; ETA etaMin=720 (12:00 UTC)
  const result = evalNotams(
    _splitNotams('- KLAX  A0001/26 31OCT0001-31OCT2359\nILS RWY 24L U/S'),
    'DEST', 720, 'B744', '2026-10-31'
  );
  assert.ok(result.issues.length >= 1, 'active NOTAM must appear in issues');
  assert.notStrictEqual(result.worst, 'green', 'worst must not be green for active ILS NOTAM');
});

test('notam-grammar: evalNotams treats NOTAM starting after ETA as inactive', () => {
  // Window starts Nov 1; ETA is Oct 31 → NOTAM is not yet active
  const result = evalNotams(
    _splitNotams('- KLAX  A0002/26 01NOV0001-01NOV2359\nILS RWY 24L U/S'),
    'DEST', 720, 'B744', '2026-10-31'
  );
  // Only the green "no critical items" sentinel remains
  assert.strictEqual(result.worst, 'green', 'future NOTAM must not appear as active at ETA');
});

test('notam-grammar: evalNotams treats NOTAM ended before ETA as inactive', () => {
  // Window ended Oct 29; ETA is Oct 31
  const result = evalNotams(
    _splitNotams('- KLAX  A0003/26 29OCT0001-29OCT2359\nILS RWY 24L U/S'),
    'DEST', 720, 'B744', '2026-10-31'
  );
  assert.strictEqual(result.worst, 'green', 'expired NOTAM must not appear as active at ETA');
});

test('notam-grammar: evalNotams treats UFN NOTAM as always active', () => {
  const result = evalNotams(
    _splitNotams('- RJCC  C2851/26 28OCT2054-UFN\nTWY E9 U/S'),
    'DEST', 720, 'B744', '2026-10-31'
  );
  assert.ok(result.issues.length >= 1, 'UFN NOTAM must appear in issues');
});

test('notam-grammar: evalNotams treats UFN EST NOTAM as always active', () => {
  const result = evalNotams(
    _splitNotams('- KSFO  A2055/26 18APR0149-UFN EST\nSFO SID TEST NOTAM'),
    'DEST', 720, 'B744', '2026-10-31'
  );
  assert.ok(result.issues.length >= 1, 'UFN EST NOTAM must appear in issues');
});

// ── Full-pipeline tests ───────────────────────────────────────────────────────

test('engine-e2e: FK_KLAX-RKSI_31OCT26 full pipeline values', () => {
  const shape = runPipeline('FK_KLAX-RKSI_31OCT26_rda-etp_prototype');
  if (!shape) { console.log('Skipping: no items file'); return; }

  // Flight identity
  assert.strictEqual(shape.origIcao, 'KLAX', 'origIcao');
  assert.strictEqual(shape.destIcao, 'RKSI', 'destIcao');
  assert.strictEqual(shape.acftType, 'B744', 'acftType');

  // Crew
  assert.ok(Array.isArray(shape.crewMembers) && shape.crewMembers.length === 4, '4 crew');

  // CAT II/III — destination must be listed
  assert.ok(Array.isArray(shape.catIiIiiApproaches) && shape.catIiIiiApproaches.length > 0, 'catIiIii entries');
  assert.ok(shape.catIiIiiApproaches.some(c => c.airport === 'RKSI'), 'RKSI in catIiIii');

  // MEL
  assert.ok(Array.isArray(shape.melItems) && shape.melItems.length === 8, '8 MEL items');

  // ETPs (this fixture has 2)
  assert.ok(Array.isArray(shape.etpPoints) && shape.etpPoints.length === 2, '2 ETP points');

  // POR
  assert.strictEqual(shape.porWpt, 'EMRON', 'porWpt');

  // Alternates: DEST ALT, EN ROUTE ALT, CFS ALT
  assert.ok(Array.isArray(shape.altData) && shape.altData.length === 6, '6 altData entries');
  assert.ok(shape.altData.some(a => a.role === 'DEST ALT' && a.icao === 'RJBB'), 'RJBB DEST ALT');
  assert.ok(shape.altData.some(a => a.role === 'CFS ALT' && a.icao === 'KSFO'), 'KSFO CFS ALT');
  assert.ok(shape.altData.some(a => a.role === 'CFS ALT' && a.icao === 'PACD'), 'PACD CFS ALT');
  assert.ok(shape.altData.some(a => a.role === 'CFS ALT' && a.icao === 'RJCC'), 'RJCC CFS ALT');

  // airportData: NOTAMs in legacy grammar for KLAX (origin)
  const klax = shape.airportData && shape.airportData['KLAX'];
  assert.ok(klax, 'KLAX in airportData');
  assert.strictEqual(typeof klax.notams, 'string', 'KLAX notams is string');
  assert.ok(klax.notams.startsWith('- KLAX  '), 'KLAX notams start with legacy header');
  assert.ok(klax.notams.length > 100, 'KLAX notams non-trivial');

  // KLAX weather: non-empty (has METARs in this fixture)
  assert.strictEqual(typeof klax.weather, 'string', 'KLAX weather is string');
  assert.ok(klax.weather.length > 0, 'KLAX weather non-empty');
  assert.ok(/METAR/i.test(klax.weather), 'KLAX weather contains METAR');

  // RKSI (destination): has NOTAMs
  const rksi = shape.airportData && shape.airportData['RKSI'];
  assert.ok(rksi, 'RKSI in airportData');
  assert.ok(rksi.notams.length > 0, 'RKSI has NOTAM text');
  assert.ok(rksi.notams.startsWith('- RKSI  '), 'RKSI notams start with legacy header');

  // opsNotes: RJCC and RKSI have company NOTAMs
  const rjcc = shape.airportData && shape.airportData['RJCC'];
  assert.ok(rjcc && rjcc.opsNotes, 'RJCC has opsNotes');
  assert.strictEqual(typeof rjcc.opsNotes.body, 'string', 'RJCC opsNotes.body is string');
  assert.ok(rjcc.opsNotes.body.length > 0, 'RJCC opsNotes.body non-empty');

  // evalNotams: KLAX NOTAM text is accepted by the app and produces issues
  const klaxArr = _splitNotams(klax.notams);
  assert.ok(klaxArr.length === 37, 'KLAX _splitNotams produces 37 NOTAM blocks');
  const klaxEval = evalNotams(klaxArr, 'ORIG', 0, 'B744', '2026-10-31');
  assert.ok(klaxEval.issues.length >= 1, 'KLAX evalNotams produces issues');
  assert.notStrictEqual(klaxEval.worst, 'unknown', 'KLAX evalNotams worst is resolved');
});

test('engine-e2e: FK_UAAA-EHAM_27OCT26 full pipeline values', () => {
  const shape = runPipeline('FK_UAAA-EHAM_27OCT26_prototype');
  if (!shape) { console.log('Skipping: no items file'); return; }

  assert.strictEqual(shape.origIcao, 'UAAA', 'origIcao');
  assert.strictEqual(shape.destIcao, 'EHAM', 'destIcao');
  assert.strictEqual(shape.acftType, 'B744', 'acftType');
  assert.ok(Array.isArray(shape.crewMembers) && shape.crewMembers.length === 4, '4 crew');
  assert.ok(Array.isArray(shape.melItems) && shape.melItems.length === 4, '4 MEL items');
  assert.ok(Array.isArray(shape.altData) && shape.altData.length >= 1, 'has altData');
  assert.ok(shape.altData.some(a => a.role === 'DEST ALT' && a.icao === 'EBBR'), 'EBBR DEST ALT');

  const eham = shape.airportData && shape.airportData['EHAM'];
  assert.ok(eham, 'EHAM in airportData');
  assert.ok(eham.notams.startsWith('- EHAM  '), 'EHAM notams in legacy grammar');
  assert.ok(eham.notams.length > 100, 'EHAM notams non-trivial');
  assert.strictEqual(typeof eham.weather, 'string', 'EHAM weather is string');

  // evalNotams accepts the converted NOTAM text
  const ehamArr = _splitNotams(eham.notams);
  assert.ok(ehamArr.length >= 1, 'EHAM _splitNotams finds NOTAM blocks');
  const ehamEval = evalNotams(ehamArr, 'DEST', 0, 'B744', '2026-10-27');
  assert.notStrictEqual(ehamEval.worst, 'unknown', 'EHAM evalNotams worst is resolved');
});

test('engine-e2e: FK_ZUCK-UAAA_27OCT26 full pipeline values', () => {
  const shape = runPipeline('FK_ZUCK-UAAA_27OCT26_prototype');
  if (!shape) { console.log('Skipping: no items file'); return; }

  assert.strictEqual(shape.origIcao, 'ZUCK', 'origIcao');
  assert.strictEqual(shape.destIcao, 'UAAA', 'destIcao');
  assert.strictEqual(shape.acftType, 'B744', 'acftType');
  assert.ok(Array.isArray(shape.crewMembers) && shape.crewMembers.length === 4, '4 crew');
  assert.ok(Array.isArray(shape.melItems) && shape.melItems.length === 2, '2 MEL items');
  assert.ok(Array.isArray(shape.altData) && shape.altData.length >= 1, 'has altData');
  assert.ok(shape.altData.some(a => a.role === 'DEST ALT' && a.icao === 'UCFM'), 'UCFM DEST ALT');

  const uaaa = shape.airportData && shape.airportData['UAAA'];
  assert.ok(uaaa, 'UAAA in airportData');
  assert.ok(uaaa.notams.startsWith('- UAAA  '), 'UAAA notams in legacy grammar');
  assert.ok(uaaa.notams.length > 100, 'UAAA notams non-trivial');
  assert.strictEqual(typeof uaaa.weather, 'string', 'UAAA weather is string');

  const uaaaArr = _splitNotams(uaaa.notams);
  assert.ok(uaaaArr.length >= 1, 'UAAA _splitNotams finds NOTAM blocks');
  const uaaaEval = evalNotams(uaaaArr, 'DEST', 0, 'B744', '2026-10-27');
  assert.notStrictEqual(uaaaEval.worst, 'unknown', 'UAAA evalNotams worst is resolved');
});
