'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { adaptItems, docToLegacyText, YTOL, COL_GAP_RATIO } = require('../../src/import/adapter-pdf');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a minimal itemsDoc for synthetic tests.
function makeItems(pages, meta) {
  return {
    meta: { file: 'test.pdf', pageCount: pages.length, outline: [], ...meta },
    pages,
  };
}

function makePage(items, opts) {
  const n = (opts && opts.n) || 1;
  const width = (opts && opts.width) || 612;
  const height = (opts && opts.height) || 792;
  return { n, width, height, items };
}

function item(str, x, y, w) {
  return { str, x, y, w: w || 0 };
}

// ── Locate fixtures (optional — skip if absent) ───────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_CANDIDATES = [
  process.env.PB_FIXTURES,
  path.join(ROOT, 'fixtures'),
  path.join(ROOT, '..', 'pilotbrief-fixtures'),
].filter(Boolean);
const FIXTURES_DIR = FIXTURES_CANDIDATES.find(d => {
  try { return fs.existsSync(path.join(d, 'manifest.json')); } catch (_) { return false; }
});

// ── Unit tests (no fixtures required) ─────────────────────────────────────────

test('adaptItems: empty pages array returns Doc with no pages', () => {
  const doc = adaptItems(makeItems([]));
  assert.equal(doc.pages.length, 0);
  assert.equal(doc.meta.pageCount, 0);
});

test('adaptItems: meta fields mapped correctly', () => {
  const doc = adaptItems(makeItems([makePage([])], { file: 'RJAA-PANC.pdf', outline: ['Title'] }));
  assert.equal(doc.meta.producer, 'RJAA-PANC.pdf');
  assert.equal(doc.meta.pageCount, 1);
  assert.deepEqual(doc.meta.outline, ['Title']);
});

