'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { detect, THRESHOLD, AMBIGUITY_BAND, _scoreProfile } = require('../../src/import/detector');
const { adaptItems } = require('../../src/import/adapter-pdf');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a minimal Doc for synthetic tests.
function makeDoc(pageTexts) {
  return {
    meta: { producer: 'test', pageCount: pageTexts.length, outline: [] },
    pages: pageTexts.map((lines, i) => ({
      n: i + 1,
      lines: lines.map(text => ({ text, y: 0, spans: [], columns: null })),
    })),
  };
}

// Navtech page header (Atlas Air and Polar Air Cargo both use "BRIEF PAGE N OF N")
const NT_FOOTER = 'ATLAS AIR BRIEF PAGE 1 OF 30';
const NT_POLAR  = 'POLAR AIR CARGO WORLDWIDE BRIEF PAGE 1 OF 79';
// FlightKeys page footer (all pages) + OFP section footer + cover line
const FK_FOOTER = 'Page 1 of 20 a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const FK_FUFI   = 'FUFI: A1B2C3D4-E5F6-7890-ABCD-EF1234567890 PAGE 1/11';
const FK_COVER  = 'OPERATIONAL FLIGHT PLAN';

// ── Unit tests ────────────────────────────────────────────────────────────────

test('detect: Navtech doc returns atlas-5y', () => {
  const pages = Array.from({ length: 10 }, () => [NT_FOOTER, 'some content here']);
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-5y');
  assert.ok(result.confidence >= THRESHOLD);
});

test('detect: Polar Air Cargo Navtech doc returns atlas-5y', () => {
  const pages = Array.from({ length: 10 }, () => [NT_POLAR, 'some content here']);
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-5y');
});

test('detect: FlightKeys doc returns atlas-fk', () => {
  const pages = [
    [FK_FOOTER, FK_COVER],
    ...Array.from({ length: 9 }, () => [FK_FOOTER, 'content']),
  ];
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-fk');
  assert.ok(result.confidence >= THRESHOLD);
});

test('detect: confidence = 1.0 when primary hits every page', () => {
  const pages = Array.from({ length: 5 }, () => [NT_FOOTER]);
  const result = detect(makeDoc(pages));
  assert.ok(result.confidence >= 1.0 - 1e-9);
});

test('detect: empty Doc rejected (below threshold)', () => {
  assert.throws(() => detect(makeDoc([])), /not recognised/);
});

test('detect: single page with no signatures rejected', () => {
  assert.throws(() => detect(makeDoc([['RANDOM TEXT HERE']])), /not recognised/);
});

test('detect: truncated doc with no signatures rejected', () => {
  // 3 pages, none with any known pattern
  const pages = [['ACARS MSG 1234'], ['WEIGHT BALANCE'], ['DISPATCH RELEASE']];
  assert.throws(() => detect(makeDoc(pages)), /not recognised/);
});

test('detect: mixed doc with both Navtech and FlightKeys signatures rejected as ambiguous', () => {
  // Each page has both signatures → both profiles score near 1.0 → ambiguous
  const pages = Array.from({ length: 10 }, () => [NT_FOOTER, FK_FOOTER]);
  assert.throws(() => detect(makeDoc(pages)), /ambiguous/);
});

test('detect: doc with Navtech header but not FlightKeys primary: FUFI alone is not a primary match', () => {
  // FUFI lines no longer the FlightKeys primary; a doc with only FUFI (and NT headers) is atlas-5y
  const pages = Array.from({ length: 10 }, () => [NT_FOOTER, FK_FUFI]);
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-5y'); // NT primary dominates; FK primary absent
});

test('detect: mostly Navtech with one FlightKeys page-footer line is not ambiguous', () => {
  // 9/10 pages have NT header, 1/10 has FK Page footer → NT dominates
  const pages = [
    ...Array.from({ length: 9 }, () => [NT_FOOTER]),
    [FK_FOOTER],
  ];
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-5y');
});

test('detect: FlightKeys secondary (OPERATIONAL FLIGHT PLAN) alone does not cross threshold', () => {
  // Only secondary matches; primary hits 0 pages → base=0; secondary boost is capped at 0.1 < THRESHOLD
  const coverOnly = makeDoc([[FK_COVER]]);
  assert.throws(() => detect(coverOnly), /not recognised/);
});

test('detect: partial Navtech doc (50% coverage) above threshold', () => {
  // THRESHOLD=0.4, 5/10 pages have the footer → 0.5 > 0.4 → accepted
  const pages = [
    ...Array.from({ length: 5 }, () => [NT_FOOTER]),
    ...Array.from({ length: 5 }, () => ['other content']),
  ];
  const result = detect(makeDoc(pages));
  assert.equal(result.profileId, 'atlas-5y');
  assert.ok(result.confidence >= THRESHOLD);
});

