'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { redactRaw, redactItems, Report, fakeName, fakeNumber, fakeInitials } = require('../../tools/redact/redact');

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
