'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { redactRaw, redactItems, itemLines, buildLexicon, Report, fakeName, fakeNumber, fakeInitials, ORDINARY_WORDS } = require('../../tools/redact/redact');

const RAW = [
  'Signed by Dispatcher: ALEX TESTERMAN',
  'CA 123456 SAMPLEWORTH M .. .. ..',
  'FO  234567    EXAMPLE L    .. .. ..',
  'DH DEMOSON A FA',
  'WINDS MAY AFFECT THE ROUTE. SHALL NOT FILE',
  'Remarks: employee 123456 called',
  '',
].join('\n');

test('redact: names and numbers replaced, ordinary text untouched', () => {
  const out = redactRaw(RAW, new Report());
  for (const s of ['ALEX', 'TESTERMAN', '123456', 'SAMPLEWORTH', '234567', 'EXAMPLE', 'DEMOSON']) {
    assert.ok(!out.includes(s), `${s} still present`);
  }
  assert.match(out, /WINDS MAY AFFECT THE ROUTE\. SHALL NOT FILE/);
  assert.match(out, /^Signed by Dispatcher: [A-Z]+ [A-Z]+$/m);
  assert.match(out, /^CA 9\d{5} [A-Z]+ [A-Z] \.\. \.\. \.\.$/m);
  assert.match(out, /^DH [A-Z]+ [A-Z] FA$/m);
});

test('redact: same input gives same output, every time and across files', () => {
  assert.equal(redactRaw(RAW, new Report()), redactRaw(RAW, new Report()));
  assert.equal(fakeName('SAMPLEWORTH'), fakeName('SAMPLEWORTH'));
  assert.equal(fakeNumber('123456'), fakeNumber('123456'));
  assert.equal(fakeNumber('123456').length, 6);
  // the same crew member in a different file/line gets the same fake
  const a = redactRaw('CA 123456 SAMPLEWORTH M ..', new Report());
  const b = redactRaw('x\nCA 123456 SAMPLEWORTH M ..\ny', new Report());
  assert.ok(b.includes(a));
});

test('redact: report counts replacements without needing originals', () => {
  const rep = new Report();
  redactRaw(RAW, rep);
  assert.equal(rep.counts.dispatcher, 1);
  assert.equal(rep.counts.empno, 3); // two roster lines + the later mention
  assert.equal(rep.counts.crew, 3);
});

test('redact: items are redacted like the text, including names split across items', () => {
  const mk = (str, x, w) => ({ str, x, y: 100, w, h: 10, font: 'f' });
  const json = { meta: {}, pages: [{ n: 1, width: 600, height: 800, items: [
    mk('CA', 30, 12), mk('123456', 60, 36), mk('SAMPLEWORTH', 120, 40), mk(' ', 160, 3), mk('M', 163, 8), mk('..', 200, 10),
  ] }] };
  redactItems(json, new Report());
  const all = json.pages[0].items.map(i => i.str).join('|');
  assert.ok(!/123456|SAMPLEWORTH/.test(all), all);
  assert.match(all, /^CA\|9\d{5}\|/);
});

// ── TC-170: gaps found in Field Map v1.1 §6 (synthetic text only) ─────────
test('TC-170-001 jump-seat lines: name replaced, seat digit and heading kept', () => {
  const raw = [
    'JS VERIFY    START-END(Z)',
    'JS    QUILLBERRY T    .. .. .. .. ..',
    'JS 0 ZANTHORPE MERIWELL OCTAVUS',
    'JS 0 PLOVERDALE, ISOLDINE',
    '',
  ].join('\n');
  const rep = new Report();
  const out = redactRaw(raw, rep);
  for (const s of ['QUILLBERRY', 'ZANTHORPE', 'MERIWELL', 'OCTAVUS', 'PLOVERDALE', 'ISOLDINE']) {
    assert.ok(!out.includes(s), `${s} still present`);
  }
  assert.match(out, /^JS VERIFY    START-END\(Z\)$/m);          // negative: heading untouched
  assert.match(out, /^JS    [A-Z]+ [A-Z]    \.\. \.\. \.\. \.\. \.\.$/m);
  assert.match(out, /^JS 0 [A-Z]+ [A-Z]+ [A-Z]+$/m);            // seat digit stays
  assert.match(out, /^JS 0 [A-Z]+, [A-Z]+$/m);
  assert.equal(rep.counts.jumpseat, 3);
});

