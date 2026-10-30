#!/usr/bin/env node
// Reproduces index.html's processPDF() text assembly using pdfjs-dist@3.11.174.
//
// The getTextContent loop below is a deliberate copy of the one in index.html
// (processPDF). If that routine changes, change this one too and re-verify with
//   node tools/extract/verify.js <fixtures-dir>
//
// Usage: node tools/extract/extract.js <file.pdf> [outDir]
// Writes <name>.raw.txt and <name>.items.json into outDir (default: cwd).
'use strict';
const fs = require('fs');
const path = require('path');

const PDFJS_VERSION = '3.11.174';

async function loadPdfjs() {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  if (pdfjs.version !== PDFJS_VERSION) {
    throw new Error(`pdfjs-dist ${pdfjs.version} loaded, expected ${PDFJS_VERSION}`);
  }
  return pdfjs;
}

// Returns { rawText, items } for one PDF buffer.
async function extractPdf(buf, fileName) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  let fullText = '';
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });

    // ── copy of index.html processPDF() ─────────────────────────────
    const YTOL = 2; // points
    const lines = [];

    tc.items.forEach(item => {
      if (!item.str) return;
      const y = vp.height - item.transform[5];
      const x = item.transform[4];
      let bucket = lines.find(l => Math.abs(l.y - y) <= YTOL);
      if (!bucket) {
        bucket = { y, items: [] };
        lines.push(bucket);
      }
      bucket.items.push({ x, str: item.str, w: item.width || 0 });
    });

    lines.sort((a, b) => a.y - b.y);

    lines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);
      let lineStr = '';
      let prevRight = null;
      line.items.forEach(item => {
        if (prevRight !== null) {
          const gap = item.x - prevRight;
          const spaces = gap > 20 ? '   ' : gap > 8 ? '  ' : gap > 3 ? ' ' : '';
          lineStr += spaces;
        }
        lineStr += item.str;
        prevRight = item.x + (item.w || item.str.length * 5);
      });
      if (lineStr.trim()) fullText += lineStr + '\n';
    });
    fullText += '\n'; // page break
    // ── end copy ────────────────────────────────────────────────────

    // Per-page positional items (document order, non-empty str only).
    pages.push({
      n: i,
      width: vp.width,
      height: vp.height,
      items: tc.items.filter(it => it.str).map(it => ({
        str: it.str,
        x: it.transform[4],
        y: vp.height - it.transform[5],
        w: it.width,
        h: it.height,
        font: it.fontName,
      })),
    });
  }

  let outline = [];
  try {
    const o = await pdf.getOutline();
    if (o) outline = o.map(n => n.title);
  } catch (_) { /* no outline */ }

  const items = { meta: { file: fileName, pageCount: pdf.numPages, outline }, pages };
  return { rawText: fullText, items };
}

async function main() {
  const [file, outDir = '.'] = process.argv.slice(2);
  if (!file) {
    console.error('usage: extract.js <file.pdf> [outDir]');
    process.exit(2);
  }
  const base = path.basename(file).replace(/\.pdf$/i, '');
  const { rawText, items } = await extractPdf(fs.readFileSync(file), path.basename(file));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, base + '.raw.txt'), rawText);
  fs.writeFileSync(path.join(outDir, base + '.items.json'), JSON.stringify(items));
  console.log(`${base}: ${items.meta.pageCount} pages, ${rawText.length} chars`);
}

module.exports = { extractPdf };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
