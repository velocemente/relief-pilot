#!/usr/bin/env node
// Change list for NOTAM ruleset v1.14.0 (ledger P-26, Exec decision D67): every NOTAM of the
// corpus whose result changes between v1.13.0 and v1.14.0, and every obstacle NOTAM the new
// rule cannot clearly decide.
//
//   node test/corpus/notam-obstacle-changes.js (--fk-raw <fk-notams-raw.json> | --fk-parser <ofp-flightkeys.js>)
//        [--fixtures <dir>]
//        [--before <module.js>] [--after <module.js>] [--json <file.json>] [--report <file.md>]
//
//   --before     defaults to v1.13.0, frozen as test/oracle/notam-rules-v1.13.0.js (built into the app until step 5e-1)
//   --after      defaults to the 'notam-rules' module (v1.14.0, built in since step 5e-1)
//   --fk-parser  a FlightKeys parser that gives airportData[icao].notamsRaw (ofp-flightkeys v0.3.0 or
//                later; merged in velocemente/relief-pilot#63)
//   --fk-raw     or the parser's output as exported by test/corpus/fk-notams-raw-export.js (fixtures
//                expected/notam-rules-v1.14.0/fk-notams-raw.json; the CI tests read the same file)
//
// Corpus:
//   NavBlue/eOFP  every NOTAM of the whole OFP text of every fixture (the split TC-171-030 uses),
//                 each evaluated alone with no window (etaMin null: in effect) and at the TC-171-030
//                 sweep (ORIG and DEST; 9 ETAs; departure unknown / 0000Z / 1140Z; with and without
//                 the flight date).
//   FlightKeys    every airport of every package: notamsRaw (the NOTAM section as printed, type
//                 headings included). v1.14.0 reads notamsRaw itself (headings → category);
//                 v1.13.0 reads the same items with no heading (the parser's notams text), because
//                 a heading inside v1.13.0 text would join the item above it (O-12). Each item alone,
//                 with no window and at each of its airport's windows (briefing roles, midpoint).
// Groups:
//   B  shown → hidden   (v1.13.0 shows it with no window, v1.14.0 hides it)
//   C  hidden → shown   (decided by an effect or other-content pattern)
//   U  undecided        (v1.14.0 shows it: OBSTACLE_RULE.undecided / height near a runway or procedure)
// Every other NOTAM must give identical evalNotams() results in both versions at every evaluation
// (fkCategory, new in v1.14.0, left out of the comparison); any other difference is a STOP: listed,
// exit 1.
// Output names packages, ICAO codes, NOTAM IDs and NOTAM text (public); never crew data. The report
// is passed through tools/redact before it is committed.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');
const { nodeAircraftProfile } = require('../lib/acft');

const AP = nodeAircraftProfile();
const ROOT = path.resolve(__dirname, '..', '..');
const RULES = path.join(ROOT, 'rules');
const MAN = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));

// The sweep of TC-171-030 (the evaluation sweep used for v1.13.0).
const SWEEP = { roles: ['ORIG', 'DEST'], etas: [0, 59, 300, 600, 719, 720, 1000, 1380, 1439], deps: [null, 0, 700] };

function parseArgs(argv) {
  const o = { before: null, after: null, fixtures: null, fkParser: null, fkRaw: null, json: null, report: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--before') o.before = argv[++i];
    else if (k === '--after') o.after = argv[++i];
    else if (k === '--fixtures') o.fixtures = argv[++i];
    else if (k === '--fk-parser') o.fkParser = argv[++i];
    else if (k === '--fk-raw') o.fkRaw = argv[++i];
    else if (k === '--json') o.json = argv[++i];
    else if (k === '--report') o.report = argv[++i];
    else if (k === '--data') o.data = argv[++i];
    else if (k === '--beta') o.beta = argv[++i];
    else { console.error(`unknown argument: ${k}`); process.exit(2); }
  }
  o.before = o.before || path.join(ROOT, 'test', 'oracle', 'notam-rules-v1.13.0.js');   // v1.13.0, frozen (O-79)
  o.after = o.after || path.join(RULES, MAN['notam-rules'].file);
  if (!o.fkParser && !o.fkRaw) { console.error('--fk-raw <fk-notams-raw.json> or --fk-parser <ofp-flightkeys.js with notamsRaw> is required'); process.exit(2); }
  o.fixtures = findFixtures(o.fixtures);
  if (!o.fixtures) { console.error('fixtures directory not found (use --fixtures or PB_FIXTURES)'); process.exit(2); }
  return o;
}

