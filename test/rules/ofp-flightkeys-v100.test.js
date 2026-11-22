'use strict';
/**
 * TC-164 — FlightKeys OFP parser v1.0.0 (rules/ofp-flightkeys; step 5e-1 PR 1, Exec answers O-74 … O-85):
 * the module only, NOT built into the app (O-74). New in v1.0.0: the filed NAT letter is worked out before
 * the NAT call, the NAT ruleset is called with { filed, findings } and its findings are forwarded into
 * findings[] (O-68, module side); the deferred-field INFO is version-free (O-84).
 *
 *   TC-164-001  identity: type, format, version 1.0.0, schema 2, contract 2.4; manifest entry, file and SHA-256;
 *               the v0.4.0 file is no longer in rules/; the frozen copy in test/oracle/ is the v0.4.0 master
 *               (SHA-256 c4ccb8c4…); a changed byte is caught by the manifest check (negative)
 *   TC-164-002  built in by the switch PR (step 5e-1; was "not built in", O-74): once, byte for byte, called only by
 *               the router in src/ofp-parse.html;
 *               APP_VERSION, CACHE_NAME and manifest.json version are 1.10.0 (release)
 *   TC-164-003  validateSchema(): valid; broken objects rejected
 *   TC-164-010  O-68: the NAT call gets { filed, findings }; the letter is known at the call; the probe call has
 *               no options; the NAT findings are forwarded as given, after the D74 WARN and before the natTrack
 *               INFO; no NAT pages → no call; a NAT parser that ignores the options (v1.1.0) still gets the
 *               letter set and the track marked (negative)
 *   TC-164-011  D79 (synthetic): the filed letter absent from the message → WARN NAT-FILED-NOT-IN-MESSAGE in
 *               findings[], exact text, nothing marked; the letter present → no such WARN, the track marked
 *   TC-164-012  D81 (synthetic): no filed letter → INFO NAT-RANDOM-ROUTE, nothing marked; a filed letter → none
 *   TC-164-013  findings shape: { level, field, message } for the parser's own, { level, field, code, message }
 *               for the forwarded NAT findings (field natTrack, code in the NAT ruleset's closed list, level =
 *               the code's level); synthetic and all 26
 *   TC-164-014  D74 kept: OFP page 1 and FPL letters differ → the crew-alert WARN once, the FPL letter marked;
 *               they agree → no WARN (negative)
 *   TC-164-015  notamRules not supplied → the existing WARN (O-18 is the app's, PR 2); supplied → none
 *   TC-164-016  O-80 text only (no positions) → WARN "read from text only", release data still read;
 *               positions supplied → no such WARN
 *   TC-164-017  O-84: the deferred INFO is version-free ("not read: not in any brief yet (open item)"); no
 *               finding names a version
 *   TC-164-020  all 26 vs v0.4.0 (test/oracle copy) with the app's NAT parser v1.1.0 (the app today): equal
 *               except natTrack on L08, L11, L12, L22, L23 and findings — the O-84 text on 26 and the INFO
 *               NAT-RANDOM-ROUTE on L08, L12, L22, L23; vs v0.4.0 with NAT v1.2.0 (3 arguments): natTrack equal
 *               on all 26, the same findings changes
 *   TC-164-021  pinned values on all 26 (fixtures expected/ofp-flightkeys-v1.0.0/nat.json): natTrack hashes,
 *               the filed letter and marked track, the forwarded NAT findings; no NAT-FILED-NOT-IN-MESSAGE
 *   TC-164-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Synthetic packages use invented identifiers (KAAA, EDDA, AAAAA …); the builder is copied unchanged from
 * TC-163 (test/rules/ofp-flightkeys-v040.test.js). Fixture tests assert counts, package labels, codes and
 * hashes; the fixture values themselves are in the private fixtures repo. No fixture text is printed here.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const vm     = require('vm');
const { findFixtures, readManifest } = require('../lib/app-path');
const { MODULES } = require('../../build/build');
const { checkRules } = require('../../build/check-rules');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
// Step 5e-2 (O-116): v1.0.1 replaced v1.0.0 in the app. These tests pin v1.0.0 on its frozen copy (test/oracle);
// TC-175-010 shows v1.0.1 = v1.0.0 on all 26 except the finding texts (O-100).
const MOD_FILE = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.0.js');
const V100_SHA = '8a7d3e8fbf02ebae421739dfd65f8598d47e4d016ae1e7a3a2a791389e548e40';   // v1.0.0 (#68), frozen
const BUILT_IN = fs.readFileSync(path.join(RULES, MANIFEST['ofp-flightkeys'].file), 'utf8');   // v1.0.1 (O-116)
const MOD_SRC  = fs.readFileSync(MOD_FILE, 'utf8');
const mod      = require(MOD_FILE);
const ORACLE   = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v0.4.0.js');
const V04_SHA  = 'c4ccb8c4656aed7ba8dbeaf81a67e7d7037541b6dd78bfd82223663a1a1afb6f';   // the v0.4.0 master (#66), frozen
const v04      = require(ORACLE);
const nat      = require(path.join(RULES, MANIFEST['nat-rules'].file));         // v1.2.0 (D77; built in at step 5e-1)
const icaoFpl  = require(path.join(RULES, MANIFEST['icao-fpl'].file));
const acProf   = require(path.join(RULES, MANIFEST['aircraft-profile'].file));
const NR       = require(path.join(RULES, MANIFEST['notam-rules'].file));       // v1.14.0 since step 5e-1 (the parser's splitter; same output as v1.13.0, TC-174-012)
const EXPECTED_FILE = path.join('expected', 'ofp-flightkeys-v1.0.0', 'nat.json');

// The app's NAT parser v1.1.0 before step 5e-1 (src/nat.html then; frozen copy test/oracle/nat-v1.1.0.html, O-79).
const appWin = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'nat-v1.1.0.html'), 'utf8'), { window: appWin });
const v11 = appWin.parseNatTrack;

const OPTS     = { icaoFpl, aircraftProfile: acProf, notamRules: NR, parseNatTrack: nat.parseNatTrack };
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const warns    = (r, re) => r.findings.filter(f => f.level === 'WARN' && (!re || re.test(f.field)));
const infos    = (r, re) => r.findings.filter(f => f.level === 'INFO' && (!re || re.test(f.field)));
const coded    = (r, code) => r.findings.filter(f => f.code === code);
const marked   = r => (r.natTrack ? r.natTrack.blocks.flatMap(b => b.tracks.filter(t => t.assigned).map(t => t.id)) : []);
const OWN_KEYS = ['level', 'field', 'message'], NAT_KEYS = ['level', 'field', 'code', 'message'];
const DEFERRED_TEXT = 'not read: not in any brief yet (open item)';

// ══ synthetic packages (invented identifiers; positions as FlightKeys prints them) ═════════════
const W = 841.889, H = 595.275, CW = 4.8, LX = 30.346, RX = 430.031;
function lineItems(col, y, text) {
  const x0 = col === 'R' ? RX : LX, items = [], re = /\S+(?: \S+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) items.push({ str: m[0], x: x0 + m.index * CW, y, w: m[0].length * CW, h: 8, font: 'f8' });
  return items;
}
const HDR_TEXT = 'TST0001 / KAAA - KBBB / 2026-11-03 / N000ZZ';
function briefPage(n, N, uuid, cols) {
  const items = [{ str: HDR_TEXT, x: 28.346, y: 19.877, w: HDR_TEXT.length * CW, h: 8, font: 'f6' },
    { str: '2026-Nov-03 08:17', x: 747.2, y: 19.877, w: 81.6, h: 8, font: 'f6' }];
  for (const col of ['L', 'R']) (cols[col] || []).forEach((t, k) => items.push(...lineItems(col, 35.034 + k * 9.6, t)));
  items.push({ str: `Page ${n} of ${N}`, x: 28.346, y: 579.398, w: 52.8, h: 8, font: 'f6' }, { str: uuid, x: 640, y: 579.398, w: 172.8, h: 8, font: 'f6' });
  return { width: W, height: H, items };
}
const U1 = '00000000-0000-4000-8000-000000000001', U2 = '00000000-0000-4000-8000-000000000002', U3 = '00000000-0000-4000-8000-000000000003';
const pad = (n, s) => ' '.repeat(n) + s;
const heading = t => pad(36, t);
const CREATED = 'CREATED:2026-Oct-31 00:00       FL: SFC - UNL';
const fkItem = (loc, id, body, dates = '2026-Nov-01 00:00 - 2026-Dec-01 00:00') => [`${loc}        ${id}        ${dates}`, CREATED, ...body];
const coItem = (loc, id, subject, body) => [loc ? `${loc}            ${id}        2026-Nov-01 00:00 - UFN` : pad(16, `${id}        2026-Nov-01 00:00 - UFN`), CREATED, `SUBJECT: ${subject}`, ...body];
const nameLine = (iata, name, role, w) => pad(18, `${iata} - ${name}`.padEnd(48) + `${role}  ${w}`);
const aptLine = (icao, rwys) => pad(2, `APT${icao}   RWYS: ${rwys}`);
const firHead = (name, code) => [pad(18, name), pad(2, `FIR${code}`)];
const EMPTY_FIR = code => [pad(17, `THERE ARE NO ACTIVE NOTAMS FOR FIR ${code} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD THAT MATCHES THE FILTERING CRITERIA.')];

// The release (text pages): FPL type, date of flight, route, origin, destination, remarks.
function releasePages({ type = 'B744/H', dof = 'DOF/261103 ', route = 'N0481F320 DCT AAAAA DCT BBBBB', orig = 'KAAA', dest = 'KBBB', remarks = null, p1route = null, navFirs = null } = {}) {
  const hdr = `TST0001/03NOV/${orig}-${dest}/N000ZZ`;
  const page = (n, of, body) => [hdr, 'OPERATIONAL FLIGHT PLAN RLS 01 03NOV26 12:00', ...body, `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`].join('\n');
  const p1 = [`TST0001/03 ${orig} - ${dest} 03 NOV 26 N000ZZ`, 'COST INDEX 020 Revision: 1.0', 'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0',
    'PROGS 031200 Release Valid Until 2300Z 03NOV26', `ORIG ${orig}/AAA ALPHA INTL N40000W080000 1755Z`, `DEST ${dest}/BBB BRAVO INTL N41000W081000 0328Z`,
    ...(p1route ? [...p1route, 'Coldest Fuel Temp: -30/BBBBB A/WC: H009 T-DEV: P01'] : [])];
  const rem = remarks ? ['Remarks', 'DISPATCHER DESK: 00', ...remarks, 'RAIM VALIDATION PASSED', 'MEL/CDL', 'Flight Release Authorization'] : [];
  const fpl = ['(FPL-TST0001-IS', `-${type}-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1`, `-${orig}1755`, `-${route}`, `-${dest}0933 KCCC`, `-PBN/A1B1 ${dof}REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)`];
  // navFirs: nav-log FIR lines "(IIII) <position> <time> <FIR name>" (O-49)
  return [page(1, 2, p1), page(2, 2, [...rem, 'TIME FUEL', ...fpl, ...(navFirs || [])])];
}

// A whole package: release (text), HSCN, Company + NOTAM Briefing, Weather + Hazard Briefing (positions),
// NAT track pages (text).
function pkg(o = {}) {
  const orig = o.orig || 'KAAA', dest = o.dest || 'KBBB';
  const contact = o.contact === undefined ? ['Contact Dispatch for a preflight briefing.'] : o.contact;   // O-46: printed after the P0110-type text
  const p1Text = o.p1Text || ['HIGH SEVERITY TEXT.', '  INDENTED SECOND LINE.'];
  const company = [pad(30, 'COMPANY NOTAMS'), pad(36, 'GENERAL'),
    ...coItem('', 'P0001/26', 'TEST OFP', p1Text),
    ...contact,
    ...coItem('', 'A0002/26', 'ADMIN-TEST', ['GENERAL TEXT.']),
    ...coItem('', 'A0003/26', 'PUBS- 999 TEST', ['PUBLICATIONS TEXT.']),
    ...(o.company || [])];
  const airports = [
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', '03 17:00 - 03 18:15'), aptLine(orig, '09/27'),
    heading('RUNWAY'), ...fkItem(orig, 'A0101/26', ['RWY 09/27 CLSD.']),
    nameLine('BBB', 'BRAVO INTL', 'DESTINATION', '04 02:30 - 04 04:30'), aptLine(dest, '18/36'),
    heading('TAXIWAY'), ...fkItem(dest, 'A0201/26', ['TWY A CLSD.']),
  ];
  const firs = o.firs || [
    ...firHead('TEST FIR', 'KXXX'), ...fkItem('KXXX', 'A0899/26', ['ITEM WITH NO HEADING.']),
    heading('AIRSPACE'), ...fkItem('KXXX', 'A0900/26', ['FIR TEXT ONE.', '  SECOND LINE KEPT.']),
    heading('WARNING'), ...fkItem('KXXX', 'A0901/26', ['WARNING TEXT.']),
    ...firHead('EMPTY FIR', 'KYYY'), ...EMPTY_FIR('KYYY'),
    ...firHead('GUARD FIR', 'KZZZ'), heading('NAVIGATION'), ...fkItem('KZZZ', 'A0902/26', ['NAV TEXT.']),
  ];
  const wx = [
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', '03 17:00 - 03 18:15'), aptLine(orig, '09/27'),
    pad(38, 'TAF'), `TAF ${orig} 031100Z 0312/0418 27010KT P6SM SCT030`, pad(37, 'METAR'), `METAR ${orig} 031651Z 27010KT 10SM SCT030 12/04 A3000`,
    pad(38, 'ATIS'), pad(17, `THERE ARE NO ACTIVE ATIS FOR AIRPORT ${orig} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD.'),
    nameLine('BBB', 'BRAVO INTL', 'DESTINATION', '04 02:30 - 04 04:30'), aptLine(dest, '18/36'),
    pad(38, 'TAF'), `TAF ${dest} 031100Z 0312/0418 18010KT P6SM SCT030`, pad(37, 'METAR'), `METAR ${dest} 031650Z 18010KT 10SM SCT030 10/05 A3001`,
    pad(38, 'ATIS'), pad(17, `THERE ARE NO ACTIVE ATIS FOR AIRPORT ${dest} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD.'),
  ];
  const hazards = [
    ...firHead('TEST FIR', 'KXXX'), pad(37, 'SIGMET'), 'TWC FPG - TURB', 'Valid: 2026-11-03 18:00:00+00 until 2026-11-03 21:00:00+00', 'Level: FL300 - FL370', 'ID: 0001 (WSI/XXX)',
    'TWC FPG - CONV', 'Type: TS', 'ID: 0002 (WSI/XXX)',
    ...firHead('EMPTY FIR', 'KYYY'), pad(37, 'SIGMET'), pad(17, 'THERE ARE NO ACTIVE SIGMET FOR FIR WITHIN THE GIVEN TIME'), 'NIL', pad(17, 'PERIOD.'),
  ];
  const brief = [
    briefPage(1, 1, U1, { L: [pad(21, 'HIGH SEVERITY COMPANY NOTAMS'), ...coItem('', 'P0001/26', 'TEST OFP', p1Text), ...(o.hscnContact === undefined ? contact : o.hscnContact)] }),
    briefPage(1, 2, U2, { L: company.slice(0, 50), R: company.slice(50) }),
    briefPage(2, 2, U2, { L: airports, R: firs }),
    briefPage(1, 1, U3, { L: wx, R: hazards }),
  ];
  const rel = releasePages({ type: o.type, dof: o.dof, route: o.route, orig, dest, remarks: o.remarks, p1route: o.p1route, navFirs: o.navFirs });
  const nat = o.nat || [];
  const texts = [...rel, ...brief.map((_, i) => `BRIEFING PAGE ${i + 1}`), ...nat.map(p => p.join('\n'))];
  const pages = [...rel.map(() => ({ width: W, height: H, items: [] })), ...brief, ...nat.map(() => ({ width: W, height: H, items: [] }))];
  const input = { text: texts.join('\n\n') + '\n\n', pages: pages.map((p, i) => ({ page: i + 1, width: p.width, height: p.height, items: p.items.map((it, k) => Object.assign({ order: k }, it)) })) };
  return mod.parseFlightKeys(input, o.opts || OPTS);
}

// A NAT message as FlightKeys prints it (invented fixes), split over pages: [[page lines], …].
function natMsg({ n = 2, tmi = '307', dir = 'WEST', valid = 'NOV 03/1130Z TO NOV 03/1900Z' } = {}) {
  const words = ['ONE', 'TWO', 'THREE'];
  const parts = [];
  for (let k = 1; k <= n; k++) {
    const p = [`(NAT-${k}/${n} TRACKS FLS 340/400 INCLUSIVE`, valid, `PART ${words[k - 1]} OF ${words[n - 1]} PARTS-`,
      `${'ABC'[k - 1]} AAAAA 5${k}/20 5${k}/30 5${k}/40 BBBBB`, `EAST LVLS ${dir === 'EAST' ? '340 350' : 'NIL'}`, `WEST LVLS ${dir === 'WEST' ? '340 350' : 'NIL'}`,
      `EUR RTS ${dir} NIL`, 'NAR NIL-'];
    if (k === n) p.push('REMARKS.', tmi === null ? '1. TMI NOT GIVEN.' : `1. TMI IS ${tmi}.`, '2. SECOND REMARK.-');
    p.push(`END OF PART ${words[k - 1]} OF ${words[n - 1]} PARTS)`);
    parts.push(p);
  }
  return parts;
}
const natPages = (...msgs) => {   // every part on a page of its own, each page headed NAT-TRACKS
  const parts = msgs.flat();
  return parts.map(p => ['NAT-TRACKS', ...p]);
};
const EAST_FLT = { orig: 'KAAA', dest: 'EDDA' }, WEST_FLT = { orig: 'EDDA', dest: 'KBBB' };

const W307 = () => natMsg({ tmi: '307', dir: 'WEST' });           // tracks A and B, westbound
const FPL = l => `N0481F320 DCT AAAAA ${l} BBBBB`;
const P1  = l => [`EDDA/F320 DCT AAAAA ${l} BBBBB/N0482F370`, 'DCT CCCCC DCT KBBB'];
const D79 = (l, tmi, dir) => `FILED NAT ${l} NOT IN TRACK MESSAGE TMI ${tmi} (${dir}) – CHECK OCEANIC CLEARANCE`;

// ══ TC-164-001 … 003 identity, not built in, schema ═══════════════════════════════════════════

test('TC-164-001 identity: v1.0.0, contract 2.4; manifest entry and SHA-256; v0.4.0 out of rules/, frozen in test/oracle/; a changed byte is caught', () => {
  assert.deepEqual([mod.RULESET_TYPE, mod.OFP_FORMAT, mod.RULESET_VERSION, mod.SCHEMA_VERSION, mod.CONTRACT_VERSION], ['ofp', 'flightkeys', '1.0.0', 2, '2.4']);
  const e = MANIFEST['ofp-flightkeys'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.deepEqual([e.version, e.file], ['1.0.1', 'ofp-flightkeys/ofp-flightkeys-v1.0.1.js'], 'O-116: v1.0.1 replaced v1.0.0');
  assert.equal(sha(fs.readFileSync(MOD_FILE)), V100_SHA, 'test/oracle/ofp-flightkeys-v1.0.0.js is v1.0.0, byte for byte');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys')).filter(f => f.endsWith('.js')), ['ofp-flightkeys-v1.0.1.js'], 'one module file; v0.4.0 and v1.0.0 are no longer in rules/');
  assert.equal(sha(fs.readFileSync(ORACLE)), V04_SHA, 'test/oracle/ofp-flightkeys-v0.4.0.js is the v0.4.0 master, byte for byte');
  assert.equal(v04.RULESET_VERSION, '0.4.0');
  assert.match(MOD_SRC.slice(0, 2000), /v1\.0\.0[\s\S]*NOT built into index\.html[\s\S]*switch PR/, 'the header says not built in until the switch PR');
  // the other modules: the switch (step 5e-1, O-79) moved NOTAM v1.14.0 and NAT v1.2.0 to their own keys, bytes unchanged
  assert.deepEqual(['notam-rules', 'ofp-navblue', 'nat-rules'].map(k => MANIFEST[k].version), ['1.14.0', '2.0.1', '1.2.0']);
  assert.ok(!MANIFEST['notam-rules-next'] && !MANIFEST['nat-rules-next'], 'no *-next keys (O-79)');
  assert.equal(MANIFEST['nat-rules'].sha256, 'a0ed2a31a344680424e96fd31d3046ac8cd65244e58cebd553fe5021fa2ca80d');
  assert.equal(MANIFEST['notam-rules'].sha256, '139ce1691574a440a2c371296aea82985bfe26904d77114fa81969c8e86621cb');
  assert.equal(MANIFEST['ofp-navblue'].sha256, 'f7dd7b28f2c61555a1cdfd9a21d601bd6c10ddc0af3d3df890d53541079c6025');
  assert.equal(checkRules(ROOT).ok, true);
  // NEGATIVE: one changed byte in a copy of rules/ → the manifest check fails
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc164-'));
  try {
    fs.cpSync(RULES, path.join(tmp, 'rules'), { recursive: true });
    fs.appendFileSync(path.join(tmp, 'rules', e.file), ' ');
    const c = checkRules(tmp);
    assert.equal(c.ok, false);
    assert.ok(c.errors.some(x => /ofp-flightkeys.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-164-002 built in by the switch PR (step 5e-1, O-74; was: not built in): once, byte for byte, called only by the router; labels 1.10.0 (release)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(html.split(BUILT_IN).length, 2, 'index.html carries v1.0.1 once, byte for byte (O-116)');
  assert.ok(!html.includes(MOD_SRC), 'v1.0.0 is no longer in index.html (O-116)');
  assert.equal(MODULES.filter(m => m && m.rule === 'ofp-flightkeys').length, 1, 'build/build.js lists it once');
  const users = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter(f => fs.statSync(path.join(ROOT, 'src', f)).isFile())
    .filter(f => /OfpFlightKeys/.test(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')));
  assert.deepEqual(users, ['ofp-parse.html'], 'only the router (src/ofp-parse.html) calls it');
  assert.match(html, /const APP_VERSION = '1\.10\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
});

test('TC-164-003 validateSchema(): valid; broken objects rejected', () => {
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  const broken = [
    [o => { o.RULESET_VERSION = '1.0'; }, /semver/],
    [o => { delete o.parseFlightKeys; }, /missing export: parseFlightKeys/],
    [o => { o.CONTRACT_VERSION = '1.0'; }, /CONTRACT_VERSION/],
    [o => { o.EXTENSION_FIELDS = mod.EXTENSION_FIELDS.slice(0, -1); }, /end with findings/],
    [o => { o.DEFERRED_FIELDS = { nope: 'open' }; }, /not a contract field/],
  ];
  for (const [breakIt, re] of broken) {
    const o = Object.assign({}, mod); breakIt(o);
    const v = mod.validateSchema(o);
    assert.equal(v.valid, false, `rejected: ${re}`);
    assert.ok(v.errors.some(x => re.test(x)), `${re} in ${v.errors.join('; ')}`);
  }
  assert.equal(mod.validateSchema(null).valid, false);
});

// ══ TC-164-010 … 017 synthetic ═════════════════════════════════════════════════════════════════

test('TC-164-010 O-68: the NAT call gets { filed, findings }; forwarded in place; probe without options; v1.1.0 still works', () => {
  const calls = [];
  const spy = (...a) => {
    calls.push({ n: a.length, filed: a[3] && a[3].filed, keys: a[3] ? Object.keys(a[3]) : null, isArray: !!(a[3] && Array.isArray(a[3].findings)) });
    if (a[3] && Array.isArray(a[3].findings)) a[3].findings.push({ level: 'INFO', field: 'natTrack', code: 'SPY', message: 'SPY FINDING' });
    return nat.parseNatTrack(...a);
  };
  const opts = Object.assign({}, OPTS, { parseNatTrack: spy });
  const r = pkg(Object.assign({ nat: natPages(W307()), route: FPL('NATB'), p1route: P1('NATC'), opts }, WEST_FLT));
  assert.deepEqual(calls.map(c => c.n), [3, 4], 'the probe (flight direction) has no options; the call for the chosen message has them');
  assert.deepEqual(calls[1].keys, ['filed', 'findings']);
  assert.equal(calls[1].filed, 'B', 'the filed letter is known at the call (worked out before it): the FPL letter');
  assert.equal(calls[1].isArray, true);
  const nf = r.findings.filter(f => f.field === 'natTrack');
  const at = k => nf.findIndex(k);
  assert.ok(at(f => /^CREW ALERT: the filed NAT track differs/.test(f.message)) < at(f => f.code === 'SPY'), 'after the D74 WARN');
  assert.ok(at(f => f.code === 'SPY') < at(f => /; filed track /.test(f.message)), 'before the natTrack INFO');
  assert.deepEqual(coded(r, 'SPY'), [{ level: 'INFO', field: 'natTrack', code: 'SPY', message: 'SPY FINDING' }], 'forwarded as given, once');
  // a random route: the letter passed is null
  calls.length = 0;
  pkg(Object.assign({ nat: natPages(W307()), route: FPL('DCT'), opts }, WEST_FLT));
  assert.equal(calls[1].filed, null);
  // NEGATIVE: no NAT pages → the NAT parser is not called, no NAT finding
  calls.length = 0;
  const none = pkg(Object.assign({ opts }, WEST_FLT));
  assert.equal(calls.length, 0); assert.deepEqual(coded(none, 'SPY'), []);
  // NEGATIVE: a NAT parser that ignores the options (the app's v1.1.0) → the letter still set and the track marked here
  const old = pkg(Object.assign({ nat: natPages(W307()), route: FPL('NATB'), opts: Object.assign({}, OPTS, { parseNatTrack: v11 }) }, WEST_FLT));
  assert.equal(old.natTrack.assignedId, 'B');
  assert.deepEqual(old.findings.filter(f => 'code' in f), [], 'v1.1.0 pushes no finding');
});

test('TC-164-011 D79: filed letter absent from the message → WARN NAT-FILED-NOT-IN-MESSAGE in findings[]; present → none', () => {
  const r = pkg(Object.assign({ nat: natPages(W307()), route: FPL('NATZ') }, WEST_FLT));
  assert.deepEqual(coded(r, 'NAT-FILED-NOT-IN-MESSAGE'), [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: D79('Z', '307', 'WEST') }]);
  assert.ok(!/\.$/.test(D79('Z', '307', 'WEST')), 'D79: no full stop');
  assert.equal(r.natTrack.assignedId, 'Z'); assert.deepEqual(marked(r), [], 'nothing marked');
  // the same through the OFP page 1 route only
  const p = pkg(Object.assign({ nat: natPages(W307()), p1route: P1('NATY') }, WEST_FLT));
  assert.deepEqual(coded(p, 'NAT-FILED-NOT-IN-MESSAGE').map(f => f.message), [D79('Y', '307', 'WEST')]);
  // an eastbound message, letter absent
  const e = pkg(Object.assign({ nat: natPages(natMsg({ tmi: '308', dir: 'EAST', valid: 'NOV 04/0100Z TO NOV 04/0800Z' })), route: FPL('NATX') }, EAST_FLT));
  assert.deepEqual(coded(e, 'NAT-FILED-NOT-IN-MESSAGE').map(f => [f.level, f.message]), [['WARN', D79('X', '308', 'EAST')]]);
  // NEGATIVE: the letter is printed → no WARN, that track marked, no other NAT finding
  for (const l of ['A', 'B']) {
    const ok = pkg(Object.assign({ nat: natPages(W307()), route: FPL('NAT' + l) }, WEST_FLT));
    assert.deepEqual(coded(ok, 'NAT-FILED-NOT-IN-MESSAGE'), [], `NAT${l} printed`);
    assert.deepEqual(marked(ok), [l]);
    assert.deepEqual(ok.findings.filter(f => 'code' in f), []);
  }
});

test('TC-164-012 D81: no filed letter → INFO NAT-RANDOM-ROUTE, nothing marked; a filed letter → none', () => {
  const r = pkg(Object.assign({ nat: natPages(W307()), route: FPL('DCT') }, WEST_FLT));
  assert.deepEqual(coded(r, 'NAT-RANDOM-ROUTE'), [{ level: 'INFO', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 307)' }]);
  assert.equal(r.natTrack.assignedId, null); assert.deepEqual(marked(r), []);
  assert.deepEqual(warns(r, /^natTrack$/), [], 'a random route is never a WARN');
  // remarks / Company text naming a track do not make it filed (O-58): still random
  const rmk = pkg(Object.assign({ nat: natPages(W307()), route: FPL('DCT'), remarks: ['YOU ARE FILED UNDER NAT TRACK X ON A RANDOM ROUTE NATX'] }, WEST_FLT));
  assert.equal(coded(rmk, 'NAT-RANDOM-ROUTE').length, 1);
  // NEGATIVE: a filed letter (printed or not) → no NAT-RANDOM-ROUTE
  for (const l of ['NATB', 'NATZ']) assert.deepEqual(coded(pkg(Object.assign({ nat: natPages(W307()), route: FPL(l) }, WEST_FLT)), 'NAT-RANDOM-ROUTE'), [], l);
  // NEGATIVE: no NAT pages, or no NAT parser → no NAT-RANDOM-ROUTE
  assert.deepEqual(coded(pkg(WEST_FLT), 'NAT-RANDOM-ROUTE'), []);
  assert.deepEqual(coded(pkg(Object.assign({ nat: natPages(W307()), opts: { icaoFpl, aircraftProfile: acProf, notamRules: NR } }, WEST_FLT)), 'NAT-RANDOM-ROUTE'), []);
});

function checkShape(r, lbl) {
  for (const f of r.findings) {
    assert.ok(['INFO', 'WARN'].includes(f.level), `${lbl}: level ${f.level}`);
    assert.ok(typeof f.field === 'string' && f.field && typeof f.message === 'string' && f.message, `${lbl}: field / message`);
    if ('code' in f) {
      assert.deepEqual(Object.keys(f), NAT_KEYS, `${lbl}: a forwarded NAT finding keeps its code`);
      assert.equal(f.field, 'natTrack');
      assert.equal(nat.FINDING_CODES[f.code], f.level, `${lbl}: ${f.code} is in the NAT ruleset's list with level ${f.level}`);
    } else assert.deepEqual(Object.keys(f), OWN_KEYS, `${lbl}: the parser's own finding`);
  }
}
test('TC-164-013 findings shape (synthetic): own { level, field, message }; forwarded { level, field, code, message }', () => {
  for (const [lbl, o] of [['D79', { route: FPL('NATZ') }], ['random', { route: FPL('DCT') }], ['filed', { route: FPL('NATB') }], ['no NAT', { nat: [] }]])
    checkShape(pkg(Object.assign({ nat: natPages(W307()) }, o, WEST_FLT)), lbl);
  // NEGATIVE: a malformed forwarded finding would be caught by the check
  assert.throws(() => checkShape({ findings: [{ level: 'WARN', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'x' }] }, 'bad'), /NAT ruleset's list/);
  assert.throws(() => checkShape({ findings: [{ level: 'INFO', field: 'x', message: 'y', extra: 1 }] }, 'bad'));
});

test('TC-164-014 D74 kept: OFP page 1 and FPL letters differ → crew-alert WARN once, FPL letter marked; agree → none', () => {
  const d = pkg(Object.assign({ nat: natPages(W307()), p1route: P1('NATA'), route: FPL('NATB') }, WEST_FLT));
  assert.deepEqual(warns(d, /^natTrack$/).map(f => f.message), ['CREW ALERT: the filed NAT track differs: OFP page 1 route NATA, ICAO FPL route NATB; NATB (the FPL) is marked (O-47)']);
  assert.equal(d.natTrack.assignedId, 'B'); assert.deepEqual(marked(d), ['B']);
  assert.deepEqual(coded(d, 'NAT-FILED-NOT-IN-MESSAGE'), []);
  // NEGATIVE: the two routes agree → no WARN
  const a = pkg(Object.assign({ nat: natPages(W307()), p1route: P1('NATB'), route: FPL('NATB') }, WEST_FLT));
  assert.deepEqual(warns(a, /^natTrack$/), []); assert.deepEqual(marked(a), ['B']);
  // both WARNs when the FPL letter is also not in the message: D74 first, then D79
  const both = pkg(Object.assign({ nat: natPages(W307()), p1route: P1('NATA'), route: FPL('NATZ') }, WEST_FLT));
  assert.deepEqual(warns(both, /^natTrack$/).map(f => f.code || 'D74'), ['D74', 'NAT-FILED-NOT-IN-MESSAGE']);
});

test('TC-164-015 notamRules not supplied → the existing WARN kept (O-18 is the app\'s, PR 2); supplied → none', () => {
  const n = pkg({ opts: { icaoFpl, aircraftProfile: acProf, parseNatTrack: nat.parseNatTrack } });
  assert.equal(warns(n, /^notamRules$/).filter(f => f.message === 'NOTAM ruleset not supplied: airport NOTAM text read, but not cut into items (notamItems empty)').length, 1);
  assert.equal(warns(n, /^companyNotams$/).filter(f => /^NOTAM ruleset not supplied/.test(f.message)).length, 1);
  // NEGATIVE: supplied → neither WARN
  const y = pkg();
  assert.deepEqual(warns(y, /^(notamRules|companyNotams)$/).filter(f => /NOTAM ruleset not supplied/.test(f.message)), []);
});

test('TC-164-016 O-80: text only (no positions) → WARN "read from text only"; release data still read; positions → none', () => {
  const full = pkg(WEST_FLT);
  const text = releasePages(WEST_FLT).join('\n\n') + '\n\n';
  const t = mod.parseFlightKeys({ text }, OPTS);
  assert.equal(warns(t, /^input$/).filter(f => f.message === 'positioned items (input.pages) not supplied; read from text only').length, 1);
  assert.equal(t.origIcao, 'EDDA'); assert.equal(t.destIcao, 'KBBB'); assert.ok(t.fltNum, 'release data read from the text');
  // NEGATIVE: positions supplied → no such WARN
  assert.deepEqual(warns(full, /^input$/).filter(f => /read from text only/.test(f.message)), []);
});

test('TC-164-017 O-84: the deferred INFO is version-free; no finding names a version', () => {
  for (const r of [pkg(), pkg(Object.assign({ nat: natPages(W307()) }, WEST_FLT)), mod.parseFlightKeys({ text: releasePages().join('\n\n') }, OPTS)]) {
    assert.deepEqual(infos(r, /^fplEquipment$/).map(f => f.message), [DEFERRED_TEXT]);
    assert.deepEqual(r.findings.filter(f => /\bv\d+\.\d+\.\d+\b/.test(f.message)), [], 'NEGATIVE: no finding names a version');
  }
  // the frozen v0.4.0 named its version (the declared change)
  assert.deepEqual(infos(v04.parseFlightKeys({ text: releasePages().join('\n\n') }, OPTS), /^fplEquipment$/).map(f => f.message), ['not read in v0.4.0: not in any brief yet (open item)']);
});

// ══ TC-164-020 / 021 / 090 fixtures ═════════════════════════════════════════════════════════════

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const LBL = Object.fromEntries(Object.entries(require('./data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
let _fk = null;
function fk() {
  if (_fk) return _fk;
  _fk = readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys').map(fx => {
    const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    return { fx, lbl: LBL[fx.id], input: () => mod.inputFromExtractor(text, items) };
  });
  return _fk;
}
const NAT_PKGS = ['L08', 'L11', 'L12', 'L22', 'L23'], RANDOM = ['L08', 'L12', 'L22', 'L23'];
const j = x => JSON.stringify(x);

fixtureTest('TC-164-020 all 26 vs v0.4.0: only natTrack on L08, L11, L12, L22, L23; findings = the O-84 text on 26 + NAT-RANDOM-ROUTE on 4', () => {
  assert.equal(fk().length, 26);
  for (const [base, baseNat, natChanged] of [['v0.4.0 + NAT v1.1.0 (the app today)', v11, NAT_PKGS], ['v0.4.0 + NAT v1.2.0, 3 arguments', (t, o, d) => nat.parseNatTrack(t, o, d), []]]) {
    const natDiff = [], randomInfo = [], o84 = [];
    for (const p of fk()) {
      const a = v04.parseFlightKeys(p.input(), Object.assign({}, OPTS, { parseNatTrack: baseNat }));
      const b = mod.parseFlightKeys(p.input(), OPTS);
      assert.deepEqual(Object.keys(b), Object.keys(a), `${p.lbl}: keys in order`);
      const keys = Object.keys(a).filter(k => j(a[k]) !== j(b[k]));
      assert.deepEqual(keys.filter(k => k !== 'natTrack' && k !== 'findings'), [], `${base}, ${p.lbl}: no other field changes`);
      if (keys.includes('natTrack')) natDiff.push(p.lbl);
      // findings: v0.4.0's, in order, with the O-84 text; plus the forwarded NAT findings, nothing else
      const back = b.findings.filter(f => !('code' in f)).map(f => (f.field === 'fplEquipment' && f.message === DEFERRED_TEXT ? Object.assign({}, f, { message: 'not read in v0.4.0: not in any brief yet (open item)' }) : f));
      assert.equal(j(back), j(a.findings), `${base}, ${p.lbl}: v0.4.0 findings in order, except the O-84 text`);
      if (b.findings.some(f => f.field === 'fplEquipment' && f.message === DEFERRED_TEXT) && a.findings.some(f => f.field === 'fplEquipment' && /^not read in v0\.4\.0: /.test(f.message))) o84.push(p.lbl);
      const fwd = b.findings.filter(f => 'code' in f);
      assert.ok(fwd.every(f => f.code === 'NAT-RANDOM-ROUTE' && f.level === 'INFO'), `${base}, ${p.lbl}: the only NAT finding is NAT-RANDOM-ROUTE: ${fwd.map(f => f.code)}`);
      if (fwd.length) { assert.equal(fwd.length, 1); randomInfo.push(p.lbl); }
      // the natTrack value of v1.0.0 = v0.4.0 with v1.2.0 injected (the NAT version makes the change, not v1.0.0)
      if (keys.includes('natTrack')) {
        assert.equal(b.natTrack.tmi, a.natTrack.tmi); assert.equal(b.natTrack.assignedId, a.natTrack.assignedId); assert.equal(b.natTrack.flightDir, a.natTrack.flightDir);
      }
    }
    assert.deepEqual(natDiff.sort(), natChanged, `${base}: natTrack changes`);
    assert.deepEqual(randomInfo.sort(), RANDOM, `${base}: NAT-RANDOM-ROUTE`);
    assert.equal(o84.length, 26, `${base}: the O-84 text on all 26`);
    console.log(`TC-164-020 (${base}): natTrack ${natDiff.length} [${natDiff.join(', ')}], NAT-RANDOM-ROUTE ${randomInfo.length} [${randomInfo.join(', ')}], O-84 text ${o84.length}; every other field equal`);
  }
});

fixtureTest('TC-164-021 pinned values on all 26 (expected/ofp-flightkeys-v1.0.0/nat.json); shape; no NAT-FILED-NOT-IN-MESSAGE', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(FIX, EXPECTED_FILE), 'utf8'));
  assert.equal(pin.module.version, '1.0.0');
  assert.equal(pin.module.sha256, V100_SHA, 'the pinned values were made with this module (v1.0.0, frozen copy)');
  assert.deepEqual(Object.keys(pin.packages).sort(), fk().map(p => p.fx.id).sort());
  let warn79 = 0;
  for (const p of fk()) {
    const r = mod.parseFlightKeys(p.input(), OPTS), e = pin.packages[p.fx.id];
    checkShape(r, p.lbl);
    assert.equal(e.label, p.lbl);
    assert.equal(r.natTrack ? sha(j(r.natTrack)) : null, e.natTrack, `${p.lbl}: natTrack`);
    assert.deepEqual(r.natTrack ? [r.natTrack.assignedId, marked(r)] : null, e.filed, `${p.lbl}: filed letter and marked track`);
    assert.deepEqual(r.findings.filter(f => 'code' in f).map(f => [f.level, f.code, f.message]), e.natFindings, `${p.lbl}: forwarded NAT findings`);
    warn79 += coded(r, 'NAT-FILED-NOT-IN-MESSAGE').length;
  }
  assert.equal(warn79, 0, 'on the 26, every filed letter is printed in its message');
  const l11 = fk().find(p => p.lbl === 'L11');
  const r11 = mod.parseFlightKeys(l11.input(), OPTS);
  assert.deepEqual([r11.natTrack.assignedId, marked(r11), r11.findings.filter(f => 'code' in f)], ['W', ['W'], []], 'L11: W filed, marked, no NAT finding');
  assert.deepEqual(NAT_PKGS.filter(l => pin.packages[fk().find(p => p.lbl === l).fx.id].natTrack), NAT_PKGS);
});

test('TC-164-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false, 'a directory without a manifest is not taken as the fixtures');
  assert.ok(FIX, 'the fixtures are available in this run');
});
