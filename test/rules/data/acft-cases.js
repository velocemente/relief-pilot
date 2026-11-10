'use strict';
// TC-151 cases: synthetic NOTAM texts (no OFP or fixture content) that exercise every branch of the
// aircraft filter, _acftApplies(), and the taxiway wingspan check, _twyApplies(), of the NOTAM
// ruleset, and the aircraft types they are evaluated for.
//
// acft-expected-v1.11.2.json holds what NOTAM ruleset v1.11.2 (the last version that carried its own
// aircraft table) returned for every case x type, called with the ICAO type string. v1.12.0 gets the
// profile object and getWingspan from the aircraft-profile module and must return the same.
// Regenerate only against that file: node test/rules/data/acft-cases.js <path to notam-rules-v1.11.2.js>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HEAD = '- KXXX A0001/26 01NOV0000-31DEC2359\n';
// [label, body]. The body carries the aircraft qualifier; the runway/taxiway part makes the NOTAM show.
const RWY = 'RWY 09/27 CLSD';
const CASES = [
  // no qualifier (applies to every aircraft)
  ['none',            `${RWY}`],
  // 1. wingspan / width limits
  ['ws-36',           `${RWY} WS 36M`],
  ['ws-max-60',       `${RWY} MAX WS 60M`],
  ['ws-wingspan-52',  `${RWY} WINGSPAN 52M`],
  ['ws-width-36',     `${RWY} WIDTH LTD 36M`],
  ['ws-span-65',      `${RWY} ACFT SPAN 65M`],
  ['ws-decimal',      `${RWY} WS 64.4M`],
  // 2. MTOW
  ['mtow-75t',        `${RWY} MAX MTOW 75000KG`],
  ['mtow-300t',       `${RWY} MTOW 300000KG`],
  ['mtow-lbs',        `${RWY} ACFT OVER 12500 LBS PROHIBITED`],
  // 3. wake category
  ['wake-heavy-only', `${RWY} HEAVY ACFT ONLY`],
  ['wake-heavy-prohib', `${RWY} HEAVY ACFT PROHIBITED`],
  ['wake-light-only', `${RWY} LIGHT ACFT ONLY`],
  ['wake-for-heavy',  `${RWY} FOR HEAVY ACFT`],
  // 4. aerodrome reference code
  ['code-e-f',        `${RWY} CODE E AND F ACFT`],
  ['code-f-only',     `${RWY} CODE F ONLY`],
  ['code-d-e',        `${RWY} CAT D/E ACFT`],
  ['code-a',          `${RWY} CODE A ACFT`],
  // 5. named types
  ['type-b748-prohib', `${RWY} B748 PROHIBITED`],
  ['type-b744-above', `${RWY} B744 AND ABOVE PROHIBITED`],
  ['type-b763-b752-above', `${RWY} B763 B752 AND ABOVE PROHIBITED`],
  ['type-a380-b748-above', `${RWY} A380 B748 AND ABOVE NOT AUTH`],
  ['type-b773-above', `${RWY} B773 AND ABOVE PROHIBITED`],      // B773 is not in the table
  ['type-a344-above', `${RWY} A344 AND ABOVE PROHIBITED`],      // A344 is not in the table
  ['type-b737-smaller', `${RWY} B737 AND SMALLER ONLY`],
  ['type-b722-smaller', `${RWY} B722 AND SMALLER ONLY`],
  ['type-md11-smaller', `${RWY} MD11 AND SMALLER ONLY`],
  ['type-a30b-smaller', `${RWY} A30B AND SMALLER ONLY`],        // A30B is not in the table
  ['type-b744-b748-only', `${RWY} B744 B748 ONLY`],
  ['type-a380-only',  `${RWY} A380 ONLY`],
  ['type-blcf-only',  `${RWY} BLCF ONLY`],
  ['type-b77-prohib', `${RWY} B77W B77L PROHIBITED`],
  ['type-disregard',  `${RWY} DISREGARD RESTRICTION FOR B744`],
  ['type-mention-only', `${RWY} B744 DEPARTURES EXPECT DELAY`],
  // 6. turbine
  ['jet-prohib',      `${RWY} JET ACFT PROHIBITED`],
  ['prop-only',       `${RWY} PROP ACFT ONLY`],
  // taxiway checks (_twyApplies): the wingspan limit read there, and the named-type list
  ['twy-closed',      'TWY E CLSD'],
  ['twy-ws-greater-40', 'TWY B RESTRICTED WINGSPAN GREATER THAN 40M'],
  ['twy-ws-more-65',  'TWY B RESTRICTED WINGSPAN MORE THAN 65M'],
  ['twy-ws-52',       'TWY C WINGSPAN RESTRICTED 52M'],
  ['twy-restr-plain', 'TWY D RESTRICTED'],
  ['twy-type-list',   'TWY F RESTRICTED TO B737 TYPE AND BELOW'],
];
const CASE_TEXT = CASES.map(([, body]) => HEAD + body + '\n');
// Table keys at the time of recording, plus unknown / odd inputs.
const EXTRA_TYPES = ['', 'ZZZZ', 'B773', 'A30B', 'A344', 'b744', 'B744F', 'UNKN'];
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// What one call returned, as a short signature.
const sig = r => JSON.stringify(r.issues.map(i => [i.slot, i.level, i.label]));

