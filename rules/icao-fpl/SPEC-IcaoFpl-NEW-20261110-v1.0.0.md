# SPEC-IcaoFpl

**Version:** v1.0.0 | **Status:** NEW | **Date:** 2026-11-10
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/icao-fpl/icao-fpl-v1.0.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1 (module catalogue: "ICAO flight plan"), §2.2 (module standard), §2.3 (master copies and CI)
**Ledger:** `RPT-IcaoFpl-RevisionLedger-NEW-20261110-v1.0.md` (beside this file)
**Supersedes:** nothing (new module). There is no earlier master in "00_General Rulesets".

---

## 1. What this module is

The ICAO flight plan module reads the **filed ICAO flight plan** — the block `(FPL- … )` that every OFP package carries — and returns its fields. It does not depend on the OFP format: NavBlue company PDF, eOFP print and FlightKeys all carry the same ICAO block.

Users (none in this step):

- the **FlightKeys parser** (`ofp-flightkeys`, sprint step 6) — flight ID, aircraft type, wake, date of flight, destination, alternates;
- the **D41 equipment check** (later) — field 10a (`equipment`) against the codes the MEL notes say were removed (`fplEquipment`, ADR-005 Appendix B).

This PR does **not** build the module into `index.html` and changes nothing in `src/`, `build/` or any other module. The **NavBlue parser keeps its own FPL patterns** (D47 lock); TC-152-020 checks that this module reads the same values from the same text.

---

## 2. Module standard (ADR-005 §2.2)

| Item | v1.0.0 |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. |
| Dual context | Node: `module.exports = API`. rules-loader (`new Function('module','exports','require', code)`): same. Browser (a plain script): no `module`, so the API object is published once as the global **`IcaoFpl`**. All declarations live inside one factory function. |
| Metadata | `RULESET_TYPE = 'icao-fpl'`, `RULESET_VERSION = '1.0.0'`, `SCHEMA_VERSION = 1`, `RULESET_SOURCE` (ICAO Doc 4444 Appendix 2 and 3; Doc 7030 EUR / EUROCONTROL IFPS for the regional field 18 indicators). |
| `validateSchema()` | Yes, §3.3. |
| No app state, no DOM, no UI | Never reads `window`, `document`, storage, the network, the clock (`Date`) or any app global. TC-152-003 loads it and calls it with those set to throw on any access: none is touched. |
| Strict mode | On. |
| Shared data | `RESULT_FIELDS` and `FIELD18_INDICATORS` are frozen. Every call returns a new result object. No state is kept between calls. |

---

## 3. Exports

### 3.1 API

```javascript
module.exports = {
  RULESET_TYPE, RULESET_VERSION, SCHEMA_VERSION, RULESET_SOURCE,
  validateSchema,       // (ruleset?) → { valid, errors[] }
  RESULT_FIELDS,        // the result's field names, in order — frozen
  FIELD18_INDICATORS,   // field 18 indicators that start an item — frozen
  parseIcaoFpl,         // (text) → result (§3.2); never throws
};
```

### 3.2 `parseIcaoFpl(text)` → result

| Field | Doc 4444 field | Content | Empty |
| :--- | :--- | :--- | :--- |
| `found` | — | `true` when a complete block `(FPL-` … `)` is in the text | `false` |
| `raw` | — | The first complete block, exactly as in the text (line breaks kept) | `''` |
| `flightId` | 7 | Aircraft identification, 2–7 letters/digits. An SSR mode/code suffix `/A1234` is accepted and not returned. | `''` |
| `flightRules` | 8 | `I`, `V`, `Y` or `Z` | `''` |
| `flightType` | 8 | `S`, `N`, `G`, `M` or `X`; `''` when not filed (INFO) | `''` |
| `aircraftType` | 9 | Type designator (letter + 1–3 letters/digits, e.g. `B744`, `C5`, `ZZZZ`). A number of aircraft before it is read and reported as INFO. | `''` |
| `wake` | 9 | Wake turbulence category `L`, `M`, `H` or `J` | `''` |
| `equipment` | 10a | Equipment and capability codes as filed (e.g. `S`, `D`, `E1`, `J5`) | `''` |
| `surveillance` | 10b | Surveillance codes as filed (e.g. `L`, `B1`, `D1`) | `''` |
| `departure` | 13 | Departure aerodrome, 4 letters (`ZZZZ`/`AFIL` returned as filed, INFO) | `''` |
| `eobt` | 13 | Estimated off-block time `HHMM` (UTC, as filed) | `''` |
| `route` | 15 | The whole field: cruising speed, level and route, line breaks read as single spaces | `''` |
| `destination` | 16 | Destination aerodrome, 4 letters | `''` |
| `eet` | 16 | **Total** estimated elapsed time `HHMM` from field 16 (not field 18 `EET/`, which is in `other.EET`) | `''` |
| `alternates` | 16 | Destination alternates, 4 letters each, in filed order | `[]` |
| `dof` | 18 `DOF/` | Date of flight as `YYYY-MM-DD` (`20YY`, as the NavBlue parser reads it); only a real calendar date | `''` |
| `reg` | 18 `REG/` | Registration text as filed (aircraft data, not crew) | `''` |
| `sel` | 18 `SEL/` | SELCAL as filed | `''` |
| `rmk` | 18 `RMK/` | Remarks as filed | `''` |
| `other` | 18 | Every field 18 item, indicator → text, in filed order (includes `DOF`, `REG`, `SEL`, `RMK` as filed) | `{}` |
| `findings` | — | `{ level: 'INFO' \| 'WARN', field, message }` | `[]` |

