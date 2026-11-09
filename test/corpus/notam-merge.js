#!/usr/bin/env node
// Corpus count: NOTAMs shown by evalNotams() per release airport (HF-6, D43).
//
//   node test/corpus/notam-merge.js [--fixtures <dir>] [--html <index.html>]
//                                   [--base <index.html>] [--list]
//
// For every Navtech / eOFP fixture (format not "flightkeys"), run evalNotams()
// on each release airport exactly as the airport card does: ORIG at the OFP
// OFF time, DEST at the OFP ETA, each alternate in altData at its OFP ETA.
// Each airport gets the NOTAMs the parser filed under it (airportData).
// --html measures any build (default: index.html). --base compares against a
// second build (e.g. main's index.html) and reports, per package, the NOTAMs
// the --html build shows that the base build does not ("added") and the
// reverse ("removed"). --list prints them as ICAO + NOTAM ID.
// Prints only fixture ids, ICAO codes and NOTAM IDs, never NOTAM text.
// This is a measuring script, not a unit test: it always exits 0 on success.
'use strict';
const fs = require('fs');
const path = require('path');

// "- ICAO [ICAO ...] A1234/26 ..." → location(s) + ID, as printed.
const ID_RE = /^\s*-\s+((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})(?=\s|$)/;

function headerId(n) {
  const m = n.match(ID_RE);
  return m ? `${m[1].trim().split(/\s+/).join(' ')} ${m[2]}` : null;
}

// Minutes of day from "HHMM", as pZM() in the app.
function minOfDay(s) {
  const c = String(s || '').replace(/\D/g, '');
  if (c.length < 4) return null;
  return parseInt(c.slice(0, 2), 10) * 60 + parseInt(c.slice(2, 4), 10);
}

// Release airports of one parsed OFP: [{ icao, role, evalRole, eta, notams }].
function releaseRuns(app, raw, fx) {
  const r = app._ofpRulesetParse(raw);
  const ad = r.airportData || {};
  const out = [];
  const add = (icao, role, eta) => {
    if (!icao) return;
    const text = (ad[icao] && ad[icao].notams) || '';
    out.push({ icao, role, evalRole: role === 'ORIG' ? 'ORIG' : 'DEST', eta,
               notams: text.trim() ? app._splitNotams(text) : [] });
  };
  add(r.origIcao, 'ORIG', r.offFromOFP);
  add(r.destIcao, 'DEST', r.etaDest);
  for (const a of r.altData || []) add(a.icao, a.role, a.ofpEta);
  return { iso: r.flightDateISO || fx.date, acftType: r.acftType || '', runs: out };
}

// NOTAM strings in evalNotams() output (the "no critical items" row excluded).
function shown(app, run, iso, acftType) {
  if (!run.notams.length) return [];
  const res = app.evalNotamsAs(run.notams, run.evalRole, minOfDay(run.eta), acftType, iso);
  return res.issues.filter(i => i.notamRaw).map(i => i.notamRaw);
}

function parseArgs(argv) {
  const o = { fixtures: null, html: null, base: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fixtures') o.fixtures = argv[++i];
    else if (argv[i] === '--html') o.html = argv[++i];
    else if (argv[i] === '--base') o.base = argv[++i];
    else if (argv[i] === '--list') o.list = true;
    else { console.error(`unknown argument: ${argv[i]}`); process.exit(2); }
  }
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [o.fixtures, process.env.PB_FIXTURES, path.join(root, 'fixtures'),
                      path.join(root, '..', 'pilotbrief-fixtures')].filter(Boolean);
  o.fixtures = candidates.find(d => fs.existsSync(path.join(d, 'manifest.json')));
  if (!o.fixtures) { console.error('fixtures directory not found (use --fixtures or PB_FIXTURES)'); process.exit(2); }
  return o;
}

// Multiset difference a − b of strings.
function minus(a, b) {
  const left = new Map();
  for (const x of b) left.set(x, (left.get(x) || 0) + 1);
  const out = [];
  for (const x of a) {
    const k = left.get(x) || 0;
    if (k > 0) left.set(x, k - 1); else out.push(x);
  }
  return out;
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const { loadApp } = require('../harness');
  const read = p => fs.readFileSync(path.resolve(p), 'utf8');
  const app  = loadApp({ html: opt.html ? read(opt.html) : undefined });
  const base = opt.base ? loadApp({ html: read(opt.base) }) : null;
  const manifest = JSON.parse(fs.readFileSync(path.join(opt.fixtures, 'manifest.json'), 'utf8'));
  const fixtures = manifest.fixtures.filter(fx => fx.format !== 'flightkeys');

  let runs = 0, total = 0, totalBase = 0, added = 0, removed = 0;
  for (const fx of fixtures) {
    const raw = fs.readFileSync(path.join(opt.fixtures, fx.files.text), 'utf8');
    const rel = releaseRuns(app, raw, fx);
    let pkgShown = 0, pkgAdded = 0, pkgRemoved = 0;
    const rows = [];
    for (const run of rel.runs) {
      runs++;
      const now = shown(app, run, rel.iso, rel.acftType);
      pkgShown += now.length;
      if (!base) continue;
      const before = shown(base, run, rel.iso, rel.acftType);
      totalBase += before.length;
      const plus = minus(now, before), less = minus(before, now);
      pkgAdded += plus.length; pkgRemoved += less.length;
      plus.forEach(n => rows.push(`  + ${run.icao} (${run.role}) ${headerId(n) || '(no id)'}`));
      less.forEach(n => rows.push(`  - ${run.icao} (${run.role}) ${headerId(n) || '(no id)'}`));
    }
    total += pkgShown; added += pkgAdded; removed += pkgRemoved;
    if (base) console.log(`${fx.id} (${fx.date}): shown ${pkgShown}, added ${pkgAdded}, removed ${pkgRemoved}`);
    else console.log(`${fx.id} (${fx.date}): shown ${pkgShown}`);
    if (opt.list) rows.forEach(r => console.log(r));
  }
  console.log(`\nbuild: ${opt.html || 'index.html'}${opt.base ? `  base: ${opt.base}` : ''}`);
  console.log(`fixtures: ${fixtures.length} Navtech/eOFP; release airport runs: ${runs}`);
  console.log(`NOTAMs shown: ${total}${base ? ` (base ${totalBase})` : ''}`);
  if (base) console.log(`added vs base: ${added}; removed vs base: ${removed}`);
}

module.exports = { releaseRuns, shown, headerId, minOfDay };
if (require.main === module) main();
