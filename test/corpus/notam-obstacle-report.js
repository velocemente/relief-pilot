'use strict';
// Markdown report of the v1.14.0 obstacle-rule change list (test/corpus/notam-obstacle-changes.js).
// v1.1: Exec answers D67a (18 Nov): groups recounted, card groups (O-25), the O-28 audit and the beta
// exposure. NOTAM text is public aeronautical information; no crew data is read or written here.

const WHAT = {
  MINIMA_CHANGED: 'approach minima raised or changed (DA/DH, MDA/MDH, OCA/OCH, minima)',
  MINIMA_VALUE: 'approach minima given as values (DA 474/HAT 346, OCA 270, RVR 4500, VIS …)',
  NOT_AUTHORISED: 'a procedure or minima not authorised (PROC NA, NOT AUTH)',
  GLIDE_PATH_VGSI: 'glide path / VGSI angle, or a VGSI not coincident / unusable beyond',
  OBSTACLE_CLEARANCE: 'obstacle clearance; MOC / MOCA / OCS raised or changed',
  CLIMB_GRADIENT: 'missed-approach or departure climb gradient (FT/NM, %, PDG, MIN CLIMB)',
  TKOF_ODP: 'take-off minimums, ODP, obstacle departure procedure (the v1.13.0 keywords)',
  TKOF_MINIMA: 'take-off minima in other wordings (TAKE-OFF MINIMUMS, TKOF MNM)',
  PROCEDURE_ALTITUDE: 'SID / STAR / approach altitude constraints changed (AT OR ABOVE, ALT:…, … VICE …, coding table)',
  PROCEDURE_AFFECTED: 'a flight procedure or take-off path stated "affected" (D67a: a procedure affected)',
  CLOSE_IN_OBSTACLE: 'a close-in obstacle — noted on the SID / ODP for the departure (D67a: the departure affected)',
  NAVAID: 'a navaid out of service, unreliable or disturbed',
  LIGHTING: 'aerodrome lighting out of service',
  PROCEDURE_AVAILABILITY: 'a procedure not available / suspended / withdrawn',
  PROCEDURE_CHANGE: 'a procedure introduced, adjusted or amended (O-25 card group)',
  DECLARED_DISTANCES: 'declared distances (TORA/TODA/ASDA/LDA) changed',
  THRESHOLD: 'threshold displaced / relocated / temporary',
  RWY_AVAILABILITY: 'runway (or aerodrome) closed / not available',
  CLOSED_TO_TRAFFIC: 'an area closed to aircraft / traffic (O-25 card group)',
  TWY_AVAILABILITY: 'taxiway closed / restricted',
  APRON_STAND: 'apron, stand or gate closed / not available (O-25 card group)',
  LOW_VIS_OPS: 'low-visibility operations amended / suspended (O-25 card group)',
  SURFACE_PENETRATION: 'a protection surface penetrated / infringed',
  SURFACE_NAMED: 'an obstacle in or above a named surface (approach, transitional, horizontal, conical, OLS, OFZ)',
  RUNWAY_STRIP: 'an obstacle in the runway strip / graded area / RESA',
  TAKEOFF_SIDE_UNSTATED: 'the approach side stated not affected (OCA/H NOT AFFECTED), a height near a runway, the take-off side not stated (D67a O-26)',
  HEIGHT_NEAR_PROCEDURE: 'a height given near a procedure, no effect stated — hidden (D67a O-22)',
  HEIGHT_NEAR_RUNWAY: 'a height given near a runway, no procedure named, no effect stated — hidden (D67a O-22, incl. FAA crane NOTAMs)',
};
const STEP = {
  effect: ['MINIMA_CHANGED', 'MINIMA_VALUE', 'NOT_AUTHORISED', 'GLIDE_PATH_VGSI', 'OBSTACLE_CLEARANCE', 'CLIMB_GRADIENT', 'TKOF_ODP', 'TKOF_MINIMA', 'PROCEDURE_ALTITUDE', 'PROCEDURE_AFFECTED', 'CLOSE_IN_OBSTACLE'],
  other: ['NAVAID', 'LIGHTING', 'PROCEDURE_AVAILABILITY', 'PROCEDURE_CHANGE', 'DECLARED_DISTANCES', 'THRESHOLD', 'RWY_AVAILABILITY', 'CLOSED_TO_TRAFFIC', 'TWY_AVAILABILITY', 'APRON_STAND', 'LOW_VIS_OPS'],
  undecided: ['SURFACE_PENETRATION', 'SURFACE_NAMED', 'RUNWAY_STRIP', 'TAKEOFF_SIDE_UNSTATED'],
  hidden: ['HEIGHT_NEAR_PROCEDURE', 'HEIGHT_NEAR_RUNWAY'],
};

