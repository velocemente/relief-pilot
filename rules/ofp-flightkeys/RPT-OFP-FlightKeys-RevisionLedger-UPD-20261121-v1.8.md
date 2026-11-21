# FlightKeys OFP Parser — Revision Ledger

**File Standard:** `RPT-OFP-FlightKeys-RevisionLedger-UPD-20261121-v1.8.md` (supersedes ledger v1.7 of 20 Nov)
**Module:** `ofp-flightkeys` — built in: `rules/ofp-flightkeys/ofp-flightkeys-v1.0.0.js` (key `ofp-flightkeys`); next: `rules/ofp-flightkeys-next/ofp-flightkeys-v1.0.1.js` (key `ofp-flightkeys-next`, not built in, D90)
**Current Version:** 1.0.1 (step 5e-2 module PR, O-100; not built in until its integration PR, D90); the app runs 1.0.0 (built in by the switch PR, step 5e-1 PR 2, O-74)
**Contents:** `parseFlightKeys()`. Release rows 1–23, 29–31, 33, 34, 36, 39–41 (v0.1.0) plus rows 24–28, 32, 32a, 35 and the Appendix B release/remarks extensions (v0.2.0) of field map v1.1, the briefing (v0.3.0, step 5d, D64): rows 37, 38, 43–45, 48, 50, and the rest of the briefing package (v0.4.0, step 5d-2, O-33 … O-45): rows 42, 46, 47, 49, Company NOTAMs, hazards, PACOTS; airport NOTAM type headings for NOTAM v1.14.0 (D67); the Exec answers O-46 … O-49 (K-11) and O-50 … O-52 (K-12); v1.0.0 (step 5e-1 PR 1): the NAT call with `{ filed, findings }`, NAT findings forwarded (O-68), version-free deferred INFO (O-84) (K-13).; v1.0.1 (step 5e-2): crew-facing finding texts without internal references (O-100) (K-14). Contract 2.4.
**QA Status:** TC-160 20/20, TC-161 27/27, TC-162 22/22, TC-163 28/28, TC-164 14/14, TC-175 10/10 PASS on the 26 FlightKeys fixtures; independent QA of v1.0.1 pending (step 5e-2 module PR)
**Last Updated:** 2026-11-21

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 14 (K-01 … K-14) |
| Current Version | 1.0.1 (next, not built in); 1.0.0 built in |
| Sources | Field map `SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1`, since K-09 v1.2 (`…-UPD-20261118-v1.2-FieldMap.md`) (rows, SME-1 … SME-23, SME-3a, SME-18a); `rules/ofp-navblue` v2.0.1 (contract and NavBlue rules, FK-P); `rules/icao-fpl` v1.0.0; `rules/aircraft-profile` v1.0.0; 5b-1 QA on relief-pilot #60 (F3, F4); QA of relief-pilot #62 (F1–F4); Exec decisions D63, D63a; the Exec's 8 truth sheets (Rev 00) |
| Masters reconciled | v1.0.1: none yet — published to the Drive after its own QA, before its integration PR (D90, CLAUDE.md rule 14); it must be byte-identical to `rules/ofp-flightkeys-next/ofp-flightkeys-v1.0.1.js` (SHA-256 in `rules/manifest.json`). v1.0.0: as K-13 |
| Gate Status | release version; gate O-68 met on the module side (the crew display is PR 2, O-76) |
| Integration | v1.0.1 **not built in** (D90, O-103 option B: this module PR, then display PR 1, then display PR 2); the app keeps v1.0.0, **built in** by the switch PR (step 5e-1 PR 2, O-74; TC-174), with icao-fpl v1.0.0, NOTAM v1.14.0 and the NAT ruleset v1.2.0: `src/ofp-parse.html` routes a FlightKeys package (detector O-78) to `parseFlightKeys({ text, pages }, { icaoFpl, aircraftProfile, notamRules, parseNatTrack })` (O-18); `processPDF` keeps the positioned items; the findings are stored with the flight and shown on the Preflight card (O-76, O-87, O-88). Module file unchanged (SHA-256 `8a7d3e8f…8e40`). Beta stays 1.9.9-hf6 (O-75) |

---

## History

### K-14 — v1.0.1: internal references out of the crew-facing finding texts (step 5e-2 module PR) (2026-11-21)

