#!/usr/bin/env node
// Replaces crew names (jump seat included), dispatcher names and initials, and
// employee numbers in extracted OFP text (.raw.txt) and positional items
// (.items.json) with stable fake values.
//
//   * Stable: the fake value is a pure function of the original token and a
//     fixed salt (SHA-256). Same input -> same output, in any run, on any file.
//   * Raw and items are redacted by the same line rules, so they stay in step.
//   * Not redacted: ordinary text that happens to look like a name (airports,
//     NOTAM text, month names...). Names are found by the line patterns in
//     ruleMatches(); their words then form the name lexicon (below).
//   * Name lexicon: every first/last name word printed on a crew, jump-seat or
//     dispatcher line of ANY package given (inputs plus --lexicon-from) is also
//     replaced in free text, as a whole word, in any letter case. The lexicon
//     is built in memory on every run and never written anywhere.
//     A lexicon word that is also an ordinary word (see AMBIGUOUS RULES at
//     buildLexicon) is replaced only where it stands in a name position.
//
// Usage:
//   node tools/redact/redact.js --out <dir> [--show-map] [--lexicon-from <file|dir>]...
//        <file.raw.txt|file.items.json> ...
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
// Initials keep their length: "ABC" -> three stable fake letters.
function fakeInitials(s) {
  const d = digest('initials', s.toUpperCase());
  let out = '';
  for (let i = 0; i < s.length; i++) out += String.fromCharCode(65 + (d[i] % 26));
  return out;
}

