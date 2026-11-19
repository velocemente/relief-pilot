'use strict';
// Markdown report of the v1.14.0 obstacle-rule change list (test/corpus/notam-obstacle-changes.js).
// NOTAM text is public aeronautical information; no crew data is read or written here.

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
  RWY_AVAILABILITY: 'runway (or aerodrome) closed / not available',
  CLOSED_TO_TRAFFIC: 'an area closed to aircraft / traffic',
  TWY_AVAILABILITY: 'taxiway closed / restricted',
  APRON_STAND: 'apron, stand or gate closed / not available',
  DECLARED_DISTANCES: 'declared distances (TORA/TODA/ASDA/LDA) changed',
  THRESHOLD: 'threshold displaced / relocated / temporary',
  NAVAID: 'a navaid out of service, unreliable or disturbed',
  LIGHTING: 'aerodrome lighting out of service',
  PROCEDURE_AVAILABILITY: 'a procedure not available / suspended / withdrawn',
  PROCEDURE_CHANGE: 'a procedure introduced, adjusted or amended',
  LOW_VIS_OPS: 'low-visibility operations amended / suspended',
  SURFACE_PENETRATION: 'a surface penetrated / infringed, or a close-in obstacle',
  SURFACE_NAMED: 'an obstacle in or above a named surface (approach, transitional, horizontal, conical, OLS, OFZ)',
  RUNWAY_STRIP: 'an obstacle in the runway strip / graded area / RESA',
  PROCEDURE_AREA_AFFECTED: 'a flight procedure or take-off path area "affected", no height or gradient stated',
  HEIGHT_NEAR_PROCEDURE: 'a height given near a procedure (approach, SID, STAR, ILS …), no effect stated',
  HEIGHT_NEAR_RUNWAY: 'a height given near a runway (RWY, THR, RCL …), no procedure named, no effect stated',
};

