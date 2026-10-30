#!/usr/bin/env node
// Re-extracts every PDF in <fixtures>/pdf and checks the result against the
// committed <fixtures>/text/*.raw.txt byte-for-byte (the contract), and
// <fixtures>/items/*.items.json (ignoring meta.file, the original upload name).
//
// Each PDF is extracted in its own process: pdf.js numbers fonts per document
// loaded in a process (g_d0_*, g_d1_*, ...), so the committed items were made
// one process per file and only reproduce that way.
//
// Usage: node tools/extract/verify.js <fixtures-dir>
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('usage: verify.js <fixtures-dir>'); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-verify-'));
const pdfs = fs.readdirSync(path.join(dir, 'pdf')).filter(f => /\.pdf$/i.test(f)).sort();
let bad = 0;
for (const f of pdfs) {
  const base = f.replace(/\.pdf$/i, '');
  execFileSync(process.execPath, [path.join(__dirname, 'extract.js'), path.join(dir, 'pdf', f), tmp], { stdio: 'ignore' });
  const gotText = fs.readFileSync(path.join(tmp, base + '.raw.txt'));
  const wantText = fs.readFileSync(path.join(dir, 'text', base + '.raw.txt'));
  const got = JSON.parse(fs.readFileSync(path.join(tmp, base + '.items.json'), 'utf8'));
  const want = JSON.parse(fs.readFileSync(path.join(dir, 'items', base + '.items.json'), 'utf8'));
  got.meta.file = want.meta.file;
  const textOk = gotText.equals(wantText);
  const itemsOk = JSON.stringify(got) === JSON.stringify(want);
  if (!textOk || !itemsOk) bad++;
  console.log(`${textOk ? 'OK  ' : 'FAIL'} text  ${itemsOk ? 'OK  ' : 'DIFF'} items  ${base}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `\n${bad} of ${pdfs.length} differ` : `\nall ${pdfs.length} reproduce (text byte-for-byte, items identical)`);
process.exit(bad ? 1 : 0);
