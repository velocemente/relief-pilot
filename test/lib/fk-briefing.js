'use strict';
/**
 * test/lib/fk-briefing.js — TEST CODE ONLY. Builds FlightKeys NOTAM item texts from the
 * fixtures' items/*.items.json (pdf.js 3.11.174 text items with x/y), with the two-column
 * reading of RPT-OFP-FlightKeys-BriefingGrammar §A.1. The NOTAM module never reads positions
 * (brief 5c, D54); the FlightKeys parser does that in step 5d. These helpers stand in for the
 * parser so the module can be tested on real item text.
 *
 * Reading (§A.1, §A.3):
 *   - every briefing page is landscape and printed in two columns: x < 411 pt left, the rest right;
 *   - y < 30 pt is the running header, y > 565 pt the footer;
 *   - order: header, left column top to bottom, right column top to bottom, footer;
 *   - items within 2 pt of the same y form one line (as the app's line assembly), sorted by x;
 *   - indentation and gaps are kept as spaces: the briefing font is monospaced, 4.8 pt per
 *     character (8 pt Courier); indent 0 = the column's left edge (left 30.3 pt, right 430 pt).
 *   - a briefing document is a run of pages whose footer reads "Page n of N <uuid>" (§A.2).
 *
 * Segmenting (§A.2 "Method", §A.1 "Counting"): an item runs from its header line (§A.5) to the
 * next item header, category heading (§A.6), airport or FIR block (§A.4, §A.8), empty-state box,
 * or document end. Page furniture (footer + running header) inside an item is removed by shape
 * (§A.3, §A.10 row 10), unless keepFurniture is set. "Contact Dispatch for a preflight
 * briefing." belongs to no item (§A.7) and is dropped.
 *
 * Nothing here is copied into the app or the module.
 */

const fs   = require('fs');
const path = require('path');

const CHAR_W   = 4.8;
const COL_X    = 411;
const LEFT_X0  = 30.3;
const RIGHT_X0 = 430.0;
const HEAD_Y   = 30;
const FOOT_Y   = 565;
const YTOL     = 2;

// §A.6 — the closed list of 17 category headings.
const CATEGORIES = ['RUNWAY', 'TAXIWAY', 'APPROACH AND LANDING', 'AIRPORT', 'OBSTACLE', 'NAVIGATION',
  'COMMUNICATION', 'AIRSPACE', 'WARNING', 'GENERAL', 'RAMP', 'DEPARTURE PROCEDURES',
  'ARRIVAL PROCEDURES', 'FACILITIES', 'N/A', 'HAZARD', 'SERVICE'];

// §A.5 row 1 as printed: [locations] [ID] START - END. Used here only to SEGMENT (the module has
// its own grammar; the tests check that both agree). Locations are 3–4 capital letters; the ID is
// <series><nnnn>/<yy> (series optional) or "ASHTAM nnnn"; START is YYYY-Mon-DD HH:MM.
const D   = '\\d{4}-[A-Za-z]{3}-\\d{1,2}\\s+\\d{1,2}:\\d{2}';
const HDR = new RegExp(`^\\s*(?:(?:[A-Z]{3,4}\\s+)+(?:(?:[A-Z]?\\d{4}\\/\\d{2}|ASHTAM\\s+\\d{4})\\s+)?|(?:[A-Z]?\\d{4}\\/\\d{2})\\s+)${D}\\s*-\\s*(?:${D}|UFN(?:\\s*\\(EST\\s+${D}\\))?)\\s*$`);

const RUNNING_HEADER = /^\s*\S+\s*\/\s*[A-Z0-9]{3,4}\s*-\s*[A-Z0-9]{3,4}\s*\/\s*\d{4}-\d{2}-\d{2}\s*\/\s*\S+\s+\d{4}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}\s*$/;
const FOOTER         = /^\s*Page\s*\d+\s*of\s*\d+\s+[0-9a-f-]{36}\s*$/;

function isFurniture(line) { return RUNNING_HEADER.test(line) || FOOTER.test(line); }

// One page → { header:[line], left:[line], right:[line], footer:[line] } (lines are strings).
function pageLines(page) {
  const groups = { header: [], left: [], right: [], footer: [] };
  for (const it of page.items) {
    if (!it.str || !it.str.trim()) continue;
    const g = it.y < HEAD_Y ? 'header' : it.y > FOOT_Y ? 'footer' : it.x < COL_X ? 'left' : 'right';
    groups[g].push(it);
  }
  const out = {};
  for (const [g, items] of Object.entries(groups)) {
    const x0 = g === 'right' ? RIGHT_X0 : (g === 'left' ? LEFT_X0 : 28.3);
    const rows = [];
    for (const it of items) {
      let r = rows.find(row => Math.abs(row.y - it.y) <= YTOL);
      if (!r) { r = { y: it.y, items: [] }; rows.push(r); }
      r.items.push(it);
    }
    rows.sort((a, b) => a.y - b.y);
    out[g] = rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      let s = ' '.repeat(Math.max(0, Math.round((r.items[0].x - x0) / CHAR_W)));
      let right = null;
      for (const it of r.items) {
        if (right !== null) {
          const gap = it.x - right;
          s += gap <= 1 ? '' : ' '.repeat(Math.max(1, Math.round(gap / CHAR_W)));
        }
        s += it.str;
        right = it.x + (it.w || it.str.length * CHAR_W);
      }
      return s.replace(/\s+$/, '');
    });
  }
  return out;
}

