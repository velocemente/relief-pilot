'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diff } = require('../golden/diff');

test('diff: identical values give no lines', () => {
  assert.deepEqual(diff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), []);
});

test('diff: reports changed, added and removed fields with paths', () => {
  const lines = diff(
    { fltNum: 'GTI1/01', crew: [{ n: 'A' }, { n: 'B' }], gone: true },
    { fltNum: 'GTI1', crew: [{ n: 'A' }, { n: 'C' }, { n: 'D' }], extra: 1 },
  );
  assert.deepEqual(lines, [
    'crew[1].n: "B" -> "C"',
    'crew[2]: (added) {"n":"D"}',
    'extra: (added) 1',
    'fltNum: "GTI1/01" -> "GTI1"',
    'gone: (removed) true',
  ]);
});
