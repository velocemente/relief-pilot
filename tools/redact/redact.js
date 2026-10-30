#!/usr/bin/env node
// Replaces crew names, dispatcher names and employee numbers in extracted
// OFP text (.raw.txt) and positional items (.items.json) with stable fake values.
//
//   * Stable: the fake value is a pure function of the original token and a
//     fixed salt (SHA-256). Same input -> same output, in any run, on any file.
//   * Raw and items are redacted by the same line rules, so they stay in step.
//   * Not redacted: ordinary text that happens to look like a name (airports,
//     NOTAM text, month names...). Only the patterns listed in findLineSpans().
//
// Usage:
//   node tools/redact/redact.js --out <dir> [--show-map] <file.raw.txt|file.items.json> ...
//
// The report lists counts and fake values only. Original values are printed
// only with --show-map; treat that output as personal data.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SALT = 'pilotbrief-redact-v1';
const YTOL = 2; // same line grouping as index.html / tools/extract

// ── stable fakes ──────────────────────────────────────────────────────────
function digest(kind, s) {
  return crypto.createHash('sha256').update(`${SALT}|${kind}|${s}`).digest();
}
const ON = ['BR', 'CAL', 'DEN', 'FAR', 'GRAN', 'HOL', 'KEL', 'LAN', 'MOR', 'NOR', 'PAR', 'QUIN', 'ROS', 'SAN', 'TAL', 'WEL'];
const MID = ['A', 'E', 'I', 'O', 'U', 'AN', 'EL', 'IN', 'OR', 'AR', 'EN', 'ON', 'IL', 'UR', 'AL', 'ER'];
const OFF = ['TON', 'FORD', 'MAN', 'SON', 'LEY', 'WOOD', 'BERG', 'FIELD', 'WELL', 'DALE', 'MORE', 'STONE', 'HART', 'WICK', 'BY', 'LAND'];
const KEEP = new Set(['JR', 'SR', 'II', 'III', 'IV']);

function fakeWord(w) {
  const up = w.toUpperCase();
  if (KEEP.has(up)) return w;
  if (up.length === 1) return String.fromCharCode(65 + (digest('initial', up)[0] % 26));
  const d = digest('word', up);
  return ON[d[0] & 15] + MID[d[1] & 15] + OFF[d[2] & 15];
}
function fakeNumber(n) {
  const d = digest('empno', n);
  let out = '9';
  for (let i = 1; i < n.length; i++) out += String(d[i] % 10);
  return out;
}
// Replace each letter run in a printed name, keep punctuation/spacing.
function fakeName(name) {
  return name.replace(/[A-Za-z]+/g, fakeWord);
}