const canon = r => JSON.stringify(r, (k, v) => v instanceof Map ? [...v] : v === Infinity ? '$Inf' : k === 'fkCategory' ? undefined : v);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const shownIn = (r, text) => r.issues.some(i => i.notamRaw === text);

// The v1.13.0 E1 keyword that showed an obstacle NOTAM (for the B list), or null.
const E1_TKOF = /\bTAKEOFF\s+MINIMUMS?\b|\bOBST(?:ACLE)?\s+DEP(?:ARTURE)?\s+PROC|\bODP\b|\bMINIMUM\s+CLIMB\b|\bMIN\s+CLIMB\b|\bCLIMB\s+GRADIENT\b/i;
const E1_APCH = /\b(?:ILS|LOC|GLS|RNAV|RNP|NDB|VOR|LDA|GBAS|GS|G\/S|G\/P|GP|IFR\s+APCH|IAP|APCH|PROC|RWY|SID|STAR|CAT\s+I{1,3})\b/i;
function e1Keyword(ruleText) {
  const m = ruleText.match(E1_TKOF) || ruleText.match(E1_APCH);
  return m ? m[0].replace(/\s+/g, ' ').toUpperCase() : null;
}

// First two body lines (FlightKeys: after the header rows and the SCHEDULE: / SUBJECT: cells;
// NavBlue: the first line without its "- LOC ID dates" part, then the next line).
function bodyLines(mod, text) {
  const h = mod._fkHeader(text);
  let ls;
  if (h) {
    const skip = new Set([...h.headerRows, ...h.scheduleRows, h.subjectRow]);
    ls = text.split('\n').filter((l, k) => !skip.has(k) && l.trim() && !mod._fkTypeHeading(l));
  } else {
    ls = text.split('\n').filter(l => l.trim());
    if (ls.length && /^\s*-\s+[A-Z]{4}\b/.test(ls[0])) {
      const rest = ls[0].replace(/^\s*-\s+(?:[A-Z]{4}\s+)+(?:[A-Z]\d{1,4}\/\d{2}\s+)?(?:\(\S+\)\s+)?(?:\d{2}[A-Z]{3}\d{4}-(?:\d{2}[A-Z]{3}\d{4}|PERM)(?:\s+20\d{2})?(?:\s+EST)?\s*)?/, '');
      ls = rest.trim() ? [rest, ...ls.slice(1)] : ls.slice(1);
    }
  }
  return ls.slice(0, 2).map(l => l.trim().replace(/\s+/g, ' ').slice(0, 110));
}

function idOf(mod, text) {
  const h = mod._fkHeader(text);
  if (h && h.id) return { loc: h.locations.join(' '), id: h.id };
  const m = text.match(/^\s*-\s+((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})(?=\s|$)/);
  if (m) return { loc: m[1].trim().split(/\s+/).join(' '), id: m[2] };
  const l = text.match(/^\s*-\s+([A-Z]{4})\b/);
  return { loc: l ? l[1] : '', id: null };
}

// Notes on a NavBlue piece of the whole-text split: no NOTAM header (the OFP text before the first
// NOTAM), or the piece runs on into the text after the NOTAM (weather, the next section).
function notesOf(p, id) {
  const n = [];
  if (!/^\s*-\s+[A-Z]{4}\b/.test(p)) n.push('NOT A NOTAM: a split piece — the OFP text before the first NOTAM');
  else if (!id.id) n.push('no NOTAM ID');
  if (/\b(?:METAR|TAF|SPECI)\b|NO OPERATIONAL NOTAMS ON FILE/.test(p)) n.push('the piece runs on into the text after the NOTAM (weather / next section)');
  return n;
}

