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