test('TC-170-002 dispatcher line with no "Signed by" repeat: name replaced everywhere, phone kept', () => {
  const raw = [
    'Remarks',
    'ROSAMUND KETTLEWICK DESK: 12 PHONE: +1-000-000-0000',
    'Contact Dispatch if you have any questions.',
    'CALL ROSAMUND KETTLEWICK BEFORE DEPARTURE',
    'DESK: 12 PHONE: +1-000-000-0000',
    '',
  ].join('\n');
  const rep = new Report();
  const out = redactRaw(raw, rep);
  assert.ok(!/ROSAMUND|KETTLEWICK/.test(out), out);
  assert.match(out, /^[A-Z]+ [A-Z]+ DESK: 12 PHONE: \+1-000-000-0000$/m);
  assert.match(out, /^Contact Dispatch if you have any questions\.$/m); // negative
  assert.match(out, /^DESK: 12 PHONE: \+1-000-000-0000$/m);            // negative: no name, no change
  assert.equal(rep.counts.dispatcher, 1); // the DESK line
  assert.equal(rep.counts.crew, 1);       // the later mention, found by name search
});

test('TC-170-003 dispatcher initials in a free-text remark', () => {
  // Any 2-3 capital letters right before "/HHMMZ" count as initials; the
  // negatives are 4 letters, a time without a slash, a digit, lower case.
  const raw = 'FUEL UPDATED PER CAPT QXZ/1430Z DUE FOR DEST WX.\nKQQQ/1430Z KQQQ 1430Z AB1/1430Z qxz/1430Z\n';
  const rep = new Report();
  const out = redactRaw(raw, rep);
  assert.ok(!out.includes('QXZ/'), out);
  assert.match(out, /PER CAPT [A-Z]{3}\/1430Z DUE FOR DEST WX\./);
  assert.equal(out.split('\n')[1], 'KQQQ/1430Z KQQQ 1430Z AB1/1430Z qxz/1430Z'); // negatives untouched
  assert.equal(fakeInitials('QXZ'), fakeInitials('QXZ'));
  assert.equal(fakeInitials('QXZ').length, 3);
  assert.equal(rep.counts.initials, 1);
});

test('TC-170-004 short employee numbers and crew lines without a number', () => {
  const raw = [
    'CA 317 HOLLOWMERE B .. .. .. ..',
    'MX 4821 FENWICKSHAW D',
    'LM VARNSWORTH PELLINGHAM',
    'FUEL 317 4821 MX OPS 24H AVBL',
    '',
  ].join('\n');
  const out = redactRaw(raw, new Report());
  for (const s of ['HOLLOWMERE', 'FENWICKSHAW', 'VARNSWORTH', 'PELLINGHAM']) assert.ok(!out.includes(s), `${s} still present`);
  assert.match(out, /^CA 9\d\d [A-Z]+ [A-Z] \.\. \.\. \.\. \.\.$/m);
  assert.match(out, /^MX 9\d{3} [A-Z]+ [A-Z]$/m);
  assert.match(out, /^FUEL 317 4821 MX OPS 24H AVBL$/m); // negative: short numbers not searched elsewhere
});

