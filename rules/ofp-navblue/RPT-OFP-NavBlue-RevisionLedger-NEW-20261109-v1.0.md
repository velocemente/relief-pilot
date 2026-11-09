# NavBlue OFP Parser — Revision Ledger

**File Standard:** `RPT-OFP-NavBlue-RevisionLedger-NEW-20261109-v1.0.md` (first ledger of this module; the 5Y OFP ruleset had none — its history was kept in the SPECs' version tables)
**Module:** `ofp-navblue` — file `rules/ofp-navblue/ofp-navblue-v2.0.0.js`
**Current Version:** 2.0.0 (contract v2.0) — **LOCKED** (ADR-005 §2.4; Exec, 7 Nov 2026; D47)
**Lines:** 1,629
**Patterns:** 47 `PATTERNS` entries (46 RegExp + `APT_LINE_TEMPLATE`)
**QA Status:** TC-130-001 … 030 PASS (14/14); lock 30/30 fixtures, 1,710 core fields, 0 differences (NAT parser passed in, both entry points). Independent QA 3a: CHANGES-REQUESTED (F1–F3) — addressed in N-11, b-8 and O-1; re-QA pending
**Last Updated:** 2026-11-09

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 11 (N-01 through N-11) |
| Current Version | 2.0.0 |
| Engine source | the app on `main` at `d073e54` (`src/ofp-parse.html`, ENR V2 helpers of `src/render-preflight.html`) |
| Masters reconciled | Drive "00_General Rulesets / 20_5Y specific / V1.0": CODE v1.0 (56,451 bytes, SHA-256 `a4ffdd8d…858e99a9`), CODE v1.1 (728 bytes, header only), SPEC v1.0, SPEC v1.1. "90_Old Versions": `5Y-ofp-rules.js` (v1.9.0, 39,304 bytes, SHA-256 `76de363a…3dd6feb1`); "V1.2 (ARCHIVED 2026-10-29)": CODE v1.2 (delta), SPEC v1.2 |
| Gate Status | N-11 pending Exec gate (ADR-005 §2.2.6) and independent QA; master copy to be written to Drive at the gate |
| Integration | not integrated; the app still runs its own copy (separate PR, SPEC §8) |

The module **follows the app**. Where a master differs from the app, the app's behaviour is kept and the difference is listed in the reconciliation below: (a) app changes since May, (b) older differences, (c) content only in a master.

---

## History

### N-01 — ofp-rules.js v1.9.0 (ADR-001 ruleset)

**Source:** `5Y-ofp-rules.js` in "90_Old Versions" (header "ofp-rules.js — OFP Format Ruleset v1.9.0").
The first standalone OFP ruleset: metadata `RULESET_TYPE 'ofp'`, `RULESET_VERSION '1.9.0'`, `SCHEMA_VERSION 1`, `OFP_FORMAT 'atlas-v2'`, `RULESET_SOURCE`; 24 `PATTERNS`; parse function named `parseOFP(rawText)`; `'use strict'`; `module.exports` only. This metadata block is still the app's § 1 today (reconciliation b-1).

### N-02 — 1.9.9-r1, master file v1.0 (2026-05-13, NEW)

**Source:** `CODE-OFP-AtlasPolar5yRuleset-NEW-20260513-v1.0.js`, `SPEC-…-v1.0.md`.
Re-extraction from `index.html` v1.9.9 as the "5Y" ruleset, IIFE-wrapped, `var` only. Exports (SPEC §4): `PATTERNS, ALT_PATTERNS, CFS_PATTERNS, WX_SECTION_LABELS, WX_METAR_ANCHOR, WX_NOTAM_START, WX_PAGE_HEADER, CAT_II_III_PATTERNS, COMPANY_NOTAM, TLR_PATTERNS, ALT_ROUTE_PATTERNS, MONTHS, MON_NAMES, elapsedToMins, wxWindowMidpoint, normalizeWaypointCoord, _ofpRulesetParse`. New: `SLOT_TIME_AT` (bare "WHEELS UP HHMMZ", priority 5 above curfew). Embedded self-test, 9 assertions. 54 return fields.

### N-03 — 1.9.9-r2, master file v1.1 (2026-05-30, UPD)

**Source:** `SPEC-…-UPD-20260530-v1_1.md` (the v1.1 CODE file in Drive is a 728-byte header comment; it holds no code).
New: `ZFW_INCR_FACTOR` (`ZFW INCR/1000 X nnn MINF ADJ`) → `zfwIncrFactor`; `TAXI_FUEL` (single-line and split-line) → `taxiFuelRaw`. Self-test 9 → 14.

### N-04 — 1.9.9-r3, master file v1.2 (2026-09-13, UPD) — ARCHIVED, never deployed (D9, 2026-10-29)

**Source:** `CODE-…-UPD-20260913-v1_2.js` (a delta document, not a module), `SPEC-…-v1_2.md`.
C1 ops-notes over-capture guard (`OPSNOTE_GUARD`); C2 `OFP_FORMAT 'atlas-5y'` + `ofpSource`; C3 `ofpSections` page map. Superseded by the HF-2 pairing fix (N-08). Not carried (c-5 … c-8).

### N-05 — PB-ALT-01 (app, `5525813`, 2026-06-02)

Alternate routes: the section no longer ends at a `PAGE n` line; page-footer lines are stripped from the route text (`_stripAltPage`). A route that runs across a page break is complete.

### N-06 — PB-ENR-01 (app, `6fb47fa`, 2026-06-03)

ETOPS exit from the OFP header, else the navlog `(E.EXT)` time (`extractEtopsExitV2`); ETP elapsed times from the navlog TOT-T (`applyNavlogEtpTimes`) — the CFS data-row time was the diversion time, not departure → ETP (BUG 1); `rawOFP` added to the return (field 57).

### N-07 — Production 1.9.9 "Deploy Package" (app, `ddc59db`, 2026-06-04)

`SLOT_TIME_AT` (absent from the app's 2 Jun parser) added with a negative look-ahead (no match when MUST / NOT / BEFORE / BETWEEN follows) and matched before the curfew form; its time is kept as captured. Crew lines: the curly apostrophe (U+2019) is accepted in names and normalised to `'` before matching.

### N-08 — HF-2 / DEF-B Remarks pairing (app, `b4058e1`, velocemente/relief-pilot#5, 2026-10-30)

`extractAptOpsNotes()` reads each `Remarks` section of each release copy separately (it ends at RAIM VALIDATION / AUTHORIZED CAT / MEL/CDL / an underline) and takes delimiter **pairs** (0–1, 2–3 …). Fixes "the whole OFP shown as departure Company Remarks" (RPT-OFP-LiveDefectDiagnosis DEF-B); supersedes N-04 C1.

### N-09 — Crew comment samples replaced with fakes (app, `b08b90c`, velocemente/relief-pilot#18, 2026-10-31)

Comment only; no behaviour change.

### N-10 — `index.html` split into `src/` modules (app, `513eeeb`, velocemente/relief-pilot#9, 2026-10-30)

No code change; the parser is `src/ofp-parse.html`.

### N-11 — Module extraction v2.0.0: NavBlue, locked; contract v2.0 (2026-11-09)

**Type:** EXTRACTION (no behaviour change) · **Brief:** SPRINT-OFP-ModularPlatform step 3 (ADR-005 §5.3)
- Engine = the app on `main` at `d073e54`, byte for byte (SPEC §7): `src/ofp-parse.html` § 2 – § 10 and the ENR V2 helpers from `src/render-preflight.html`. Three marked edits in `_ofpRulesetParse`: JSDoc line, `options` parameter, NAT call via `_natTrackFrom()`.
- NAT track parser passed in only: `options.parseNatTrack` (a function) is called with the app's arguments `(t, origIcao, destIcao)`. Not passed → `natTrack` null (the app's value when no NAT track is found) and `parseNavBlue()` adds one `findings[]` INFO "NAT parser not supplied". The module never reads `window`, `document` or any app global (QA 3a F1: the first draft fell back to `window.parseNatTrack`; removed). The app passes `{ parseNatTrack: window.parseNatTrack }` at integration (SPEC §8 step 3c).
- New: metadata (`'ofp'`, `'navblue'`, `'2.0.0'`, `SCHEMA_VERSION 2`, `CONTRACT_VERSION '2.0'`, `RULESET_SOURCE`), `validateSchema()`, `parseNavBlue()`, `CORE_FIELDS` (57), `EXTENSION_FIELDS` (12), the nested extension lists.
- Every ADR-005 Appendix B extension returned as an explicit empty value; `findings` = one INFO "sections: content-built bookmarks arrive in step 5" (plus the NAT INFO above when no NAT parser is passed).
- Not in the module: `parseOFP()`, `fuelK()`, `deriveCallsign()`, the D-EVAL timeline, UI.
- Tests: `test/rules/ofp-navblue.test.js` TC-130-001 … 030 (14 tests), run by `npm test`.
- Tests TC-130-003 and TC-130-015 load and run the module with `window`, `document`, storage and app globals that throw on any access (`typeof` included): none is touched. TC-130-015 also shows that a published `window.parseNatTrack` is never called.
- Lock evidence: 30 NavBlue/eOFP fixtures, 57 fields each (1,710), 6,464 values; module in the app context and in Node, the NAT parser passed in on both entry points (`_ofpRulesetParse`, `parseNavBlue` core); 0 differences. Golden, NOTAM and app-path snapshots unchanged (33/33 each). `src/`, `build/` and `index.html` unchanged.

---

## Reconciliation — the masters vs the app (2026-11-09)

Method: the v1.0 master (exact bytes from Drive) and `5Y-ofp-rules.js` were compared with the app's parser block line by line, with `var`/`const`/`let` and indentation normalised so that only real differences remain; the v1.1 and v1.2 masters (no code / delta only) were read in full and compared item by item. Every difference was traced to the app's git history (`git log -S`). The repository's history starts on 2026-06-02 (`c9bcf11`, PB-OFP-01r1): changes between 13 May and 2 Jun are not in git. At `c9bcf11` the app already had the v1.1 content (`TAXI_FUEL`, `ZFW_INCR_FACTOR`, `zfwIncrFactor`, `taxiFuelRaw`), so v1.1 matches the app.

### (a) Changes in the app since May (carried — the module follows the app)

| # | Change | Commit / PR | Effect vs master v1.0 |
| :- | :- | :- | :- |
| a-1 | Alternate routes across a page break | `5525813` PB-ALT-01 (2 Jun) | `ALT_ROUTE_PATTERNS.SECTION_RE` no longer stops at `\nPAGE \d`; page lines stripped from the route |
| a-2 | ETOPS exit V2, ETP times from the navlog, `rawOFP` | `6fb47fa` PB-ENR-01 (3 Jun) | header-only exit → header then `(E.EXT)`; ETP `elapsedMins` from navlog TOT-T, the CFS data-row stamp removed; return gains `rawOFP` |
| a-3 | Slot time "AT" form; crew apostrophes | `ddc59db` production 1.9.9 (4 Jun) | `SLOT_TIME_AT` gains a negative look-ahead; matched before curfew; time not upper-cased (master: `_fmtT`); crew regex accepts U+2019 and normalises it |
| a-4 | Remarks pairing (DEF-B) | `b4058e1`, velocemente/relief-pilot#5 (30 Oct) | ops notes per `Remarks` section, delimiter pairs; master: every adjacent pair over all text before the company NOTAMs, plus a leading "-" strip |
| a-5 | Crew comment samples → fakes | `b08b90c`, velocemente/relief-pilot#18 (31 Oct) | comment only |
| a-6 | Split into `src/` | `513eeeb`, velocemente/relief-pilot#9 (30 Oct) | none |
| a-7 | v1.1 content | present at `c9bcf11` (2 Jun) | `TAXI_FUEL`, `ZFW_INCR_FACTOR`, `taxiFuelRaw`, `zfwIncrFactor` — as SPEC v1.1 |

### (b) Older differences (reported; the module follows the app)

| # | Difference | Disposition |
| :- | :- | :- |
| b-1 | **Metadata and naming disagree across copies.** The app carries the § 1 block of the old `ofp-rules.js` v1.9.0 (`RULESET_VERSION '1.9.0'`, `SCHEMA_VERSION 1`, `OFP_FORMAT 'atlas-v2'`, banner "v1.9.0-r3"); masters v1.0/v1.1 have no metadata at all (their headers say 1.9.9-r1 / -r2); archived v1.2 proposed `'atlas-5y'`. | Replaced by the module's own metadata (`'navblue'`, `'2.0.0'`, schema 2). The app's values stay in the app until integration. |
| b-2 | **Packaging.** Master v1.0 is an IIFE with `var` only ("required for the non-strict scope", SPEC v1.0 §12) that exports only through `module.exports`: inlined as the SPEC says, it publishes nothing in a browser. The app's code is `const`/`let` in a **strict** script. | Module: factory as the NOTAM module, strict, the app's `const`/`let`, global `OfpNavBlue`. |
| b-3 | **Master `SLOT_TIME_AT` behaves differently from the app's.** No look-ahead; matched after the curfew test (display priority the same); time upper-cased by `_fmtT`. Arrived separately in the app (a-3), not from the master. | App kept. The lower-case "z" form stays as captured (SPEC §10). |
| b-4 | **The v1.0 master's crew-parser comment contains real crew sample lines (names and employee numbers).** The app's copy was replaced with fakes (a-5). | Not copied anywhere. **Recommend the Exec scrub or restrict the v1.0 master file in Drive.** |
| b-5 | **Pattern counts in the SPECs are wrong.** SPEC v1.0 says 40 `PATTERNS`, v1.1 says 42; the v1.0 file has 45, the app/module 47 (+ `TAXI_FUEL`, `ZFW_INCR_FACTOR`). | Documentation only; this ledger records 47. |
| b-6 | **The v1.1 code master is a header only** (728 bytes); the v1.1 change exists only as SPEC text and in the app. | The app is the only code copy of v1.1; carried from it. |
| b-7 | **Return shape.** Master v1.0 returns 54 fields; the app returns 57 (`zfwIncrFactor`, `taxiFuelRaw` from v1.1; `rawOFP` from a-2). | 57, as ADR-005 Appendix A. |
| b-8 | **The v1.0 master crashes in Node, contrary to its SPEC.** Its parser reads `window.parseNatTrack` with no guard, so every call throws `ReferenceError: window is not defined` outside a browser. SPEC v1.0 says "dual-context (Node + browser inline)" and "Dependencies: None (pure function)". The master was never runnable in Node: any self-test that parses text (v1.1 #12) cannot pass against it. (QA 3a F2, confirmed by the QA session on the exact Drive bytes.) | The module never reads `window`: the NAT parser is passed in (N-11); it runs in Node, the rules loader and the browser (TC-130-003). |

### (c) Content only in a master (not carried)

| # | Content | Master | Disposition |
| :- | :- | :- | :- |
| c-1 | Embedded self-test (`require.main === module`, 9 assertions; v1.1 SPEC: 14) | v1.0 / v1.1 | Not carried as code; the same 14 assertions run in TC-130-016 |
| c-2 | ETOPS exit from the header only; ETP elapsed stamped from the CFS data row | v1.0 | Superseded by a-2 (the data-row time was wrong: BUG 1) |
| c-3 | Alternate-route section ends at `\nPAGE \d` | v1.0, `5Y-ofp-rules.js` | Superseded by a-1 |
| c-4 | Ops notes over all adjacent delimiter pairs; leading "-" strip | v1.0 | Superseded by a-4 |
| c-5 | `OPSNOTE_GUARD` (600-character cap, `SECTION_LEAK_RE`, `DELIM_LEAK_RE`, both-sides delimiting) | v1.2 (archived) | Superseded by HF-2 (D9); not carried |
| c-6 | `OFP_FORMAT 'atlas-5y'`; `_ofpRulesetParse(rawText, opts)` with `opts.hasEmbeddedOutline` → `ofpSource` (`company` / `jepp-eofp` / `unknown`); return fields `ofpFormat`, `ofpSource` | v1.2 (archived) | Not carried: not in contract v2.0; the source and format belong to the import platform (detector) |
| c-7 | `OFP_SECTION_ANCHORS` (8 anchors: Flight Plan per revision, TLR, Company Notams, Weather & Notams, PAC Tracks, NAT Tracks, Maps and Company Docs, Weather Charts), `OFP_PAGE_FOOTER_RE`, `buildOfpSections()` (described, no code), return `ofpSections [{label, page}]` | v1.2 (archived) | Not carried; contract `sections[]` arrive in step 5 (the INFO finding). **Useful input for step 5** (ADR-005 §2.6). |
| c-8 | Self-test assertions 15–20 (commented out in the delta) | v1.2 (archived) | Not carried |
| c-9 | Parse function named `parseOFP(rawText)`; `'use strict'` + `module.exports` only; 24 `PATTERNS`; `WX_METAR_ANCHOR` without "NO METAR REPORTS FOUND FOR"; no `CAT_II_III_PATTERNS` | `5Y-ofp-rules.js` v1.9.0 | Older than the app in every respect; nothing in it the app lacks. Its metadata block survives in the app (b-1). |

---

## Pending items

| ID | Item | Status |
| :- | :- | :- |
| NB-01 | Integration into `index.html` (build entry, app binds `_ofpRulesetParse` to the module, app copy removed) | Planned — separate PR (SPEC §8) |
| NB-02 | ENR V2 helpers exist twice (module § 9b and `src/render-preflight.html`) until the en-route timeline module owns them | Open — with the ENR module |
| NB-03 | Master copy of v2.0.0, this SPEC and ledger written to Drive at the gate; v1.0/v1.1/v1.2 masters to "90_Old Versions" | Exec, at the gate |
| NB-04 | v1.0 master in Drive carries real crew sample lines (b-4) | Exec decision |
| O-1 | **`navLog` is empty for NavBlue packages in the app today; locked as-is (D47).** `navLog` is `[]` on all 30 fixtures in the app, in the module and in the committed golden snapshots (the navlog row pattern expects a time form the packages do not print). The lock therefore compares `navLog` only as an empty list; a change to that sub-parser is caught by the byte compare of the copies (TC-130-004), not by the lock. (QA 3a F3.) | Open — reported only; any change needs an Exec decision and its own gate |

---

## Changelog

| Ledger | Date | Change |
| :- | :- | :- |
| v1.0 | 2026-11-09 | First ledger. History N-01 … N-10 from the 5Y SPECs v1.0/v1.1/v1.2, the archived files and the app's git history; extraction N-11; reconciliation (a)/(b)/(c). |
| v1.0 (QA 3a) | 2026-11-09 | After independent QA 3a: N-11 NAT hook is passed-in only, with the "NAT parser not supplied" INFO (F1); b-8 v1.0 master's Node crash added (F2); O-1 `navLog` empty for NavBlue added (F3). Module SHA-256 in `rules/manifest.json` updated. |