**Reading rules (Doc 4444 Appendix 3):**

1. **The block.** The first `(FPL-` that has a `)` before the next `(FPL-` (or the end of the text). An OFP package repeats the block (3 identical copies in each NavBlue package); later copies are only compared with the first (line wrapping ignored). Copies that differ → WARN, the first is read (as the NavBlue patterns, which match the first). A `(FPL-` with no closing `)` → WARN; when no complete block exists, `found: false`.
2. **Fields.** The hyphen separates fields. Fields 7, 8, 9, 10, 13, 15, 16 are the first seven; field 18 is the rest. Field 19 (after `-E/`, `-P/`, `-R/` …) is cut off and not read (INFO). Fewer than 8 fields → WARN and **no positional field is read** (nothing is guessed by position). A hyphen left inside field 18 → WARN; it stays in the text.
3. **Line breaks** inside a field are wraps. Fields 7, 8, 9, 10, 13 have no spaces in their syntax: line breaks are removed. Fields 15, 16, 18: any run of white space (line breaks, CRLF, double spaces) reads as one space.
4. **Syntax check per field.** Each field must meet its Doc 4444 syntax (table above). One that does not is returned **empty** with a **WARN** on that field; the other fields are still read. Partial reads keep only the part that is sure: field 9 with a wake letter that is not L/M/H/J keeps the type, wake empty; field 13 with an impossible EOBT keeps the aerodrome; field 16 with an impossible EET keeps destination and alternates; an alternate that is not 4 letters is skipped (WARN). Field 15 must start with a cruising speed and level (`N0481F320`, `M084F340`, `K0900S1150`, `N0120VFR` …), otherwise the route is empty (WARN). More than 2 alternates (Doc 4444 allows 2): all are returned, WARN.
5. **Field 18.** `0` → no items (INFO). Items start at a known indicator followed by `/` (at the start or after a space). Known indicators: Doc 4444 `STS PBN NAV COM DAT SUR DEP DEST DOF REG EET SEL TYP CODE DLE OPR ORGN PER ALTN RALT TALT RIF RMK`, regional `RVR EUR IFP AWR RFP`. Any other `XXX/` is text of the item before it (RMK free text may contain a stroke), reported as INFO. Text before the first indicator → WARN, not put in any item. An indicator filed twice → texts joined with a space, WARN. An indicator with no text → `''`, WARN. `DOF/` that is not a real date `YYMMDD` → `dof` empty, WARN; `other.DOF` keeps the filed text. DOF, REG, SEL or RMK not filed → INFO listing them.
6. **Not found** (no block, empty text, non-string input) → `found: false`, every field empty, one INFO; an unclosed block only → one WARN.

### 3.3 `validateSchema(ruleset?)`

Checks the module's own exports (no argument) or a given object. Errors: a missing export or one of the wrong type; `parseNavBlue`, `_ofpRulesetParse`, `parseOFP` or `parseFlightKeys` exported (format parsers are not part of a shared module); `RULESET_TYPE` not `'icao-fpl'`; `RULESET_VERSION` not semver; `SCHEMA_VERSION` not an integer ≥ 1; `RULESET_SOURCE` empty; `FIELD18_INDICATORS` not an array of unique 3–4 letter upper-case indicators; `RESULT_FIELDS` not the field list of §3.2 in order; `parseIcaoFpl('')` throwing, not returning exactly those fields, or not returning `found: false`.

