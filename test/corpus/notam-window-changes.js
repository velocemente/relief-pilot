#!/usr/bin/env node
// Corpus comparison for NOTAM ruleset v1.11.2 (ledger P-23): which NOTAMs change between
// two NOTAM ruleset module files, at every release airport of every Navtech/eOFP fixture,
// at the OFP ETA, called exactly as src/airports.html evalAirport() calls evalNotams().
//
//   node test/corpus/notam-window-changes.js --before <module.js> [--after <module.js>]
//        [--fixtures <dir>] [--report <file.md>]
//
// --after defaults to the module listed in rules/manifest.json. Every NOTAM that goes
// shown -> hidden must have readable dates or a readable day-of-month schedule that lie
// wholly outside the actual evaluation window (ETA +/- 60 min on its actual UTC date,
// _evalWindows of the --after module). Any other shown -> hidden is a STOP: the script
// lists it and exits 1.
// Output names fixture ids, ICAO codes, roles, NOTAM IDs, dates and schedule times only;
// never NOTAM text, never crew data.
'use strict';
const fs = require('fs');
const path = require('path');
const { findFixtures, readManifest, importFixture } = require('../lib/app-path');
const { evalArgsFor, notamIdOf } = require('../lib/v0-snapshots');

const ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const o = { before: null, after: null, fixtures: null, report: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--before') o.before = argv[++i];
    else if (k === '--after') o.after = argv[++i];
    else if (k === '--fixtures') o.fixtures = argv[++i];
    else if (k === '--report') o.report = argv[++i];
    else { console.error(`unknown argument: ${k}`); process.exit(2); }
  }
  if (!o.before) { console.error('--before <module.js> is required'); process.exit(2); }
  if (!o.after) {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'manifest.json'), 'utf8'));
    o.after = path.join(ROOT, 'rules', man['notam-rules'].file);
  }
  o.fixtures = findFixtures(o.fixtures);
  if (!o.fixtures) { console.error('fixtures directory not found (use --fixtures or PB_FIXTURES)'); process.exit(2); }
  return o;
}

function loadModule(file) {
  const m = { exports: {} };
  new Function('module', 'exports', 'require', fs.readFileSync(path.resolve(file), 'utf8'))(m, m.exports, () => ({}));
  return m.exports;
}

const z = ms => ms === Infinity ? 'no end' : new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const hhmm = m => m === null || m === undefined ? '—' : String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0') + 'Z';
const SCHED_RE = /^\s*((?:\d{2}-\d{2}\s+)+)(\d{4})-(\d{4})\s*$/m;
const DLY_RE   = /^\s*(?:DLY\s+)?(\d{4}\s*-\s*\d{4}(?:\s*,\s*\d{4}\s*-\s*\d{4})*)/m;

// What decides this NOTAM's status: its dates (after D31 EST), and its schedule line if any.
function describe(mod, chunk, iso) {
  let w = mod.xNW_standalone(chunk, iso);
  const est = !!(w && mod._windowEndEstimated(chunk));
  if (w && est) w = { startMs: w.startMs, endMs: Infinity };
  const sm = chunk.match(SCHED_RE);
  const dly = !sm && chunk.match(DLY_RE);
  return { w, est, perm: /-PERM\b|C\)\s*PERM/.test(chunk.split('\n')[0] + chunk), sched: sm ? sm[0].trim() : dly ? 'DLY ' + dly[1].trim() : null, sm };
}

