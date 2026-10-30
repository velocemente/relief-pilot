'use strict';
/**
 * TC-110 — OFP remarks parsing delimiter pair fix (DEF-B)
 *
 * Covers:
 *   extractAptOpsNotes() correctly processes delimiter (open, close) pairs
 *   and constrains extraction to each Flight Plan's Remarks section.
 *
 * TC-110-010  Remarks section is properly bounded from ^Remarks$ to stopping pattern
 * TC-110-011  Delimiter pairs (0-1, 2-3, 4-5...) are processed; gaps ignored
 * TC-110-012  Closing delimiter line is excluded from body
 * TC-110-SYNTH CAT line after closing delimiter → no remarks for that airport
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const app = loadApp();
const _ofpRulesetParse = app._ofpRulesetParse;

// ── TC-110-010: Remarks section boundaries ─────────────────────────────────
test('TC-110-010: Remarks section properly bounded by stopping patterns', () => {
  // Remarks section should terminate at RAIM VALIDATION pattern
  const ofp = `N999AA KJFK - EGLL 01 MAY 26 N407KZ
B747-400F

ORIG KJFK/ABC 0300Z
DEST EGLL/DEF 0730Z

Remarks
----------
KJFK Operations
Special handling required
----------
RAIM VALIDATION AVAILABLE AT DESTINATION
Other section that should not be parsed`;

  const result = _ofpRulesetParse(ofp);
  assert.ok(result, 'should parse OFP');
  assert.ok(result.airportData['KJFK'], 'should have KJFK airport data');
  assert.ok(result.airportData['KJFK'].opsNotes, 'should have opsNotes for KJFK');
  assert.ok(result.airportData['KJFK'].opsNotes.body.includes('Special'), 'body should contain remark content');
});

// ── TC-110-011: Delimiter pairs, not consecutive ─────────────────────────────
test('TC-110-011: Delimiter pairs processed (0-1, 2-3); gaps not included', () => {
  // Pair 0: KDFW release notes
  // Gap: CAT II AUTHORIZATION (should NOT be in remarks)
  // Pair 1: KSEA crew notes
  const ofp = `N555AA KDFW - KSEA 02 MAY 26 N501KZ
B747-400F

ORIG KDFW/ABC 0500Z
DEST KSEA/DEF 0830Z

Remarks
----------
KDFW Release Notes
Special departure procedures in effect
----------
CAT II AUTHORIZATION FOR KSEA WITH STANDARD MINIMUMS
This should NOT be in remarks
----------
KSEA Crew Requirements
All crew briefed on procedures
----------
END OF REMARKS SECTION`;

  const result = _ofpRulesetParse(ofp);
  assert.ok(result, 'should parse OFP');

  // KDFW should have remarks from first pair only
  assert.ok(result.airportData['KDFW'].opsNotes, 'KDFW should have opsNotes');
  const kdfw = result.airportData['KDFW'].opsNotes.body;
  assert.ok(kdfw.includes('departure'), 'KDFW notes should contain "departure"');
  assert.ok(!kdfw.includes('CAT II'), 'KDFW notes should NOT contain CAT II from gap');

  // KSEA should have remarks from second pair only
  assert.ok(result.airportData['KSEA'].opsNotes, 'KSEA should have opsNotes');
  const ksea = result.airportData['KSEA'].opsNotes.body;
  assert.ok(ksea.toLowerCase().includes('crew') || ksea.includes('briefed'), 'KSEA notes should contain crew content');
  assert.ok(!ksea.includes('CAT II'), 'KSEA notes should NOT contain CAT II from gap');
});

// ── TC-110-012: Closing delimiter excluded from body ───────────────────────
test('TC-110-012: Closing delimiter line excluded from body', () => {
  const ofp = `N777AA KORD - CYYZ 03 MAY 26 N502KZ
B747-400F

ORIG KORD/ABC 0600Z
DEST CYYZ/DEF 0900Z

Remarks
----------
KORD Alternate Requirements
MEL EXEMPT PER FCA
----------
AUTHORIZED CAT II APPROACHES ONLY
Other non-remarks content`;

  const result = _ofpRulesetParse(ofp);
  assert.ok(result, 'should parse OFP');
  assert.ok(result.airportData['KORD'].opsNotes, 'KORD should have opsNotes');

  const body = result.airportData['KORD'].opsNotes.body;
  assert.ok(body.includes('MEL'), 'body should contain remarks content');
  assert.ok(!body.includes('AUTHORIZED CAT'), 'body should not include content after closing delimiter');
});

// ── TC-110-SYNTH: CAT line after closing delimiter ─────────────────────────
test('TC-110-SYNTH: CAT line after closing delimiter → no remarks for that airport', () => {
  // After the closing delimiter, a CAT authorization line appears.
  // This should NOT create remarks for EGLL (no open delimiter before it).
  const ofp = `N888AA LIRF - EGLL 04 MAY 26 N503KZ
B747-400F

ORIG LIRF/ABC 0700Z
DEST EGLL/DEF 0900Z

Remarks
----------
LIRF Ground Handling
Special equipment required
----------
AUTHORIZED CAT II/III APPROACHES AT EGLL WITH LOW VISIBILITY PROCEDURES
This section is NOT paired with delimiters`;

  const result = _ofpRulesetParse(ofp);
  assert.ok(result, 'should parse OFP');

  // LIRF should have remarks from the paired block
  assert.ok(result.airportData['LIRF'].opsNotes, 'LIRF should have opsNotes');
  assert.ok(result.airportData['LIRF'].opsNotes.body.toLowerCase().includes('ground') || result.airportData['LIRF'].opsNotes.body.includes('equipment'), 'LIRF notes should contain correct content');

  // EGLL should NOT have remarks from the unpaired CAT section
  // (it appears after the closing delimiter without an opening delimiter before it)
  if (result.airportData['EGLL']) {
    assert.ok(!result.airportData['EGLL'].opsNotes, 'EGLL should NOT have opsNotes from unpaired CAT section');
  }
});
