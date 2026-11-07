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

// ── FlightKeys live packages: roster and contact-line shapes (all names below are synthetic) ──
const FK = [
  'CA 123456 * SAMPLEWORTH, ADA .. .. ..',
  'FO 234567 * Exampleson, Ben .. .. ..',
  'MX 34567 DEMO MAINT',
  'LM 45678 DEMO LOADER J',
  'JS 1 TESTLEY CARL M',
  'JS 1 Verifyson, Dana',
  'JS 1 TBA',
  'JS SEA   0650(Z)',
  'PU 7654321 Paxman, Eve (E.P.)',
  'FA 8765432 Cabinson, Fay',
  'DH 345678 Deadheader, Gus',
  'FAKEDISPATCHER Zed DESK: 20 PHONE: +1-555-010-0100',
  'DISPATCH DESK: 20 PHONE: +1-555-010-0100',
  'CONTACT THE DISPATCH DESK AT 555-010-0100. DO NOT RELY ON THIS',
  'Remark: FAKEDISPATCHER Zed said hello to SAMPLEWORTH, ADA at the gate',
  '',
].join('\n');

test('redact FK: asterisk after the employee number is kept and the name behind it is replaced', () => {
  const out = redactRaw(FK, new Report());
  for (const s of ['123456', 'SAMPLEWORTH', 'ADA', '234567', 'Exampleson', 'Ben']) assert.ok(!out.includes(s), `${s} still present`);
  assert.match(out, /^CA 9\d{5} \* [A-Za-z]+, [A-Za-z]+ \.\. \.\. \.\.$/m);
  assert.match(out, /^FO 9\d{5} \* [A-Za-z]+, [A-Za-z]+ \.\. \.\. \.\.$/m);
  // the same crew member named elsewhere in the text gets the same fake
  const fake = /^CA 9\d{5} \* ([A-Za-z]+, [A-Za-z]+) /m.exec(out)[1];
  assert.match(out, new RegExp(`^Remark: .* said hello to ${fake} at the gate$`, 'm'));
});

test('redact FK: every roster role is covered (MX, LM, PU, FA, DH)', () => {
  const out = redactRaw(FK, new Report());
  for (const s of ['34567', 'DEMO MAINT', '45678', 'DEMO LOADER', '7654321', 'Paxman', 'E.P.', '8765432', 'Cabinson', '345678', 'Deadheader'])
    assert.ok(!out.includes(s), `${s} still present`);
  assert.match(out, /^MX 9\d{4} [A-Z]+ [A-Z]+$/m);
  assert.match(out, /^PU 9\d{6} [A-Za-z]+, [A-Za-z]+ \(.\..\.\)$/m);
});

test('redact FK: jump-seat names are replaced; a bare placeholder and the JS timing line are not', () => {
  const out = redactRaw(FK, new Report());
  for (const s of ['TESTLEY', 'CARL', 'Verifyson', 'Dana']) assert.ok(!out.includes(s), `${s} still present`);
  assert.match(out, /^JS 1 [A-Z]+ [A-Z]+ [A-Z]$/m);
  assert.match(out, /^JS 1 [A-Za-z]+, [A-Za-z]+$/m);
  assert.match(out, /^JS 1 TBA$/m);               // negative: one word, not a name
  assert.match(out, /^JS SEA {3}0650\(Z\)$/m);    // negative: not the seat-count form
});

test('redact FK: "<name> DESK:" dispatcher lines are replaced; desk labels and prose are not', () => {
  const rep = new Report();
  const out = redactRaw(FK, rep);
  assert.ok(!/FAKEDISPATCHER|\bZed\b/.test(out), out);
  assert.match(out, /^[A-Za-z]+ [A-Za-z]+ DESK: 20 PHONE: \+1-555-010-0100$/m);
  assert.match(out, /^DISPATCH DESK: 20 PHONE: \+1-555-010-0100$/m);                                  // negative: label only
  assert.match(out, /^CONTACT THE DISPATCH DESK AT 555-010-0100\. DO NOT RELY ON THIS$/m);            // negative: prose
  assert.equal(rep.counts.dispatcher, 1); // the DESK line; the later mention is found by the name registry (counted as crew, as before)
});