const cell = s => String(s === null || s === undefined ? '' : s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const yes = b => b ? 'shown' : 'hidden';
const cards = c => c ? `DEST: ${c.DEST} · ORIG: ${c.ORIG}` : '—';
const noRow = c => !!c && (/^no row/.test(c.DEST) || /^no row/.test(c.ORIG));

function why(e) {
  const by = e.fmt === 'FK' && e.byHeadingOnly ? 'printed under OBSTACLE (no obstacle word)' : 'says OBST / OBSTACLE / CRANE';
  if (e.group === 'B') {
    return `obstacle NOTAM (${by}); ${e.pattern ? WHAT[e.pattern] : 'no procedure affected, nothing else changed'}` +
      (e.e1 ? `; v1.13.0 showed it for the keyword "${e.e1}"` : '; v1.13.0 showed it (no obstacle word, not filtered)') +
      (e.noEffectStated ? '; the text states no effect (e.g. OCA/H NOT AFFECTED)' : '');
  }
  const p = `${e.pattern}: ${WHAT[e.pattern] || ''}`;
  if (e.group === 'C') return `${p} (v1.13.0 hid it: obstacle word and none of its keywords)`;
  if (e.group === 'G') return `${p}; shown by both, v1.13.0 gave it no card row`;
  return `${p}${e.noEffectStated && e.pattern !== 'TAKEOFF_SIDE_UNSTATED' ? '; the text also states no effect on some procedure' : ''}; v1.13.0: ${e.before.noWindow ? 'shown' : 'hidden'}`;
}

function table(rows, withCards) {
  const out = [`| # | Package | Airport | NOTAM ID | Category | First 2 body lines | Reason (pattern) | No window v1.13.0 → v1.14.0 |${withCards ? ' Card group v1.14.0 |' : ''} Notes |`,
               `| --: | :-- | :-- | :-- | :-- | :-- | :-- | :-- |${withCards ? ' :-- |' : ''} :-- |`];
  rows.forEach((e, k) => {
    const notes = [...(e.notes || []), ...(e.windows ? [`airport windows: ${e.windows.join(', ')}`] : []),
                   ...(e.before.sweep ? [`TC-171-030 sweep shown: ${e.before.sweep} → ${e.after.sweep}`] : []),
                   ...(e.group === 'G' && e.cards13 ? [`v1.13.0 card group: ${cards(e.cards13)}`] : [])];
    out.push(`| ${k + 1} | \`${cell(e.pkg)}\` | ${cell(e.airport)} | ${cell(e.id || '—')} | ${cell(e.category || (e.fmt === 'NB' ? 'NavBlue' : '—'))} | ${cell(e.body.join(' / '))} | ${cell(why(e))} | ${yes(e.before.noWindow)} → ${yes(e.after.noWindow)} |${withCards ? ` ${cell(cards(e.cards))} |` : ''} ${cell(notes.join('; '))} |`);
  });
  return out.join('\n');
}

function auditTable(rows) {
  const out = ['| # | Package | Airport | NOTAM ID | First 2 body lines | Why v1.13.0 hid it (obstacle filter E1) | v1.14.0: group (pattern) | Card group v1.14.0 | Notes |',
               '| --: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |'];
  rows.forEach((e, k) => {
    const w = e.why;
    const hid = `obstacle word "${w.word}" ${w.where}; none of E1's keywords — the content "${w.content}" (missing keyword: ${w.missing})`;
    out.push(`| ${k + 1} | \`${cell(e.pkg)}\` | ${cell(e.airport)} | ${cell(e.id || '—')} | ${cell(e.body.join(' / '))} | ${cell(hid)} | ${e.group} (${e.pattern})${e.shown14 ? ', shown' : ', NOT SHOWN'} | ${cell(cards(e.cards))} | ${cell((e.notes || []).join('; '))} |`);
  });
  return out.join('\n');
}

function betaTable(rows) {
  const out = ['| # | Package | Airport | NOTAM ID | First 2 body lines | v1.14.0: why shown | Change list group | Card group v1.14.0 |',
               '| --: | :-- | :-- | :-- | :-- | :-- | :-- | :-- |'];
  rows.forEach((e, k) => {
    const r = e.obstacle ? `${e.decision} (${e.pattern})${e.why ? ` — v1.11.2 hid it: obstacle word "${e.why.word}" ${e.why.where}, content "${e.why.content}"` : ''}` : 'not an obstacle NOTAM';
    out.push(`| ${k + 1} | \`${cell(e.pkg)}\` | ${cell(e.airport)} | ${cell(e.id || '—')} | ${cell(e.body.join(' / '))} | ${cell(r)} | ${e.group || '—'} | ${cell(cards(e.cards))} |`);
  });
  return out.join('\n');
}

function report(res) {
  const E = res.entries;
  const g = (x, f) => E.filter(e => e.group === x && (!f || e.fmt === f));
  const uniq = arr => new Set(arr.map(e => `${e.airport} ${e.id || e.sha}`)).size;
  const patCount = arr => {
    const c = {};
    for (const e of arr) { const k = e.pattern || '(none)'; c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  };
  const st = res.stats;
  const shownRows = [...g('C'), ...g('U'), ...g('G')];
  const L = [];
  L.push('# RPT-NOTAM-ObstacleRule-ChangeList — NOTAM ruleset v1.14.0 (Exec decisions D67, D67a)');
  L.push('');
  L.push('**Version:** v1.1-UPD | **Status:** UPD | **Date:** 2026-11-19 (supersedes v1.0 of 2026-11-18)');
  L.push('**For:** the Exec\'s review of the change list before v1.14.0 is published to Drive (it is not built into the app; beta takes it in step 5e).');
  L.push(`**Modules:** before \`${res.before}\` (SHA-256 \`${res.sha.before.slice(0, 8)}…\`), after \`${res.after}\` (SHA-256 \`${res.sha.after.slice(0, 8)}…\`); FlightKeys parser for \`notamsRaw\`: \`${res.fkParserFile}\` (SHA-256 \`${res.sha.fkParser.slice(0, 8)}…\`, velocemente/relief-pilot#63), its output as stored in the fixtures repository (\`expected/notam-rules-v1.14.0/fk-notams-raw.json\`, the file the CI tests read); beta exposure: NOTAM v1.11.2 \`${res.betaFile}\` (SHA-256 \`${(res.betaSha || '').slice(0, 8)}…\`, from git history, commit \`cb473e5\`; the same bytes are in the \`index.html\` the beta runs).`);
  L.push('**Made by:** `node test/corpus/fk-notams-raw-export.js --out <fixtures>/expected/notam-rules-v1.14.0/fk-notams-raw.json`, then `node test/corpus/notam-obstacle-changes.js --fk-raw <that file> --beta <notam-rules-v1.11.2.js> --report <this file> --data test/rules/data/notam-v1.14.0-obstacle-changes.json`, then `tools/redact` (no replacement made: the list holds no crew data).');
  L.push('');
  L.push('> **Public repository.** NOTAM text is public aeronautical information and is quoted as printed (first two body lines). No crew names, employee numbers, dispatcher names or phone numbers.');
  L.push('');
  L.push('## Change log');
  L.push('');
  L.push('| Version | Date | Change |');
  L.push('| :-- | :-- | :-- |');
  L.push('| v1.0 | 2026-11-18 | First list (D67): B 132, C 12, U 221. |');
  L.push(`| **v1.1** | 2026-11-19 | Exec answers **D67a** (18 Nov) applied. O-22 / O-24: a height near a runway or a procedure with no effect stated (incl. FAA crane NOTAMs, FlightKeys items under OBSTACLE) → **hidden**: the 135 v1.0 U rows \`HEIGHT_NEAR_RUNWAY\` / \`HEIGHT_NEAR_PROCEDURE\` move to B (shown by v1.13.0) or leave the list (hidden by both). O-23: obstacle-light outages and men / equipment near a runway with no height stay hidden. O-26: "OCA/H NOT AFFECTED" with a height near a runway and the take-off side not stated → U, shown (\`TAKEOFF_SIDE_UNSTATED\`). A procedure stated "affected" and a close-in obstacle now count as a procedure affected (effect). O-25: the four extra other-content cases are given a card group with a row; new group **G** (shown by both, only the card group set). Every shown row carries its card group. New section **O-28 audit** (a: what v1.13.0's obstacle filter hid; c: beta exposure, v1.11.2). Counts below. |`);
  L.push('');
  L.push('## Counts');
  L.push('');
  L.push('| Group | What | All | NavBlue/eOFP | FlightKeys | Different NOTAMs (airport + ID) |');
  L.push('| :-- | :-- | --: | --: | --: | --: |');
  L.push(`| **B** | shown → hidden | **${g('B').length}** | ${g('B', 'NB').length} | ${g('B', 'FK').length} | ${uniq(g('B'))} |`);
  L.push(`| **C** | hidden → shown | **${g('C').length}** | ${g('C', 'NB').length} | ${g('C', 'FK').length} | ${uniq(g('C'))} |`);
  L.push(`| **U** | undecided, shown | **${g('U').length}** | ${g('U', 'NB').length} | ${g('U', 'FK').length} | ${uniq(g('U'))} |`);
  L.push(`| | of which hidden by v1.13.0 (hidden → shown) | ${g('U').filter(e => !e.before.noWindow).length} | ${g('U', 'NB').filter(e => !e.before.noWindow).length} | ${g('U', 'FK').filter(e => !e.before.noWindow).length} | ${uniq(g('U').filter(e => !e.before.noWindow))} |`);
  L.push(`| **G** | shown by both, card group set (O-25) | **${g('G').length}** | ${g('G', 'NB').length} | ${g('G', 'FK').length} | ${uniq(g('G'))} |`);
  L.push(`| **O-28 (a)** | hidden by v1.13.0's obstacle filter although it changes something else or affects a procedure | **${res.audit.length}** | ${res.audit.filter(e => e.fmt === 'NB').length} | ${res.audit.filter(e => e.fmt === 'FK').length} | ${uniq(res.audit)} |`);
  L.push(`| **O-28 (c)** | beta exposure: hidden by v1.11.2 (beta), shown by v1.14.0 — NavBlue corpus | **${res.beta.length}** | ${res.beta.length} | — | ${uniq(res.beta)} |`);
  L.push('');
  L.push(`Corpus: ${st.navblue.fixtures} NavBlue/eOFP fixtures, ${st.navblue.notams.toLocaleString('en')} NOTAMs (whole OFP text, the TC-171-030 split), ${st.navblue.calls.toLocaleString('en')} \`evalNotams()\` calls; ${st.flightkeys.packages} FlightKeys packages, ${st.flightkeys.airports} airports with NOTAMs, ${st.flightkeys.items.toLocaleString('en')} items under ${st.flightkeys.headings} type headings, ${st.flightkeys.calls.toLocaleString('en')} calls. **Every NOTAM that is not in this list gives exactly the same \`evalNotams()\` result in v1.13.0 and v1.14.0 at every evaluation** (the new optional field \`fkCategory\` left out); the script stops on any other difference, and found none.`);
  L.push('');
  L.push(`Reasons — B: ${patCount(g('B'))} (\`(none)\` = no procedure affected, nothing else changed; ${g('B').filter(e => e.byHeadingOnly).length} are FlightKeys items printed under OBSTACLE with no obstacle word). C: ${patCount(g('C'))}. U: ${patCount(g('U'))}. G: ${patCount(g('G'))}.`);
  L.push('');
  L.push(`**Card rows (E2).** The airport card draws a row only for the runway groups, GENERAL, TAXIWAYS, SIDs and STARs. ${shownRows.filter(e => noRow(e.cards)).length} of the ${shownRows.length} shown rows of C, U and G have no card row at the destination or the departure airport (their classification is v1.13.0's: catch-all slot 7/8 or INFO); none of them is one of the four O-25 cases, which all have a row. Listed per row; open item for the Exec.`);
  L.push('');
  L.push('## How the list was made');
  L.push('');
  L.push('- **NavBlue/eOFP:** the whole OFP text of each fixture, split as TC-171-030 splits it (v1.13.0 and v1.14.0 split it identically). Each NOTAM evaluated alone, with no window (`etaMin` null: in effect) and at the TC-171-030 sweep (ORIG and DEST; ETA 0000, 0059, 0500, 1000, 1159, 1200, 1640, 2300, 2359Z; departure unknown, 0000Z, 1140Z; with and without the flight date). The whole-text split also yields pieces that are not one NOTAM (the OFP text before the first NOTAM, or a last NOTAM that runs on into the weather); they are listed with a note, as the corpus holds them. In the app each airport card reads its own NOTAM text, not these pieces.');
  L.push('- **FlightKeys:** each airport\'s `notamsRaw` (the NOTAM section as printed, type headings included) from the FlightKeys parser v0.3.0. v1.14.0 reads `notamsRaw` as it is: `_splitNotams()` cuts out the headings and every item carries its heading as `fkCategory`. v1.13.0 reads the same items without headings (the parser\'s `notams` text). Each item alone, with no window and at each of its airport\'s windows (the briefing\'s role windows, at their midpoint).');
  L.push('- **Groups.** B and C compare the result with no window (the obstacle rule does not depend on time). U is every obstacle NOTAM v1.14.0 shows because the patterns cannot decide, whatever v1.13.0 did. G is an obstacle NOTAM shown by both whose result differs: the O-25 card group it is now given. **Card group** = where the item lands on the card with no window, as destination (DEST) and as departure airport (ORIG).');
  L.push('- The same NOTAM printed in several packages is listed once per package.');
  L.push('');
  L.push('## The pattern set (SPEC v1.14.0 §8a, §8b; `OBSTACLE_RULE` in the module)');
  L.push('');
  L.push('| Step | Pattern | Meaning |');
  L.push('| :-- | :-- | :-- |');
  const label = { effect: '1 a procedure affected → shown', other: '2 other content → shown', undecided: '3 undecided → shown (U)', hidden: '4 → hidden (reason only)' };
  for (const [k, ids] of Object.entries(STEP)) for (const id of ids) L.push(`| ${label[k]} | \`${id}\` | ${WHAT[id]} |`);
  L.push('| 4 | — | none of the above → **hidden** |');
  L.push('');
  L.push('## What remains in U, and why');
  L.push('');
  L.push('D67a decides an obstacle NOTAM by whether a procedure (runway, approach, SID, STAR, departure, missed approach, circling) is affected. What is left undecided, and shown:');
  L.push('');
  L.push('| Pattern | Rows | Why it stays undecided |');
  L.push('| :-- | --: | :-- |');
  const uWhy = {
    SURFACE_PENETRATION: 'the text says a protection surface (transitional, inner horizontal, OLS …) is penetrated or infringed: a fact that may affect the approach, missed approach or circling, but no procedure or effect is stated',
    SURFACE_NAMED: 'the obstacle stands in or above a named surface (approach, transitional, horizontal, conical, OFZ): the surface protects a procedure, but no procedure or effect is stated',
    RUNWAY_STRIP: 'an obstacle in the runway strip / graded area / RESA: the runway itself may be affected, no effect stated',
    TAKEOFF_SIDE_UNSTATED: 'D67a O-26 (Exec): the approach side is stated not affected (OCA/H NOT AFFECTED), a height is given near a runway and the take-off side is not stated',
  };
  for (const id of STEP.undecided) L.push(`| \`${id}\` | ${g('U').filter(e => e.pattern === id).length} | ${uWhy[id]} |`);
  L.push('');
  L.push('## Group B — shown → hidden');
  L.push('');
  L.push(table(g('B'), false));
  L.push('');
  L.push('## Group C — hidden → shown');
  L.push('');
  L.push(table(g('C'), true));
  L.push('');
  L.push('## Group U — undecided (shown)');
  L.push('');
  L.push(table(g('U'), true));
  L.push('');
  L.push('## Group G — shown by both, card group set (O-25)');
  L.push('');
  L.push(table(g('G'), true));
  L.push('');
  L.push('## O-28 audit');
  L.push('');
  L.push(`### (a) Hidden by v1.13.0's obstacle filter although it changes something else or affects a procedure — ${res.audit.length} rows (${uniq(res.audit)} NOTAMs)`);
  L.push('');
  L.push('Every NOTAM of the corpus (NavBlue whole text and FlightKeys items) that v1.13.0 hid by its obstacle filter E1 — the text says OBST / OBSTACLE / CRANE and holds none of E1\'s keywords (ILS, LOC, GLS, RNAV, RNP, NDB, VOR, LDA, GBAS, GS, G/S, G/P, GP, IFR APCH, IAP, APCH, PROC, RWY, SID, STAR, CAT I–III, and the TKOF / ODP keywords) — and that v1.14.0 decides as a procedure affected (effect) or as changing something else (other). Each is shown by v1.14.0 (TC-172-061 holds it in CI; TC-172-060 has one test per kind that fails on v1.13.0). Where the obstacle word stands outside the NOTAM (NavBlue: the piece runs on into the weather or the next section), the NOTAM itself is not an obstacle NOTAM at all.');
  L.push('');
  L.push(auditTable(res.audit));
  L.push('');
  L.push(`### (c) Beta exposure — hidden by NOTAM v1.11.2 (the beta), shown by v1.14.0: **${res.beta.length}** rows (${uniq(res.beta)} NOTAMs), NavBlue corpus`);
  L.push('');
  L.push('Read only; nothing in the app or the beta is changed. NOTAM v1.11.2 (git history, the copy built into the beta\'s `index.html`) over the 30 NavBlue/eOFP fixtures, each NOTAM alone with no window (in effect), the aircraft type as the beta passes it (a type string): every NOTAM v1.11.2 hides that v1.14.0 shows. v1.11.2\'s obstacle filter is E1, as in v1.13.0; the rows are the NavBlue rows of (a) and the NavBlue U rows v1.13.0 hid.');
  L.push('');
  L.push(betaTable(res.beta));
  L.push('');
  return L.join('\n') + '\n';
}

module.exports = { report, WHAT, STEP };
