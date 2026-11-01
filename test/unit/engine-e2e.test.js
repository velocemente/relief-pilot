'use strict';
// End-to-end test: engine import path on all FlightKeys fixtures.
// Verifies that items can be loaded and adapted correctly.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const { adaptItems } = require('../../src/import/adapter-pdf.js');

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

fkFixtures.forEach(fx => {
  test(`engine-e2e: ${fx.id} items load and adapt correctly`, () => {
    const itemsPath = path.join(fixturesDir, 'items', `${fx.id}.items.json`);
    if (!fs.existsSync(itemsPath)) {
      console.log(`Skipping ${fx.id}: no items file`);
      return;
    }

    const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
    const doc = adaptItems(itemsDoc);

    // Verify doc structure
    assert(doc.pages, 'Doc must have pages');
    assert(doc.pages.length > 0, 'Doc must have at least one page');

    // Verify pages have lines
    assert(doc.pages.some(p => p.lines && p.lines.length > 0), 'At least one page should have lines');
  });
});