---

## 4. The NavBlue FPL patterns (read, not changed)

`rules/ofp-navblue/ofp-navblue-v2.0.0.js` (locked, D47), lines 111–125:

```javascript
  FLIGHT_ID_FPL: /\(FPL-([A-Z]{2,3}\d{3,5})-/,
  AIRCRAFT_TYPE: /\(FPL-[A-Z0-9]+-[A-Z]+\s*\n?-([A-Z0-9]{2,4})\/[A-Z]/,
  FPL_WAKE:      /\(FPL-[A-Z0-9]+-[A-Z]+\s*\n?-[A-Z0-9]{2,4}\/([A-Z])-/,
  DATE_DOF:   /DOF\/(\d{2})(\d{2})(\d{2})/i,
```

Used in `_ofpRulesetParse()` (lines 579–613): `FLIGHT_ID_FPL` is the third fallback for `fltNum`; `AIRCRAFT_TYPE` → `acftType`; `FPL_WAKE` → `isHeavy` (`H` or `J`); `DATE_DOF` → `flightDateISO` (`20YY-MM-DD`) and `dateStr`. No other NavBlue pattern reads the FPL block.

| Item | NavBlue pattern | This module |
| :--- | :--- | :--- |
| Flight ID | 2–3 letters + 3–5 digits | Doc 4444: 2–7 letters/digits (wider: e.g. a registration as the identification) |
| Aircraft type | any 2–4 letters/digits | letter + 1–3 letters/digits; optional number of aircraft before it |
| Wake | any letter | `L`, `M`, `H`, `J` only |
| DOF | first `DOF/` **anywhere in the text**, digits not checked | `DOF/` inside field 18 of the block; a real calendar date only |

On the 30 NavBlue fixtures these differences change nothing (TC-152-020: 0 differences). They matter only for text the NavBlue patterns would read loosely; there this module returns empty with a WARN instead of a value.

---

## 5. FPL block layout in the fixtures (structure only)

The 33 fixtures (26 NavBlue company, 4 eOFP print, 3 FlightKeys) all carry the same layout: one line per field, field 9 and 10 on one line, field 18 last, no field 19, no page header inside the block. Letters shown as `A`, digits as `9`; lengths shortened.

```
(FPL-AAA999-AA                          field 7 - field 8
-A999/A-AAA9A9A9AAAAAAA9A9A9A9AAAAAA/AA9A9   field 9 - field 10a/10b
-AAAA9999                               field 13
-A9999A999 AAAAA A999 AAAAA … (wrapped over 1–5 lines)   field 15
-AAAA9999 AAAA                          field 16 (one fixture: no alternate)
-AAA/A9A9… AAA/AAAA9… DOF/999999 REG/…  field 18 (wrapped over 3–8 lines)
… AAA/AAAA … AAA/… RMK/… )
```

| Format | Fixtures | Blocks per package | Lines per block | Field 18 indicators seen |
| :--- | ---: | ---: | :--- | :--- |
| NavBlue company | 26 | 3 identical | 10–22 | PBN NAV DAT SUR DOF REG EET SEL CODE OPR RMK in all; TALT in 2 |
| eOFP print | 4 | 3 identical | 11–21 | PBN NAV DAT SUR DOF REG EET SEL CODE OPR RMK in all |
| FlightKeys | 3 | 1 | 12–15 | as above; RVR in 2, RALT and RIF in 1; field 18 runs on with fewer line breaks (lines up to 72 characters) |

Observed: field 15 and field 18 wrap over several lines; a field 18 item's text can run over a line break (e.g. SUR/, RMK/). No wrap in any fixture breaks a field's Doc 4444 syntax (no WARN on any fixture, TC-152-020).

---

## 6. Tests and evidence (`test/rules/icao-fpl.test.js`, run by `npm test`)