// All results of one evaluator: { acftApplies: [row per case], eval: { ORIG: [...], DEST: [...] } }, a row
// being { default, except: { type: value } }: the most common value, and the types that differ.
function compress(values) {          // values: { type: string }
  const count = new Map();
  for (const v of Object.values(values)) count.set(v, (count.get(v) || 0) + 1);
  const dflt = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const except = {};
  for (const [t, v] of Object.entries(values)) if (v !== dflt) except[t] = v;
  return { default: dflt, except };
}
function record(types, acftApplies, evalAt) {
  const out = { acftApplies: [], eval: { ORIG: [], DEST: [] } };
  CASE_TEXT.forEach((text, i) => {
    const a = {};
    for (const t of types) a[t] = String(acftApplies(text, t));
    out.acftApplies.push(compress(a));
    for (const role of ['ORIG', 'DEST']) {
      const e = {};
      for (const t of types) e[t] = sig(evalAt(text, role, t));
      out.eval[role].push(compress(e));
    }
  });
  return out;
}
function expand(row, types) {
  const out = {};
  for (const t of types) out[t] = Object.prototype.hasOwnProperty.call(row.except, t) ? row.except[t] : row.default;
  return out;
}

module.exports = { CASES, CASE_TEXT, EXTRA_TYPES, sig, record, expand, sha };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node acft-cases.js <path to notam-rules-v1.11.2.js>'); process.exit(2); }
  const src = fs.readFileSync(file);
  const old = require(path.resolve(file));
  if (old.RULESET_VERSION !== '1.11.2') { console.error('not v1.11.2'); process.exit(2); }
  // the table of v1.11.2: its own buildAcftProfile of every key (the module exports it)
  const keys = [];
  const re = /^  ([A-Z0-9]{2,4}):\s*\{ ws:/gm; let m;
  while ((m = re.exec(src.toString('utf8')))) keys.push(m[1]);
  const types = [...keys, ...EXTRA_TYPES];
  const rec = record(types,
    (text, t) => old._acftApplies(text, t),
    (text, role, t) => old.evalNotams([text], role, 600, t, '2026-11-09', 480));
  fs.writeFileSync(path.join(__dirname, 'acft-expected-v1.11.2.json'), JSON.stringify({
    recordedFrom: { file: 'rules/notam-rules/notam-rules-v1.11.2.js', sha256: sha(src) },
    call: "_acftApplies(text, typeString); evalNotams([text], role, 600, typeString, '2026-11-09', 480)",
    cases: CASES.map(([l]) => l), types, ...rec,
  }, null, 1) + '\n');
  console.log(`recorded ${CASES.length} cases x ${types.length} types`);
}