function groupOf(dec, before, after, diff) {
  if (dec.group === 'DEFERRED') return null;          // D67b F-5: decided as v1.13.0 (listed apart)
  if (dec.group === 'UNDECIDED') return 'U';
  if (before && !after) return 'B';
  if (!before && after) return 'C';
  if (before && after && diff) return 'G';   // shown by both; only its card group / label set (D67a O-25, D67b O-29)
  return null;   // (a NOTAM that is not an obstacle NOTAM by its own text can still be C / G: D67b F-3)
}

// The card group an item lands in (the airport card draws rows for these only, E2), or 'no row'.
function cardGroupOf(res, raw) {
  const it = res.issues.find(i => i.notamRaw === raw);
  if (!it) return '—';
  if ((res.sidIssues || []).includes(it)) return 'SIDs';
  if ((res.starIssues || []).includes(it)) return 'STARs';
  for (const [k, g] of res.rwyGroups) if (g.items.includes(it)) return k;
  return `no row (slot ${it.slot}${it.category ? ', ' + it.category : ''})`;
}

// O-28: why v1.13.0's obstacle filter (E1) hid a NOTAM — the obstacle word and where it stands, and
// the word that carries the content v1.14.0 reads (not an E1 keyword).
const NB_TRAIL = /\b(?:METAR|TAF|SPECI)\b|NO OPERATIONAL NOTAMS ON FILE|\bOTHER\b(?=\s+(?:METAR|NO\b))/;
function e1Why(NEW, ruleText, dec) {
  const t = ruleText.toUpperCase().replace(/\s+/g, ' ');
  const w = t.match(NEW.OBSTACLE_RULE.obstacleWord);
  // D67b F-3: an obstacle word that is not in the NOTAM's own text stands in the text after it
  const where = dec.obstacle ? 'in the NOTAM text' : 'only in the text after the NOTAM (weather / another NOTAM): not an obstacle NOTAM';
  // the content: the pattern v1.14.0's rule reads in the NOTAM's own text (read as an obstacle NOTAM when it is none)
  const d = dec.obstacle ? dec : NEW._obstacleRule(ruleText, 'OBSTACLE');
  const n = t.replace(NEW.OBSTACLE_RULE.noEffect, ' ').replace(NEW.OBSTACLE_RULE.obstacleLight, ' ');
  const grp = d.group === 'EFFECT' ? 'effect' : d.group === 'OTHER' ? 'other' : null;
  const m = grp && NEW.OBSTACLE_RULE[grp][d.pattern] ? n.match(NEW.OBSTACLE_RULE[grp][d.pattern]) : null;
  // the word that carries the content: the first word of the match that is not a verb or a joiner;
  // for an area closed (CLSD TO ACFT), the area named before it (RAMP, APRON …)
  const STOP = /^(?:CHANGE|CHANGED|OF|IN|THE|CLSD|CLOSED|TO|ACFT|U\/S|UNUSABLE|AFFECTED|AREA|PATH|CHART,?|SECTOR|LIMIT|ALT|NOT|AVBL|FOR|AND|\d.*)$/;
  let missing = m ? (m[0].split(' ').find(x => !STOP.test(x)) || null) : null;
  if (m && !missing) { const a = n.slice(0, m.index).match(/\b(RAMP|APRON|APN|STANDS?|AREA|PARKING|GATES?)\b(?!.*\b(?:RAMP|APRON|APN|STANDS?|AREA|PARKING|GATES?)\b)/); missing = a ? a[1] : m[0].split(' ')[0]; }
  return { word: w ? w[0] : null, where, content: m ? m[0].slice(0, 60) : (d.pattern || null), missing, pattern: d.pattern };
}