test('TC-170-005 items: jump-seat name split across items is redacted like the text', () => {
  const mk = (str, x, w) => ({ str, x, y: 100, w, h: 10, font: 'f' });
  const json = { meta: {}, pages: [{ n: 1, width: 600, height: 800, items: [
    mk('JS', 30, 12), mk('0', 50, 6), mk('ZANTHORPE', 70, 45), mk(' ', 115, 3), mk('MERIWELL', 118, 40),
  ] }] };
  const rep = new Report();
  redactItems(json, rep);
  const all = json.pages[0].items.map(i => i.str).join('|');
  assert.ok(!/ZANTHORPE|MERIWELL/.test(all), all);
  assert.match(all, /^JS\|0\|[A-Z]+/);
  assert.equal(rep.counts.jumpseat, 1);
});

// ── TC-170-1xx: single name words in free text (F1), synthetic text only ──
// The lexicon is built at run time from the crew / jump-seat / dispatcher lines
// of every package given. Package A holds the roster; package B is another
// package whose free text mentions the same people.
const PKG_A = [
  'CA 123456 QUILLBERRY, OSWINDA .. .. ..',
  'FO 234567 VELLACOURT, GRANT .. .. ..',
  'FA 345678 TARVENBROOK, MIKE .. .. ..',
  'JS 0 CORVANDER WILL',
  'Signed by Dispatcher: ROSE BELLWHISTLE',
  '',
].join('\n');
const pkgs = (...texts) => texts.map((t, i) => ({ name: `pkg${i}`, lines: t.split('\n') }));
const lexOf = (...texts) => buildLexicon(pkgs(...texts));

test('TC-170-101 first name alone in a remark of another package is replaced', () => {
  const b = 'Remarks\nTEST FOR OSWINDA\nTHANKS OSWINDA\nFROM ROSE :P\nFUEL ADDED FOR WX\n';
  const lex = lexOf(PKG_A, b);
  const rep = new Report();
  const out = redactRaw(b, rep, lex);
  assert.ok(!/OSWINDA|ROSE/.test(out), out);
  assert.match(out, /^TEST FOR [A-Z]+$/m);
  assert.match(out, /^THANKS [A-Z]+$/m);
  assert.match(out, /^FROM [A-Z]+ :P$/m);                     // emoticon kept
  assert.match(out, /^FUEL ADDED FOR WX$/m);                   // negative: ordinary line untouched
  assert.equal(out.split('\n')[1].slice(9), fakeName('OSWINDA')); // same fake as on the roster line
  assert.equal(rep.counts.nameword, 3);
  // Without package A's names the remark is not touched: the lexicon is the
  // only source of single name words.
  assert.equal(redactRaw(b, new Report()), b);
});

test('TC-170-102 surname alone, any letter case, whole word only', () => {
  const b = 'PLS CALL QUILLBERRY ON ARRIVAL\nPlease call Quillberry or quillberry.\nQUILLBERRYS QUILLBERRY2 XQUILLBERRY\n';
  const out = redactRaw(b, new Report(), lexOf(PKG_A, b));
  const fake = fakeName('QUILLBERRY');
  assert.equal(out.split('\n')[0], `PLS CALL ${fake} ON ARRIVAL`);
  assert.equal(out.split('\n')[1], `Please call ${fake[0]}${fake.slice(1).toLowerCase()} or ${fake.toLowerCase()}.`);
  assert.equal(out.split('\n')[2], 'QUILLBERRYS QUILLBERRY2 XQUILLBERRY'); // negative: not a whole word
});

test('TC-170-103 a name repeated in a line and across lines gets the same fake each time', () => {
  const b = 'TARVENBROOK TO BRIEF. TARVENBROOK HAS THE PAPERS\nCORVANDER AND TARVENBROOK\n';
  const rep = new Report();
  const out = redactRaw(b, rep, lexOf(PKG_A, b));
  const t = fakeName('TARVENBROOK'), c = fakeName('CORVANDER');
  assert.equal(out, `${t} TO BRIEF. ${t} HAS THE PAPERS\n${c} AND ${t}\n`);
  assert.equal(rep.counts.nameword, 4);
});

