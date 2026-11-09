'use strict';
/*
 * rules/ against rules/manifest.json (ADR-005 §2.5): build/check-rules.js, run by CI as its own
 * step, and by build/build.js before it builds a module into index.html.
 *
 *   positive: the repository's rules/ matches; the CLI exits 0
 *   negative: one byte changed, an unlisted module file, a listed file missing, a bad manifest
 *             → the check fails and the build refuses to assemble index.html
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkRules } = require('../../build/check-rules');
const { assemble } = require('../../build/build');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'manifest.json'), 'utf8'));
const MOD_REL = MANIFEST['notam-rules'].file;

// A throw-away copy of rules/ and src/ (what the build reads).
function withCopy(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-rules-'));
  try {
    fs.cpSync(path.join(ROOT, 'rules'), path.join(tmp, 'rules'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('rules/ matches rules/manifest.json; the CLI exits 0; the copy builds the same index.html', () => {
  const r = checkRules(ROOT);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.modules.map(m => m.file), Object.values(MANIFEST).map(e => e.file));
  assert.ok(r.modules.some(m => m.file === MOD_REL), 'the NOTAM module is listed');
  assert.ok(r.modules.some(m => m.file === MANIFEST['ofp-navblue'].file), 'the NavBlue parser module is listed');
  assert.ok(r.documents.every(d => d.endsWith('.md')), 'only Markdown documents are unlisted');
  const cli = spawnSync(process.execPath, [path.join(ROOT, 'build', 'check-rules.js')], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  withCopy(tmp => {
    assert.equal(checkRules(tmp).ok, true);
    assert.ok(assemble(tmp).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'same bytes as the committed index.html');
  });
});

test('negative: one byte of the module changed → hash mismatch, and the build refuses', () => {
  withCopy(tmp => {
    const f = path.join(tmp, 'rules', MOD_REL);
    const buf = fs.readFileSync(f);
    buf[buf.length - 2] = buf[buf.length - 2] === 0x3b ? 0x20 : 0x3b;   // the final ";" of "});"
    fs.writeFileSync(f, buf);
    const r = checkRules(tmp);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes(MOD_REL) && e.includes('does not match the manifest')), r.errors.join('\n'));
    assert.throws(() => assemble(tmp), /does not match rules\/manifest\.json/);
  });
});

test('negative: an unlisted module file in rules/ fails the check', () => {
  withCopy(tmp => {
    fs.writeFileSync(path.join(tmp, 'rules', 'notam-rules', 'notam-rules-v9.9.9.js'), '/* not listed */\n');
    const r = checkRules(tmp);
    assert.equal(r.ok, false);
    assert.ok(r.errors.includes('rules/notam-rules/notam-rules-v9.9.9.js is not listed in rules/manifest.json'), r.errors.join('\n'));
    assert.throws(() => assemble(tmp));
  });
});

test('negative: a listed module file that is missing, or an unreadable manifest, fails the check', () => {
  withCopy(tmp => {
    fs.rmSync(path.join(tmp, 'rules', MOD_REL));
    const r = checkRules(tmp);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes(`rules/${MOD_REL} is listed but missing`)), r.errors.join('\n'));
  });
  withCopy(tmp => {
    fs.writeFileSync(path.join(tmp, 'rules', 'manifest.json'), '{ not json');
    const r = checkRules(tmp);
    assert.equal(r.ok, false);
    assert.ok(r.errors[0].startsWith('rules/manifest.json cannot be read'));
  });
  withCopy(tmp => {
    const m = JSON.parse(fs.readFileSync(path.join(tmp, 'rules', 'manifest.json'), 'utf8'));
    delete m['notam-rules'].sha256;
    fs.writeFileSync(path.join(tmp, 'rules', 'manifest.json'), JSON.stringify(m));
    const r = checkRules(tmp);
    assert.equal(r.ok, false);
    assert.ok(r.errors.includes('notam-rules: manifest entry needs file, version and sha256'));
  });
});
