'use strict';
/**
 * TC-186 — DEF-017 (Exec rulings R1–R5): the Company Remarks subsection of an airport card.
 * Each rule has a positive and a negative check. The synthetic input is invented; the fixture tests assert counts,
 * ICAOs and classes only, never fixture text.
 *
 *   TC-186-010  R1  the subsection status is blue (ball and label, the app's --tint); collapsed by default; NEGATIVE: no
 *                   yellow header
 *   TC-186-020  R2  a Company NOTAM "SUBJECT: <ICAO>-ETOPS" whose body starts with "ETOPS ALTERNATE INFORMATION" or
 *                   "ETOPS AIRPORT INFORMATION" shows one line, "Suitable Airport - Refer to Company NOTAMS", blue ball,
 *                   none of its own lines, with or without the closing CHECK OPSPEC line; NEGATIVE: another heading,
 *                   another subject, another airport's subject, the words in the middle of an item
 *   TC-186-030  R3  every other remark has a blue ball; a "- " comment keeps its "-" and has no ball (opsNotes lines and
 *                   remark rows); a "- " line absorbs the plain lines that continue it, up to the next "- ", SUBJECT:,
 *                   bar or numbered line; NEGATIVE: plain lines are never joined, no yellow ball, escaped
 *   TC-186-040  R5  an approach restriction / authorization, or a runway restriction / authorization (take-off, landing,
 *                   arrival, departure use of a runway), keeps today's markup (yellow ball, its text, not joined);
 *                   NEGATIVE: the words MINIMUM, VOR are not approach words; a runway named without a restriction,
 *                   a restriction naming no runway, stay blue
 *   TC-186-050  all 56 fixtures: every screen except the Company Remarks subsection is as main (hashes in
 *                   data/*-screens.json); ETOPS items, R5 rows, headers counted by airport
 *
 * All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const vm     = require('vm');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture } = require('../lib/app-path');
const crypto = require('crypto');

const J = JSON.stringify;
const run = (app, expr) => vm.runInContext(expr, app.sandbox);
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const LINE = 'Suitable Airport - Refer to Company NOTAMS';

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys');
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const sha16 = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

// A card with the given opsNotes body, remark rows and CAT II/III rows (synthetic).
function card(body, remarks, cat) {
  const app = loadApp();
  run(app, `airportData.XXXX = { notams: '', weather: '', opsNotes: ${body == null ? 'null' : J({ header: 'XXXX COMPANY NOTAMS', body })}, remarks: ${J(remarks || [])} }`);
  run(app, `S.catIiIiiRestrictions = ${J(cat || [])}`);
  return run(app, `renderAptOpsNotes('XXXX')`);
}
// [{ dot, text }] of the body rows: dot is the ball class ('' for none), text with line breaks as \n.
function rows(h) {
  const body = h.split('<div class="notam-group-body" hidden>')[1] || '';
  return [...body.matchAll(/<div class="notam-item-hdr">([\s\S]*?)<\/div>/g)].map(m => ({
    dot: (m[1].match(/notam-dot (\w)"/) || [, ''])[1],
    text: unesc(m[1].match(/<span class="notam-item-label">([\s\S]*?)<\/span>/)[1].replace(/<br>/g, '\n')),
  }));
}
// main's markup of one Company Remarks row (yellow ball), byte for byte.
const MAIN_ROW = html => `
      <div class="notam-item">
        <div class="notam-item-hdr">
          <span class="notam-dot y"></span>
          <span class="notam-item-label">${html}</span>
        </div>
      </div>`;

const ETOPS = (apt, heading, last) => ['SUBJECT: ' + apt + '-ETOPS', heading, 'XXX / ' + apt + ' - SYNTHETIC FIELD', '- AIRPORT HRS: H24', '- TOWER PH: 000-000', ...(last === false ? [] : ['- CHECK OPSPEC B342 FOR AUTHORIZATION'])];

// ══ TC-186-010 R1 ══════════════════════════════════════════════════════════════════
test('TC-186-010 R1: the Company Remarks status is blue (ball and label) and the subsection is collapsed by default', () => {
  const h = card('SUBJECT: SYNTHETIC ITEM\nSYNTHETIC LINE');
  assert.match(h, /<span class="notam-dot b"><\/span>\s*<span class="notam-group-label"\s+style="color:var\(--tint\)">/);
  assert.ok(h.includes('<div class="notam-group-body" hidden>'), 'collapsed by default');
  assert.ok(!/notam-dot y|--sys-yellow/.test(h.split('<div class="notam-group-body"')[0]), 'NEGATIVE: the header is not yellow');
  // the blue is the app's existing --tint, one new class names it
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'styles.html'), 'utf8');
  assert.match(css, /\.notam-dot\.b \{ background: var\(--tint\); \}/);
});

// ══ TC-186-020 R2 ══════════════════════════════════════════════════════════════════
test('TC-186-020 R2: a qualifying ETOPS Company NOTAM shows only the Suitable Airport line, blue, one line', () => {
  for (const heading of ['ETOPS ALTERNATE INFORMATION', 'ETOPS AIRPORT INFORMATION']) {
    for (const last of [true, false]) {   // the CHECK OPSPEC line is not required (Exec R2 amended)
      const h = card(ETOPS('XXXX', heading, last).join('\n'));
      assert.deepEqual(rows(h), [{ dot: 'b', text: LINE }], `${heading}, closing line ${last}`);
      assert.ok(!/AIRPORT HRS|TOWER PH|CHECK OPSPEC|SYNTHETIC FIELD|ETOPS/.test(h), 'none of the NOTAM\'s own lines');
    }
  }
  // its place: the other items of the airport keep order, R3 (blue); the ETOPS item is one line where it stood
  const mixed = card(['SUBJECT: XXXX-RWYS', 'SYNTHETIC RUNWAY NOTE', ...ETOPS('XXXX', 'ETOPS AIRPORT INFORMATION', false), 'SUBJECT: XXXX-SLOTS', 'SYNTHETIC SLOT NOTE'].join('\n'));
  assert.deepEqual(rows(mixed), [
    { dot: 'b', text: 'SUBJECT: XXXX-RWYS' }, { dot: 'b', text: 'SYNTHETIC RUNWAY NOTE' }, { dot: 'b', text: LINE },
    { dot: 'b', text: 'SUBJECT: XXXX-SLOTS' }, { dot: 'b', text: 'SYNTHETIC SLOT NOTE' }]);
  // the same on a NavBlue-style body (no title lines): the rule reads the body, not the format
  assert.deepEqual(rows(card('SYNTHETIC LINE\n' + ETOPS('XXXX', 'ETOPS ALTERNATE INFORMATION').join('\n'))), [{ dot: 'b', text: 'SYNTHETIC LINE' }, { dot: 'b', text: LINE }]);
});
test('TC-186-020 R2 NEGATIVE: not qualifying → the item is shown as any other (R3)', () => {
  // another heading
  const a = rows(card(ETOPS('XXXX', 'ETOPS SYNTHETIC OTHER HEADING').join('\n')));
  assert.ok(!a.some(r => r.text === LINE) && a.some(r => r.text === 'ETOPS SYNTHETIC OTHER HEADING'), 'another heading');
  // the right heading under another subject
  const b = rows(card(ETOPS('XXXX', 'ETOPS ALTERNATE INFORMATION').join('\n').replace('XXXX-ETOPS', 'XXXX-RWYS')));
  assert.ok(!b.some(r => r.text === LINE) && b.some(r => r.text === 'ETOPS ALTERNATE INFORMATION'), 'another subject');
  // an ETOPS subject of another airport (decision: the subject's ICAO is the card's own)
  const c = rows(card(ETOPS('YYYY', 'ETOPS ALTERNATE INFORMATION').join('\n')));
  assert.ok(!c.some(r => r.text === LINE), 'another airport');
  // the heading words in the middle of an item, not its first line
  const d = rows(card(['SUBJECT: XXXX-ETOPS', 'SYNTHETIC TITLE', 'ETOPS ALTERNATE INFORMATION'].join('\n')));
  assert.ok(!d.some(r => r.text === LINE) && d.length === 3, 'not the first line');
  // a subject with a suffix is not "<ICAO>-ETOPS"
  const e = rows(card(['SUBJECT: XXXX-ETOPS2', 'ETOPS ALTERNATE INFORMATION'].join('\n')));
  assert.ok(!e.some(r => r.text === LINE), 'another subject word');
});

// ══ TC-186-030 R3 ══════════════════════════════════════════════════════════════════
test('TC-186-030 R3: blue balls; a "- " comment keeps its "-" with no ball; its continuation lines join it', () => {
  const h = card(['SUBJECT: XXXX-SYN', 'SYNTHETIC TITLE', 'SYNTHETIC PLAIN LINE ONE', 'SYNTHETIC PLAIN LINE TWO'].join('\n'),
    [{ text: 'SYNTHETIC REMARK', subHeading: 'SYNTHETIC SUB' }, { text: '- SYNTHETIC COMMENT REMARK\nSECOND PRINTED LINE', subHeading: 'SYNTHETIC SUB' }]);
  assert.deepEqual(rows(h), [
    { dot: 'b', text: 'SYNTHETIC SUB' }, { dot: 'b', text: 'SYNTHETIC REMARK' }, { dot: '', text: '- SYNTHETIC COMMENT REMARK\nSECOND PRINTED LINE' },
    { dot: 'b', text: 'SUBJECT: XXXX-SYN' }, { dot: 'b', text: 'SYNTHETIC TITLE' }, { dot: 'b', text: 'SYNTHETIC PLAIN LINE ONE' }, { dot: 'b', text: 'SYNTHETIC PLAIN LINE TWO' }],
  'blue balls, the remark rows first (as main); NEGATIVE: plain lines are not joined');
  assert.ok(!/notam-dot y/.test(h), 'NEGATIVE: no yellow ball');
  // "- " lines: continuation absorbed up to the next "- ", SUBJECT:, bar line or numbered line
  const j = rows(card(['- SYNTHETIC ONE WRAPS HERE', 'AND CONTINUES', 'AND AGAIN', '- SYNTHETIC TWO', 'SUBJECT: XXXX-NEXT', '- SYNTHETIC THREE', '****', '- SYNTHETIC FOUR', '1. SYNTHETIC NUMBERED', '- SYNTHETIC FIVE', '2- SYNTHETIC NUMBERED', '- SYNTHETIC SIX', '3) SYNTHETIC NUMBERED', 'PLAIN AFTER'].join('\n')));
  assert.deepEqual(j.map(r => r.text), ['- SYNTHETIC ONE WRAPS HERE AND CONTINUES AND AGAIN', '- SYNTHETIC TWO', 'SUBJECT: XXXX-NEXT', '- SYNTHETIC THREE', '****', '- SYNTHETIC FOUR',
    '1. SYNTHETIC NUMBERED', '- SYNTHETIC FIVE', '2- SYNTHETIC NUMBERED', '- SYNTHETIC SIX', '3) SYNTHETIC NUMBERED', 'PLAIN AFTER']);
  assert.deepEqual(j.map(r => r.dot), ['', '', 'b', '', 'b', '', 'b', '', 'b', '', 'b', 'b'], 'dash rows without ball, the rest blue');
  // NEGATIVE: a plain line is not absorbed by the plain line before it, nor does a dash-only separator row show
  assert.deepEqual(rows(card('SYNTHETIC A\nSYNTHETIC B\n- - - - -\n---')).map(r => r.text), ['SYNTHETIC A', 'SYNTHETIC B']);
});
test('TC-186-030 R3: everything shown is escaped', () => {
  const h = card('SUBJECT: XXXX-SYN\n- <img src=x onerror="alert(1)"> &\nAND <b>MORE</b>', [{ text: '<script>alert(2)</script>' }]);
  assert.ok(!/<img|<script|<b>/.test(h));
  assert.ok(h.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; AND &lt;b&gt;MORE&lt;/b&gt;') && h.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
});

// ══ TC-186-040 R5 ══════════════════════════════════════════════════════════════════
test('TC-186-040 R5: an approach restriction / authorization keeps today\'s display (yellow ball, its text, not joined)', () => {
  const approach = ['SYNTHETIC CAT III RWY 99 NOT AUTHORIZED', 'USE RNAV APPROACHES ONLY', 'ILS RWY 99 UNAVAILABLE', 'RNP APCH NOT AUTHORIZED', 'LPV AND GLS NOT AUTHORIZED', 'CIRCLING MINIMA NOT AUTHORIZED', 'AUTOLAND NOT AUTHORIZED', 'CAT II/III NOT AUTHORIZED'];
  for (const t of approach) {
    const h = card(t, [{ text: '- ' + t }]);
    assert.ok(h.includes(MAIN_ROW(t)), `the line as main: ${t}`);
    assert.ok(h.includes(MAIN_ROW('- ' + t)), `a "- " remark row too: it keeps its ball`);
    assert.ok(!/notam-dot b"><\/span>\s*<span class="notam-item-label"/.test(h.split('<div class="notam-group-body"')[1]), 'none of them turned blue');
  }
  // a "- " opsNotes line that states a restriction and its continuation lines: today's rows, unjoined
  assert.deepEqual(rows(card('- SYNTHETIC CIRCLING IS AUTHORIZED PROVIDED\nSYNTHETIC MINIMA ARE OBSERVED')), [
    { dot: 'y', text: '- SYNTHETIC CIRCLING IS AUTHORIZED PROVIDED' }, { dot: 'y', text: 'SYNTHETIC MINIMA ARE OBSERVED' }]);
  // the CAT II/III restriction rows (by their source), whatever their text
  const cat = card(null, [], [{ airport: 'XXXX', category: 'II/III', text: 'SYNTHETIC RESTRICTION TEXT', runways: [] }, { airport: 'YYYY', text: 'ELSEWHERE' }]);
  assert.ok(cat.includes(MAIN_ROW('SYNTHETIC RESTRICTION TEXT')) && !cat.includes('ELSEWHERE'), 'the airport\'s own CAT row, as main');
  // NEGATIVE: words that are not approach words stay R3
  for (const t of ['THE MINIMUM ARFF REQUIREMENTS', 'IDENTIFY ON 118.8 FROM SYN VOR', 'SYNTHETIC CATERING TRUCK', 'CATEGORY ONE LINE']) {
    assert.deepEqual(rows(card(t)), [{ dot: 'b', text: t }], t);
  }
});

test('TC-186-040 R5 (runway): a restriction / authorization of the take-off, landing, arrival or departure use of a runway keeps today\'s display', () => {
  const runway = ['NIGHT TAKE-OFF NOT PERMITTED ON RWY 99', 'NIGHT LANDING NOT PERMITTED ON RWYS 98 AND 97', 'RWY 96L NOT APPROVED', 'RWY96 NOT AVAILABLE FOR TAKEOFF',
    'RUNWAY 95 CLOSED EVERY MON', 'RWY 94 CLSD', 'RWY 93 PROHIBITED FOR LANDING', 'RWY 92 AUTHORIZED FOR DEPARTURE ONLY', 'DUTY PILOT BRIEFING REQUIRED FOR DEPARTURE FROM RWY 91', 'RUNWAY 90 RESTRICTION: NO LANDING'];
  for (const t of runway) {
    const h = card(t, [{ text: '- ' + t }, { text: t }]);
    assert.ok(h.includes(MAIN_ROW(t)) && h.includes(MAIN_ROW('- ' + t)), `as main: ${t}`);
    assert.ok(!/notam-dot b"><\/span>\s*<span class="notam-item-label"/.test(h.split('<div class="notam-group-body"')[1]), `none blue: ${t}`);
    assert.deepEqual(rows(card('- ' + t)).map(r => r.dot), ['y'], 'a "- " line keeps its ball');
  }
  // a restriction printed on two lines: both lines keep the ball, they are not joined; a SUBJECT line or a bar is not carried
  assert.deepEqual(rows(card('RWY 30 IS NOT AVAILABLE FOR TAKEOFF UNLESS\nAUTHORIZED BY SYNTHETIC AUTHORITY.\nSYNTHETIC NEXT SENTENCE')), [
    { dot: 'y', text: 'RWY 30 IS NOT AVAILABLE FOR TAKEOFF UNLESS' }, { dot: 'y', text: 'AUTHORIZED BY SYNTHETIC AUTHORITY.' }, { dot: 'b', text: 'SYNTHETIC NEXT SENTENCE' }]);
  assert.deepEqual(rows(card('RWY 30 NOT AVAILABLE\nSUBJECT: XXXX-NEXT\n****')).map(r => r.dot), ['y', 'b', 'b'], 'not carried into a SUBJECT line or a bar');
  assert.deepEqual(rows(card('RWY 30 NOT AVAILABLE FOR TAKEOFF.\nSYNTHETIC OTHER LINE')).map(r => r.dot), ['y', 'b'], 'a sentence that ended: the next line is blue');
  // NEGATIVE: a runway named without a restriction, a restriction naming no runway
  for (const t of ['IF ASSIGNED RWY 18L, PLEASE UTILIZE SYNTHETIC FOR DATA', 'PGUA RWY 06R NOTAM', 'IF PERFORMANCE ALLOWS, CONSIDER RWY 08R/26L HOWEVER,', 'DEP: NO REQUIREMENT TO REDUCE PAYLOAD TO FORCE SHORT RWY',
    'NOT PERMITTED TO PARK AT THE SYNTHETIC GATE', 'TWY K CLOSED', 'TAKEOFF AND LANDING IS NOT ALLOWED BETWEEN 17:00 AND 07:00 UTC']) {
    assert.deepEqual(rows(card(t)), [{ dot: 'b', text: t }], t);
  }
});

// ══ TC-186-050 the 56 fixtures ═════════════════════════════════════════════════════
fixtureTest('TC-186-050 every screen except the Company Remarks subsection is as main (all 56 fixtures); R2 / R5 / header counts', async () => {
  const PIN = Object.assign({},
    require('./data/display-pr2-navblue-screens.json').screens, require('./data/def017-flightkeys-screens.json').screens);
  const noCard = [];
  let screens = 0, etopsLines = 0, etopsItems = 0, yellow = [], headers = 0, cards = 0;
  for (const fx of manifest().fixtures) {
    const { app } = await importFixture(fx, FIX);
    const got = { pre: sha16(app.renderPreflightPhase()), enr: sha16(app.renderEnroutePhase()), des: sha16(run(app, 'renderDescentPhase()')), notes: sha16(run(app, 'renderNotesSection()')) };
    for (const a of app.getAllAirports()) {
      const iss = run(app, `(function(){const d=airportData[${J(a.icao)}]||{notams:'',weather:''};const a=getAllAirports().find(x=>x.icao===${J(a.icao)});return renderAptIssues(evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType))})()`);
      const ops = run(app, `renderAptOpsNotes(${J(a.icao)})`), raw = run(app, `renderAptRaw(${J(a.icao)})`);
      got['card:' + a.icao] = fx.format === 'flightkeys' ? sha16(iss + '\u0000' + raw) : sha16(iss + raw);
      run(app, `S.descentAirport=${J(a.icao)}`);
      got['desc:' + a.icao] = sha16(run(app, 'renderDescentAirportSummary()'));
      if (!ops) continue;
      cards++;
      const r = rows(ops);
      headers += /<span class="notam-dot b"><\/span>\s*<span class="notam-group-label"/.test(ops) ? 1 : 0;
      etopsLines += r.filter(x => x.text === LINE).length;
      etopsItems += (run(app, `(airportData[${J(a.icao)}].opsNotes && airportData[${J(a.icao)}].opsNotes.body || '')`).match(new RegExp(`^SUBJECT: ${a.icao}-ETOPS$`, 'mg')) || []).length;
      assert.ok(!r.some(x => /CHECK OPSPEC|AIRPORT HRS/.test(x.text)), `${fx.id} ${a.icao}: no ETOPS NOTAM line left in Company Remarks`);
      assert.ok(r.filter(x => x.text === LINE).every(x => x.dot === 'b'));
      r.filter(x => x.dot === 'y').forEach(() => yellow.push(a.icao));
      assert.ok(!r.some(x => /^- /.test(x.text) && x.dot === 'b'), 'a "- " row never has a blue ball');
    }
    const cardIcaos = new Set(app.getAllAirports().map(a => a.icao));
    Object.entries(run(app, 'airportData')).forEach(([icao, d]) => {
      if (!cardIcaos.has(icao) && d.opsNotes && new RegExp(`^SUBJECT: ${icao}-ETOPS$`, 'm').test(d.opsNotes.body)) noCard.push(icao);
    });
    assert.deepEqual(got, PIN[fx.id], `${fx.id}: every screen but Company Remarks as main`);
    screens += Object.keys(got).length;
  }
  assert.equal(screens, 746);
  assert.equal(headers, cards, 'every Company Remarks subsection has the blue header');
  assert.equal(etopsLines, 17, 'the 17 ETOPS items that sit on an airport card (14 with and 3 without the CHECK OPSPEC line) are one line each');
  assert.equal(etopsItems, 17, 'every "<ICAO>-ETOPS" item on a card is one of them');
  assert.deepEqual(noCard.sort(), ['CYXY', 'PAJN', 'RJBB'], 'the other 3 of the 20 ETOPS items are for airports with no card: shown nowhere, as on main');
  const tally = {}; yellow.forEach(i => { tally[i] = (tally[i] || 0) + 1; });
  assert.deepEqual(tally, { KCVG: 1, KWRI: 3, LEZG: 3, LLBG: 4, NFFN: 3, PAFA: 1, ZHCC: 5 },
    'R5, rows by airport: the CAT II/III row; the runway restriction of KWRI (3 lines); LEZG (2 remark rows + 1 line); LLBG (2 lines, 2 packages); NFFN (take-off, landing, circling); the RNAV-only line; the ZHCC runway closures (5 lines) — nothing else keeps a yellow ball');
  // NEGATIVE: a changed screen is caught
  const fx = fkFixtures()[0], { app } = await importFixture(fx, FIX);
  run(app, 'S.stabTrim = "1.5/2.5"');
  assert.notEqual(sha16(app.renderPreflightPhase()), PIN[fx.id].pre);
});