| ID | What | Result (2026-11-10) |
| :--- | :--- | :--- |
| TC-152-001 | metadata; export list; frozen tables; `validateSchema()` valid; 16 kinds of broken object rejected; non-object rejected | PASS |
| TC-152-002 | manifest entry: version, file, SHA-256 | PASS |
| TC-152-003 | dual context: Node, rules-loader, browser (exactly one new global `IcaoFpl`) give the same results; loaded and called with `window`, `document`, storage, `Date`, app globals set to throw — none touched; the code names no browser or app global | PASS |
| TC-152-004 | not built into the app: `index.html`, `build/build.js` and `src/` do not name it; `index.html` is still the build of `src/` + `rules/` | PASS |
| TC-152-010 | synthetic, positive: full block (every field); line breaks inside every field; CRLF / double spaces; 0, 1, 2 alternates; field 18 with and without DOF/REG/SEL/RMK, any order, `0`; leap day; regional and less common indicators; `/` in RMK text; flight rules I/V/Y/Z with and without type of flight; number of aircraft; L/M/H/J; SSR code; ZZZZ/AFIL; Mach, metric and VFR levels; field 19; block inside other text; 3 identical copies | PASS |
| TC-152-011 | synthetic, negative: not found (9 inputs) → `found: false`, every field empty, one finding; 29 malformed-field cases → that field empty + WARN, every other field unchanged; 9 impossible DOFs; empty DOF; too few fields → nothing positional read; shifted fields; differing copies; 3 alternates; repeated indicator; text before the first indicator; hyphen in field 18 | PASS |
| TC-152-012 | no state between calls; fresh results; 11 odd inputs return the shape, none throws | PASS |
| TC-152-020 | all 30 NavBlue/eOFP fixtures: found; flightId, aircraftType, wake, dof = the NavBlue FPL patterns and `_ofpRulesetParse` (`acftType`, `isHeavy`, `flightDateISO`) — **0 differences**; 3 FlightKeys: found; no WARN on any fixture; equipment/route counts reported | PASS |
| TC-152-021 | gate bites: wake fixed to M, type cut short, flight ID cut short, DOF as 19YY — each caught on all 30 NavBlue fixtures | PASS |
| TC-152-030 | fixtures missing → the fixture comparison fails, not skipped | PASS |

Reported per fixture (counts, no values; `node --test test/rules/icao-fpl.test.js` prints them):

| Format | Fixtures | Equipment 10a codes | Surveillance 10b codes | Route elements | Alternates | Field 18 items | REG filed |
| :--- | ---: | :--- | :--- | :--- | :--- | :--- | ---: |
| NavBlue company | 26 | 17 (3), 18 (17), 20 (6) | 3 (26) | 7–80 | 1 (25), 0 (1) | 10 (3), 11 (21), 12 (2) | 26 |
| eOFP print | 4 | 18 (3), 20 (1) | 3 (4) | 13–70 | 1 (4) | 10 (1), 11 (3) | 4 |
| FlightKeys | 3 | 18 (3) | 3 (3) | 37–55 | 1 (3) | 11, 12, 14 | 3 |

Whole suite on the branch: `npm test` 381/381; `check-rules` 4 modules match; build = committed `index.html`; extractor 33/33; golden, NOTAM and app-path compares 33/33 each — unchanged.

---

## 7. Known limitations

| Item | Note |
| :--- | :--- |
| Known indicator inside RMK text | RMK text containing e.g. ` REG/` starts a new item (Doc 4444 reserves the indicators). Not seen in the fixtures. |
| Field 19 | Cut off, not read (no user for it). |
| DOF century | `20YY`, as the NavBlue parser. |
| Field 18 `EET/` | Kept as text in `other.EET` (points and times not split). |
| Message forms | Only the filed plan `(FPL-`; other ATS messages (`CHG`, `DLA`, `CNL`) and message numbers in field 3 are not read. |

---

## 8. Integration notes (later PRs)

1. **FlightKeys parser (step 6):** calls `IcaoFpl.parseIcaoFpl(rawText)`; the module is passed in or loaded beside it (as the NAT parser is for NavBlue), so the parser stays standalone. FK-P: the parser must give the rulesets what NavBlue gives; TC-152-020 shows this module gives the same flight ID, type, wake and date on the NavBlue packages.
2. **D41 equipment check:** compares `equipment` (10a) with the MEL notes; its own brief, safety tests (positive and negative).
3. Building into `index.html` is a separate PR (`{ rule: 'icao-fpl' }` in `build/build.js`), after the gate and the master copy.
4. The NavBlue parser is not changed (D47).

---

## 9. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-11-10 | NEW | ICAO FPL reader: fields 7, 8, 9, 10, 13, 15, 16, 18 per Doc 4444; findings; Blueprint metadata; `validateSchema()`. |
