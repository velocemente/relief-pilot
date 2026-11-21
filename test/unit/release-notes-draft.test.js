'use strict';
/**
 * TC-178-030 — step 5e-3: the draft release notes docs/release/1.10.0-draft.md are crew language. No internal
 * reference (D-, O-, SME-, CS-, package or step numbers), no crew name or number; the file is a draft only:
 * RELEASE_NOTES.md, the labels and the app are not changed by it (labels: TC-176-090 / TC-177-041).
 * TC-178-033: the notes carry no forward-looking promise (a Planned heading, "coming soon", "future release", "will be shown").
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');

const ROOT  = path.resolve(__dirname, '..', '..');
const DRAFT = fs.readFileSync(path.join(ROOT, 'docs', 'release', '1.10.0-draft.md'), 'utf8');

test('TC-178-030 draft notes: no internal reference (D-, O-, SME-, CS-, package or step numbers)', () => {
  const bad = DRAFT.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) =>
    /\b(?:D|O|SME|CS)-?\d+[a-z]?\b/.test(l) || /\b(?:package|step|sub-package)\s+\d/i.test(l) || /\b5[efg](?:-\d)?\b/.test(l));
  assert.deepEqual(bad, []);
});

test('TC-178-031 draft notes: the sections and the known limits as agreed, no planned items; a draft, not linked to the label', () => {
  for (const h of ['## What\'s New', '## NOTAMs', '## FlightKeys', '## Display', '## Saved Flights', '## Known Limits'])
    assert.ok(DRAFT.includes(h), h);
  const limits = DRAFT.split('## Known Limits')[1].split('\n').filter(l => l.startsWith('- '));
  assert.equal(limits.length, 6);
  assert.ok(!/^#+\s*planned\b/im.test(DRAFT), 'no Planned heading (Exec)');
  assert.ok(!/coming soon|future release|will be shown/i.test(DRAFT), 'no forward-looking promise (Exec)');
  assert.ok(/^# PilotBrief 1\.10\.0 Release Notes/.test(DRAFT) && /DRAFT/.test(DRAFT));
  // NEGATIVE: the live notes and the labels do not mention 1.10.0 yet
  assert.ok(!/1\.10\.0/.test(fs.readFileSync(path.join(ROOT, 'RELEASE_NOTES.md'), 'utf8')));
  for (const f of ['index.html', 'sw.js', 'manifest.json']) assert.ok(!/1\.10\.0/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
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
