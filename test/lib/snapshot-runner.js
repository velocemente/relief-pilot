'use strict';
// Shared compare/update loop of test/golden/notam.js and test/golden/app.js.
//   node test/golden/<name>.js compare [--fixtures <dir>] [--max-lines <n>]
//   node test/golden/<name>.js update  [--fixtures <dir>]
// Snapshots are read from / written to <fixtures>/<dirName>/<id>.json.
// Missing fixtures, a missing snapshot, or a snapshot with no fixture all FAIL.
// Live FlightKeys fixtures are not selected (app-path.js snapshotFixtures).
const fs = require('fs');
const path = require('path');
const { normalize, stringify } = require('../golden/serialize');
const { diff } = require('../golden/diff');
const { findFixtures, readManifest, importFixture, snapshotFixtures } = require('./app-path');

function parseArgs(argv, usage) {
  const o = { mode: argv[0], fixtures: null, maxLines: 40 };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--fixtures') o.fixtures = argv[++i];
    else if (argv[i] === '--max-lines') o.maxLines = parseInt(argv[++i], 10);
    else { console.error(`unknown argument: ${argv[i]}`); process.exit(2); }
  }
  if (o.mode !== 'compare' && o.mode !== 'update') { console.error(usage); process.exit(2); }
  o.dir = findFixtures(o.fixtures);
  if (!o.dir) { console.error('fixtures directory not found (use --fixtures or PB_FIXTURES)'); process.exit(2); }
  return o;
}

async function run({ name, dirName, build }) {
  const opt = parseArgs(process.argv.slice(2), `usage: ${name}.js compare|update [--fixtures <dir>] [--max-lines <n>]`);
  const manifest = readManifest(opt.dir);
  const snapDir = path.join(opt.dir, dirName);
  const failures = [];
  let same = 0, written = 0;
  const selected = snapshotFixtures(manifest);
  const notSelected = manifest.fixtures.length - selected.length;
  if (notSelected) console.log(`${name}: ${notSelected} live FlightKeys fixture(s) not compared (no snapshots)`);

  for (const fx of selected) {
    let snap;
    try {
      const imp = await importFixture(fx, opt.dir);
      snap = normalize(build(fx, imp));
      // The import must not carry state between runs: a second, fresh run has to agree.
      const again = normalize(build(fx, await importFixture(fx, opt.dir)));
      const nondet = diff(snap, again);
      if (nondet.length) failures.push({ id: fx.id, lines: ['NON-DETERMINISTIC: two imports of the same fixture differ', ...nondet] });
    } catch (e) {
      failures.push({ id: fx.id, lines: [`import failed: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`] });
      continue;
    }
    const file = path.join(snapDir, `${fx.id}.json`);
    if (opt.mode === 'update') {
      fs.mkdirSync(snapDir, { recursive: true });
      fs.writeFileSync(file, stringify(snap));
      written++;
      continue;
    }
    if (!fs.existsSync(file)) {
      failures.push({ id: fx.id, lines: [`no snapshot at ${dirName}/${fx.id}.json (run "update" and commit it to the fixtures repo)`] });
      continue;
    }
    const lines = diff(JSON.parse(fs.readFileSync(file, 'utf8')), snap);
    if (lines.length) failures.push({ id: fx.id, lines }); else same++;
  }

  if (opt.mode === 'compare') {
    const ids = new Set(manifest.fixtures.map(f => f.id));
    const present = fs.existsSync(snapDir) ? fs.readdirSync(snapDir).filter(n => n.endsWith('.json')) : [];
    for (const f of present) {
      if (!ids.has(f.replace(/\.json$/, ''))) failures.push({ id: f.replace(/\.json$/, ''), lines: [`snapshot has no fixture in manifest.json`] });
    }
  }

  if (opt.mode === 'update') {
    console.log(`${name}: wrote ${written} snapshots to ${snapDir}${failures.length ? `\nWARNING: ${failures.length} fixture(s) failed` : ''}`);
    failures.forEach(f => console.log(`── ${f.id}\n   ${f.lines.join('\n   ')}`));
    process.exit(failures.length ? 1 : 0);
  }
  if (!failures.length) { console.log(`${name}: all ${same} fixtures match their snapshots`); return; }
  console.log(`${name}: ${failures.length} of ${selected.length} fixtures differ from their snapshots\n`);
  for (const f of failures) {
    console.log(`── ${f.id}  (${f.lines.length} field${f.lines.length === 1 ? '' : 's'})`);
    f.lines.slice(0, opt.maxLines).forEach(l => console.log('   ' + l));
    if (f.lines.length > opt.maxLines) console.log(`   … ${f.lines.length - opt.maxLines} more`);
    console.log('');
  }
  console.log(`"old -> new": old = committed ${dirName}/ snapshot, new = what the current index.html produces.`);
  console.log(`If the change is intended, run "node test/golden/${name}.js update", review the snapshot diff in the fixtures repo, and say so in the PR.`);
  process.exit(1);
}

module.exports = { run };
