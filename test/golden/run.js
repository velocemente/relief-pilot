#!/usr/bin/env node
// Golden-master runner: _ofpRulesetParse over every fixture package.
//
//   node test/golden/run.js compare [--fixtures <dir>] [--max-lines <n>]
//   node test/golden/run.js update  [--fixtures <dir>]
//
// <dir> defaults to $PB_FIXTURES, then ./fixtures, then ../pilotbrief-fixtures.
// Reads <dir>/manifest.json and <dir>/text/<id>.raw.txt; snapshots live in
// <dir>/snapshots/<id>.json. compare exits 1 on any difference and prints the
// differing fields as "old -> new" (old = snapshot, new = current index.html).
'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../harness');
const { normalize, stringify } = require('./serialize');
const { diff } = require('./diff');

function parseArgs(argv) {
  const o = { mode: argv[0], fixtures: null, maxLines: 40 };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--fixtures') o.fixtures = argv[++i];
    else if (argv[i] === '--max-lines') o.maxLines = parseInt(argv[++i], 10);
    else { console.error(`unknown argument: ${argv[i]}`); process.exit(2); }
  }
  if (o.mode !== 'compare' && o.mode !== 'update') {
    console.error('usage: run.js compare|update [--fixtures <dir>] [--max-lines <n>]');
    process.exit(2);
  }
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [o.fixtures, process.env.PB_FIXTURES, path.join(root, 'fixtures'), path.join(root, '..', 'pilotbrief-fixtures')].filter(Boolean);
  o.fixtures = candidates.find(d => fs.existsSync(path.join(d, 'manifest.json')));
  if (!o.fixtures) { console.error('fixtures directory not found (use --fixtures or PB_FIXTURES)'); process.exit(2); }
  return o;
}

// One snapshot = parser output for one fixture, or the error it threw.
function snapshotFor(app, rawText) {
  let result;
  try {
    result = { result: normalize(app._ofpRulesetParse(rawText)) };
  } catch (e) {
    result = { error: String(e && e.message || e) };
  }
  return result;
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(path.join(opt.fixtures, 'manifest.json'), 'utf8'));
  const snapDir = path.join(opt.fixtures, 'snapshots');
  const app = loadApp();
  const failures = [];
  let same = 0, written = 0;

  for (const fx of manifest.fixtures) {
    const raw = fs.readFileSync(path.join(opt.fixtures, fx.files.text), 'utf8');
    const snap = { id: fx.id, parser: '_ofpRulesetParse', ...snapshotFor(app, raw) };

    // The parser must not carry state between calls: a second run has to agree.
    const again = { id: fx.id, parser: '_ofpRulesetParse', ...snapshotFor(app, raw) };
    const nondet = diff(snap, again);
    if (nondet.length) failures.push({ id: fx.id, lines: ['NON-DETERMINISTIC: two runs on the same text differ', ...nondet] });

    const file = path.join(snapDir, `${fx.id}.json`);
    if (opt.mode === 'update') {
      fs.mkdirSync(snapDir, { recursive: true });
      fs.writeFileSync(file, stringify(snap));
      written++;
      continue;
    }
    if (!fs.existsSync(file)) {
      failures.push({ id: fx.id, lines: [`no snapshot at snapshots/${fx.id}.json (run "update" and commit it to the fixtures repo)`] });
      continue;
    }
    const want = JSON.parse(fs.readFileSync(file, 'utf8'));
    const lines = diff(want, normalize(snap));
    if (lines.length) failures.push({ id: fx.id, lines });
    else same++;
  }

  if (opt.mode === 'compare' && fs.existsSync(snapDir)) {
    const ids = new Set(manifest.fixtures.map(f => f.id));
    for (const f of fs.readdirSync(snapDir).filter(n => n.endsWith('.json'))) {
      if (!ids.has(f.replace(/\.json$/, ''))) failures.push({ id: f.replace(/\.json$/, ''), lines: ['snapshot has no fixture in manifest.json'] });
    }
  }

  if (opt.mode === 'update') {
    console.log(`wrote ${written} snapshots to ${snapDir}${failures.length ? `\nWARNING: ${failures.length} fixture(s) were non-deterministic` : ''}`);
    process.exit(failures.length ? 1 : 0);
  }

  if (!failures.length) {
    console.log(`golden: all ${same} fixtures match their snapshots`);
    return;
  }
  console.log(`golden: ${failures.length} of ${manifest.fixtures.length} fixtures differ from their snapshots\n`);
  for (const f of failures) {
    console.log(`── ${f.id}  (${f.lines.length} field${f.lines.length === 1 ? '' : 's'})`);
    f.lines.slice(0, opt.maxLines).forEach(l => console.log('   ' + l));
    if (f.lines.length > opt.maxLines) console.log(`   … ${f.lines.length - opt.maxLines} more`);
    console.log('');
  }
  console.log('"old -> new": old = committed snapshot, new = what the current index.html produces.');
  console.log('If the change is intended, run "node test/golden/run.js update", review the snapshot diff in the fixtures repo, and say so in the PR.');
  process.exit(1);
}

main();
