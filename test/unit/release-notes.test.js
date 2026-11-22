'use strict';
/**
 * TC-178-030 — step 5e-3 release: the 1.10.0 section of RELEASE_NOTES.md (newest first, on top) is crew language. No internal
 * reference (D-, O-, SME-, CS-, package or step numbers), no crew name or number. (Before the release these notes were a
 * draft file; the draft is gone and the tests read RELEASE_NOTES.md.)
 * TC-178-031: the sections and exactly six known limits as agreed; the section is the newest and the labels say 1.10.0.
 * TC-178-033: the notes carry no forward-looking promise (a Planned heading, "coming soon", "future release", "will be shown").
 * TC-178-034: the Exec's wording of the release (window, hidden obstacle height, type headings, unclear cases, display as built).
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');

const ROOT  = path.resolve(__dirname, '..', '..');
const ALL   = fs.readFileSync(path.join(ROOT, 'RELEASE_NOTES.md'), 'utf8');
// the 1.10.0 section: from its heading to the next release heading
const START = ALL.indexOf('# PilotBrief 1.10.0 Release Notes');
const NOTES = START < 0 ? '' : ALL.slice(START).split(/\n(?=# PilotBrief )/)[0];

test('TC-178-030 release notes: no internal reference (D-, O-, SME-, CS-, package or step numbers)', () => {
  assert.ok(NOTES.length > 0, 'the 1.10.0 section exists in RELEASE_NOTES.md');
  const bad = NOTES.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) =>
    /\b(?:D|O|SME|CS)-?\d+[a-z]?\b/.test(l) || /\b(?:package|step|sub-package)\s+\d/i.test(l) || /\b5[efg](?:-\d)?\b/.test(l));
  assert.deepEqual(bad, []);
});

test('TC-178-031 release notes: sections and known limits as agreed, no planned items; newest section; labels 1.10.0', () => {
  for (const h of ['## What\'s New', '## NOTAMs', '## FlightKeys', '## Display', '## Saved Flights', '## Known Limits'])
    assert.ok(NOTES.includes(h), h);
  const limits = NOTES.split('## Known Limits')[1].split('\n').filter(l => l.startsWith('- '));
  assert.equal(limits.length, 6);
  assert.ok(!/^#+\s*planned\b/im.test(NOTES), 'no Planned heading (Exec)');
  assert.ok(!/coming soon|future release|will be shown/i.test(NOTES), 'no forward-looking promise (Exec)');
  assert.ok(/^# PilotBrief 1\.10\.0 Release Notes/.test(NOTES) && !/DRAFT/.test(NOTES), 'a release section, not a draft');
  // newest first: 1.10.0 is the first heading of the file, the previous release follows it
  assert.equal(ALL.indexOf('# PilotBrief '), START);
  assert.equal(START, 0);
  assert.ok(ALL.indexOf('# PilotBrief 1.9.9-hf6 Release Notes') > START, 'the previous release is kept, below');
  // the draft file is gone
  assert.ok(!fs.existsSync(path.join(ROOT, 'docs', 'release', '1.10.0-draft.md')), 'the draft file is deleted');
  // the three labels say 1.10.0 (TC-176-090 pins the exact lines)
  assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /const APP_VERSION = '1\.10\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
});

test('TC-178-032 the scan bites: an internal reference in the text is found', () => {
  const scan = t => /\b(?:D|O|SME|CS)-?\d+[a-z]?\b/.test(t);
  for (const s of ['see D57', 'O-68 gate', 'SME-3', 'CS-1']) assert.ok(scan(s), s);
  assert.ok(!scan('FL340–400 and B747 and TMI 307'));
});

test('TC-178-033 the forward-looking scan bites; ordinary words do not trip it', () => {
  const scan = t => /^#+\s*planned\b/im.test(t) || /coming soon|future release|will be shown/i.test(t);
  for (const s of ['## Planned\n- x', 'Coming soon: x', 'in a future release', 'it will be shown']) assert.ok(scan(s), s);
  for (const s of ['planned fuel', 'unplanned stop', 'The planned route is shown']) assert.ok(!scan(s), s);
});

test('TC-178-034 release notes carry the Exec\'s wording; the superseded wording is gone', () => {
  const has = s => NOTES.includes(s);
  // NOTAMs
  assert.ok(has("against the airport's time window for its role in the flight"));
  assert.ok(!/ETA\s*(?:\+\/-|±)\s*60/.test(NOTES), 'no fixed ETA window in the 1.10.0 notes');
  assert.ok(has('an obstacle height near a runway that affects no procedure'));
  assert.ok(!has('or procedure with no stated effect') && !has('a height near a runway or procedure'));
  assert.ok(!has('A heading can no longer hide a NOTAM.'));
  assert.ok(has('Unclear cases are shown, on the safe side,') && has('for example an obstacle notice near a runway that says obstacle clearance is not affected but not whether the take-off side is.'));
  assert.ok(!has('One unclear case is shown'));
  // Display, as built
  assert.ok(has('OFP Alerts are in NOTES, below the airport status rows'));
  assert.ok(has('in the OFP Remarks group, below DDG in NOTES'));
  assert.ok(has('open when the Dispatch contact is REQUIRED or a security message is present'));
  assert.ok(has('Each card shows Weather, then NOTAMS, as printed in the briefing'));
  assert.ok(has('Company Remarks is collapsed too: tap it to open. A departure CAT II/III restriction is inside Company Remarks.'));
  assert.ok(has('The chevron on the airport ID row opens or closes all groups of the card.'));
  assert.ok(has("TMI row of the message it names"));
  // the old display text is gone
  assert.ok(!has('under Departure') && !has('top of the Preflight card') && !has('RAW NOTAMs and RAW Weather'));
});