test('adaptItems: single item, no gap → text equals item.str', () => {
  const pg = makePage([item('HELLO', 72, 100)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'HELLO');
});

test('adaptItems: two items gap > 20 → 3 spaces', () => {
  // item at x=10, width=30 → prevRight=40; next at x=65, gap=25 > 20
  const pg = makePage([item('A', 10, 100, 30), item('B', 65, 100, 10)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'A   B');
});

test('adaptItems: two items gap 9–20 → 2 spaces', () => {
  // prevRight=40, next at x=50, gap=10 (> 8, ≤ 20)
  const pg = makePage([item('A', 10, 100, 30), item('B', 50, 100, 10)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'A  B');
});

test('adaptItems: two items gap 4–8 → 1 space', () => {
  // prevRight=40, next at x=45, gap=5 (> 3, ≤ 8)
  const pg = makePage([item('A', 10, 100, 30), item('B', 45, 100, 10)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'A B');
});

test('adaptItems: two items gap ≤ 3 → no space', () => {
  // prevRight=40, next at x=42, gap=2 (≤ 3)
  const pg = makePage([item('A', 10, 100, 30), item('B', 42, 100, 10)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'AB');
});

test('adaptItems: item with empty str is skipped', () => {
  const pg = makePage([item('', 10, 100), item('OK', 50, 100)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'OK');
});

test('adaptItems: line with only whitespace after assembly is excluded', () => {
  // A single item whose str is spaces becomes lineStr.trim() === '' → excluded
  const pg = makePage([item('   ', 10, 100)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines.length, 0);
});

test(`adaptItems: items within ${YTOL}pt Y tolerance share a line`, () => {
  // Two items at y=100 and y=101 (gap < YTOL=2) → same line
  const pg = makePage([item('A', 10, 100), item('B', 50, 101)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines.length, 1);
  assert.ok(doc.pages[0].lines[0].text.includes('A'));
  assert.ok(doc.pages[0].lines[0].text.includes('B'));
});

test('adaptItems: items more than YTOL apart produce separate lines', () => {
  const pg = makePage([item('A', 10, 100), item('B', 10, 115)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines.length, 2);
});

test('adaptItems: lines sorted top → bottom', () => {
  // Items provided in reverse Y order (bottom first)
  const pg = makePage([item('BOTTOM', 10, 200), item('TOP', 10, 50)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].text, 'TOP');
  assert.equal(doc.pages[0].lines[1].text, 'BOTTOM');
});

test('adaptItems: items within a line sorted left → right', () => {
  // Items provided right-first
  const pg = makePage([item('B', 200, 100), item('A', 10, 100)]);
  const doc = adaptItems(makeItems([pg]));
  assert.ok(doc.pages[0].lines[0].text.startsWith('A'));
});

test('adaptItems: spans carry x and str for each item', () => {
  const pg = makePage([item('HELLO', 72, 100, 40), item('WORLD', 200, 100, 50)]);
  const doc = adaptItems(makeItems([pg]));
  const spans = doc.pages[0].lines[0].spans;
  assert.equal(spans.length, 2);
  assert.equal(spans[0].x, 72);
  assert.equal(spans[0].str, 'HELLO');
  assert.equal(spans[1].x, 200);
  assert.equal(spans[1].str, 'WORLD');
});

test('adaptItems: y coordinate on line equals bucket y', () => {
  const pg = makePage([item('X', 10, 123.5)]);
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].y, 123.5);
});

test(`adaptItems: gap > ${COL_GAP_RATIO * 100}% of page width → two columns`, () => {
  // page width 612; 40% = 244.8; item A ends at x=10+30=40, item B starts at x=300 → gap=260 > 244.8
  const pg = makePage([item('LEFT', 10, 100, 30), item('RIGHT', 300, 100, 50)], { width: 612 });
  const doc = adaptItems(makeItems([pg]));
  const line = doc.pages[0].lines[0];
  assert.ok(Array.isArray(line.columns), 'columns should be an array');
  assert.equal(line.columns.length, 2);
  assert.equal(line.columns[0], 'LEFT');
  assert.equal(line.columns[1], 'RIGHT');
});

test('adaptItems: gap just at column threshold boundary (< threshold) → no columns', () => {
  // page width 612; 40% = 244.8; item A ends at x=10+30=40, item B starts at x=280 → gap=240 < 244.8
  const pg = makePage([item('L', 10, 100, 30), item('R', 280, 100, 30)], { width: 612 });
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].columns, null);
});

test('adaptItems: three-column split', () => {
  // page width 300; 40% = 120; gaps at x:10→80(end), x:210, x:400
  const pg = makePage([
    item('C1', 10, 100, 70),   // ends at 80
    item('C2', 210, 100, 80),  // gap 130 > 120 → split; ends at 290
    item('C3', 430, 100, 50),  // gap 140 > 120 → split
  ], { width: 300 });
  const doc = adaptItems(makeItems([pg]));
  const line = doc.pages[0].lines[0];
  assert.equal(line.columns.length, 3);
  assert.equal(line.columns[0], 'C1');
  assert.equal(line.columns[1], 'C2');
  assert.equal(line.columns[2], 'C3');
});

test('adaptItems: page with zero width → columns always null', () => {
  const pg = { n: 1, width: 0, height: 792, items: [item('A', 10, 100, 30), item('B', 400, 100, 30)] };
  const doc = adaptItems(makeItems([pg]));
  assert.equal(doc.pages[0].lines[0].columns, null);
});

test('docToLegacyText: page break appended per page', () => {
  const pg = makePage([item('LINE', 10, 100)]);
  const doc = adaptItems(makeItems([pg]));
  const text = docToLegacyText(doc);
  assert.equal(text, 'LINE\n\n');
});

test('docToLegacyText: multi-page concatenates with per-page breaks', () => {
  const pg1 = makePage([item('P1', 10, 100)], { n: 1 });
  const pg2 = makePage([item('P2', 10, 100)], { n: 2 });
  const doc = adaptItems(makeItems([pg1, pg2]));
  const text = docToLegacyText(doc);
  assert.equal(text, 'P1\n\nP2\n\n');
});

// ── Fixture-based tests (skipped when fixtures are absent) ────────────────────

if (!FIXTURES_DIR) {
  test('adapter-pdf fixture test (SKIPPED — fixtures not found; set PB_FIXTURES to enable)', { skip: true }, () => {});
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));

  test(`adaptItems: legacy text byte-for-byte on all ${manifest.fixtures.length} fixtures`, async () => {
    let passed = 0;
    const failures = [];
    for (const fx of manifest.fixtures) {
      const itemsPath = path.join(FIXTURES_DIR, fx.files.items);
      const textPath  = path.join(FIXTURES_DIR, fx.files.text);
      if (!fs.existsSync(itemsPath) || !fs.existsSync(textPath)) {
        failures.push(`${fx.id}: items or text file missing`);
        continue;
      }
      const itemsDoc  = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
      const wantText  = fs.readFileSync(textPath, 'utf8');
      const doc       = adaptItems(itemsDoc);
      const gotText   = docToLegacyText(doc);
      if (gotText === wantText) {
        passed++;
      } else {
        // Find first differing byte for a helpful message
        let pos = 0;
        while (pos < gotText.length && pos < wantText.length && gotText[pos] === wantText[pos]) pos++;
        failures.push(`${fx.id}: first diff at byte ${pos} — got ${JSON.stringify(gotText.slice(pos, pos + 40))} want ${JSON.stringify(wantText.slice(pos, pos + 40))}`);
      }
    }
    assert.equal(failures.length, 0, `${failures.length} fixture(s) differ:\n${failures.join('\n')}`);
    assert.equal(passed, manifest.fixtures.length, `Only ${passed}/${manifest.fixtures.length} passed`);
  });
}