test('TC-170-104 a name that is also an ordinary word stays unless it is in a name position', () => {
  // GRANT, MIKE, WILL and ROSE are first names in PKG_A and ordinary words
  // (ORDINARY_WORDS). They are replaced only in a name position:
  //   P1 next to the same person's other name, P2 after a title or role code,
  //   P3 in a sign-off line, P4 exact mixed case inside an upper-case line.
  for (const w of ['GRANT', 'MIKE', 'WILL', 'ROSE']) assert.ok(ORDINARY_WORDS.has(w), w);
  const b = [
    'SLOT GRANT REQUESTED. TWY MIKE CLSD. ATIS WILL BE AVBL. WIND ROSE ON CHART', // stays
    'GRANT VELLACOURT TO CALL OPS',      // P1: same person's surname next to it
    'CAPT MIKE TO SIGN. FO GRANT.',      // P2: title / role code
    'THANKS WILL',                       // P3: sign-off line
    'PLS CALL Grant ON ARRIVAL',         // P4: roster prints "Grant" (FlightKeys case)
    'GRANT TARVENBROOK',                 // not the same person: TARVENBROOK only is replaced
    '',
  ].join('\n');
  const a = PKG_A + 'CA 456789 VELLACOURT, Grant .. ..\n';
  const out = redactRaw(b, new Report(), lexOf(a, b)).split('\n');
  assert.equal(out[0], 'SLOT GRANT REQUESTED. TWY MIKE CLSD. ATIS WILL BE AVBL. WIND ROSE ON CHART');
  assert.equal(out[1], `${fakeName('GRANT')} ${fakeName('VELLACOURT')} TO CALL OPS`);
  assert.equal(out[2], `CAPT ${fakeName('MIKE')} TO SIGN. FO ${fakeName('GRANT')}.`);
  assert.equal(out[3], `THANKS ${fakeName('WILL')}`);
  assert.equal(out[4], `PLS CALL ${fakeName('GRANT')[0]}${fakeName('GRANT').slice(1).toLowerCase()} ON ARRIVAL`);
  assert.equal(out[5], `GRANT ${fakeName('TARVENBROOK')}`);
});

test('TC-170-105 stop-list: names that are also place or waypoint names stay in place text', () => {
  // A name word the packages also use in a place name (A2: CITY/<x>, <x> INTL,
  // SAN <x>, <x> COUNTY, airway + waypoint, navaid + frequency) or in the
  // ordinary text of 2+ other packages (A3) becomes ambiguous.
  const a = 'CA 123456 VELLACOURT, OSWINDA ..\nFO 234567 QUENT, ISOLDINE ..\nFA 345678 KETTLEWICK, OCTAVUS ..\n';
  const places = [
    'DEST KXYZ/XYZ NEW HARBOR/VELLACOURT INTL N40000W070000 0100Z',
    'XYZ IAP VELLACOURT INTL, NEW HARBOR, NY.',
    'N147 QUENT',
    'DCT ABC KETTLEWICK 112.90',
    '',
  ].join('\n');
  const c = 'SAN ISOLDINE OCEANIC FIR\n';
  const remarks = 'CAPT VELLACOURT ADVISED\nTHANKS QUENT\nRWY 04 OCTAVUS SIDE CLSD\n';
  const lex = lexOf(a, places, c, remarks);
  for (const w of ['VELLACOURT', 'QUENT', 'KETTLEWICK', 'ISOLDINE']) assert.ok(lex.ambiguous.has(w), w);
  assert.ok(!lex.ambiguous.has('OCTAVUS'));          // used once in ordinary text: still distinctive
  assert.equal(redactRaw(places, new Report(), lex), places);   // place text untouched
  assert.equal(redactRaw(c, new Report(), lex), c);
  const out = redactRaw(remarks, new Report(), lex).split('\n');
  assert.equal(out[0], `CAPT ${fakeName('VELLACOURT')} ADVISED`);
  assert.equal(out[1], `THANKS ${fakeName('QUENT')}`);
  assert.equal(out[2], `RWY 04 ${fakeName('OCTAVUS')} SIDE CLSD`); // distinctive: replaced anywhere
  // A3: the same word in the ordinary text of two packages that do not list it.
  const d = 'RWY 04 OCTAVUS SIDE CLSD\n', e = 'OCTAVUS LGT U/S\n';
  assert.ok(lexOf(a, d, e).ambiguous.has('OCTAVUS'));
  assert.ok(!lexOf(a, d).ambiguous.has('OCTAVUS'));
});

