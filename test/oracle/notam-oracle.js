// Oracle for NOTAM window resolution, copied UNCHANGED (code below the credit block)
// from the independent QA comment on PR #27 (HF-5), "Independent QA — HF-5 (PR 27,
// head 621398b)": https://github.com/velocemente/relief-pilot/pull/27#issuecomment-6617361954
// Credit: written by the independent HF-5 QA session from the brief's table, before it
// read the diff. Do not edit the code below; if the rules change, replace the whole file
// from a new independent oracle.
// Independent oracle for HF-5 NOTAM window resolution (built from the brief table only).
'use strict';
const fs = require('fs'), path = require('path');
const MON = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
// "- ICAO [ICAO] A1234/YY [(nn/nnn)] DDMMMhhmm-(DDMMMhhmm|PERM) [20YY]"
const HDR = /^\s*-\s+([A-Z]{4})(?:\s+([A-Z]{4}))?\s+([A-Z]\d{1,4}\/(\d{2}))\s+(?:\(\d+\/\d+\)\s+)?(\d{2})([A-Z]{3})(\d{2})(\d{2})-(?:(\d{2})([A-Z]{3})(\d{2})(\d{2})|(PERM))(?:\s+(20\d{2}))?\s*$/;
// Sensitivity variant (NOT in the table): same, plus an optional trailing "EST" (= estimated end, rule 1).
const HDR_EST = new RegExp(HDR.source.replace('\\s*$', '(?:\\s+EST)?\\s*$'));
const FAR = Date.UTC(9999, 0, 1);
function ms(y, mo, d, h, mi) {               // strict: no roll-over
  const t = Date.UTC(y, mo, d, h, mi), x = new Date(t);
  if (x.getUTCFullYear() !== y || x.getUTCMonth() !== mo || x.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return t;
}
function resolve(m, flightISO) {
  const [fy, fm] = flightISO.split('-').map(Number);           // fm 1-based
  const flightMon = fm - 1, I = 2000 + +m[4];
  const sD = +m[5], sM = MON[m[6]], sh = +m[7], smi = +m[8];
  if (sM === undefined) return { rule: 'BAD', start: null, end: null };
  if (m[13]) {                                                  // T3 PERM
    return { rule: 'T3', start: ms(I, sM, sD, sh, smi), end: FAR };
  }
  const eD = +m[9], eM = MON[m[10]], eh = +m[11], emi = +m[12];
  if (eM === undefined) return { rule: 'BAD', start: null, end: null };
  let rule, endYear;
  if (m[14]) { rule = 'T1'; endYear = +m[14]; }                 // T1 same-line end year
  else {                                                        // T2
    rule = 'T2';
    endYear = (eM < sM && eM < flightMon) ? fy + 1 : fy;
  }
  const end = ms(endYear, eM, eD, eh, emi);
  let start = null;
  if (end !== null) for (let Y = I; Y <= endYear; Y++) {
    const s = ms(Y, sM, sD, sh, smi);
    if (s !== null && s <= end) { start = s; break; }
  }
  return { rule, start, end };
}
function inEffect(r, flightISO) {
  const [y, mo, d] = flightISO.split('-').map(Number);
  const d0 = Date.UTC(y, mo - 1, d), d1 = d0 + 86400000;
  if (r.start === null || r.end === null) return true;          // unresolvable -> fail-safe shown
  return r.start < d1 && r.end >= d0;
}
function build(fixDir, opts) {
  const RX = opts && opts.all ? HDR_ALL : opts && opts.est ? HDR_EST : HDR;
  const man = JSON.parse(fs.readFileSync(path.join(fixDir, 'manifest.json'), 'utf8'));
  const out = [];
  for (const f of man.fixtures) {
    if (f.format === 'flightkeys') continue;
    const text = fs.readFileSync(path.join(fixDir, f.files.text), 'utf8');
    const seen = new Map();
    for (const line of text.split(/\r?\n/)) {
      const m = RX.exec(line); if (!m) continue;
      const loc = m[2] ? m[1] + ' ' + m[2].trim().split(/\s+/).join(' ') : m[1];
      const key = f.id + '|' + loc + '|' + m[3];
      if (seen.has(key)) { seen.get(key).dupes++; continue; }
      const r = resolve(m, f.date);
      const e = { pkg: f.id, flight: f.date, loc, airport: m[1], twoLoc: !!m[2], id: m[3], rule: r.rule,
        start: r.start, end: r.end, inEffect: inEffect(r, f.date), unresolved: r.start === null || r.end === null,
        dupes: 0, line: line.trim() };
      seen.set(key, e); out.push(e);
    }
  }
  return out;
}
// Gap-explanation variant (NOT in the table): table+EST, and any number (>=1) of location codes.
const HDR_ALL = new RegExp(HDR_EST.source.replace('(?:\\s+([A-Z]{4}))?', '((?:\\s+[A-Z]{4})+)?'));
const locOf = m => m[2] ? m[1] + ' ' + m[2].trim().split(/\s+/).join(' ') : m[1];
module.exports = { build, resolve, inEffect, HDR, HDR_EST, HDR_ALL, locOf };
if (require.main === module) {
  for (const v of ['table', 'est', 'all']) {
  const o = build(process.argv[2], { est: v !== 'table', all: v === 'all' });
  console.log(v === 'table' ? 'TABLE (primary)' : v === 'est' ? 'VARIANT table+EST' : 'VARIANT table+EST+3..n locations');
  const c = (p) => o.filter(p).length;
  console.log(JSON.stringify({ unique: o.length, twoLoc: c(e => e.twoLoc), T1: c(e => e.rule === 'T1'),
    T2: c(e => e.rule === 'T2'), T3: c(e => e.rule === 'T3'), inEffect: c(e => e.inEffect),
    unresolved: c(e => e.unresolved), pkgs: new Set(o.map(e => e.pkg)).size }));
}
}
