'use strict';
// PdfAdapter — Layer 1 of the canonical import engine (ADR-004 §1).
//
// Converts pre-extracted pdf.js items (the *.items.json format produced by
// tools/extract/extract.js) into a Doc understood by the import engine.
//
// Doc shape:
//   { meta:{producer,pageCount,outline},
//     pages:[{n, lines:[{text, y, spans:[{x,str}], columns}]}] }
//
// line.text   — legacy text assembled byte-for-byte as processPDF() in src/pdf.html
//               (YTOL=2, gap→spaces rules unchanged).
// line.columns — array of per-column strings when a genuine side-by-side gap
//               (> 40 % of page width) exists; null otherwise.

const YTOL = 2; // points — must stay in sync with src/pdf.html processPDF()
const COL_GAP_RATIO = 0.4; // gap fraction of page width that triggers column split

// Assemble a left-to-right sorted item list into a single string using
// the same gap-to-spaces rule as processPDF().
function assembleItems(sortedItems) {
  let s = '';
  let prevRight = null;
  for (const item of sortedItems) {
    if (prevRight !== null) {
      const gap = item.x - prevRight;
      s += gap > 20 ? '   ' : gap > 8 ? '  ' : gap > 3 ? ' ' : '';
    }
    s += item.str;
    prevRight = item.x + (item.w || item.str.length * 5);
  }
  return s;
}

// adaptItems — items doc → Doc
// itemsDoc is the object stored in fixtures/items/*.items.json:
//   { meta:{file,pageCount,outline}, pages:[{n,width,height,items:[{str,x,y,w,h}]}] }
function adaptItems(itemsDoc) {
  const pages = itemsDoc.pages.map(pg => {
    const pageWidth = pg.width || 0;

    // 1. Group items into line buckets by Y coordinate (within YTOL tolerance).
    const buckets = [];
    for (const item of pg.items) {
      if (!item.str) continue;
      let bucket = buckets.find(b => Math.abs(b.y - item.y) <= YTOL);
      if (!bucket) {
        bucket = { y: item.y, items: [] };
        buckets.push(bucket);
      }
      bucket.items.push({ x: item.x, str: item.str, w: item.w || 0 });
    }

    // 2. Sort buckets top → bottom.
    buckets.sort((a, b) => a.y - b.y);

    const lines = [];
    for (const bucket of buckets) {
      // 3. Sort items left → right within each line.
      bucket.items.sort((a, b) => a.x - b.x);

      // 4. Assemble legacy text — byte-for-byte as processPDF().
      const text = assembleItems(bucket.items);
      if (!text.trim()) continue; // skip blank lines, same as processPDF()

      // 5. Spans: raw position + string for each item.
      const spans = bucket.items.map(it => ({ x: it.x, str: it.str }));

      // 6. Column detection: split on gaps > COL_GAP_RATIO of page width.
      let columns = null;
      if (pageWidth > 0) {
        const parts = [[]];
        let prevRight = null;
        for (const item of bucket.items) {
          if (prevRight !== null && item.x - prevRight > COL_GAP_RATIO * pageWidth) {
            parts.push([]);
          }
          parts[parts.length - 1].push(item);
          prevRight = item.x + (item.w || item.str.length * 5);
        }
        if (parts.length > 1) {
          columns = parts.map(assembleItems);
        }
      }

      lines.push({ text, y: bucket.y, spans, columns });
    }
    return { n: pg.n, lines };
  });

  return {
    meta: {
      producer: itemsDoc.meta.file || '',
      pageCount: itemsDoc.meta.pageCount,
      outline: itemsDoc.meta.outline || [],
    },
    pages,
  };
}

// Reconstruct the legacy fullText from a Doc (useful for comparing with *.raw.txt).
// Mirrors processPDF(): lines joined with '\n', page break = extra '\n'.
function docToLegacyText(doc) {
  let text = '';
  for (const page of doc.pages) {
    for (const line of page.lines) {
      text += line.text + '\n';
    }
    text += '\n'; // page break
  }
  return text;
}

module.exports = { adaptItems, docToLegacyText, YTOL, COL_GAP_RATIO };