// Does the readable day-of-month schedule have any minute inside the windows? (as evalNotams)
function schedHits(sm, wins) {
  const hm = s => { const h = +s.slice(0, 2), m = +s.slice(2, 4); return (m >= 0 && m <= 59 && h >= 0 && h <= 24 && !(h === 24 && m)) ? h * 60 + m : null; };
  const startT = hm(sm[2]), endT = hm(sm[3]);
  const ranges = [...sm[1].matchAll(/(\d{2})-(\d{2})/g)].map(m => ({ from: +m[1], to: +m[2] }));
  if (startT === null || endT === null || !ranges.every(r => r.from >= 1 && r.to <= 31 && r.from <= r.to)) return null; // unreadable
  const onDay = d => ranges.some(r => d >= r.from && d <= r.to);
  const inP = m => endT >= startT ? (m >= startT && m <= endT) : (m >= startT || m <= endT);
  for (const x of wins) for (let t = x.startMs; t <= x.endMs; t += 60000) {
    const dt = new Date(t), m = dt.getUTCHours() * 60 + dt.getUTCMinutes();
    if (onDay(dt.getUTCDate()) && inP(m)) return true;
    if (endT < startT && m <= endT && onDay(new Date(t - 86400000).getUTCDate())) return true;
  }
  return false;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const before = loadModule(opt.before), after = loadModule(opt.after);
  if (typeof after._evalWindows !== 'function') { console.error('--after module has no _evalWindows()'); process.exit(2); }
  const manifest = readManifest(opt.fixtures);
  const fixtures = manifest.fixtures.filter(f => f.format !== 'flightkeys');
  const rows = [], stops = [];
  let airports = 0, evaluated = 0, notams = 0, shownB = 0, shownA = 0;
  for (const fx of fixtures) {
    const imp = await importFixture(fx, opt.fixtures);
    for (const apt of imp.app.getAllAirports()) {
      airports++;
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      evaluated++;
      notams += a.notamArr.length;
      const run = mod => {
        const r = mod.evalNotams(mod._splitNotams(imp.airportData[apt.icao].notams), a.evalRole, a.etaMin, a.acftType, a.flightISO, a.depMin);
        return new Set(r.issues.filter(i => i.notamRaw).map(i => notamIdOf(i.notamRaw)));
      };
      const b = run(before), f = run(after);
      shownB += b.size; shownA += f.size;
      const wins = a.etaMin === null || !a.flightISO ? [] : after._evalWindows(a.etaMin, a.depMin, a.flightISO);
      const winTxt = a.etaMin === null ? 'no ETA' : !a.flightISO ? 'no flight date'
        : wins.map(x => `${z(x.startMs)} – ${z(x.endMs).slice(11)}`).join(' or ');
      const changed = [...[...b].filter(id => !f.has(id)).map(id => [id, 'shown → hidden']),
                       ...[...f].filter(id => !b.has(id)).map(id => [id, 'hidden → shown'])];
      for (const [id, dir] of changed) {
        const chunks = a.notamArr.filter(c => notamIdOf(c) === id);
        const d = describe(after, chunks[0], a.flightISO);
        let reason;
        if (dir === 'shown → hidden') {
          // Every copy of this ID must be ruled out by its readable dates or schedule.
          const why = chunks.map(c => {
            const dc = describe(after, c, a.flightISO);
            if (!wins.length) return null;
            if (dc.w && !wins.some(x => dc.w.startMs <= x.endMs && dc.w.endMs >= x.startMs)) return 'dates wholly outside the window';
            if (dc.sm && schedHits(dc.sm, wins) === false) return 'day-of-month schedule wholly outside the window';
            return null;
          });
          if (why.some(x => x === null)) {
            reason = 'NOT EXPLAINED';
            stops.push(`${fx.id} ${apt.icao} (${apt.role}) ${id}`);
          } else reason = [...new Set(why)].join('; ');
          // What the removed two-day rule did.
          const depKnown = a.depMin !== null && a.depMin !== undefined && !isNaN(a.depMin);
          if (depKnown) {
            const onD1 = a.etaMin < a.depMin;
            reason += onD1
              ? ' (ETA on D + 1; in effect at the ETA time on D, which v1.11.1 also tried)'
              : ' (ETA on D; in effect at the ETA time on D + 1, which the ETA-before-1200Z rule also tried)';
          }
        } else {
          const wEdge = d.w && wins.some(x => d.w.endMs === x.startMs || d.w.startMs === x.endMs);
          reason = wEdge ? 'dates touch the window edge exactly (edges included)'
            : (a.depMin === null ? 'departure time unknown: D and D + 1 both checked' : 'see dates');
        }
        rows.push({ pkg: fx.id, date: fx.date, icao: apt.icao, role: apt.role, eta: apt.eta, out: hhmm(a.depMin), id,
          dates: d.w ? `${z(d.w.startMs)} – ${z(d.w.endMs)}${d.est ? ' (EST end: no end)' : ''}` : 'no readable dates',
          sched: d.sched || '—', window: winTxt, dir, reason, copies: chunks.length });
      }
    }
  }
  const toHidden = rows.filter(r => r.dir === 'shown → hidden'), toShown = rows.filter(r => r.dir === 'hidden → shown');
  const summary = { fixtures: fixtures.length, airports, evaluated, notamChunks: notams, shownBefore: shownB, shownAfter: shownA,
    shownToHidden: toHidden.length, hiddenToShown: toShown.length, unexplained: stops.length };
  console.log(JSON.stringify(summary));
  for (const r of rows) console.log(`${r.dir}  ${r.pkg} ${r.icao} (${r.role}) ${r.id}  window ${r.window}  dates ${r.dates}  sched ${r.sched}  — ${r.reason}`);
  if (opt.report) fs.writeFileSync(opt.report, report(summary, rows, opt));
  if (stops.length) {
    console.error(`STOP: ${stops.length} shown → hidden not explained by dates or schedule wholly outside the window:\n  ${stops.join('\n  ')}`);
    process.exit(1);
  }
}

