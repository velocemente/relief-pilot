'use strict';
// DEF-024: a bookmark pill tap on the OFP tab must put the top of the page just below the sticky
// pill row. _ofpPillScrollTop() is the arithmetic only; the DOM reads stay in loadOFPPanel().
// Numbers are CSS px from a measured iPad layout: viewer top 111 (nav bar + tab bar above it),
// pill row 47 high.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const app = loadApp();
const f = app._ofpPillScrollTop;
const CT = 111, BAR = 47, MAX = 100000;

test('positive: scroll so the page top sits just below the pill row', () => {
  // Page 24 is 27107 px down the content. The viewer starts at the top (scrollTop 0), so the page
  // top is on screen at containerTop + 27107 + the pill row that sits above page 1.
  assert.equal(f(0, CT, CT + 27107, BAR, MAX, true), 27107 - BAR);
});

test('positive: the result does not depend on where the viewer is scrolled now', () => {
  // Same page, viewer already scrolled 5000 px (or mid-way through an earlier smooth scroll):
  // the page top is on screen 5000 px higher, and the answer is the same.
  assert.equal(f(5000, CT, CT + 27107 - 5000, BAR, MAX, true), 27107 - BAR);
  assert.equal(f(27107, CT, CT, BAR, MAX, true), 27107 - BAR);
});

test('positive: the viewer\'s own offset on the screen is not added (the DEF-024 fault)', () => {
  // The old code added the offsets of the elements above the viewer (111 px) and took a fixed 52.
  const top = f(0, CT, CT + 27107, BAR, MAX, true);
  assert.notEqual(top, 27107 + CT - 52);
  assert.equal(top, 27060);
});

test('positive: page 1 sits just below the pill row, so no scroll is needed', () => {
  assert.equal(f(0, CT, CT + BAR, BAR, MAX, true), 0);
});

test('positive: never a negative position', () => {
  assert.equal(f(0, CT, CT + 10, BAR, MAX, true), 0);
});

test('positive: no pill row height is taken as 0, not NaN', () => {
  assert.equal(f(0, CT, CT + 500, undefined, MAX, true), 500);
  assert.equal(f(0, CT, CT + 500, NaN, MAX, true), 500);
});

test('negative: a page that is not drawn yet has no position (nothing is taken from it)', () => {
  assert.equal(f(0, CT, null, BAR, MAX, true), null);
  assert.equal(f(0, CT, undefined, BAR, MAX, false), null);
  assert.equal(f(0, CT, NaN, BAR, MAX, true), null);
  assert.equal(f(0, CT, Infinity, BAR, MAX, true), null);
});

test('negative: while pages are still being added, a position the viewer cannot reach yet waits', () => {
  // The newest page, in a narrow viewer: the pages added so far end 38 px before the position.
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 2962, false), null);
});

test('positive: a position the viewer can reach is used even while pages are still being added', () => {
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 3000, false), 3000);
});

test('positive: once every page is added the scroll end is the limit, so the scroll goes ahead', () => {
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 2962, true), 3000);
});

test('positive: a fractional position is rounded down, so the page is never under the pill row', () => {
  // Page top 500.6 px below the viewer top, pill row 47: ideal 453.6, taken as 453 (page 0.6 px below the row).
  assert.equal(f(0, CT, CT + 500.6, BAR, MAX, true), 453);
  assert.equal(f(1000.4, CT, CT + 500.6 - 1000.4, BAR, MAX, true), 453);
});