function run(o) {
  const OLD = require(path.resolve(o.before));
  const NEW = require(path.resolve(o.after));
  const fixtures = readManifest(o.fixtures).fixtures;
  const entries = [], stops = [], audit = [], beta = [], deferred = [];
  const e1Hid = text => NEW.OBSTACLE_RULE.obstacleWord.test(text.toUpperCase()) && !NEW.OBSTACLE_RULE.e1Keyword.test(text);   // v1.13.0's E1
  const BETA = o.beta ? require(path.resolve(o.beta)) : null;   // NOTAM v1.11.2: evalNotams(notams, role, eta, acftType, iso, dep)
  const stats = { navblue: { fixtures: 0, notams: 0, calls: 0 }, flightkeys: { packages: 0, airports: 0, items: 0, calls: 0, headings: 0 } };

  // ── NavBlue / eOFP ──
  for (const fx of fixtures.filter(f => f.format !== 'flightkeys')) {
    stats.navblue.fixtures++;
    const text = fs.readFileSync(path.join(o.fixtures, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    const parts = OLD._splitNotams(text);
    const parts14 = NEW._splitNotams(text);
    if (canon(parts) !== canon(parts14)) stops.push(`${fx.id}: NavBlue split differs`);
    const prof = AP.buildAcftProfile(fx.aircraft || '');
    parts.forEach((p, k) => {
      stats.navblue.notams++;
      const ev = (M, role, eta, dep, d) => M.evalNotams([p], role, eta, prof, d, dep, AP.getWingspan);
      const b0 = ev(OLD, 'DEST', null, null, fx.date), a0 = ev(NEW, 'DEST', null, null, fx.date);
      const dec = NEW._obstacleRule(p, null);
      let diff = canon(b0) !== canon(a0) ? 1 : 0, sb = 0, sa = 0, n = 0;
      for (const role of SWEEP.roles) for (const eta of SWEEP.etas) for (const dep of SWEEP.deps) for (const d of [fx.date, null]) {
        const b = ev(OLD, role, eta, dep, d), a = ev(NEW, role, eta, dep, d);
        stats.navblue.calls += 2; n++;
        if (canon(b) !== canon(a)) diff++;
        if (shownIn(b, p)) sb++;
        if (shownIn(a, p)) sa++;
      }
      const g = groupOf(dec, shownIn(b0, p), shownIn(a0, p), diff);
      const id = idOf(NEW, p);
      const ownU = NEW._ownNotamText(p).toUpperCase().replace(/\s+/g, ' ');
      if (dec.group === 'DEFERRED' || (!dec.obstacle && NEW.OBSTACLE_RULE.enRoute.test(ownU) && /\bOBST\w*|\bCRANES?\b/.test(ownU))) {
        deferred.push({ fmt: 'NB', pkg: fx.id, airport: id.loc, id: id.id, key: `NB ${fx.id} #${k}`, body: bodyLines(NEW, p), before: shownIn(b0, p), after: shownIn(a0, p), diff, decision: dec.group || 'not an obstacle NOTAM (word test)' });
        if (diff) stops.push(`${fx.id} #${k}: deferred en-route NOTAM differs from v1.13.0`);
      }
      const o14 = ev(NEW, 'ORIG', null, null, fx.date);
      const cards = shownIn(a0, p) ? { DEST: cardGroupOf(a0, p), ORIG: cardGroupOf(o14, p) } : null;
      const cards13 = shownIn(b0, p) ? { DEST: cardGroupOf(b0, p), ORIG: cardGroupOf(ev(OLD, 'ORIG', null, null, fx.date), p) } : null;
      // O-28 (a): hidden by v1.13.0's obstacle filter although it changes something else or affects a procedure
      if (e1Hid(p) && !shownIn(b0, p) && shownIn(a0, p) && dec.group !== 'UNDECIDED') {
        audit.push({ fmt: 'NB', pkg: fx.id, airport: id.loc, id: id.id, key: `NB ${fx.id} #${k}`, body: bodyLines(NEW, p), why: e1Why(NEW, p, dec),
          group: g, decision: dec.group, pattern: dec.pattern, shown14: shownIn(a0, p), cards, notes: notesOf(p, id), sha: sha(p) });
      }
      // O-28 (c): beta exposure — v1.11.2 (the beta's copy) hides it, v1.14.0 shows it (no window)
      if (BETA && !shownIn(BETA.evalNotams([p], 'DEST', null, fx.aircraft || '', fx.date, null), p) && shownIn(a0, p)) {
        beta.push({ pkg: fx.id, airport: id.loc, id: id.id, key: `NB ${fx.id} #${k}`, body: bodyLines(NEW, p), decision: dec.group, pattern: dec.pattern,
          obstacle: dec.obstacle, why: dec.obstacle && ['EFFECT', 'OTHER'].includes(dec.group) ? e1Why(NEW, p, dec) : null, group: g, cards, notes: notesOf(p, id) });
      }
      if (g === null && diff) stops.push(`${fx.id} #${k}: result differs (${diff} evaluations) but the NOTAM is not in the change list`);
      if ((g === 'B' || g === 'C') && !diff) stops.push(`${fx.id} #${k}: listed ${g} but no result differs`);
      if (g) {
        entries.push({ fmt: 'NB', pkg: fx.id, airport: id.loc, id: id.id, category: null, key: `NB ${fx.id} #${k}`,
          group: g, decision: dec.group, pattern: dec.pattern, noEffectStated: dec.noEffectStated, e1: e1Keyword(p),
          before: { noWindow: shownIn(b0, p), sweep: `${sb}/${n}` }, after: { noWindow: shownIn(a0, p), sweep: `${sa}/${n}` },
          header: !!id.id, notes: notesOf(p, id), body: bodyLines(NEW, p), cards, cards13, sha: sha(p) });
      }
    });
  }

  // ── FlightKeys ──
  const raw = o.fkRaw ? JSON.parse(fs.readFileSync(o.fkRaw, 'utf8'))
    : require('./fk-notams-raw-export').exportAll({ fkParser: o.fkParser, fixtures: o.fixtures });
  for (const fx of fixtures.filter(f => f.format === 'flightkeys')) {
    stats.flightkeys.packages++;
    const pk = raw.packages[fx.id];
    if (!pk) { stops.push(`${fx.id}: not in the FlightKeys parser output`); continue; }
    const dep = pk.depMin;
    const prof = AP.buildAcftProfile(pk.acftType || fx.aircraft || '');
    for (const [icao, a] of Object.entries(pk.airports)) {
      if (typeof a.notamsRaw !== 'string') { stops.push(`${fx.id}: the FlightKeys parser gives no notamsRaw (needs v0.3.0 or later)`); continue; }
      if (!a.notamsRaw.trim()) continue;
      stats.flightkeys.airports++;
      const pieces = NEW._splitNotams(a.notamsRaw);
      const old = a.notams ? OLD._splitNotams(a.notams) : [];
      const oldByKey = new Map();
      for (const q of old) { const h = OLD._fkHeader(q); if (h) oldByKey.set(`${h.locations.join(' ')} ${h.id}#${q.replace(/\s+$/, '')}`, q); }
      const ws = a.windows;
      let cat = null;
      for (const p of pieces) {
        if (NEW.FK_TYPE_HEADINGS.includes(p.trim()) && NEW._fkTypeHeading(p.replace(/\n+$/, ''))) { cat = p.trim(); stats.flightkeys.headings++; continue; }
        const h = NEW._fkHeader(p);
        if (!h) continue;                     // text before the first item (empty-state box): no item
        stats.flightkeys.items++;
        const q = oldByKey.get(`${h.locations.join(' ')} ${h.id}#${p.replace(/\s+$/, '')}`);
        if (q === undefined) { stops.push(`${fx.id} ${icao} ${h.id}: item not found in the v1.13.0 (no heading) text`); continue; }
        const hd = cat ? ' '.repeat(36) + cat + '\n' : null;
        const evB = (role, eta, d) => OLD.evalNotams([q], role, eta, prof, d, dep, AP.getWingspan);
        const evA = (role, eta, d) => NEW.evalNotams(hd ? [hd, p] : [p], role, eta, prof, d, dep, AP.getWingspan);
        const b0 = evB('DEST', null, fx.date), a0 = evA('DEST', null, fx.date);
        const dec = NEW._obstacleRule(p.split('\n').filter((_, k) => !h.headerRows.includes(k)).join('\n'), cat);
        // compare: notamRaw of the two texts may differ only in a trailing newline; compare with it unified
        const norm = (res, raw) => canon(res).split(JSON.stringify(raw).slice(1, -1)).join('<RAW>');
        let diff = norm(b0, q) !== norm(a0, p) ? 1 : 0;
        const atWin = [];
        for (const w of ws) {
          const b = evB(w.role, w.eta, fx.date), aa = evA(w.role, w.eta, fx.date);
          stats.flightkeys.calls += 2;
          if (norm(b, q) !== norm(aa, p)) diff++;
          atWin.push(`${w.name}:${shownIn(b, q) ? 'S' : 'H'}→${shownIn(aa, p) ? 'S' : 'H'}`);
        }
        stats.flightkeys.calls += 2;
        const g = groupOf(dec, shownIn(b0, q), shownIn(a0, p), diff);
        if (dec.group === 'DEFERRED') {
          deferred.push({ fmt: 'FK', pkg: fx.id, airport: icao, id: h.id, key: `FK ${fx.id} ${h.locations.join(' ')} ${h.id} ${cat || '-'}`, body: bodyLines(NEW, p), before: shownIn(b0, q), after: shownIn(a0, p), diff, decision: dec.group });
          if (diff) stops.push(`${fx.id} ${icao} ${h.id}: deferred en-route NOTAM differs from v1.13.0`);
        }
        const rt = p.split('\n').filter((_, k) => !h.headerRows.includes(k)).join('\n');
        const cards = shownIn(a0, p) ? { DEST: cardGroupOf(a0, p), ORIG: cardGroupOf(NEW.evalNotams(hd ? [hd, p] : [p], 'ORIG', null, prof, fx.date, dep, AP.getWingspan), p) } : null;
        const cards13 = shownIn(b0, q) ? { DEST: cardGroupOf(b0, q), ORIG: cardGroupOf(OLD.evalNotams([q], 'ORIG', null, prof, fx.date, dep, AP.getWingspan), q) } : null;
        if (e1Hid(rt) && !shownIn(b0, q) && shownIn(a0, p) && dec.group !== 'UNDECIDED') {
          audit.push({ fmt: 'FK', pkg: fx.id, airport: icao, id: h.id, key: `FK ${fx.id} ${h.locations.join(' ')} ${h.id} ${cat || '-'}`, category: cat,
            body: bodyLines(NEW, p), why: e1Why(NEW, rt, dec), group: g, decision: dec.group, pattern: dec.pattern, shown14: shownIn(a0, p), cards, notes: [], sha: sha(p.replace(/\s+$/, '')) });
        }
        if (g === null && diff) stops.push(`${fx.id} ${icao} ${h.id}: result differs (${diff}) but the item is not in the change list`);
        if ((g === 'B' || g === 'C') && !diff) stops.push(`${fx.id} ${icao} ${h.id}: listed ${g} but no result differs`);
        if (g) entries.push({ fmt: 'FK', pkg: fx.id, airport: icao, id: h.id, category: cat, key: `FK ${fx.id} ${h.locations.join(' ')} ${h.id} ${cat || '-'}`,
          group: g, decision: dec.group, pattern: dec.pattern, noEffectStated: dec.noEffectStated, e1: e1Keyword(p.split('\n').filter((_, k) => !h.headerRows.includes(k)).join('\n')),
          byHeadingOnly: dec.byHeading && !dec.byText,
          before: { noWindow: shownIn(b0, q) }, after: { noWindow: shownIn(a0, p) }, windows: atWin,
          header: true, body: bodyLines(NEW, p), cards, cards13, sha: sha(p.replace(/\s+$/, '')) });
      }
    }
  }
  return { entries, audit, beta, deferred, betaFile: o.beta ? path.basename(o.beta) : null, betaSha: o.beta ? sha(fs.readFileSync(o.beta)) : null, stops, stats, before: path.relative(ROOT, path.resolve(o.before)), after: path.relative(ROOT, path.resolve(o.after)),
    sha: { before: sha(fs.readFileSync(o.before)), after: sha(fs.readFileSync(o.after)), fkParser: raw.parser.sha256 }, fkParserFile: raw.parser.file };
}

// The change list as test data for this (public) repository: keys, IDs, groups and patterns, the
// SHA-256 of each NOTAM text; no NOTAM text.
function slim(res) {
  const cnt = g => res.entries.filter(e => e.group === g).length;
  return {
    version: '1.2',
    _about: 'NOTAM ruleset v1.14.0 obstacle-rule change list (D67): docs/RPT-NOTAM-ObstacleRule-ChangeList-UPD-20261119-v1.2.md (D67a, D67b), made by test/corpus/notam-obstacle-changes.js. Keys: NB <fixture> #<piece index of the whole-text split>; FK <package> <locations> <ID> <category>. sha = SHA-256 of the NOTAM text (FlightKeys: trailing white space removed). No NOTAM text, no crew data.',
    before: { file: res.before, sha256: res.sha.before }, after: { file: res.after, sha256: res.sha.after }, fkParser: res.sha.fkParser,
    counts: { B: cnt('B'), C: cnt('C'), U: cnt('U'), G: cnt('G'), deferred: res.deferred.length }, stats: res.stats,
    deferred: res.deferred.map(e => ({ key: e.key, fmt: e.fmt, pkg: e.pkg, airport: e.airport, id: e.id, before: e.before, after: e.after })),
    audit: res.audit.map(e => ({ key: e.key, fmt: e.fmt, pkg: e.pkg, airport: e.airport, id: e.id, group: e.group, pattern: e.pattern, shown: e.shown14, cards: e.cards, sha: e.sha })),
    beta: res.beta ? { file: res.betaFile, sha256: res.betaSha, entries: res.beta.map(e => ({ key: e.key, pkg: e.pkg, airport: e.airport, id: e.id, pattern: e.pattern })) } : null,
    entries: res.entries.map(e => ({ key: e.key, fmt: e.fmt, pkg: e.pkg, airport: e.airport, id: e.id, category: e.category, group: e.group,
      pattern: e.pattern, byHeadingOnly: !!e.byHeadingOnly, before: e.before.noWindow, after: e.after.noWindow, cards: e.cards || null, sha: e.sha })),
  };
}

module.exports = { run, slim, SWEEP };

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  const res = run(o);
  const count = g => res.entries.filter(e => e.group === g).length;
  console.log(JSON.stringify(res.stats));
  console.log(`B ${count('B')}  C ${count('C')}  U ${count('U')}  G ${count('G')}  deferred ${res.deferred.length}  (U newly shown: ${res.entries.filter(e => e.group === 'U' && !e.before.noWindow).length})  O-28 audit ${res.audit.length}  beta exposure ${res.beta.length}`);
  for (const s of res.stops) console.log(`STOP ${s}`);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(res, null, 1) + '\n');
  if (o.data) fs.writeFileSync(o.data, JSON.stringify(slim(res), null, 1) + '\n');
  if (o.report) fs.writeFileSync(o.report, require('./notam-obstacle-report').report(res));
  process.exit(res.stops.length ? 1 : 0);
}