**Type:** UPD · **Brief:** step 5e-2 module PR (Exec answers O-100, O-103 option B, sheet "Scoping Decisions", 5e-2 rows; D90, D91, D92, D99) · contract 2.4 unchanged · not built in (D90)
- **O-100:** the internal references `(SME-n)`, `(O-n)`, `(D63a)` and combinations are removed from every crew-facing finding text, at the source: **10 WARN and 17 INFO templates** (SPEC §5.25), shown or not. Meaning, wording and capitals kept; only the space before a removed bracket, and `; SME-18a` inside `(aircraft …)`, tidied. Level, field and code unchanged. No version number in any text (D99).
- **On the 26 (TC-175-010), against v1.0.0:** every field but `findings` byte-identical; `findings[]` the same length, order, level, field and code; 114 texts change (4 WARN, 110 INFO) in all 26 packages; 306 unchanged. The 4 WARNs shown on OFP Alerts: L08, L22 (NAT one-direction crew alert), L21 (NZWN takeoff alternate), L23 (ETAR curfew, effective dates not stated) — shown with the new text once integrated (TC-175-020, index.html with v1.0.1 swapped in, in memory).
- **Scoping counts:** WARN 10 = 10; INFO 14 (scoping) vs 17 (build): the 14 fire on the 26, 3 do not (`dispatchContact` null, `enrouteNotams` O-40 no FIR block, O-49 emptied blocks) — all 17 changed.
- **Wiring:** manifest key `ofp-flightkeys-next` (the `notam-rules-next` / `nat-rules-next` pattern); `index.html`, `src/`, `build/` unchanged; TC-174-001 / 002 carry one declared exception for that key (O-79 retired the `*-next` keys at the switch; O-116).
- **Not changed (O-115):** `(CS-1)`, `rows 29–31`, `read in 5d`, `(§A.8)` — outside O-100's listed patterns.
- **Tests:** TC-175-001 … 005, 010, 011, 020, 030, 090 (`test/rules/ofp-flightkeys-v101.test.js`, 10 tests; positive and negative per CLAUDE.md rule 6). Pinned values: fixtures `expected/ofp-flightkeys-v1.0.1/messages.json` (exporter `test/corpus/fk-v101-expected-export.js`).
- **Module:** new `rules/ofp-flightkeys-next/ofp-flightkeys-v1.0.1.js` (= v1.0.0 + header paragraph, `RULESET_VERSION`, 28 template lines); `rules/manifest.json` new entry with its SHA-256. SPEC v1.0.1 beside SPEC v1.0.0.
- **Unchanged:** `index.html`, `src/`, `sw.js`, `manifest.json` (1.9.9-hf6, D91), `rules/ofp-flightkeys` v1.0.0, `rules/ofp-navblue` (D47), `rules/nat-rules`, `rules/notam-rules`, `rules/icao-fpl`, the golden, NOTAM and app-path snapshots.

### K-13 — v1.0.0: the NAT call with { filed, findings }; version-free deferred INFO (step 5e-1 PR 1) (2026-11-20)

**Type:** UPD · **Brief:** step 5e-1 PR 1 (Exec answers O-74 … O-85, sheet "Scoping Decisions" tab 5e-1) · release version v1.0.0 (D58), contract 2.4 unchanged · not built in (O-74)
- **O-68 (module side):** the filed NAT letter (OFP page 1 route + ICAO FPL route, D78) is worked out **before** the NAT call; the NAT ruleset is called `parseNatTrack(text, orig, dest, { filed, findings })`; its findings are appended to `findings[]` as given (`{ level, field: 'natTrack', code, message }`), after the D74 WARN and before the `natTrack` INFO. The probe call (flight direction) has no options. D79 `NAT-FILED-NOT-IN-MESSAGE` and D81 `NAT-RANDOM-ROUTE` now reach `findings[]`. The module's own `assignedId` / `assigned` lines are kept (no-op with v1.2.0; a parser that ignores the options still works).
- **O-84:** the deferred-field INFO is version-free: `not read: not in any brief yet (open item)` (was `not read in v0.4.0: …`).
- **O-80:** as built — the text-only WARN already exists (`positioned items (input.pages) not supplied; read from text only`); no change. **Item 4:** `notamRules` absent → the existing WARNs kept (O-18 is passed by the app in PR 2).
- **On the 26 (TC-164-020), against v0.4.0 (frozen as `test/oracle/ofp-flightkeys-v0.4.0.js`):** with the app's NAT v1.1.0 only `natTrack` on L08, L11, L12, L22, L23 (O-85: the brief's "L10" is L08) and the findings — INFO `NAT-RANDOM-ROUTE` on L08, L12, L22, L23 and the O-84 text on 26; with NAT v1.2.0 (3 arguments) `natTrack` is equal on all 26. No `NAT-FILED-NOT-IN-MESSAGE` on the 26. Every other field and finding identical.
- **Tests:** TC-164-001 … 021, 090 (`test/rules/ofp-flightkeys-v100.test.js`, 14 tests; positive and negative per CLAUDE.md rule 6); TC-160-001 / 002 pin 1.0.0; TC-160-005, TC-162-001, TC-163-001b, TC-163-100 compare the deferred INFO version-free (O-84). Pinned values: fixtures `expected/ofp-flightkeys-v1.0.0/nat.json` (exporter `test/corpus/fk-v100-expected-export.js`).
- **Module:** `ofp-flightkeys-v1.0.0.js` (renamed from v0.4.0; header, `RULESET_VERSION`, `_readNat`, the deferred INFO); `rules/manifest.json` version, file and SHA-256.
- **Unchanged:** `index.html`, `src/`, `sw.js`, `manifest.json` (1.9.9-hf6, O-75), `rules/nat-rules-next` (v1.2.0, byte-identical, O-77), the NOTAM modules, NavBlue (D47) and the golden snapshots.