// ── line rules ────────────────────────────────────────────────────────────
// Returns { found: [{kind, orig}] } entries for registry building, and spans.
// Employee numbers are 3 to 7 digits (Navtech prints some 3- and 4-digit ones).
const ROSTER = /^(\s*(?:CA|FO|FA|PU|LM|MX|DH|RO|IRO|SO)\s+(?:\*\s*)?)(\d{3,7})(\s+)(.+?)(?=\s+\.\.|\s*$)/;
const DH_NONUM = /^(\s*DH\s+)([A-Za-z][A-Za-z’'\-. ]*?)(\s+(?:FA|FO|CPT|PR|CA)\s*)$/;
// LM / MX / PU printed with a name and no employee number: the whole line is the name.
const CREW_NONUM = /^(\s*(?:LM|MX|PU)\s+)([A-Z][A-Z’'\-.]*(?:,?\s+[A-Z(][A-Z’'\-.()]*){1,4})\s*$/;
// Jump seat: "JS <name> .. .." (Navtech/eOFP) or "JS <seat digit> <name>" (FlightKeys).
// The seat digit is not an employee number and stays. "JS VERIFY" is a heading.
const JUMPSEAT = /^(\s*JS\s+(?:\d\s+)?)(?!VERIFY\b)([A-Za-z][A-Za-z’'\-.,() ]*?)(?=\s+\.\.|\s*$)/;
const DISPATCHER = /^(\s*Signed by Dispatcher:\s*)([A-Za-z][A-Za-z’'\-.() ]*?)\s*$/;
// FlightKeys first Remarks line: "<dispatcher name> DESK: nn PHONE: ...". The
// prototypes have no "Signed by Dispatcher:" line that repeats the name.
const DISPATCH_DESK = /^(\s*)([A-Za-z][A-Za-z’'\-.]*(?:\s+[A-Za-z][A-Za-z’'\-.]*)+?)(?=\s+DESK:)/;
// Dispatcher initials in a free-text remark: "... ABC/1234Z ...".
const INITIALS = /(?<![A-Za-z0-9/])([A-Z]{2,3})(?=\/\d{4}Z(?![A-Za-z0-9]))/g;

function ruleMatches(line) {
  const out = []; // { kind, start, end, orig }
  let m;
  if ((m = ROSTER.exec(line))) {
    const numStart = m[1].length;
    out.push({ kind: 'empno', start: numStart, end: numStart + m[2].length, orig: m[2] });
    const nameStart = numStart + m[2].length + m[3].length;
    out.push({ kind: 'crew', start: nameStart, end: nameStart + m[4].length, orig: m[4] });
  } else if ((m = DH_NONUM.exec(line)) || (m = CREW_NONUM.exec(line))) {
    out.push({ kind: 'crew', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  } else if ((m = JUMPSEAT.exec(line))) {
    out.push({ kind: 'jumpseat', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  } else if ((m = DISPATCHER.exec(line)) && !/NOT RELEASED/i.test(m[2])) {
    out.push({ kind: 'dispatcher', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  } else if ((m = DISPATCH_DESK.exec(line))) {
    out.push({ kind: 'dispatcher', start: m[1].length, end: m[1].length + m[2].length, orig: m[2] });
  }
  INITIALS.lastIndex = 0;
  while ((m = INITIALS.exec(line))) {
    if (out.some(f => m.index < f.end && m.index + m[1].length > f.start)) continue;
    out.push({ kind: 'initials', start: m.index, end: m.index + m[1].length, orig: m[1] });
  }
  return out;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── name lexicon ──────────────────────────────────────────────────────────
// Words that are ordinary English, aviation or OFP words and also occur as
// first or last names. A lexicon word in this list is AMBIGUOUS (see below).
// Generic list of common words: it does not say which of them is a name in any
// package.
const ORDINARY_WORDS = new Set(`
  JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER
  MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY DAY DAYS NIGHT MORNING NOON DAWN DUSK
  SPRING SUMMER AUTUMN FALL WINTER NORTH SOUTH EAST WEST NORTHERN SOUTHERN EASTERN WESTERN
  ALFA ALPHA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIET JULIETT KILO LIMA MIKE
  OSCAR PAPA QUEBEC ROMEO SIERRA TANGO UNIFORM VICTOR WHISKEY WHISKY XRAY YANKEE ZULU
  WHITE BLACK BROWN GREEN GREY GRAY RED BLUE GOLD SILVER AMBER ROSE
  WILL MARK GRANT CASE COST BELL BALL WALL POOL POLE MAST POST POSE CROSS BEST BOLD BRIGHT
  SHARP SHORT LONG LARGE LITTLE SMALL WIDE HIGH LOW MAJOR GUARD PAGE WARD MARSHALL
  WOOD HILL FIELD LAKE RIVER STONE ROCK BROOK MARSH FORD BANK CLIFF DALE GLEN HEATH LANE ROW
  STREET WELL SPRINGS SNOW FROST STORM RAIN STAR SKY SUN MOON ASH OAK PINE BUSH REED CRANE
  BIRD CAPE PARK PORT FORT HAVEN MILES MILE TRUE GOOD MAN WAY KEY TOWER TOWERS LIGHT LIGHTS
  FLAG SEA BAY BEACH ISLAND HARBOR HARBOUR VALLEY RIDGE MOUNT MOUNTAIN CANYON CREEK CAMP
  GATE BRIDGE CHURCH CASTLE MILL MILLS BARN HOUSE NEW OLD GREAT BIG FAIR
  DA DH MDA RA TA FA CA FO SO PU LM MX DO GO NO ON OR AT AS AN IN IS IT TO UP US WE
`.trim().split(/\s+/));
// A person cue right before a word puts that word in a name position. Titles
// may carry a dot ("MR."); role codes must be followed by a space only.
const TITLE_CUE = /(?:^|[^A-Za-z0-9])(?:CAPT|CAPTAIN|CPT|MR|MRS|MS|DR|DISPATCHER|DSP|ATTN|HELLO|DEAR)\.?\s+$/i;
const ROLE_CUE = /(?:^|\s)(?:CA|FO|FA)\s+$/;
// A remark line that is only a sign-off and a name: "THANKS <x>", "FROM <x> :P".
const SIGNOFF_LINE = /^\s*(?:THANKS|THANK YOU|THX|TY|FROM|REGARDS|BEST REGARDS|CHEERS|SIGNED)[\s,.:-]+$/i;
const LINE_END = /^[\s.,!?;)\-'"]*(?:[:;]-?[A-Za-z()]{1,2}[\s.!]*)?$/;
// Place cues: a word in a place name (airport, navaid, FIR, area, taxiway).
const PLACE_PREFIX = /^(?:FORT|FT|SAN|SANTA|SAINT|ST|STE|LAKE|CAPE|MOUNT|MT|PORT|PUERTO|GENERAL|GEN|TAXIWAY|TWY|RWY|RAMP|APRON|STAND|GATE)$/i;
// An ATS route designator (N147, UL975, J521) is followed by a waypoint or navaid.
const AIRWAY = /^[A-Z]{1,3}\d{1,4}$/;
const PLACE_SUFFIX = /^(?:INTL\w*|INT|INTERNATIONAL|FLD|FIELD|ARPT|AIRPORT|COUNTY|MUNI|MUNICIPAL|RGNL|REGIONAL|AFB|NAS|OCEANIC|FIR|UIR|CTA|TMA|CORRIDOR|PASS|LN|VOR|VORTAC|VORDME|NDB|DME|TACAN|\d{3}\.\d{1,3}|\d{3,4}KHZ|\d{3}\.\d{1,3}MHZ)$/i;
const MIN_PACKAGES_ORDINARY = 2;

function words(s) { return s.match(/[A-Za-z0-9]+(?:\.\d+[A-Za-z]*)?/g) || []; }
function caseLike(fake, orig) {
  if (orig === orig.toUpperCase()) return fake;
  if (orig === orig.toLowerCase()) return fake.toLowerCase();
  return fake[0] + fake.slice(1).toLowerCase();
}
function lexWordsOf(name) {
  return (name.match(/[A-Za-z]+/g) || []).map(w => w.toUpperCase()).filter(w => w.length >= 2 && !KEEP.has(w));
}

// Context of one occurrence [start,end) of a lexicon word in a line.
function contextOf(line, start, end) {
  const pre = line.slice(0, start), post = line.slice(end);
  return { pre, post, before: words(pre), after: words(post) };
}

// NAME POSITION — true when the word stands where a person's name stands:
//   P1 next to another word of the SAME person's name (first + last, either
//      order; one initial or a comma may sit between);
//   P2 right after a title (CAPT, MR., DISPATCHER, DEAR ...) or a role code
//      (CA, FO, FA) separated by spaces only;
//   P3 the line is only a sign-off cue, the word and punctuation or an
//      emoticon: "THANKS <x>", "FROM <x> :P";
//   P4 exact case: a separate word written in the same mixed case the roster
//      prints it in ("Grant") inside an otherwise upper-case line. FlightKeys
//      prints names in mixed case; OFP and NOTAM free text is upper case. Dates
//      such as 2026-May-27 are not separate words.
function isNamePosition(lex, word, orig, line, start, end) {
  const { pre, post, before, after } = contextOf(line, start, end);
  const persons = lex.persons.get(word) || new Set();
  const samePerson = w => {
    const p = w && lex.persons.get(w.toUpperCase());
    return !!p && [...p].some(id => persons.has(id));
  };
  const near = (list, dir) => {
    const seq = dir < 0 ? list.slice().reverse() : list;
    const [a, b] = seq;
    if (samePerson(a)) return true;
    return !!a && /^[A-Za-z]$/.test(a) && samePerson(b);
  };
  if (near(before, -1) || near(after, 1)) return true;                              // P1
  if (TITLE_CUE.test(pre) || ROLE_CUE.test(pre)) return true;                        // P2
  if (SIGNOFF_LINE.test(pre) && LINE_END.test(post)) return true;                    // P3
  if (orig !== orig.toUpperCase() && lex.forms.has(orig)                          // P4
      && /(?:^|\s)$/.test(pre) && /^(?:$|[\s.,!?:;])/.test(post)
      && !/[a-z]/.test(pre + post)) return true;
  return false;
}

// PLACE POSITION — the word is part of a place name: right after "<text>/"
// (CITY/NAME, ICAO/IATA), right after a place prefix (FORT, SAN, LAKE,
// TAXIWAY ...) or an airway (a waypoint), within 3 words before a place suffix
// (INTL, FLD, COUNTY, FIR, PASS, LN, a radio frequency ...), or a 3-letter
// code opening an airport header ("XXX - CITY").
function isPlacePosition(word, line, start, end) {
  const { pre, post, before, after } = contextOf(line, start, end);
  if (/[A-Za-z0-9]\/$/.test(pre)) return true;
  const prev = before[before.length - 1];
  if (prev && (PLACE_PREFIX.test(prev) || AIRWAY.test(prev))) return true;
  if (after.slice(0, 3).some(t => PLACE_SUFFIX.test(t))) return true;
  if (word.length === 3 && !/\S/.test(pre) && /^\s+-\s/.test(post)) return true;
  return false;
}

// Build the lexicon from packages [{ name, lines }]. Returns
//   { words: Set, persons: Map(word -> Set(personId)), forms: Set(mixed-case
//     forms as printed), ambiguous: Set, re: RegExp }.
// AMBIGUOUS RULES — a lexicon word is ambiguous (replaced only in a name
// position) when ANY of:
//   A1 it is in ORDINARY_WORDS (generic ordinary/aviation words);
//   A2 some package uses it in a place position (and not a name position);
//   A3 it occurs outside name positions in >= MIN_PACKAGES_ORDINARY packages
//      that do not list it as a name (it is part of their ordinary text).
// Every other lexicon word is DISTINCTIVE and is replaced everywhere.
function buildLexicon(packages) {
  const persons = new Map(), forms = new Set(), namePkgs = new Map();
  let pid = 0;
  for (const pkg of packages) {
    for (const line of pkg.lines) {
      for (const r of ruleMatches(line)) {
        if (r.kind === 'empno' || r.kind === 'initials') continue;
        const id = pid++;
        for (const w of lexWordsOf(r.orig)) {
          if (!persons.has(w)) { persons.set(w, new Set()); namePkgs.set(w, new Set()); }
          persons.get(w).add(id);
          namePkgs.get(w).add(pkg.name);
        }
        for (const f of r.orig.match(/[A-Za-z]+/g) || []) if (f !== f.toUpperCase() && f.length >= 2) forms.add(f);
      }
    }
  }
  const lex = { words: new Set(persons.keys()), persons, forms, ambiguous: new Set(), re: null };
  if (!lex.words.size) return lex;
  lex.re = new RegExp(`(?<![A-Za-z0-9])(?:${[...lex.words].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![A-Za-z0-9])`, 'gi');
  const outside = new Map();
  for (const pkg of packages) {
    for (const line of pkg.lines) {
      const spans = ruleMatches(line);
      lex.re.lastIndex = 0;
      let m;
      while ((m = lex.re.exec(line))) {
        const s = m.index, e = s + m[0].length;
        if (spans.some(f => s < f.end && e > f.start)) continue;
        const w = m[0].toUpperCase();
        if (isNamePosition(lex, w, m[0], line, s, e)) continue;
        if (isPlacePosition(w, line, s, e)) lex.ambiguous.add(w);                    // A2
        if (!namePkgs.get(w).has(pkg.name)) {
          if (!outside.has(w)) outside.set(w, new Set());
          outside.get(w).add(pkg.name);
        }
      }
    }
  }
  for (const w of lex.words) {
    if (ORDINARY_WORDS.has(w)) lex.ambiguous.add(w);                                 // A1
    if ((outside.get(w) || new Set()).size >= MIN_PACKAGES_ORDINARY) lex.ambiguous.add(w); // A3
  }
  return lex;
}

// Build the per-file registry from every line, then return a function that
// maps a line to replacement spans [{start,end,text,kind}]. `lex` is the name
// lexicon (built from this file alone when not given).
function makeRedactor(lines, lex) {
  if (!lex) lex = buildLexicon([{ name: '', lines }]);
  const numbers = new Set();
  const names = new Map(); // normalised multi-token name -> kind
  for (const line of lines) {
    for (const r of ruleMatches(line)) {
      // Short numbers (3-4 digits) are replaced on their roster line only; a
      // search elsewhere would rewrite fuel figures, times and NOTAM numbers.
      if (r.kind === 'empno') { if (r.orig.length >= 5) numbers.add(r.orig); }
      else if (r.kind === 'initials') continue;
      // Only distinctive names (two words of 3+ letters) are searched for
      // elsewhere. A short surname plus an initial (e.g. "WELARFORD S",
      // "FARENWOOD O") can also be ordinary words, and searching for it would
      // rewrite ordinary NOTAM text.
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
    // Single name words from the lexicon, anywhere in the line.
    if (lex.re) {
      lex.re.lastIndex = 0;
      let m;
      while ((m = lex.re.exec(line))) {
        const s = m.index, e = s + m[0].length, w = m[0].toUpperCase();
        if (found.some(f => s < f.end && e > f.start)) continue;
        if (lex.ambiguous.has(w) && !isNamePosition(lex, w, m[0], line, s, e)) continue;
        found.push({ start: s, end: e, kind: 'nameword', orig: m[0] });
      }
    }
    found.sort((a, b) => a.start - b.start);
    return found.map(f => ({ ...f, text: f.kind === 'empno' ? fakeNumber(f.orig)
      : f.kind === 'initials' ? fakeInitials(f.orig)
      : f.kind === 'nameword' ? caseLike(fakeWord(f.orig), f.orig) : fakeName(f.orig) }));
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
function redactRaw(text, report, lex) {
  const lines = text.split('\n');
  const spansFor = makeRedactor(lines, lex);
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

// The text lines of an items file, assembled like the app.
function itemLines(json) {
  return json.pages.flatMap(p => assemble(p.items)).map(l => l.str);
}

function redactItems(json, report, lex) {
  const perPage = json.pages.map(p => assemble(p.items));
  const spansFor = makeRedactor(perPage.flat().map(l => l.str), lex);
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
  const files = [], lexFrom = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = args[++i];
    else if (args[i] === '--show-map') showMap = true;
    else if (args[i] === '--lexicon-from') lexFrom.push(args[++i]);
    else files.push(args[i]);
  }
  if (!outDir || !files.length) {
    console.error('usage: redact.js --out <dir> [--show-map] [--lexicon-from <file|dir>]... <file.raw.txt|file.items.json> ...');
    process.exit(2);
  }
  const isPkgFile = f => /\.(raw\.txt|items\.json)$/.test(f);
  const expand = p => fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).filter(isPkgFile).map(f => path.join(p, f)) : [p];
  // The lexicon: names from every input and every --lexicon-from package,
  // kept in memory only.
  const docs = [];
  for (const f of new Set([...files, ...lexFrom.flatMap(expand)].filter(isPkgFile).map(f => path.resolve(f)))) {
    const text = fs.readFileSync(f, 'utf8');
    const name = path.basename(f).replace(/\.(raw\.txt|items\.json)$/, '');
    docs.push({ name, lines: /\.items\.json$/.test(f) ? itemLines(JSON.parse(text)) : text.split('\n') });
  }
  const lex = buildLexicon(docs);
  console.log(`Name lexicon: ${lex.words.size} words from ${new Set(docs.map(d => d.name)).size} packages (${lex.ambiguous.size} ambiguous: name positions only). Not stored.`);
  fs.mkdirSync(outDir, { recursive: true });
  const total = new Report();
  for (const f of files) {
    const rep = new Report();
    let out;
    if (/\.items\.json$/.test(f)) out = JSON.stringify(redactItems(JSON.parse(fs.readFileSync(f, 'utf8')), rep, lex));
    else if (/\.raw\.txt$/.test(f)) out = redactRaw(fs.readFileSync(f, 'utf8'), rep, lex);
    else { console.error(`skip (unknown type): ${f}`); continue; }
    fs.writeFileSync(path.join(outDir, path.basename(f)), out);
    const c = rep.counts;
    console.log(`${path.basename(f)}: ${c.empno || 0} employee numbers, ${c.crew || 0} crew names, ${c.jumpseat || 0} jump-seat names, ${c.dispatcher || 0} dispatcher names, ${c.initials || 0} initials, ${c.nameword || 0} name words in free text replaced`);
    rep.map.forEach((v, k) => total.map.set(k, v));
  }
  const u = total.unique();
  console.log(`\nDistinct values replaced: ${u.empno || 0} employee numbers, ${u.crew || 0} crew names, ${u.jumpseat || 0} jump-seat names, ${u.dispatcher || 0} dispatcher names, ${u.initials || 0} initials, ${u.nameword || 0} name words`);
  if (showMap) {
    console.log('\nPERSONAL DATA BELOW (original -> fake)');
    total.map.forEach((v, k) => console.log(`${k.replace('\t', ' ')} -> ${v}`));
  }
}

module.exports = { redactRaw, redactItems, itemLines, buildLexicon, Report, fakeName, fakeNumber, fakeInitials, ruleMatches, ORDINARY_WORDS };
if (require.main === module) main();
