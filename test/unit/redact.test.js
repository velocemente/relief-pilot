'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { redactRaw, redactItems, Report, fakeName, fakeNumber } = require('../../tools/redact/redact');

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

// ── FlightKeys: jump seats, dispatcher desk line, Remarks sign-offs ──────
// Synthetic text only (CLAUDE.md: never copy fixture names into this repo).
const FK = [
  'OPERATIONAL FLIGHT PLAN RLS 01 01JAN26 00:00',
  'Remarks',
  'Quillan Zorbaxter DESK: 50 PHONE: +1-000-000-0000',
  'TEST FOR WEXLOMIR',
  'FROM QUILLAN :P',
  'FROM 0800 TO 1200 RWY 04L CLSD',
  'PERISHABLES ONBOARD',
  'FUFI: 00000000-0000 PAGE 1/2',
  'JS VERIFY   START-END(Z)',
  'CA 123456 SAMPLEWORTH M .. .. ..',
  'JS 0 FENWORTHY DRASCOMB T',
  'JS 0 Plimbury, Odessandra',
  'JS 0 FENWORTHY-GALE ALBRECHTA',
  'Signed by Dispatcher: Quillan Zorbaxter',
  'JUMPSEAT FENWORTHY DRASCOMB T CONFIRMED',
  'THANKS WEXLOMIR',
  'FROM KLAX',
  'Wind Shear DESK: 50',
  'KLAX LOS ANGELES INTL',
  '',
].join('\n');

test('redact FK: JS 0 jump-seat names replaced, upper and mixed case', () => {
  const rep = new Report();
  const out = redactRaw(FK, rep);
  for (const s of ['FENWORTHY', 'DRASCOMB', 'Plimbury', 'Odessandra', 'ALBRECHTA']) {
    assert.ok(!out.includes(s), `${s} still present`);
  }
  assert.match(out, /^JS 0 [A-Z]+ [A-Z]+ [A-Z]$/m);
  assert.match(out, /^JS 0 [A-Z]+, [A-Z]+$/m);
  assert.match(out, /^JS 0 [A-Z]+-[A-Z]+ [A-Z]+$/m);
  assert.match(out, /^JUMPSEAT [A-Z]+ [A-Z]+ [A-Z] CONFIRMED$/m, 'the name is replaced elsewhere too');
  assert.match(out, /^JS VERIFY {3}START-END\(Z\)$/m, 'the JS heading is not a name');
  assert.equal(fakeName('Plimbury, Odessandra'), fakeName('PLIMBURY, ODESSANDRA'));
});

test('redact FK: dispatcher on the first Remarks line replaced, desk and phone kept', () => {
  const rep = new Report();
  const out = redactRaw(FK, rep);
  assert.ok(!/Quillan|Zorbaxter/i.test(out), 'dispatcher name still present');
  const fake = fakeName('Quillan Zorbaxter');
  assert.ok(out.includes(`\n${fake} DESK: 50 PHONE: +1-000-000-0000\n`));
  assert.ok(out.includes(`Signed by Dispatcher: ${fake}\n`), 'same fake as the signature line');
  assert.equal(redactRaw('Remarks\nQuillan Zorbaxter DESK: POLAR', new Report()), `Remarks\n${fake} DESK: POLAR`);
  assert.equal(redactRaw('Remarks\n  Quillan Zorbaxter DESK: 21  ', new Report()), `Remarks\n  ${fake} DESK: 21  `);
});

test('redact FK: a DESK line that is not the first Remarks line is not touched', () => {
  const out = redactRaw(FK, new Report());
  assert.match(out, /^Wind Shear DESK: 50$/m);
  const lone = 'Quillan Zorbaxter DESK: 50';
  assert.equal(redactRaw(lone, new Report()), lone);
  assert.equal(redactRaw(`REMARKS 1\n${lone}`, new Report()), `REMARKS 1\n${lone}`);
});

test('redact FK: first names in Remarks sign-off lines replaced, ordinary lines kept', () => {
  const rep = new Report();
  const out = redactRaw(FK, rep);
  assert.ok(!/WEXLOMIR|QUILLAN/.test(out.split('FUFI:')[0]), 'sign-off name still present');
  assert.match(out, /^TEST FOR [A-Z]+$/m);
  assert.match(out, /^FROM [A-Z]+ :P$/m);
  assert.equal(rep.counts.remarks, 2);
  // Outside the Remarks block (after the page footer) the same shapes are left alone.
  assert.match(out, /^THANKS WEXLOMIR$/m);
  assert.match(out, /^FROM KLAX$/m);
  for (const l of ['FROM 0800 TO 1200 RWY 04L CLSD', 'PERISHABLES ONBOARD', 'KLAX LOS ANGELES INTL']) {
    assert.ok(out.includes(`\n${l}\n`), `${l} changed`);
  }
});

test('redact FK: an airport or NOTAM line that looks like a name is not touched', () => {
  const text = [
    'Remarks',
    'RAIM VALIDATION PASSED',
    'FROM PARIS CHARLES DE GAULLE',
    'THANKS FOR THE COOPERATION AND',
    'JS 1 SEAT INOP',
    'RJAA NARITA INTL',
    'A1234/26 NOTAMN JS 0 DEG MAG VAR',
    '',
  ].join('\n');
  assert.equal(redactRaw(text, new Report()), text);
});

test('redact FK: items match the text, including items out of reading order', () => {
  const mk = (str, x, y, w) => ({ str, x, y, w, h: 10, font: 'f' });
  // pdf.js may hand items over in any order; the Remarks header is listed last.
  const json = { meta: {}, pages: [{ n: 1, width: 600, height: 800, items: [
    mk('Quillan', 30, 120, 30), mk(' ', 60, 120, 3), mk('Zorbaxter', 63, 120, 40), mk('DESK: 50', 110, 120, 40),
    mk('THANKS', 30, 130, 30), mk('WEXLOMIR', 65, 130, 40),
    mk('JS', 30, 200, 10), mk('0', 45, 200, 5), mk('Plimbury, Odessandra', 55, 200, 90),
    mk('Remarks', 30, 110, 40),
  ] }] };
  const raw = 'Remarks\nQuillan Zorbaxter DESK: 50\nTHANKS WEXLOMIR\nJS 0 Plimbury, Odessandra';
  const outRaw = redactRaw(raw, new Report());
  redactItems(json, new Report());
  const all = json.pages[0].items.map(i => i.str).join('|');
  assert.ok(!/Quillan|Zorbaxter|WEXLOMIR|Plimbury|Odessandra/.test(all), all);
  const fake = fakeName('Quillan Zorbaxter');
  assert.ok(all.startsWith(`${fake}|||DESK: 50|THANKS|${fakeName('WEXLOMIR')}|JS|0|${fakeName('Plimbury, Odessandra')}|Remarks`), all);
  assert.ok(outRaw.includes(`${fake} DESK: 50`) && outRaw.includes(`JS 0 ${fakeName('Plimbury, Odessandra')}`));
});