function report(s, rows, opt) {
  const esc = v => String(v).replace(/\|/g, '\\|');
  const table = list => list.length ? [
    '| Package | Airport (role) | ETA / OUT | NOTAM ID | Dates (UTC) | Schedule | Actual window (UTC) | Change | Reason |',
    '| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |',
    ...list.map(r => `| ${esc(r.pkg)} | ${r.icao} (${esc(r.role)}) | ${r.eta || '—'}Z / ${r.out} | ${r.id}${r.copies > 1 ? ` (${r.copies} copies)` : ''} | ${esc(r.dates)} | ${esc(r.sched)} | ${esc(r.window)} | ${r.dir} | ${esc(r.reason)} |`),
  ].join('\n') : '_None._';
  const sorted = list => list.slice().sort((a, b) => (a.pkg + a.icao + a.id).localeCompare(b.pkg + b.icao + b.id));
  return `# NOTAM ruleset v1.11.2 — corpus changes vs main (v1.11.1)

Generated by \`node test/corpus/notam-window-changes.js --before <main v1.11.1 module> --report …\`
(ledger P-23). Every Navtech/eOFP fixture, every release airport, at the OFP ETA, with
the departure time (OUT) and flight date (DOF) the app passes (\`evalAirport()\`).
NOTAM IDs, airports, roles, dates and schedule times only; no NOTAM text, no crew data.

Rule (Exec, 7 Nov): a NOTAM is shown only if it is in effect at some time during the
airport's evaluation window (ETA ± 60 min) on the window's actual UTC date and time.
The actual window is D (DOF) + the ETA time, or D + 1 when the ETA time is earlier than OUT.

A NOTAM may go shown → hidden only when its readable dates or schedule lie wholly outside
the actual window; the script checks every such NOTAM (every copy of its ID) and stops
on any other.

## Totals

| | Count |
| :-- | --: |
| Navtech/eOFP fixtures | ${s.fixtures} |
| Release airports (evaluated with NOTAM text) | ${s.airports} (${s.evaluated}) |
| NOTAM entries evaluated | ${s.notamChunks} |
| NOTAM IDs shown, main v1.11.1 | ${s.shownBefore} |
| NOTAM IDs shown, v1.11.2 | ${s.shownAfter} |
| **shown → hidden** | **${s.shownToHidden}** |
| **hidden → shown** | **${s.hiddenToShown}** |
| shown → hidden not explained (STOP) | ${s.unexplained} |

## shown → hidden

${table(sorted(rows.filter(r => r.dir === 'shown → hidden')))}

## hidden → shown

${table(sorted(rows.filter(r => r.dir === 'hidden → shown')))}
`;
}

main().catch(e => { console.error(e); process.exit(1); });