test('TC-170-106 positions file stays in step with the text file', () => {
  const lines = ['Remarks', 'THANKS OSWINDA', 'CALL QUILLBERRY AT DESK', 'TWY MIKE CLSD', ''];
  const raw = lines.join('\n');
  // The same lines as positioned items; "QUILLBERRY" is split over two items.
  const mk = (str, x, y, w) => ({ str, x, y, w, h: 10, font: 'f' });
  const json = { meta: {}, pages: [{ n: 1, width: 600, height: 800, items: [
    mk('Remarks', 30, 700, 40),
    mk('THANKS', 30, 690, 36), mk('OSWINDA', 70, 690, 42),
    mk('CALL', 30, 680, 24), mk('QUILL', 58, 680, 30), mk('BERRY', 88, 680, 30), mk('AT', 122, 680, 12), mk('DESK', 138, 680, 24),
    mk('TWY', 30, 670, 18), mk('MIKE', 52, 670, 24), mk('CLSD', 80, 670, 24),
  ] }] };
  assert.deepEqual(itemLines(json), lines.slice(0, 4));         // fixture assembles like the text
  const before = JSON.parse(JSON.stringify(json));
  const lex = lexOf(PKG_A, raw);
  const outRaw = redactRaw(raw, new Report(), lex);
  redactItems(json, new Report(), lex);
  // Same words in the same lines. Only the spacing may differ where a name was
  // split over items: the emptied item keeps its position (the previous tool
  // behaves the same way).
  const norm = l => l.replace(/\s+/g, ' ');
  assert.deepEqual(itemLines(json).map(norm), outRaw.split('\n').slice(0, 4).map(norm));
  assert.equal(itemLines(json)[1], outRaw.split('\n')[1]);    // one item per word: identical
  assert.ok(!/OSWINDA|QUILL|BERRY/.test(JSON.stringify(json)));
  json.pages[0].items.forEach((it, i) => {                      // positions never move
    const b = before.pages[0].items[i];
    assert.deepEqual([it.x, it.y, it.w, it.h], [b.x, b.y, b.w, b.h]);
  });
  assert.equal(json.pages[0].items[9].str, 'MIKE');             // negative: not a name position
});

test('TC-170-107 CLI: lexicon from other packages, kept in memory only', () => {
  const os = require('os'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'redact-'));
  try {
    fs.mkdirSync(path.join(dir, 'lex'));
    fs.writeFileSync(path.join(dir, 'lex', 'A.raw.txt'), PKG_A);
    fs.writeFileSync(path.join(dir, 'B.raw.txt'), 'THANKS OSWINDA\n');
    const out = path.join(dir, 'out');
    const log = execFileSync(process.execPath, [path.join(__dirname, '../../tools/redact/redact.js'),
      '--out', out, '--lexicon-from', path.join(dir, 'lex'), path.join(dir, 'B.raw.txt')], { encoding: 'utf8' });
    assert.deepEqual(fs.readdirSync(out), ['B.raw.txt']);                 // nothing else written
    assert.equal(fs.readFileSync(path.join(out, 'B.raw.txt'), 'utf8'), `THANKS ${fakeName('OSWINDA')}\n`);
    assert.ok(!/OSWINDA|QUILLBERRY|VELLACOURT/.test(log), log);           // report: counts only
    assert.match(log, /1 name words in free text replaced/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