const cell = s => String(s === null || s === undefined ? '' : s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const yes = b => b ? 'shown' : 'hidden';

function why(e) {
  const by = e.fmt === 'FK' && e.byHeadingOnly ? 'printed under OBSTACLE (no obstacle word)' : 'says OBST / OBSTACLE / CRANE';
  if (e.group === 'B') {
    return `obstacle NOTAM (${by}); no effect on runway / approach / SID / STAR heights or gradients stated` +
      (e.e1 ? `; v1.13.0 showed it for the keyword "${e.e1}"` : '; v1.13.0 showed it (no obstacle word, not filtered)') +
      (e.noEffectStated ? '; the text states no effect (e.g. OCA/H NOT AFFECTED)' : '');
  }
  const p = `${e.pattern}: ${WHAT[e.pattern] || ''}`;
  if (e.group === 'C') return `${p} (v1.13.0 hid it: obstacle word and none of its keywords)`;
  return `${p}${e.noEffectStated ? '; the text also states no effect on some procedure (e.g. OCA/H NOT AFFECTED)' : ''}; v1.13.0: ${e.before.noWindow ? 'shown' : 'hidden'}`;
}

function table(rows) {
  const out = ['| # | Package | Airport | NOTAM ID | Category | First 2 body lines | Reason (pattern) | No window v1.13.0 → v1.14.0 | Notes |',
               '| --: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |'];
  rows.forEach((e, k) => {
    const notes = [...(e.notes || []), ...(e.windows ? [`airport windows: ${e.windows.join(', ')}`] : []),
                   ...(e.before.sweep ? [`TC-171-030 sweep shown: ${e.before.sweep} → ${e.after.sweep}`] : [])];
    out.push(`| ${k + 1} | \`${cell(e.pkg)}\` | ${cell(e.airport)} | ${cell(e.id || '—')} | ${cell(e.category || (e.fmt === 'NB' ? 'NavBlue' : '—'))} | ${cell(e.body.join(' / '))} | ${cell(why(e))} | ${yes(e.before.noWindow)} → ${yes(e.after.noWindow)} | ${cell(notes.join('; '))} |`);
  });
  return out.join('\n');
}

function report(res) {
  const E = res.entries;
  const g = (x, f) => E.filter(e => e.group === x && (!f || e.fmt === f));
  const uniq = arr => new Set(arr.map(e => `${e.airport} ${e.id || e.sha}`)).size;
  const patCount = x => {
    const c = {};
    for (const e of g(x)) { const k = e.pattern || '(none)'; c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  };
  const st = res.stats;
  const L = [];
  L.push('# RPT-NOTAM-ObstacleRule-ChangeList — NOTAM ruleset v1.14.0 (Exec decision D67)');
  L.push('');
  L.push('**Version:** v1.0-NEW | **Status:** NEW | **Date:** 2026-11-18');
  L.push('**For:** the Exec\'s review of the change list before v1.14.0 is published to Drive (it is not built into the app; beta takes it in step 5e).');
  L.push(`**Modules:** before \`${res.before}\` (SHA-256 \`${res.sha.before.slice(0, 8)}…\`), after \`${res.after}\` (SHA-256 \`${res.sha.after.slice(0, 8)}…\`); FlightKeys parser for \`notamsRaw\`: \`${res.fkParserFile}\` (SHA-256 \`${res.sha.fkParser.slice(0, 8)}…\`, velocemente/relief-pilot#63), its output as stored in the fixtures repository (\`expected/notam-rules-v1.14.0/fk-notams-raw.json\`, the file the CI tests read).`);
  L.push('**Made by:** `node test/corpus/fk-notams-raw-export.js --out <fixtures>/expected/notam-rules-v1.14.0/fk-notams-raw.json`, then `node test/corpus/notam-obstacle-changes.js --fk-raw <that file> --report <this file> --data test/rules/data/notam-v1.14.0-obstacle-changes.json`, then `tools/redact` (no replacement made: the list holds no crew data).');
  L.push('');
  L.push('> **Public repository.** NOTAM text is public aeronautical information and is quoted as printed (first two body lines). No crew names, employee numbers, dispatcher names or phone numbers.');
  L.push('');
  L.push('## Counts');
  L.push('');
  L.push('| Group | What | All | NavBlue/eOFP | FlightKeys | Different NOTAMs (airport + ID) |');
  L.push('| :-- | :-- | --: | --: | --: | --: |');
  L.push(`| **B** | shown → hidden | **${g('B').length}** | ${g('B', 'NB').length} | ${g('B', 'FK').length} | ${uniq(g('B'))} |`);
  L.push(`| **C** | hidden → shown | **${g('C').length}** | ${g('C', 'NB').length} | ${g('C', 'FK').length} | ${uniq(g('C'))} |`);
  L.push(`| **U** | undecided, shown | **${g('U').length}** | ${g('U', 'NB').length} | ${g('U', 'FK').length} | ${uniq(g('U'))} |`);
  L.push(`| | of which hidden by v1.13.0 (hidden → shown) | ${g('U').filter(e => !e.before.noWindow).length} | ${g('U', 'NB').filter(e => !e.before.noWindow).length} | ${g('U', 'FK').filter(e => !e.before.noWindow).length} | ${uniq(g('U').filter(e => !e.before.noWindow))} |`);
  L.push('');
  L.push(`Corpus: ${st.navblue.fixtures} NavBlue/eOFP fixtures, ${st.navblue.notams.toLocaleString('en')} NOTAMs (whole OFP text, the TC-171-030 split), ${st.navblue.calls.toLocaleString('en')} \`evalNotams()\` calls; ${st.flightkeys.packages} FlightKeys packages, ${st.flightkeys.airports} airports with NOTAMs, ${st.flightkeys.items.toLocaleString('en')} items under ${st.flightkeys.headings} type headings, ${st.flightkeys.calls.toLocaleString('en')} calls. **Every NOTAM that is not in this list gives exactly the same \`evalNotams()\` result in v1.13.0 and v1.14.0 at every evaluation** (the new optional field \`fkCategory\` left out); the script stops on any other difference, and found none.`);
  L.push('');
  const bHead = g('B').filter(e => e.byHeadingOnly).length;
  L.push(`Reasons — B: no effect stated (all ${g('B').length}; ${bHead} are FlightKeys items printed under OBSTACLE with no obstacle word, which v1.13.0 did not treat as obstacle NOTAMs; ${g('B').filter(e => (e.notes || []).length).length} are NavBlue pieces with a note). C: ${patCount('C')}. U: ${patCount('U')}.`);
  L.push('');
  L.push('## How the list was made');
  L.push('');
  L.push('- **NavBlue/eOFP:** the whole OFP text of each fixture, split as TC-171-030 splits it (v1.13.0 and v1.14.0 split it identically). Each NOTAM evaluated alone, with no window (`etaMin` null: in effect) and at the TC-171-030 sweep (ORIG and DEST; ETA 0000, 0059, 0500, 1000, 1159, 1200, 1640, 2300, 2359Z; departure unknown, 0000Z, 1140Z; with and without the flight date). The whole-text split also yields pieces that are not one NOTAM (the OFP text before the first NOTAM, or a last NOTAM that runs on into the weather); they are listed with a note, as the corpus holds them. In the app each airport card reads its own NOTAM text, not these pieces.');
  L.push('- **FlightKeys:** each airport\'s `notamsRaw` (the NOTAM section as printed, type headings included) from the FlightKeys parser v0.3.0. v1.14.0 reads `notamsRaw` as it is: `_splitNotams()` cuts out the headings and every item carries its heading as `fkCategory`. v1.13.0 reads the same items without headings (the parser\'s `notams` text), as it would be given them — a heading inside v1.13.0 text joins the item above it (O-12). Each item alone, with no window and at each of its airport\'s windows (the briefing\'s role windows, at their midpoint, as TC-162 evaluates them).');
  L.push('- **Groups.** B and C compare the result with no window (the obstacle rule does not depend on time; at an airport window the NOTAM may also be out of effect — the windows are in the notes). U is every obstacle NOTAM v1.14.0 shows because the patterns cannot decide (`OBSTACLE_RULE.undecided`, a height near a procedure or a runway), whatever v1.13.0 did; the row says whether v1.13.0 showed it.');
  L.push('- The same NOTAM printed in several packages is listed once per package.');
  L.push('');
  L.push('## The pattern set (SPEC v1.14.0 §8a; `OBSTACLE_RULE` in the module)');
  L.push('');
  L.push('| Step | Pattern | Meaning |');
  L.push('| :-- | :-- | :-- |');
  const step = id => ['MINIMA_CHANGED', 'MINIMA_VALUE', 'NOT_AUTHORISED', 'GLIDE_PATH_VGSI', 'OBSTACLE_CLEARANCE', 'CLIMB_GRADIENT', 'TKOF_ODP', 'TKOF_MINIMA', 'PROCEDURE_ALTITUDE'].includes(id) ? '1 effect → shown'
    : ['SURFACE_PENETRATION', 'SURFACE_NAMED', 'RUNWAY_STRIP', 'PROCEDURE_AREA_AFFECTED', 'HEIGHT_NEAR_PROCEDURE', 'HEIGHT_NEAR_RUNWAY'].includes(id) ? '3 undecided → shown (U)' : '2 other → shown';
  for (const [id, w] of Object.entries(WHAT)) L.push(`| ${step(id)} | \`${id}\` | ${w} |`);
  L.push('| 4 | — | none of the above → **hidden** |');
  L.push('');
  L.push('## Group B — shown → hidden');
  L.push('');
  L.push(table(g('B')));
  L.push('');
  L.push('## Group C — hidden → shown');
  L.push('');
  L.push(table(g('C')));
  L.push('');
  L.push('## Group U — undecided (shown)');
  L.push('');
  L.push(table(g('U')));
  L.push('');
  return L.join('\n') + '\n';
}

module.exports = { report, WHAT };
