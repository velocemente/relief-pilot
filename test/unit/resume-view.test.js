'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const RESUME_KEY = 'rp_resume_view';

// ── Helpers ───────────────────────────────────────────────────────────────
function makeFlightEntry(overrides) {
  const defaults = {
    id: 'f_test_001',
    fltNum: 'GTI1234/01',
    date: '15 MAR 26',
    at: '2026-03-15T10:00:00.000Z',
    state: { fltNum: 'GTI1234/01', date: '15 MAR 26', activePhase: 'preflight' },
    raw: '',
    aptData: {}
  };
  return Object.assign({}, defaults, overrides,
    overrides && overrides.state ? { state: Object.assign({}, defaults.state, overrides.state) } : {});
}

// ── TC-RV-001: Simulated reload restores the crew's last-viewed flight ─────
{
  const flightId = 'f_test_rv1';
  const savedFlight = makeFlightEntry({
    id: flightId,
    fltNum: 'GTI5678/02',
    date: '16 MAR 26',
    state: { fltNum: 'GTI5678/02', date: '16 MAR 26', activePhase: 'cruise' }
  });
  const resumeView = {
    flightId,
    screen: 'screen-flight',
    tab:    'airports',
    phase:  'cruise',
    scrollY: 300
  };

  // Load the app with pre-populated storage — simulates an iOS Home Screen reload
  const app = loadApp({
    storageData: {
      'rp_flights':    JSON.stringify([savedFlight]),
      [RESUME_KEY]:    JSON.stringify(resumeView)
    }
  });

  test('TC-RV-001a: reload restores the correct flight (fltNum)', () => {
    assert.equal(app.S.fltNum, 'GTI5678/02');
  });

  test('TC-RV-001b: reload restores activePhase', () => {
    assert.equal(app.S.activePhase, 'cruise');
  });

  test('TC-RV-001c: reload pushes screen-flight onto the nav stack', () => {
    assert.equal(app._navStack[app._navStack.length - 1], 'screen-flight');
  });

  test('TC-RV-001d: reload restores the active flight tab', () => {
    assert.equal(app._getActiveFlightTab(), 'airports');
  });
}

// ── TC-RV-002: Stored view for a missing flight is silently ignored ─────────
{
  const app2 = loadApp({
    storageData: {
      'rp_flights': JSON.stringify([]),      // flight list is empty
      [RESUME_KEY]: JSON.stringify({
        flightId: 'f_gone',
        screen: 'screen-flight',
        tab: 'note',
        phase: 'preflight',
        scrollY: 0
      })
    }
  });

  test('TC-RV-002: missing flight leaves app on Flights list', () => {
    assert.equal(app2._navStack[app2._navStack.length - 1], 'screen-flights');
  });
}

// ── TC-RV-003: Deleting the flight clears the stored resume view ────────────
{
  const flightId = 'f_test_rv3';
  const savedFlight = makeFlightEntry({
    id: flightId,
    fltNum: 'GTI9876/01',
    date: '17 MAR 26',
    state: { fltNum: 'GTI9876/01', date: '17 MAR 26', activePhase: 'preflight' }
  });

  const app3 = loadApp({
    storageData: {
      'rp_flights': JSON.stringify([savedFlight]),
      [RESUME_KEY]: JSON.stringify({
        flightId,
        screen: 'screen-flight',
        tab: 'note',
        phase: 'preflight',
        scrollY: 0
      })
    }
  });

  app3.deleteFlight(flightId);

  test('TC-RV-003: deleting the flight clears rp_resume_view', () => {
    assert.equal(app3.sandbox.localStorage.getItem(RESUME_KEY), null);
  });
}
