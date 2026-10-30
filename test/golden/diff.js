'use strict';
// Field-level diff of two normalized JSON values. Returns lines like
//   result.crewMembers[1]: "A B" -> "A C"
//   result.slotTime: (added) "1530"
//   result.hasPerishables: (removed) true
function show(v) {
  const s = JSON.stringify(v);
  return s === undefined ? 'undefined' : s.length > 160 ? s.slice(0, 157) + '...' : s;
}
const isObj = v => v !== null && typeof v === 'object';

function diff(a, b, p = '', out = []) {
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a)) {
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (i >= a.length) out.push(`${p}[${i}]: (added) ${show(b[i])}`);
        else if (i >= b.length) out.push(`${p}[${i}]: (removed) ${show(a[i])}`);
        else diff(a[i], b[i], `${p}[${i}]`, out);
      }
    } else {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of [...keys].sort()) {
        const q = p ? `${p}.${k}` : k;
        if (!(k in a)) out.push(`${q}: (added) ${show(b[k])}`);
        else if (!(k in b)) out.push(`${q}: (removed) ${show(a[k])}`);
        else diff(a[k], b[k], q, out);
      }
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push(`${p || '(root)'}: ${show(a)} -> ${show(b)}`);
  }
  return out;
}

module.exports = { diff };
