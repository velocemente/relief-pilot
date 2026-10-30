'use strict';
// Turns a parser result into plain JSON-safe data, deterministically.
// Values come from a vm context, so type checks use Object.prototype.toString
// rather than instanceof. Keys are sorted; non-JSON values are tagged so a
// change from "" to undefined (or a NaN appearing) shows up as a diff.
function normalize(v) {
  if (v === undefined) return '$undefined';
  if (v === null) return null;
  const t = typeof v;
  if (t === 'number') {
    if (Number.isNaN(v)) return '$NaN';
    if (v === Infinity) return '$Infinity';
    if (v === -Infinity) return '$-Infinity';
    return v;
  }
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'bigint') return `$bigint:${v}`;
  if (t === 'function') return '$function';
  if (t === 'symbol') return `$symbol:${String(v)}`;
  const tag = Object.prototype.toString.call(v);
  if (Array.isArray(v)) return v.map(normalize);
  if (tag === '[object Map]') return { $map: [...v].map(([k, x]) => [normalize(k), normalize(x)]) };
  if (tag === '[object Set]') return { $set: [...v].map(normalize) };
  if (tag === '[object Date]') return { $date: Number.isNaN(v.getTime()) ? 'Invalid' : v.toISOString() };
  if (tag === '[object RegExp]') return { $regexp: String(v) };
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = normalize(v[k]);
  return out;
}

function stringify(v) {
  return JSON.stringify(normalize(v), null, 2) + '\n';
}

module.exports = { normalize, stringify };
