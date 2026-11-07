'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadApp } = require('../harness');

// ── TC-112-001: Settings and Help show the real version once the page has loaded ──
// The harness models document order: the main script runs while the page is still
// loading, so elements whose markup comes after it are not yet reachable.
{
  const app = loadApp({ domModel: true });
  app.fireDomReady();
  const expected = 'PilotBrief v' + vm.runInContext('APP_VERSION', app.sandbox);

  test('TC-112-001a: Settings version label reads PilotBrief v + APP_VERSION', () => {
    assert.equal(app.document.getElementById('settingsVersionBadge').textContent, expected);
  });

  test('TC-112-001b: Help version label reads PilotBrief v + APP_VERSION', () => {
    assert.equal(app.document.getElementById('helpVersionInline').textContent, expected);
  });
}
