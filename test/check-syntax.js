#!/usr/bin/env node
// node --check on every inline <script> of index.html, and on sw.js.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { inlineScripts, INDEX_HTML } = require('./harness');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-syntax-'));
let bad = 0;
const check = (label, file) => {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`ok    ${label}`);
  } catch (e) {
    bad++;
    console.log(`FAIL  ${label}\n${String(e.stderr || e.message).trim()}\n`);
  }
};

inlineScripts(fs.readFileSync(INDEX_HTML, 'utf8')).forEach((src, i) => {
  const f = path.join(tmp, `inline-${i + 1}.js`);
  fs.writeFileSync(f, src);
  check(`index.html inline script ${i + 1} (${src.split('\n').length} lines)`, f);
});
check('sw.js', path.join(root, 'sw.js'));
JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); console.log('ok    manifest.json');
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