test('detect: partial doc just below threshold rejected', () => {
  // THRESHOLD=0.4, 3/10 pages have the footer → 0.3 < 0.4 → rejected
  const pages = [
    ...Array.from({ length: 3 }, () => [NT_FOOTER]),
    ...Array.from({ length: 7 }, () => ['other content']),
  ];
  assert.throws(() => detect(makeDoc(pages)), /not recognised/);
});

test('detect: AMBIGUITY_BAND enforced — equal scores rejected as ambiguous', () => {
  // 5 pages with Navtech header, 5 pages with FlightKeys "Page N of M uuid" footer
  // → both profiles score 0.5, gap = 0.0 < AMBIGUITY_BAND → ambiguous
  const pages = [
    ...Array.from({ length: 5 }, () => [NT_FOOTER]),
    ...Array.from({ length: 5 }, () => [FK_FOOTER]),
  ];
  assert.throws(() => detect(makeDoc(pages)), /ambiguous/);
});

test('_scoreProfile: all pages hit → score = 1.0', () => {
  const profile = { id: 'atlas-5y', primary: /ATLAS AIR BRIEF/, secondary: [] };
  const doc = makeDoc(Array.from({ length: 5 }, () => ['ATLAS AIR BRIEF something']));
  assert.ok(Math.abs(_scoreProfile(profile, doc) - 1.0) < 1e-9);
});

test('_scoreProfile: no pages hit → score = 0', () => {
  const profile = { id: 'atlas-5y', primary: /ATLAS AIR BRIEF/, secondary: [] };
  assert.equal(_scoreProfile(profile, makeDoc([])), 0);
  assert.equal(_scoreProfile(profile, makeDoc([['nothing']])), 0);
});

test('_scoreProfile: secondary boost capped at 0.1', () => {
  const profile = {
    id: 'atlas-fk',
    primary: /Page \d+ of \d+ [0-9a-f-]{30,}/i,
    secondary: [/OPERATIONAL FLIGHT PLAN/],
  };
  // 2 pages, only secondary matches (primary never matches) → base=0, boost is tiny
  const doc = makeDoc([[FK_COVER], [FK_COVER]]);
  const score = _scoreProfile(profile, doc);
  assert.ok(score < THRESHOLD); // secondary alone can't rescue a doc
});

// ── Fixture-based tests (skipped when fixtures are absent) ────────────────────

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
  test('detector fixture test (SKIPPED — fixtures not found; set PB_FIXTURES to enable)', { skip: true }, () => {});
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));

  // Derive expected profile from fixture id:
  // FlightKeys fixtures have ids starting with 'FK_' (case-insensitive); all others are atlas-5y.
  function expectedProfile(id) {
    return /^FK_/i.test(id) ? 'atlas-fk' : 'atlas-5y';
  }

  test(`detector: all ${manifest.fixtures.length} fixtures classified correctly`, async () => {
    let fkCount = 0;
    let ntCount = 0;
    const failures = [];

    for (const fx of manifest.fixtures) {
      const itemsPath = path.join(FIXTURES_DIR, fx.files.items);
      if (!fs.existsSync(itemsPath)) {
        failures.push(`${fx.id}: items file missing`);
        continue;
      }
      const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
      const doc      = adaptItems(itemsDoc);

      let result;
      try {
        result = detect(doc);
      } catch (e) {
        failures.push(`${fx.id}: detect threw — ${e.message}`);
        continue;
      }

      const want = expectedProfile(fx.id);
      if (result.profileId !== want) {
        failures.push(`${fx.id}: got ${result.profileId} (confidence ${result.confidence.toFixed(2)}), want ${want}`);
      } else {
        if (result.profileId === 'atlas-fk') fkCount++;
        else ntCount++;
      }
    }

    assert.equal(failures.length, 0, `${failures.length} fixture(s) misclassified:\n${failures.join('\n')}`);
    // Expected counts come from the manifest's format field, so adding a fixture
    // needs no test edit. Floors guard against the library silently shrinking.
    const wantFk = manifest.fixtures.filter(fx => fx.format === 'flightkeys').length;
    const wantNt = manifest.fixtures.length - wantFk;
    assert.equal(ntCount, wantNt, `Expected ${wantNt} atlas-5y fixtures, got ${ntCount}`);
    assert.equal(fkCount, wantFk, `Expected ${wantFk} atlas-fk fixtures, got ${fkCount}`);
    assert.ok(wantNt >= 30 && wantFk >= 2, `Fixture library shrank: ${wantNt} Navtech/eOFP, ${wantFk} FlightKeys`);
  });
}