### K-12 — v0.4.0 (amended): Exec answers O-50 … O-52 (2026-11-20)

**Type:** UPD · **Brief:** Exec answers O-50 … O-52 (20 Nov); all earlier answers stand · same development version v0.4.0 (D58), contract 2.4 unchanged
- **O-50:** for the O-49 FIR-repeat rule the departure FIR — the first FIR block of the NOTAM Briefing — always counts as on the OFP, with or without a navigation-log FIR line for it. The O-49 INFO names it (`not on the OFP and not the departure FIR IIII`). On the 26: copies left out 6 → **1** (T2 4 → 0, L16 1 → 0, L03 1 unchanged: A4854/26 under ZGZU, not under its departure FIR PAZA); 0 NOTAMs left out under every block; `firRaw` unchanged. Only L03 now differs from build 1 in `firNotams[]` / `enrouteNotams.fir`.
- **O-51:** as built (FPL letter marked + crew-alert WARN). No change.
- **O-52:** as built (nothing left out + WARN when no navigation-log FIR line and no FPL `EET/` is read; the departure FIR does not change this). No change.
- **Byte-identity:** against the previous head (`50e13b0`) on all 26 only `firNotams[]` and `enrouteNotams.fir` (T2, L16) and the O-49 INFO (T2, L16 gone; L03's text names the departure FIR) differ; every other field and finding, and `firRaw`, are identical. TC-163-100: `firNotams` / `enrouteNotams` change only in L03 against build 1.
- **Tests:** TC-163-142 (O-50 synthetic, positive and negative, CLAUDE.md rule 6); TC-163-140 (EET case: the departure FIR keeps its copy) and TC-163-141 (rule applied independently incl. the departure FIR; T2 4 and L16 1 kept under it) updated; TC-163-100 changed list L03. Expected values re-exported (fixtures `expected/ofp-flightkeys-v0.4.0/briefing.json`: T2 +4, L16 +1 items, module SHA-256).
- **Module:** `ofp-flightkeys-v0.4.0.js` (`_firRepeats`, 3 lines + comments); `rules/manifest.json` SHA-256 updated. The Drive master copy of the module is not touched here.
- **Unchanged:** `index.html`, `src/`, `rules/nat*`, NavBlue, the NOTAM modules and the golden snapshots.

### K-11 — v0.4.0 (amended): Exec answers O-46 … O-49 (2026-11-20)

**Type:** UPD · **Brief:** Exec answers O-46 … O-49 (19 Nov); all earlier answers stand · same development version v0.4.0 (D58), contract 2.4 (addendum 4 amended)
- **O-46:** both Dispatch contact lines stay in the P0110 text as printed (44 short lines in 22 packages, 8 long in L20–L23); new package field `dispatchContact { label, text }` — REQUIRED (short form; also when both), IF QUESTIONS (long form), `null` (neither). On 26: REQUIRED 22, IF QUESTIONS 4, null 0. `EXTENSION_FIELDS` 19.
- **O-47:** `natTrack.assignedId` from the OFP page 1 route and the ICAO FPL strip route; never remarks or NOTAM text; differ → FPL letter + crew alert (O-51). On 26: L11 `W` from both routes; L08, L12, L22, L23 none.
- **O-48:** `CURFEW_TYPES` = designator → family + variant names (B762/B763/B764, B744, BLCF, B748, B772/B773/B77L/B77W/B77F); a family name applies to every variant, a variant name to that variant; no match → all lines + note + WARN (unchanged). On 26: no curfew string changed.
- **O-49:** a FIR NOTAM under more than one FIR block (same ID and text) kept only under FIRs on the OFP (navigation-log FIR lines ∪ FPL EET); other copies out of `firNotams[]` / `enrouteNotams.fir`; none on the OFP → all out; one INFO lists every copy; `firRaw` as printed. On 26: 24 repeats in 10 packages, 6 copies left out (T2 4, L03 1, L16 1), 0 fully. Grammar errata E-1, E-2 in SPEC §8.3 (distinct hazard products: 1,558 by `ID:` line = the scoping method; 1,573 by text).
- **Byte-identity:** build 1 (`9a76b58`) recorded with its module (`test/rules/data/ofp-flightkeys-v0.4.0-build1-baseline.json`); TC-163-100: only `companyNotams` (22), `firNotams` / `enrouteNotams` (T2, L03, L16) and `dispatchContact` change.
- **Tests:** TC-163-100, 110/111, 120/121, 130/131, 140/141; TC-160-001, TC-162-001/060, TC-163-001/001b/010/011/020/031 adapted where they named the extension list, the Contact line, the build-1 type table or "repeats kept". Expected values re-exported (fixtures `expected/ofp-flightkeys-v0.4.0/briefing.json`).
- **Unchanged:** `index.html`, `src/`, `rules/nat*`, NavBlue, the NOTAM modules and the golden snapshots.

### K-10 — v0.4.0: Company NOTAMs, curfews, ops notes, FIR NOTAMs, hazards, NAT / PACOTS; type headings to the rules (step 5d-2) (2026-11-19)

**Type:** UPD · **Brief:** Exec brief v0.4.0 (step 5d-2) and the Exec answers O-33 … O-45 (19 Nov) · module v0.4.0 (development, D58), contract 2.4 (addendum 4)
- **Scope 0 (D67):** `airportData[icao].notams` keeps the printed type heading lines before their items; without them the text is v0.3.0's. NOTAM v1.14.0 on all 26 (724 evaluations): every item shown / hidden as with v0.3.0's text except the 24 OBSTACLE-category items of the change list v1.2 (TC-163-002).
- **Scope 1 (§A.7, O-40):** `companyNotams[]` — 298 = 26 HSCN + 272, as printed, `origin` and `severity`; P0110 pair kept; the `Contact Dispatch for a preflight briefing.` line in no item (44 lines).
- **Scope 2 (row 46, O-33 … O-37):** `airportData[icao].curfew` from the `IIII-CURFEW` key only; closed type table `CURFEW_TYPES` (planned FK-P exception); registration lists never matched; season effectivity with changeover month; LCL bracket dropped — NavBlue fault **NB-F8** logged as G-NB-8 (open, D47); departure-only qualifiers kept; curfew-like items under other keys named in an INFO. 16 items, 10 packages.
- **Scope 3 (row 47, O-38, O-39):** `airportData[icao].opsNotes` per airport with an entry; repeats of the OFP Remarks left out (L06 LEZG, L09 VHHH, L21 NZWN); no entry created (L13 UAAA).
- **Scope 4 (row 49, O-40, O-41, D64):** `enrouteNotams.fir`, `firNotams[]`, `firRaw[]` — 221 blocks, 989 items, 43 empty; 3 FIR-keyed Company items with their FIR; repeats kept.
- **Scope 5 (row 42, O-42 … O-44):** `natMessages[]` (6 in 5 packages), `natTrack` through the injected NAT parser (L12 → 307; L08, L22 crew-alert WARN; filed track from the route string only); PACOTS: 38 items, 13 sets → `sections[]` entries, no track object.
- **Scope 6 (O-45):** `hazards[]` — 221 blocks, 66 empty, 1,980 products, as printed, never weather / E-WINS.
- **Byte-identity:** v0.3.0 output recorded before the change (`test/rules/data/ofp-flightkeys-v0.3.0-baseline.json`); TC-163-001: every other v0.3.0 field, airport value and finding unchanged.
- **Tests:** TC-163 (18); TC-160 / TC-161 / TC-162 adapted only where they named the version, the extension list, the deferred list or v0.3.0's heading-free text. Pinned values in the fixtures repo `expected/ofp-flightkeys-v0.4.0/briefing.json` (exporter `test/corpus/fk-v040-expected-export.js`).
- **Unchanged:** `index.html`, `src/`, `build/`, NavBlue, the NOTAM modules and the golden snapshots.

### K-09 — v0.3.0: Exec answers of 18 Nov — D65, D66, document corrections (2026-11-18)

**Type:** UPD · **Brief:** Exec answers to O-12 … O-20 (18 Nov); module still v0.3.0 (development, D58)
- **D65 (O-19):** `weather` is unchanged (METAR → ATIS → TAF; the app reads from the first `TAF`). The new airport extension `weatherRaw` holds the Weather Briefing block as printed: TAF → METAR → ATIS, with sub-headings, line breaks, indentation, wrapped TAF groups and empty-state text; furniture removed; only the `* PRIO * ` prefix removed. It is for RAW only and is the last key of each entry. `AIRPORT_EXTENSION_FIELDS` 7; addendum 3 updated.
- **D66 (O-14, O-15):** `ewinsWindow` is `''`, so `src/airports.html` line 297 uses the airport's normal window. `ewinsRole` is the airport's briefing role codes in printed order, joined by `/` (L15 `EA`, L20 `TA/IA`, L22 `DEPARTURE/IA`). `ewinsWeather` is unchanged and the TAF stays in `weather`.
- **NavBlue faults:** FK-P does not copy a logged NavBlue fault. The comments cite NB-F6 and NB-F7, and the NavBlue-rule patterns `EWINS_VALID`, `EWINS_ROLE_ALT` and `EWINS_ROLE_DEST` are removed. `test/known-gaps.json` "navblue-parser" gets G-NB-6 (lines 1320–1321) and G-NB-7 (lines 1316–1318), status open. NavBlue is not changed (D47).
- **O-12:** no parser change. The Exec's rule (D67) goes into NOTAM v1.14.0 (step 5c-2). Headings stay out of the item text.
- **O-13, O-16, O-17:** field map v1.1 → v1.2 (§1.1 L16 / L18 pages; row 44 repeated IDs) and briefing grammar v1.0 → v1.1 (§A.4 roles; §A.5 repeated IDs). Each has a change log; `tools/redact` replaced nothing; docs/README updated.
- **O-18, O-20:** for 5e and step 6; nothing here.
- **Tests:** TC-162-033 (`weatherRaw` on 285 airports), TC-162-034 (line 297 plus the app's `extractEtaWindow`: 384/384 in the normal window; control: NB-F6 differs in 315), TC-162-031 (D66), TC-162-060 (byte-identical to e96ed88 except the 6 D66 values; `weatherRaw` added). TC-162-001 (v0.2.0) is unchanged and passes.
- **Unchanged:** `index.html`, `src/`, `build/`, NavBlue and the snapshots.

### K-08 — v0.3.0: the briefing reader (step 5d, D64) (2026-11-18)

**Type:** UPD · **Brief:** FlightKeys parser v0.3.0 (Exec prompt, 18 Nov; D58 amended, D64)
- **Reader:** the briefing documents are read from the positioned items only. The thresholds were measured on the 567 briefing pages: header band y < 27.5, footer band y > 571.6, column split at the page middle. The running header and footer are removed by position and shape; a band row without the shape is kept, with a WARN. The documents (HSCN, Company + NOTAM, Weather + Hazard, VA) are found by content. Column and page continuation is joined (SPEC §5.13).
- **Airport blocks:** roles come from the closed list, anchored to the window; every window is kept in the new extension `briefing` (SME-1) (SPEC §5.14).
- **Airport NOTAMs (D64):**
  - the type heading is removed from the text and becomes the item's category;
  - items are cut by the NOTAM ruleset (`options.notamRules._splitNotams` / `_fkHeader`, ADR-005 §2.5);
  - `notams` is in the v1.13.0 form; `notamItems[]` gives ID, category and source positions; `notamsRaw` gives the section as printed;
  - weather-only airports and empty-state boxes give no items, with an INFO (SPEC §5.15).
- **Weather:** in NavBlue's form, METAR → ATIS → TAF, reports as printed. E-WINS comes from the `* PRIO *` TAF, with the fields set as NavBlue sets them (FK-P); the prefix is not shown; the TAF is kept in `weather` (D46). Hazard products are never airport weather (SPEC §5.16).
- **Airports, card order and sections:** an entry for every briefing airport; card order per SME-1; `sections[]` (ADR-005 §2.6) (SPEC §5.17).
- **Contract 2.3:** ADR-005 Appendix B addendum 3 (`notamItems`, `notamsRaw`, `briefing`). `DEFERRED_FIELDS` no longer lists `airportData.weather` / `.notams` and `sections`.
- **Proof:** the v0.2.0 output is byte-identical on all 26 (TC-162-001, against the output recorded with v0.2.0 before any change). One entry changes place: L15 PWAK, an EA airport, moves to its card-order place.
- **Counts:** they equal the grammar doc per package (blocks 137 / 285, items 2,292), and the weather totals (§A.9) too. Doc corrections, not applied to the docs: O-13, O-16, O-17.
- **Tests:** TC-162 (`test/rules/ofp-flightkeys-briefing.test.js`). TC-160 / TC-161 were changed only where they assumed the briefing unread.
- **Unchanged:** `index.html`, `src/`, `build/`, the other modules, and the golden / NOTAM / app-path snapshots.

### K-07 — v0.2.0: blank lines inside a marked item (O-11 confirmed) (2026-11-18)

**Type:** UPD (SPEC and tests only; the module is unchanged, SHA-256 as K-06) · **Brief:** Exec confirmation O-11, 18 Nov
- **D63 stands as written.** In a block that marks its items (dash, number or sub-heading), only the marker starts a new remark. A blank line (a gap in the positions) inside a marked item stays part of that item, with the line breaks kept for display. L06 LEZG `DEPARTURES` = one remark (correct). SPEC §5.12 (D63) records it.
- Test TC-161-103: two marked items each printed across two blank lines stay one remark each; the next marker after a blank line starts a new one; control: the same lines in an unmarked run split (D63a). A mutant that splits a marked item at a blank line fails TC-161-103 (and TC-161-050, 100, 200, 303 on the fixtures).
- No output change on any package.

### K-06 — v0.2.0: D63a blank lines from the positions; MEL notes keep their line breaks (QA re-review F1–F4) (2026-11-18)

**Type:** UPD (same development version, before merge) · **Brief:** Exec prompt, 18 Nov (QA re-review of PR #62, F1–F4)
- **F1:** the app's reader writes no empty line inside a page, so the D63a "blank line" is now read from the positioned items: a gap between two consecutive lines of the same page of at least 1.6 × the median line pitch of the first release copy (13.20 pt in all 26; one line 0.90–1.10 ×, a blank line ≥ 1.99 ×). The page's lines are rebuilt from the items as `processPDF()` builds them and used only when they match the text line for line. Never across a page break (O-10). Applied to the general Remarks run and the CDC attestation. A spaces-only text line is no longer a blank line. Without matching items: no blank line, one WARN naming the page(s). **No output change on the 26** (131 printed blank lines in unmarked blocks, each already a record boundary).
- **F2:** crew and CAT tests plant a full block, heading included, on a briefing page before the release; a mutant that reads the whole package now fails TC-161-011 / TC-161-021.
- **F3:** a wrapped MEL/CDL note keeps its printed line breaks (`"\n"`), as remarks do (Exec display rule, 3 Nov). Changed on the 26: one note in L13 (36-11-08C), one in L19 (2 lines each). Titles still join with a space (`melItems`, NavBlue form).
- **F4:** the private truth-sheet report header gives the current module SHA-256 (fixtures repo).
- Tests: TC-161-300 … 304 new; TC-161-201 / 203 / 302 built from positioned items (no typed blank lines); TC-161-011, 021, 031 changed. Mutants caught: blank never seen, page break as blank line, threshold 2.5 and 1.2, CDC and Remarks blank ignored, WARN removed, note joined with a space, crew and CAT read from the whole package.

### K-05 — v0.2.0: D63a readings confirmed (O-10) (2026-11-17)

**Type:** UPD (SPEC and tests only; the module is unchanged, SHA-256 as K-04) · **Brief:** Exec confirmation O-10, 17 Nov
- (1) Fixed-length recognised items never take a continuation: one-line items stay one line, the boilerplate ends at `questions.`, and an unmarked line after such an item starts a new remark (T3's 3 test lines stay a remark of their own). Test TC-161-202.
- (2) A page break is not a blank line; a remark continues across it, the same as D63. Test TC-161-203.
- Both readings were already applied in K-04; the SPEC §5.12 records them as confirmed. A mutant of each reading fails its test.

### K-04 — v0.2.0: paragraph grouping in unmarked remark blocks (D63a) (2026-11-17)

**Type:** UPD (same development version, before merge) · **Brief:** Exec prompt, 17 Nov (O-9 → D63a)
- **D63a:** in a remark block that does not mark its items, a remark runs until a blank line, a sub-heading, or the start of a recognised item; its lines are joined with their printed line breaks, nothing added, removed or reflowed. Marked blocks keep D63. Applied to the general Remarks run and the CDC attestation of `ofpRemarks[]`, and to every list built from those remarks (`pcf.reasons`, `extraFuel.reasons`, `securityMessages`, `remarksWeather[].text`, the late-addition MEL note), which no longer join wraps with a space. SPEC §5.12 gives the rule per block and the list of recognised items.
- Applied as v0.2.0 already read them: fixed-form items (one-line items, the boilerplate to `questions.`) end where their form ends; a page break is not a blank line (Exec to confirm, O-10).
- **Changed on the 26:** 46 remarks in 24 packages (159 printed lines); T1 and T2 unchanged. Reason lists with line breaks now: `pcf.reasons` L13, T3; `extraFuel.reasons` L23; `remarksWeather` L15. Findings unchanged on all 26; v0.1.0 fields byte-identical.
- Tests: TC-161-200 (fixtures), TC-161-201 (synthetic positive and negative); TC-161-050, 051, 100 and 102 changed (they asserted the per-line form). The new and changed tests fail on `df1bdeb`; a mutant of each part of the rule is caught.
- Truth sheets: re-compared; no new difference (3 found, 3 decided, 0 open).

### K-03 — v0.2.0: one remark per item in a marked block (D63) (2026-11-17)

**Type:** UPD (same development version, before merge) · **Brief:** Exec prompt, 17 Nov (QA F1 on PR #62; D63)
- **D63:** in airport remarks and in any remark block that marks its items, a new remark starts only at the block's own item marker (dash, number or sub-heading); any other line continues the remark above it, with its printed line breaks kept (`"\n"`, nothing reflowed). Applied to `airportData[icao].remarks[]` and to the station-block and ADHOC-block records of `ofpRemarks[]` (SPEC §5.12, markers per block layout from the field map v1.1 §2.4).
- **Changed on the 26:** 4 remarks in 3 packages (13 printed lines): L06 2 (LEZG caution, `DEPARTURES`), L09 1 (VHHH), L21 1 (NFFN circling + minima). Every other package and field unchanged; v0.1.0 fields byte-identical (TC-161-001); findings unchanged on all 26.
- The SME-18a INFO counts printed lines, as before (unchanged message); SME-18 is read on the joined remark, so a wrapped `Takeoff alternate` / `required` is flagged (synthetic).
- Outside a marked block `ofpRemarks` stays one record per printed line (open item O-9).
- Tests: TC-161-100 (fixtures), 101 (synthetic positive and negative, page break), 102 (scope); TC-161-050 changed (lines counted inside joined records; L06 sub-cards one remark each). The new tests fail on `1a96479`; mutants of each part of the rule are caught.
- Exec, 17 Nov, also: a blank TO/LNDG expiry stays an INFO (QA F4); non-crew remark text may be quoted in the public SPEC and tests after `tools/redact` (QA F2; every quoted remark checked, no change needed). The STATUS 1 wording "listed once" is superseded (QA F3; the current rule is §5.7: every printed copy kept).

### K-02 — v0.2.0: release and remarks pages (2026-11-17)

**Type:** UPD · **Brief:** FlightKeys parser v0.2.0 (Exec prompt, 17 Nov; D58, D62)
- Crew (row 26, SC): pilots with role and TO/LNDG currency (blank → "Not Reported", SME-9); `*` kept with the last name, never seniority (SME-3/3a); DH/JS as NavBlue; MX/LM/FA/PU not crew (INFO counts); new extension `operatingPilots` (D62); crew-record extensions `firstName`, `toLndgExpiry`.
- CAT II/III (row 24, SC): authorisations in the NavBlue form; restrictions from Remarks lines and MEL notes/titles in `catIiIiiRestrictions[]`, never as an authorisation (SME-10).
- MEL/CDL/DDG (row 25): items as printed with `type` and `notes[]`; indentation from the positioned items; ADHOC penalty lines kept apart; every printed item kept, a repeated one included (Exec, 17 Nov); late additions named only in a remark (SME-19). TLR cross-reference (32a), including the codes printed below the `RMKS` line.
- TLR (row 32): `oeiData` by the NavBlue rule on the TLR with page furniture removed (fixes the L10 page-break leak; field map §6).
- Perishables (27, bare `PERISHABLES ONBOARD` + NavBlue rule) and temperature control (28, NavBlue rule, D55), read on the release Remarks only.
- Permits (35): `overflightPerms` (NavBlue form), `permits[]` with route, registration restriction, missing permit, ADC number.
- `ofpRemarks[]` with categories, sub-headings and provenance, plus the MEL-block ADHOC lines and the CDC attestation. Station restrictions on `airportData[icao].remarks[]` (D34), with the fleet rule (SME-18a). Takeoff alternate required but none listed → WARN (SME-18). `remarksWeather[]` on its airport (D34, D46, SME-23); one airport entry created for a release alternate not on page 1 (L15 PWAK). `securityMessages[]` (D45). `extraFuel` with type and tanker flag (D39). `pcf` with reasons (SME-7). `revision`.
- 5b-1 QA F4: `icao-fpl` reads the release lines only. QA F3: SPEC corrected (no `curfew` / `opsNotes` keys before 5d).
- `fplEquipment` (D41) is not in the brief: explicit `null`, step `open`.
- Proof: every v0.1.0 field byte-identical on the 26 fixtures (TC-161-001, SHA-256 per field against the output recorded with v0.1.0 before the change).
- Truth sheets: 3 differences at first (L07 1, L08 1, L12 1), all presentation decisions; private report `pilotbrief-fixtures/expected/ofp-flightkeys-v0.2.0/TRUTH-SHEETS-REPORT.md`.
- **Exec decisions, 17 Nov (PR #62 review):**
  - L07 security line stays on the Preflight card only (O-5 closed).
  - Repeated MEL items are possible and not an anomaly; every printed item is kept and no finding is raised (O-6 closed; L08 and L12 now match their sheets). This replaces the NavBlue dedup of the first push.
  - Ignore NavBlue for the contract 2.2 fields (O-1 closed).
  - Names as printed: OK.
  - `fplEquipment` is a later issue (O-7 deferred).
  - Step 5d items stay with 5d: OK (O-4).
  - Draft truth sheets: OK (O-8 closed).
  After these, 0 truth-sheet differences remain open.
- Tests: TC-161-001 … 090 (`test/rules/ofp-flightkeys-release.test.js`); TC-160 scoped to the v0.1.0 fields. Crew values only in the private fixtures repo (`expected/ofp-flightkeys-v0.2.0/crew.json`).
- Nothing else changes: `index.html`, `src/`, `build/`, the other modules, golden / NOTAM / app-path snapshots unchanged.

### K-01 — New module v0.1.0 (2026-11-17)

**Type:** NEW · **Brief:** FlightKeys parser v0.1.0 (Exec prompt, 17 Nov; D58)
- `parseFlightKeys(input, options)`: input = extractor text + positioned items (mapping documented, `inputFromExtractor`); options = `icaoFpl`, `aircraftProfile`, `parseNatTrack`, passed in.
- Contract 2.1: the 57 core fields with the NavBlue names, order, types and meanings; the 12 contract v2.0 extensions + `swa`; airport extensions + `specialQualification` (ADR-005 Appendix B addendum, Exec SME answers 13 Nov).
- Read: identity, type, date (FPL DOF or OFP header only, real dates, D57), airports incl. the no-IATA line and the Q token, fuel, weights, SWA, DOT exemption incl. the wrapped form, slot, verbal callsign, nav log (TOC, ETOPS, ETP, POR), alternate routes, ETP points, CFS alternates incl. E.ENT/E.EXIT-only airports.
- Not read (explicit empties + one INFO each): crew, perishables, temperature control, CAT II/III, DDG/MEL, permits, TLR (5b-2); weather, NOTAMs, curfew, ops notes, en-route NOTAMs, NAT, Company NOTAMs, sections (5d); remaining extensions (5b-2/5d).
- Decisions applied: SME-1 (page-1 order), SME-2, SME-5, SME-6, SME-8, SME-11, SME-13, SME-16, D55 (SALT/TALT, NavBlue rule), D57 (empty date), FK-P (`navLog` `[]`).
- Tests: `test/rules/ofp-flightkeys.test.js` TC-160-001 … 040, run by `npm test`. Expected values `test/rules/data/ofp-flightkeys-expected-v0.1.0.json` (no crew data).

---

## Open items

| ID | Item | Owner |
|:---|:-----|:------|
| O-1 | ~~NavBlue does not return the addendum fields~~ **Closed (Exec, 17 Nov): ignore NavBlue**; the contract 2.2 fields are FlightKeys only | — |
| O-2 | `porWpt` for a fix-plus-distance POR carries the lat/long in the same string (SME-11) | Exec (confirm at the visual check) |
| O-3 | `navLog` stays `[]` by FK-P; a real nav log would change the en-route screen | Exec |
| O-4 | ~~Step 5d~~ **done: airport NOTAMs, weather, sections in v0.3.0 (K-08); Company NOTAMs, curfew, opsNotes, en-route NOTAMs, NAT and the SME-18 repeat in v0.4.0 (K-10)** | later brief |
| O-5 | ~~L07 security line~~ **Closed (Exec, 17 Nov): Preflight card only** (`securityMessages[]`, D45) | — |
| O-6 | ~~Duplicate MEL items~~ **Closed (Exec, 17 Nov): keep all items**, a repeat is not an anomaly | — |
| O-7 | `fplEquipment` (D41: filed 10a and the codes the MEL notes remove) has no brief. **Exec, 17 Nov: a later issue** | Exec (later brief) |
| O-8 | ~~Truth sheets are drafts~~ **Closed (Exec, 17 Nov): OK** | — |
| O-9 | ~~D63 outside a marked block~~ **Closed (Exec D63a, 17 Nov): paragraph grouping** (K-04) | — |
| O-10 | ~~D63a readings~~ **Closed (Exec, 17 Nov): both confirmed** (K-05; TC-161-202, 203) | — |
| O-11 | ~~Blank line inside a marked block~~ **Closed (Exec, 18 Nov): D63 stands as written**; only the marker starts a new remark, a blank line inside a marked item stays part of it (K-07; TC-161-103) | — |
| O-12 | ~~A trailing type heading~~ **Closed: NOTAM v1.14.0 (D67, #64) reads the headings; v0.4.0 passes them in `notams` (K-10). `notams` must not go to NOTAM v1.13.0** | — |
| O-13 | ~~Grammar §A.4 roles~~ **Closed (Exec, 18 Nov): grammar v1.1** (K-09) | — |
| O-14 | ~~E-WINS window~~ **Closed (Exec D66, 18 Nov): `ewinsWindow` `''`**; NavBlue fault NB-F6 / G-NB-6 (K-09) | — |
| O-15 | ~~`ewinsRole`~~ **Closed (Exec D66, 18 Nov): the airport's own role codes**; NavBlue fault NB-F7 / G-NB-7 (K-09) | — |
| O-16 | ~~Field map §1.1 L16 / L18~~ **Closed (Exec, 18 Nov): field map v1.2** (K-09) | — |
| O-17 | ~~Repeated NOTAM IDs~~ **Closed (Exec, 18 Nov): field map v1.2 row 44, grammar v1.1 §A.5** (K-09) | — |
| O-18 | The app must pass `options.notamRules` at integration (Exec, 18 Nov: 5e) | integration brief (5e) |
| O-19 | ~~Weather order~~ **Closed (Exec D65, 18 Nov): `weather` unchanged, `weatherRaw` in the FlightKeys order** (K-09) | — |
| O-20 | Sections: names and order at the Exec's visual check (Exec, 18 Nov: step 6) | step 6 |
| O-33 … O-45 | **Closed (Exec, 19 Nov)**: applied in v0.4.0 (K-10) | — |
| O-46 … O-49 | **Closed (Exec, 19 Nov)**: applied in v0.4.0 (K-11). The NAT ruleset revision (FlightKeys track lines) is a separate package | — |
| O-50 | ~~Departure FIR~~ **Closed (Exec, 20 Nov):** the departure FIR (first FIR block) always counts as on the OFP; T2 keeps 4 copies, L16 1, L03's 1 removed copy unchanged (K-12) | — |
| O-51 | ~~Routes disagree~~ **Closed (Exec, 20 Nov): as built** — FPL letter + crew alert (K-12) | — |
| O-52 | ~~No OFP FIR read~~ **Closed (Exec, 20 Nov): as built** — nothing left out + WARN (K-12) | — |
| O-68 | NAT findings to the crew: **module side done in v1.0.0** (K-13); the crew display is the switch PR (O-76) | 5e-1 PR 2 |
| O-80 | ~~Pasted FlightKeys text~~ **As built:** text-only WARN exists; no module change (K-13) | — |
| O-84 | ~~Version in the deferred INFO~~ **Closed (Exec, 20 Nov): version-free text** (K-13) | — |
| O-85 | ~~Package label L10~~ **Closed (Exec, 20 Nov): L08** (K-13) | — |
