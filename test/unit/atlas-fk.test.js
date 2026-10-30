'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { adaptItems } = require('../../src/import/adapter-pdf');
const { extractCbm } = require('../../src/import/atlas-fk');
const { validate } = require('../../src/import/validate');
const { toLegacyShape } = require('../../src/import/legacy-shape');

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
  test('atlas-fk profile test (SKIPPED — fixtures not found; set PB_FIXTURES to enable)', { skip: true }, () => {});
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  const fkFixtures = manifest.fixtures.filter(fx => /^FK_/i.test(fx.id));

  test(`atlas-fk: extract and validate ${fkFixtures.length} FlightKeys fixtures`, async () => {
    const results = [];

    for (const fx of fkFixtures) {
      const itemsPath = path.join(FIXTURES_DIR, fx.files.items);
      if (!fs.existsSync(itemsPath)) {
        results.push({ id: fx.id, status: 'SKIP', reason: 'items file missing' });
        continue;
      }

      const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
      const doc = adaptItems(itemsDoc);

      // Extract CBM using the profile
      let cbm;
      try {
        cbm = extractCbm(doc);
      } catch (e) {
        results.push({
          id: fx.id,
          status: 'FAIL',
          reason: `extractCbm threw: ${e.message}`,
        });
        continue;
      }

      // Validate the CBM
      const validation = validate(cbm);

      // Convert to legacy shape for comparison
      const legacy = toLegacyShape(cbm);

      results.push({
        id: fx.id,
        status: validation.status,
        fltNum: cbm.fltNum || '',
        origIcao: cbm.origIcao || '',
        destIcao: cbm.destIcao || '',
        acftType: cbm.acftType || '',
        crew: (cbm.crewMembers || []).length,
        mel: (cbm.melItems || []).length,
        catApproaches: (cbm.catIiIiiApproaches || []).length,
        blockFuel: cbm.blockFuelRaw || '',
        minfFuel: cbm.minfFuelRaw || '',
        togwActual: cbm.togwActual || 0,
        zfwActual: cbm.zfwActual || 0,
        ofpFormat: cbm.ofpFormat || '',
        validationFindings: validation.findings.length,
        findings: validation.findings.map(f => `${f.code}: ${f.severity}`).slice(0, 5),
      });
    }

    console.log('\n=== ATLAS-FK PROFILE TEST RESULTS ===\n');
    for (const result of results) {
      console.log(`${result.id}:`);
      if (result.status === 'SKIP') {
        console.log(`  SKIP: ${result.reason}`);
      } else {
        console.log(`  Status: ${result.status}`);
        console.log(`  Flight: ${result.fltNum} ${result.origIcao}→${result.destIcao} ${result.acftType}`);
        console.log(`  Crew: ${result.crew}, MEL: ${result.mel}, CAT: ${result.catApproaches}`);
        console.log(`  Fuel: BLOCK=${result.blockFuel}, MINF=${result.minfFuel}`);
        console.log(`  Weights: TOGW=${result.togwActual}, ZFW=${result.zfwActual}`);
        console.log(`  OFP Format: ${result.ofpFormat}`);
        if (result.validationFindings > 0) {
          console.log(`  Validation findings (${result.validationFindings}):`);
          for (const f of result.findings) {
            console.log(`    - ${f}`);
          }
        }
      }
      console.log();
    }

    // Assert that both FK fixtures were processed successfully
    const processed = results.filter(r => r.status !== 'SKIP');
    assert.ok(processed.length >= 2, `Expected at least 2 FK fixtures, got ${processed.length}`);

    // Assert that flight numbers are extracted
    for (const result of processed) {
      assert.ok(result.fltNum, `${result.id}: fltNum not extracted`);
      assert.ok(result.origIcao, `${result.id}: origIcao not extracted`);
      assert.ok(result.destIcao, `${result.id}: destIcao not extracted`);
      assert.ok(result.crew > 0, `${result.id}: crew members not extracted`);
      assert.ok(result.blockFuel, `${result.id}: blockFuel not extracted`);
      assert.ok(result.ofpFormat === 'atlas-fk', `${result.id}: ofpFormat should be atlas-fk`);
    }
  });
}