// ── line rules ────────────────────────────────────────────────────────────
// Returns { found: [{kind, orig}] } entries for registry building, and spans.
const ROSTER = /^(\s*(?:CA|FO|FA|PU|LM|MX|DH|RO|IRO|SO)\s+(?:\*\s*)?)(\d{5,7})(\s+)(.+?)(?=\s+\.\.|\s*$)/;
const DH_NONUM = /^(\s*DH\s+)([A-Za-z][A-Za-z’'\-. ]*?)(\s+(?:FA|FO|CPT|PR|CA)\s*)$/;
const DISPATCHER = /^(\s*Signed by Dispatcher:\s*)([A-Za-z][A-Za-z’'\-.() ]*?)\s*$/;

function ruleMatches(line) {
  const out = []; // { kind, start, end, orig }
  let m;
  if ((m = ROSTER.exec(line))) {
    const numStart = m[1].length;
    out.push({ kind: 'empno', start: numStart, end: numStart + m[2].length, orig: m[2] });
    const nameStart = numStart + m[2].length + m[3].length;
    out.push({ kind: 'crew', start: nameStart, end: nameStart + m[4].length, orig: m[4] });
  } else if ((m = DH_NONUM.exec(line))) {
    out.push({ kind: 'crew', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  } else if ((m = DISPATCHER.exec(line)) && !/NOT RELEASED/i.test(m[2])) {
    out.push({ kind: 'dispatcher', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  }
  return out;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Build the per-file registry from every line, then return a function that
// maps a line to replacement spans [{start,end,text,kind}].
function makeRedactor(lines) {
  const numbers = new Set();
  const names = new Map(); // normalised multi-token name -> kind
  for (const line of lines) {
    for (const r of ruleMatches(line)) {
      if (r.kind === 'empno') numbers.add(r.orig);
      // Only distinctive names are searched for elsewhere; "MAY A" or "HALL N"
      // would also rewrite ordinary text ("MAY A BIRD", "SHALL NOT").
      else if (r.orig.split(/[^A-Za-z]+/).filter(t => t.length >= 3).length >= 2) {
        names.set(r.orig.trim().replace(/\s+/g, ' '), r.kind);
      }
    }
  }
  const numRe = numbers.size ? new RegExp(`(?<![0-9])(?:${[...numbers].map(esc).join('|')})(?![0-9])`, 'g') : null;
  const nameRe = names.size
    ? new RegExp(`(?<![A-Za-z])(?:${[...names.keys()].sort((a, b) => b.length - a.length)
        .map(n => esc(n).replace(/ /g, '\\s+')).join('|')})(?![A-Za-z])`, 'g')
    : null;

  return function spans(line) {
    const found = ruleMatches(line).map(r => ({ start: r.start, end: r.end, kind: r.kind, orig: r.orig }));
    const add = (re, kind) => {
      if (!re) return;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        if (found.some(f => m.index < f.end && m.index + m[0].length > f.start)) continue;
        found.push({ start: m.index, end: m.index + m[0].length, kind, orig: m[0] });
      }
    };
    add(numRe, 'empno');
    add(nameRe, 'crew');
    found.sort((a, b) => a.start - b.start);
    return found.map(f => ({ ...f, text: f.kind === 'empno' ? fakeNumber(f.orig) : fakeName(f.orig) }));
  };
}

function applySpans(line, spans) {
  let out = '', pos = 0;
  for (const s of spans) { out += line.slice(pos, s.start) + s.text; pos = s.end; }
  return out + line.slice(pos);
}

// ── report ────────────────────────────────────────────────────────────────
class Report {
  constructor() { this.counts = {}; this.map = new Map(); }
  add(s) {
    this.counts[s.kind] = (this.counts[s.kind] || 0) + 1;
    this.map.set(`${s.kind}\t${s.orig.replace(/\s+/g, ' ')}`, s.text);
  }
  unique() { const u = {}; for (const k of this.map.keys()) { const kind = k.split('\t')[0]; u[kind] = (u[kind] || 0) + 1; } return u; }
}

// ── raw text ──────────────────────────────────────────────────────────────
function redactRaw(text, report) {
  const lines = text.split('\n');
  const spansFor = makeRedactor(lines);
  return lines.map(l => {
    const sp = spansFor(l);
    sp.forEach(s => report.add(s));
    return applySpans(l, sp);
  }).join('\n');
}

// ── items ─────────────────────────────────────────────────────────────────
// Assemble lines exactly like the app, remembering where each item sits.
function assemble(pageItems) {
  const lines = [];
  pageItems.forEach(it => {
    if (!it.str) return;
    let b = lines.find(l => Math.abs(l.y - it.y) <= YTOL);
    if (!b) { b = { y: it.y, items: [] }; lines.push(b); }
    b.items.push(it);
  });
  return lines.map(l => {
    const sorted = l.items.slice().sort((a, b) => a.x - b.x);
    let str = '', prevRight = null;
    const ranges = [];
    sorted.forEach(it => {
      if (prevRight !== null) {
        const gap = it.x - prevRight;
        str += gap > 20 ? '   ' : gap > 8 ? '  ' : gap > 3 ? ' ' : '';
      }
      ranges.push({ it, start: str.length, end: str.length + it.str.length });
      str += it.str;
      prevRight = it.x + (it.w || it.str.length * 5);
    });
    return { str, ranges };
  });
}

function redactItems(json, report) {
  const perPage = json.pages.map(p => assemble(p.items));
  const spansFor = makeRedactor(perPage.flat().map(l => l.str));
  perPage.forEach(pageLines => pageLines.forEach(line => {
    const sp = spansFor(line.str);
    if (!sp.length) return;
    sp.forEach(s => report.add(s));
    // Rewrite item strings: the first item a span touches carries the fake
    // text, later items lose their covered part.
    const edits = new Map(); // item -> [{from,to,text}] in item-local offsets
    sp.forEach(s => {
      let first = true;
      line.ranges.forEach(r => {
        const a = Math.max(s.start, r.start), b = Math.min(s.end, r.end);
        if (a >= b) return;
        if (!edits.has(r.it)) edits.set(r.it, []);
        edits.get(r.it).push({ from: a - r.start, to: b - r.start, text: first ? s.text : '' });
        first = false;
      });
    });
    edits.forEach((list, it) => {
      let out = '', pos = 0;
      list.sort((x, y) => x.from - y.from).forEach(e => { out += it.str.slice(pos, e.from) + e.text; pos = e.to; });
      it.str = out + it.str.slice(pos);
    });
  }));
  return json;
}

// ── CLI ───────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  let outDir = null, showMap = false;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = args[++i];
    else if (args[i] === '--show-map') showMap = true;
    else files.push(args[i]);
  }
  if (!outDir || !files.length) {
    console.error('usage: redact.js --out <dir> [--show-map] <file.raw.txt|file.items.json> ...');
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const total = new Report();
  for (const f of files) {
    const rep = new Report();
    let out;
    if (/\.items\.json$/.test(f)) out = JSON.stringify(redactItems(JSON.parse(fs.readFileSync(f, 'utf8')), rep));
    else if (/\.raw\.txt$/.test(f)) out = redactRaw(fs.readFileSync(f, 'utf8'), rep);
    else { console.error(`skip (unknown type): ${f}`); continue; }
    fs.writeFileSync(path.join(outDir, path.basename(f)), out);
    const c = rep.counts;
    console.log(`${path.basename(f)}: ${c.empno || 0} employee numbers, ${c.crew || 0} crew names, ${c.dispatcher || 0} dispatcher names replaced`);
    rep.map.forEach((v, k) => total.map.set(k, v));
  }
  const u = total.unique();
  console.log(`\nDistinct values replaced: ${u.empno || 0} employee numbers, ${u.crew || 0} crew names, ${u.dispatcher || 0} dispatcher names`);
  if (showMap) {
    console.log('\nPERSONAL DATA BELOW (original -> fake)');
    total.map.forEach((v, k) => console.log(`${k.replace('\t', ' ')} -> ${v}`));
  }
}

module.exports = { redactRaw, redactItems, Report, fakeName, fakeNumber };
if (require.main === module) main();
