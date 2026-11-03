#!/usr/bin/env node
// Corpus count: NOTAMs whose resolved window does not cover their flight date.
//
//   node test/corpus/notam-hidden.js [--fixtures <dir>] [--html <index.html>] [--list]
//
// For every Navtech / eOFP fixture (format not "flightkeys"): split the package
// text with _splitNotams, resolve each NOTAM with xNW_standalone at the flight
// date, and report the headers whose window does not overlap the flight date
// (00:00Z to 24:00Z, UTC). A NOTAM with no resolvable window (null) is in
// effect and is not counted. --html measures any build (default: index.html).
// Prints only fixture ids and NOTAM ids, never NOTAM text.
// This is a measuring script, not a unit test: it always exits 0 on success.
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const o = { fixtures: null, html: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fixtures') o.fixtures = argv[++i];
    else if (argv[i] === '--html') o.html = argv[++i];
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

// NOTAM header: "- ICAO ..." with a date range or PERM on the first line.
const HEADER_RE = /^- [A-Z]{4}\b.*\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}-(?:\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/;
const ID_RE = /\b[A-Z]\d{4}\/\d{2}\b/;

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const html = opt.html ? fs.readFileSync(path.resolve(opt.html), 'utf8') : undefined;
  const { loadApp } = require('../harness');
  const app = loadApp({ html });
  const manifest = JSON.parse(fs.readFileSync(path.join(opt.fixtures, 'manifest.json'), 'utf8'));
  const fixtures = manifest.fixtures.filter(fx => fx.format !== 'flightkeys');

  let total = 0, hidden = 0, hiddenPerm = 0, unresolved = 0;
  for (const fx of fixtures) {
    const raw = fs.readFileSync(path.join(opt.fixtures, fx.files.text), 'utf8');
    const dayStart = Date.UTC(+fx.date.slice(0, 4), +fx.date.slice(5, 7) - 1, +fx.date.slice(8, 10));
    const dayEnd = dayStart + 86400000;
    const rows = [];
    for (const n of app._splitNotams(raw)) {
      const first = n.split('\n')[0];
      if (!HEADER_RE.test(first)) continue;
      total++;
      const w = app.xNW_standalone(n, fx.date);
      if (!w) { unresolved++; continue; }
      if (w.startMs < dayEnd && w.endMs > dayStart) continue;
      const perm = /-PERM\b/.test(first);
      hidden++; if (perm) hiddenPerm++;
      const icao = first.slice(2, 6);
      const id = (first.match(ID_RE) || ['(no id)'])[0];
      rows.push(`  ${icao} ${id}${perm ? ' PERM' : ''}  ${new Date(w.startMs).toISOString().slice(0, 16)}Z .. ${new Date(w.endMs).toISOString().slice(0, 16)}Z`);
    }
    if (rows.length) {
      console.log(`${fx.id} (${fx.date}): ${rows.length} not in effect`);
      if (opt.list) rows.forEach(r => console.log(r));
    }
  }
  console.log(`\nbuild: ${opt.html || 'index.html'}`);
  console.log(`fixtures: ${fixtures.length} Navtech/eOFP; NOTAM headers: ${total}`);
  console.log(`window does not cover flight date: ${hidden} (${hidden - hiddenPerm} dated, ${hiddenPerm} PERM)`);
  console.log(`no resolvable window (in effect): ${unresolved}`);
}

main();