// Briefing documents: runs of pages whose footer "Page n of N" counts 1..N (§A.2).
function documents(pages) {
  const docs = [];
  let cur = null;
  for (const p of pages) {
    const pl = pageLines(p);
    const f = pl.footer.join(' ').match(/Page\s*(\d+)\s*of\s*(\d+)/);
    if (!f) { cur = null; continue; }
    const n = +f[1], N = +f[2];
    if (n === 1) { cur = { pages: [], N }; docs.push(cur); }
    if (!cur) continue;
    cur.pages.push({ n: p.n, lines: pl });
    if (n === N) cur = null;
  }
  return docs;
}

// Reading-order lines of a document, each { text, page, furniture }.
function readingOrder(doc) {
  const out = [];
  for (const p of doc.pages) {
    for (const t of p.lines.header) out.push({ text: t, page: p.n, furniture: true });
    for (const t of p.lines.left)   out.push({ text: t, page: p.n, furniture: false, col: 'L' });
    for (const t of p.lines.right)  out.push({ text: t, page: p.n, furniture: false, col: 'R' });
    for (const t of p.lines.footer) out.push({ text: t, page: p.n, furniture: true });
  }
  return out;
}

function isCategory(line) {
  const t = line.trim();
  return CATEGORIES.includes(t) && /^\s{15,}/.test(line);
}
function isBlockLine(line) {
  const t = line.trim();
  return /^APT[A-Z]{4}/.test(t) ||                                    // §A.4 APT line
         /^FIR[A-Z]{4}$/.test(t) ||                                   // §A.8 code line
         /\d{2} \d{2}:\d{2} - \d{2} \d{2}:\d{2}\s*$/.test(t) && !HDR.test(line) || // §A.4 role cell
         (/\b(?:FIR|UIR|FIR\/UIR|ARTCC(?: HIGH| LOW)?|FIR 2)$/.test(t) && /^\s{15,}/.test(line)) || // §A.8 name
         /^THERE ARE NO ACTIVE/.test(t) || t === 'NIL' ||                    // empty-state box
         /^(?:TIME )?PERIOD THAT MATCHES THE FILTERING CRITERIA\.$/.test(t) ||
         t === 'COMPANY NOTAMS' || t === 'HIGH SEVERITY COMPANY NOTAMS';
}
const isDispatchLine = line => /^Contact Dispatch for\s+a preflight briefing\.$/.test(line.trim());

/**
 * Items of one document: [{ text, page, pageEnd, crossesPage, furnitureInside, headerSplit }].
 * opts.keepFurniture: leave the footer/running header lines inside an item (raw order).
 */
function segment(doc, opts = {}) {
  const lines = readingOrder(doc);
  const items = [];
  let cur = null;
  const close = () => {
    if (!cur) return;
    while (cur.lines.length && !cur.lines[cur.lines.length - 1].text.trim()) cur.lines.pop();
    items.push(cur); cur = null;
  };
  for (const l of lines) {
    if (l.furniture) {
      if (cur) { cur.furnitureInside = true; if (opts.keepFurniture) cur.lines.push(l); }
      continue;
    }
    if (isDispatchLine(l.text)) continue;
    if (HDR.test(l.text)) { close(); cur = { lines: [l], furnitureInside: false }; continue; }
    if (isCategory(l.text) || isBlockLine(l.text)) { close(); continue; }
    if (cur) cur.lines.push(l);
  }
  close();
  return items.map(it => {
    const body = it.lines.filter(l => !l.furniture);
    // Header rows (§A.5): row 1, any wrapped location / ID lines, the CREATED:/FL: row, then an
    // optional SCHEDULE: and SUBJECT: row. "Header rows split by a page": a header row is on a
    // later page than row 1.
    let last = body.findIndex(l => /CREATED:/.test(l.text));
    if (last < 0) last = 0;
    for (let k = last + 1; k < body.length && /^\s*(?:SCHEDULE|SUBJECT):/.test(body[k].text); k++) last = k;
    const headerSplit = body.slice(0, last + 1).some(l => l.page !== body[0].page);
    const isCompany = body.slice(0, last + 1).some(l => /^\s*SUBJECT:/.test(l.text));
    return {
      text: it.lines.map(l => l.text).join('\n'),
      page: body[0].page, pageEnd: body[body.length - 1].page,
      crossesPage: body[body.length - 1].page !== body[0].page,
      furnitureInside: it.furnitureInside,
      headerSplit, isCompany,
    };
  });
}

/**
 * Every NOTAM item of a package (HSCN, Company NOTAMs and NOTAM Briefing documents).
 * kind: 'HSCN' | 'COMPANY' | 'NOTAM'. Weather and VA documents have no item headers.
 */
function packageItems(itemsJson, opts = {}) {
  const docs = documents(itemsJson.pages);
  const out = [];
  docs.forEach((doc, di) => {
    const its = segment(doc, opts);
    if (!its.length) return;
    const hscn = its.length === 1 && doc.N === 1;
    for (const it of its) out.push({ ...it, doc: di, kind: hscn ? 'HSCN' : it.isCompany ? 'COMPANY' : 'NOTAM' });
  });
  return out;
}

function loadItems(fixturesDir, id) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, 'items', id + '.items.json'), 'utf8'));
}

module.exports = { pageLines, documents, readingOrder, segment, packageItems, loadItems, isFurniture, CATEGORIES, HDR };
