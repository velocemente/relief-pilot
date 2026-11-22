# SPEC-AdvisoryRules

**Version:** v1.0.0 | **Status:** NEW (not built into the app until its integration PR, D90) | **Date:** 2026-11-22 (step 5f module PR B; Exec answers O-169 … O-181, sheet "Scoping Decisions" tab 5f, clarified with the Exec 22 Nov)
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/advisory-rules-next/advisory-rules-v1.0.0.js` (manifest key `advisory-rules-next`, SHA-256 in `rules/manifest.json`; declared not built in in `test/lib/not-built-in.js`, D90, D96). The integration PR moves it to `rules/advisory-rules/` (key `advisory-rules`)
**Architecture:** ADR-005 §2.1, §2.2 (a shared rules engine, D88; Exec answer O-173 option A); input: the OFP contract 2.5 (`docs/ADR-005-AppendixB-Addendum5-NEW-20261122-v1.0.md`); result: `docs/ADR-005-AppendixB-Addendum6-NEW-20261122-v1.0.md`
**Ledger:** `RPT-AdvisoryRules-RevisionLedger-NEW-20261122-v1.0.md` (beside this file)
**Drive master:** a new subfolder of the Exec's folder "00_General Rulesets" (O-173 addition: the Exec confirms or names another); published after its own QA, before its integration PR (CLAUDE.md rule 14)

---

## 1. What this module is

The interpretation of what an OFP prints about **volcanic ash** and **RAIM** (D88: the format parsers only extract and normalise; the same content gives the same result whatever the format). The app calls `evaluateAdvisories(result)` in `parseOFP()` **after** the format parser, on the parser's contract object, so the locked NavBlue parser and its 30 golden snapshots are untouched (D47, D118). It reads `volcanicAsh`, `ofpRemarks[]`, `firNotams[]` and `hazards[]` of ofp-flightkeys v1.1.0 (module PR A); the NavBlue parser returns none of them, so a NavBlue flight gets the empty result.

It decides: whether the crew gets an OFP Alerts WARN for volcanic ash (D116, O-169, O-170, O-177, O-178); whether a RAIM remark needs crew attention (D115, O-171); which FIR NOTAMs and hazards carry volcanic content (O-180); and whether the OFP Remarks group opens for these reasons (O-179). It shows nothing: the display is the integration PR (O-179, O-180: the display opens the groups; O-171: the RAIM note in the Preflight NOTES section below DDG). It does **not** decide the 1.10.0 open conditions of the OFP Remarks group (Dispatch contact short form, security message: the display keeps them, O-181) or the Dispatch contact (D131, stays in ofp-flightkeys, O-173 addition).

Module standard: one standalone file, dual context (Node `module.exports`; browser global `AdvisoryRules`), no window, DOM, storage, clock, app state or network (TC-181-002); `validateSchema()`; the input is never changed (TC-181-051).

## 2. API

| Export | Meaning |
| :--- | :--- |
| `evaluateAdvisories(ofp)` | → `{ volcanicAsh, raim, volcanicFir, openOfpRemarks, findings }` (§3–§6); `null` when `ofp` is not an object |
| `remarkPolarity(text)` | → `'POSITIVE'` / `'NEGATIVE'` / `null` (no VA term) (§3.2) |
| `namesVolcano(text, volcano)` | → whether the text names the volcano (§3.3) |
| `isRaimPassed(text)` | → whether the text is one of the PASSED forms (§4) |
| `vaTerms(text)` | → the VA terms the text carries, in list order (§3.1) |
| `vaSigmetCount(text)` | → the SIGMET products of a hazard block that carry a VA term (§5) |
| `VA_TERMS`, `VA_NEGATIVE_FORMS`, `RAIM_PASSED_FORMS`, `VA_WARN`, `FINDING_CODES` | the closed lists and crew texts (frozen) |
| `RULESET_TYPE` `'advisory-rules'`, `RULESET_VERSION` `'1.0.0'`, `SCHEMA_VERSION` 1, `RULESET_SOURCE`, `validateSchema()` | identity |

## 3. Volcanic ash (O-169, O-170, O-177, O-178; D116)

### 3.1 The VA term list (closed; O-177, O-180)

One list, used for the OFP remarks, the FIR NOTAMs and the hazards. Whole words; line breaks and runs of spaces read as one space.

| Term | Rule |
| :--- | :--- |
| `VA` | capitals only (`va` in mixed-case text is not the term) |
| `VOLCANO`, `VOLCANOES` | any case |
| `VOLCANIC` | any case |
| `ASH` | any case (so `NO ASH CLOUD IS PRODUCED` carries it) |
| `ASHTAM` | any case |
| `ERUPTION`, `ERUPTIONS` | any case |
| `VAAC` | any case |

Not terms (negatives, TC-181-005): `AVAIL`, `NOVA`, `EVAC`, `CASH`, `WASH`, `VAAC2`, lower-case `va`. A term may be added later (safe); none is taken out to quiet an item.

### 3.2 VA remarks and the negative list (O-177)

A **VA remark** is an `ofpRemarks[]` record of **any category** that carries a VA term — RAIM records, the dispatcher line, the boilerplate and the CDC attestation included (QA F-02, fix round 1: the O-171 RAIM hide is for RAIM output only and never hides volcanic ash content; a VA line taken as the continuation of an outage remark, or a VA remark that names RAIM, is read). Every line of the record counts, so a VA line joined to a neighbouring paragraph (D63a) is still found.

The **closed negative list** — the form seen in the corpus (L14):

| Negative form |
| :--- |
| `NO VA ACTIVITY AFFECTING FLIGHT` |

A VA remark is **NEGATIVE** when, after every negative form in it is taken out (whole words, line breaks as spaces, a full stop after it allowed), **no VA term is left**; otherwise it is **POSITIVE**. So `NO VA ACTIVITY AFFECTING FLIGHT` printed alone, wrapped over two lines or joined to a PCF line is negative; any other wording — `NO VA ACTIVITY AFFECTING THIS FLIGHT` included — is positive (safe side: a form not on the list raises the WARN; adding a form later is safe, adding unseen forms could hide).

### 3.3 Advisory and link (O-169)

An **advisory** is the Volcanic Ash Advisories page with an actual advisory listed: `volcanicAsh.state` `'ADVISORY'` (ofp-flightkeys v1.1.0). `NONE`, `UNREADABLE` and a missing page (`null`) are no advisory. An advisory is **linked** to a **positive** VA remark that **names its volcano** (`advisories[].volcano`): whole words, any case, line breaks read as spaces (`GREAT` / `SITKIN` over a line break is linked). A remark naming another volcano is not linked. An UNREADABLE page links nothing.

### 3.4 Results and WARNs (D116, O-170, O-177, O-178)

| Case | Result |
| :--- | :--- |
| Advisory with a linked positive remark | **WARN** `VA-ADVISORY-REMARK`: `VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB` (D116; `noted` true) |
| Advisory with no linked remark (real case L02) | **nothing** (O-170, Exec-decided hide) |
| Positive VA remark not linked to an advisory — no page, NONE page, UNREADABLE page, an advisory of another volcano | **WARN** `VA-REMARK-ROUTING`: `VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE` (O-177; `routing` true) |
| UNREADABLE page, no positive remark | nothing (as O-170) |
| Only negative remarks (with or without an advisory) | nothing |

Each WARN at most once per flight, ADVISORY first; both can appear (one linked and one unlinked positive remark). The texts are exact (O-178, D79: capitals, en dash U+2013, no full stop), carry no internal reference (D103) and no version (D99); `validateSchema()` refuses a text that breaks the style (TC-181-003, 004). Finding shape: `{ level: 'WARN', field: 'volcanicAsh', code, message }`, appended by the app to OFP Alerts at integration.

`volcanicAsh` result: `{ state, page, advisories[] { index, volcano, vaac, number, remarks[] (linked remark indexes) }, remarks[] { index, text, page, line, polarity, terms, advisories[] }, noted, routing }`.

## 4. RAIM (O-171, D115)

The **RAIM remarks** are the `ofpRemarks[]` records of category `raim` (ofp-flightkeys v1.1.0, O-172: a remark whose first line names RAIM and that matches no other category; continuation lines kept) **and** the remarks of another category flagged `raim: true` (QA F-01: a CAT II/III, security, PCF, extra fuel, route … remark naming RAIM keeps its own category and field; the engine counts it as a RAIM remark too). The **closed PASSED list** (the two forms seen in both corpora):

| PASSED form (the whole record, trimmed) |
| :--- |
| `RAIM VALIDATION PASSED` |
| `RAIM VALIDATION FOR ETOPS ALTN <ICAO> PASSED` |

- **Any PASSED form printed → no RAIM output for the flight** (`attention` `[]`), even if another RAIM remark is printed too (O-171, Exec-decided hide). It suppresses **only** the RAIM attention output: it never removes or hides a remark, a field, a display or the volcanic ash result (§3) (QA F-01, F-02).
- **No PASSED form + any other RAIM remark** (an outage, a `no outages` wording, `FAILED`, unreadable, an unknown form) → one **attention record per remark**, `{ text (as printed, every line), page, line }` (D115: crew attention).
- **Never an OFP Alerts line** for RAIM (O-171): the display shows the record in the Preflight NOTES section below DDG.
- The ETOPS-alternate form is not linked to the alternate (O-176 c). RAIM inside NOTAM text never reaches the remarks (O-172).

`raim` result: `{ passed, records[] { index, text, page, line, passed }, attention[] }`.

## 5. Volcanic FIR items (O-180)

A FIR NOTAM item (`firNotams[].items[]`, ASHTAM included, a Company item listed with the FIR too) or a hazard block (`hazards[]`) whose text carries a term of §3.1 is **flagged** — "no ash cloud" items too (O-180: L06). No WARN: the display opens their existing groups by default (display PR). Result `volcanicFir`: `{ notams[] { fir, name, block, item, id, origin, terms }, hazards[] { fir, name, index, vaSigmets, terms }, notamFirs[], hazardFirs[] }` (the FIR codes, unique, in printed order). `vaSigmets`: the SIGMET products of the block (`<id> SIGMET <n> VALID …` up to the next product — SIGMET, AIRMET `<id> WA <ddhhmm>`, TWC) that carry a VA term (information; the flag is the block).

## 6. The OFP Remarks group flag (O-179)

`openOfpRemarks` = a **positive** VA remark is present **or** a RAIM **attention** record is present. The display opens the OFP Remarks group by default when this flag or one of the 1.10.0 conditions holds (O-181).

## 7. Results on the 26 FlightKeys fixtures (TC-181-010, 011, 015)

| Item | Scoping (brief) | Build | Match |
| :--- | :--- | :--- | :---: |
| VA pages | 26: 1 advisory, 25 none | 1 ADVISORY (L02), 25 NONE | yes |
| VA remarks | L03 positive, L14 negative | L03 POSITIVE (`… AVOID POTENTIAL VA FROM SHEVELUCH`), L14 NEGATIVE | yes |
| VA WARNs | — | 1: L03 `VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE` (its page prints no advisory). L02: advisory SHEVELUCH, no remark → nothing (O-170) | — |
| Volcanic FIR items | 24 in 10 packages | 24 in 10: L02 PAZA 2, L03 PAZA 2, L06 LIRR 2 + LIBB 2 ("no ash cloud"), L09 PAZA 2, L14 PAZA 2, L15 WAAF 3 + WIIF 1 (4 ASHTAMs), L16 PAZA 2, L18 PAZA 2, L19 PAZA 2, L20 PAZA 2 | yes |
| VA SIGMETs | 4 in L15 | L15 WAAF hazard block flagged, 4 VA SIGMETs; no other hazard flagged | yes |
| RAIM | 27 records, all PASSED → 0 attention | 27, all PASSED, 0 attention | yes |
| OFP Remarks flag (O-179) | at most L03 | L03 only | yes |
| NavBlue (30) | nothing | the empty result on all 30 golden results (TC-181-050) | yes |

Per package (VA state · VA WARN · RAIM attention · volcanic FIR / hazard flags · OFP Remarks flag):

| Pkg | VA state | VA WARN | RAIM attention | Volcanic FIR / hazard | Flag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| L01 | NONE | — | 0 (PASSED) | — | — |
| L02 | ADVISORY | — (no linked remark) | 0 (PASSED) | PAZA 2 | — |
| L03 | NONE | ROUTING | 0 (PASSED) | PAZA 2 | open |
| L04–L05 | NONE | — | 0 (PASSED) | — | — |
| L06 | NONE | — | 0 (PASSED) | LIRR 2, LIBB 2 | — |
| L07–L08 | NONE | — | 0 (PASSED) | — | — |
| L09 | NONE | — | 0 (PASSED) | PAZA 2 | — |
| L10–L13 | NONE | — | 0 (PASSED) | — | — |
| L14 | NONE | — (negative remark) | 0 (PASSED ×2) | PAZA 2 | — |
| L15 | NONE | — | 0 (PASSED) | WAAF 3, WIIF 1; hazard WAAF (4 VA SIGMETs) | — |
| L16 | NONE | — | 0 (PASSED) | PAZA 2 | — |
| L17 | NONE | — | 0 (PASSED) | — | — |
| L18–L20 | NONE | — | 0 (PASSED) | PAZA 2 each | — |
| L21–L23, T1–T3 | NONE | — | 0 (PASSED) | — | — |

## 8. Tests (run by `npm test`)

| ID | What | Result (2026-11-22) |
| :--- | :--- | :--- |
| TC-181-001 … 005 | identity, not built in, static purity, schema (negatives), O-178 texts byte for byte, the closed lists and their rules (negatives) | PASS |
| TC-181-010, 011, 015 | the 26 against scoping; FIR / hazard flags; pinned results (`expected/advisory-rules-v1.0.0/results.json`, made with this module and ofp-flightkeys v1.1.0) | PASS |
| TC-181-020 | SYNTHETIC VA (D87): VAA + positive remark; VAA, no remark; VAA + another volcano; garbled page with and without a remark; VA remark joined to a neighbouring paragraph (positive and negative); NO VA ACTIVITY + VAA; NONE / no page; both WARNs; two advisories; a name over a line break; skipped kinds | PASS |
| TC-181-021 | SYNTHETIC QA F-02: a VA remark naming RAIM; a VA line after an outage line; both with PASSED → the O-177 WARN (without PASSED also the attention record); a volcano name in a raim record links an advisory; PASSED only → nothing | PASS |
| TC-181-030 | SYNTHETIC RAIM: outage with satellite and times and continuation lines; `no outages`; FAILED; garbled; PASSED + outage (plain and ETOPS ALTN) → no output; RAIM in a non-RAIM remark; RAIM in NOTAM text; none; no WARN | PASS |
| TC-181-031 | SYNTHETIC QA F-01: CAT II/III, security, PCF, extra fuel, route remarks naming RAIM keep their category and field; attention without PASSED, none with PASSED; a VA term in one still warns with PASSED | PASS |
| TC-181-040 | SYNTHETIC FIR flags: ASHTAM, "no ash cloud", VAAC, Company item, lower-case `va` (negative), hazards with / without a VA SIGMET | PASS |
| TC-181-050, 051, 090 | D88 / D118 (NavBlue 30/30 empty; format-neutral input = same result); input unchanged; fixtures missing → fail | PASS |

16/16 PASS.

## 9. Known limitations / open items

| Item | Note |
| :--- | :--- |
| Integration | **Not built in (D90, D96).** The integration PR builds it into `index.html` (after ofp-flightkeys v1.1.0), calls it in `parseOFP()` after the format parser, appends its findings to OFP Alerts, shows the RAIM attention record (Preflight NOTES, below DDG), opens the OFP Remarks group (O-179, O-181) and the flagged FIR / hazard groups (O-180). |
| RAIM outages | **Synthetic only:** all 27 real records are PASSED (D115 is a safety net). A real FlightKeys outage sample from the Exec would help (O-171 addition). |
| Negative list | One form (L14). An unseen negative wording raises the routing WARN (safe side) until the Exec adds it. |
| NavBlue | D118: NavBlue VA / RAIM remarks are not read (O-176 b); the result is empty. |
| O-182, O-183 | ofp-flightkeys v1.1.0 items (PERISHABLES bare form; Dispatch contact with no remark); not in this module. |

## 10. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-11-22 | NEW (not built in, D90, D96) | Step 5f module PR B, Exec answers O-169 … O-181 (fix round 1: QA F-02 — every remark read for VA terms; F-01 — flagged remarks are RAIM remarks): volcanic ash (advisory + linked remark WARN, positive unlinked remark WARN, closed term and negative lists), RAIM (PASSED hides, attention records), volcanic FIR item / hazard flags, the OFP Remarks flag. |
