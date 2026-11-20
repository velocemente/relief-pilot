# SPEC-NOTAM-Ruleset

**Version:** v1.14.0 | **Status:** UPD | **Date:** 2026-11-18, updated 2026-11-19 (Exec answers D67a, D67b; independent QA F-1 … F-8)
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/notam-rules/notam-rules-v1.14.0.js` (manifest entry `notam-rules`, SHA-256 in `rules/manifest.json`). **Built into the app at step 5e-1** (the switch PR, O-21 / O-27, §12); until then `rules/notam-rules-next/`, entry `notam-rules-next`, with v1.13.0 built in.
**Exec decision:** D67 (18 Nov) — obstacle NOTAMs "should only show if it affects a runway, approach, SID or STAR heights or gradients", both formats (§8a).
**Exec answers:** D67a (18 Nov) — O-22 … O-28; D67b (18 Nov) — O-29, O-31, F-5, the departure card (5e), and the planning-chat rulings F-6, O-30, O-21; all binding (§8a, §8b, §8c, §12).
**Change list:** `docs/RPT-NOTAM-ObstacleRule-ChangeList-UPD-20261119-v1.2.md` (groups B, C, U, G, deferred; the departure-card list for 5e; O-28 audit; reviewed by the Exec before publishing)
**Architecture:** ADR-005 §2.1–2.3, §2.5 (module catalogue, module standard, master copies and CI; NOTAMs across formats)
**FlightKeys grammar:** `docs/RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md` §A.5 (item header), §A.6 (type headings), §A.7 (Company NOTAMs), §A.10 (D54)
**Ledger:** `RPT-NOTAM-RevisionLedger-UPD-20261118-v1.6.md` (beside this file)
**Supersedes:** v1.13.0 (`SPEC-NOTAM-Ruleset-UPD-20261117-v1.13.0.md`, kept beside this file while v1.13.0 is the module built into the app), which superseded v1.12.0 (`SPEC-NOTAM-Ruleset-UPD-20261109-v1.12.0.md`), which superseded v1.11.2, which superseded v1.11.1 (previous master, Drive "00_General Rulesets / 00_Notam Rules"), v1.11.0 and master `notam-rules-v110-1.js` (v1.10.1)

---

## 1. What this module is

The NOTAM ruleset decides, for one airport, which NOTAMs are in effect around the ETA (or the departure time), which ones apply to the aircraft, how serious each one is, and how they are grouped on the airport card.

v1.11.0 is an **extraction**: it is the NOTAM engine the PilotBrief app runs today (`src/notam.html` and `_splitNotams` from `src/airports.html`, on `main` at `17701d0`), copied into one standalone file. **Its behaviour is identical to the app's.** The proof is in §10: the module and the app give the same output, field by field, on every release airport of every Navtech/eOFP fixture.

v1.11.0 itself did not change the app; it was built into `index.html` by a separate integration PR (velocemente/relief-pilot#39, ADR-005 §2.3.3). Since then each module **revision** is built into `index.html` in its own PR (plan v4.1 / v4.3 §2): the module file in `rules/notam-rules/` changes, `index.html` is rebuilt from it, and nothing in `src/` changes.

**v1.11.1** was a revision (ledger P-22): the date-range check also tried D + 1 for a flight that lands on the next UTC day at or after 1200Z (velocemente/relief-pilot#41).

**v1.11.2** is a revision (ledger P-23): NOTAMs are checked against the **actual** UTC date and time of the evaluation window only (§6). One function, `_evalWindows`, builds the window; the date-range and schedule checks both use it. The second-day tries of v1.11.0/v1.11.1 are removed when the departure time is known. Built into `index.html` in the same PR (plan v4.3 §2 module revision).

**v1.12.0** is a revision (ledger P-24, plan v4.5 §2): the module no longer holds aircraft data. `AIRCRAFT_DATA`, `getWingspan()` and `buildAcftProfile()` are removed; there is one copy, in the aircraft-profile module (`rules/aircraft-profile`, v1.0.0), which the app builds into `index.html` just above this module. `evalNotams()` takes the aircraft **profile object** that module builds. **No NOTAM rule changes and the app's behaviour is identical** (§10, TC-151). The aircraft filter and the taxiway check read two things from that module, and both now come in as arguments: the profile (the aircraft's own values) and `getWingspan` (the wingspan of any other type a NOTAM names).

**v1.13.0** is a revision (ledger P-25, plan v4.10 §6, brief 5c): the module reads the **FlightKeys NOTAM item header** (§5a) and evaluates FlightKeys items with exactly the rules it applies to NavBlue NOTAMs (FK-P, ADR-005 §2.5): the window on its actual UTC date (ETA ± 60, D51), T6, D27, D31, D43. A text with no FlightKeys header takes the v1.12.0 path unchanged: NavBlue results are identical (§10, TC-171-030) except for D61 below. Nothing FlightKeys-related is visible yet: no FlightKeys NOTAM text reaches the module in the app until the FlightKeys parser delivers it (step 5d).

**v1.13.0, after QA (F1, D61).** (a) A FlightKeys row 1 whose location/ID cell reads but whose date cell does not (`PERM`, an en dash, a numeric month, a missing colon, a trailing `EST` …) is still an item header when its `CREATED:` row follows: that NOTAM stands alone and is never joined to the NOTAM above it (QA F1, D43, §5a). (b) **Exec decision D61 (16 Nov):** a NOTAM whose own date range is impossible or cannot be read is **always shown** — no window and no schedule hides it, even when a `SCHEDULE:` / `DLY` line is readable — and its item carries `dateUnreadable: true` and the flag **`DATE NOT READABLE – CHECK NOTAM`** at the start of its display text and row label (§8). NavBlue and FlightKeys alike. On the 30 NavBlue/eOFP fixtures this flags 14 NOTAMs that were already shown at every ETA (`test/reports/NOTAM-v1.13.0-D61-changes.md`); nothing else changes.

**v1.14.0** is a revision (ledger P-26, Exec decision D67, 18 Nov). Two changes, NavBlue and FlightKeys alike:

1. **The obstacle rule (§8a) replaces E1.** An obstacle NOTAM — its text says `OBST`, `OBSTACLE` or `CRANE` (as before), or a FlightKeys item printed under the `OBSTACLE` type heading — is shown only if its text states an effect on the heights or gradients of a runway, approach, SID or STAR (one documented pattern set, `OBSTACLE_RULE`). It is also shown when it changes anything else (it is then shown by its own content exactly as v1.13.0 shows it), or when the patterns cannot clearly decide (group U, listed for the Exec). E1 — shown whenever the text named any runway, approach, SID or STAR keyword (`notam-rules-v1.13.0.js` lines 1953–1958) — is gone.
2. **FlightKeys type headings (§5b).** The 17 printed type heading lines (grammar §A.6) are headings: never part of an item's text, and the items after a heading carry it as their category (`issues[].fkCategory`). A heading left at the end of an item can no longer hide it (FlightKeys parser v0.3.0 open item O-12: 994 items). NavBlue text has no such headings: unchanged path.

3. **D67a (Exec answers, 18 Nov).** Show an obstacle NOTAM only when a procedure (runway, approach, SID, STAR, departure, missed approach, circling) is affected. A height given near a runway or a procedure with no effect stated (incl. FAA crane NOTAMs), obstacle-light outages, and men / equipment near a runway with no height are hidden; FlightKeys items under `OBSTACLE` take the same test (O-22 … O-24). The four extra other-content cases are shown in a card group with a row (O-25, §8b). "OCA/H NOT AFFECTED" with a height near a runway and the take-off side unstated stays undecided, shown (O-26). The NOTAMs v1.13.0's obstacle filter hid although they change something else or affect a procedure are audited and all shown (O-28, §8c).

4. **D67b (Exec answers, 18 Nov) and the independent QA findings.** The rule reads only the NOTAM's own text (F-3); a table's values decide "procedure affected", never its column title (F-4); a surface notice that states minima / procedures unchanged is hidden (O-31 / F-7); an area closed — also from the ground to a height around an obstacle — is other content, in GENERAL (F-2); en-route NOTAMs (airway MEA / MOCA set by an obstacle) are deferred and decided exactly as v1.13.0 (F-5). Every shown NOTAM of change-list groups C and U has a row on the destination / alternate card: one with none goes to GENERAL (O-29 / F-1, §8b). The departure card is step 5e (§12).

Everything else is unchanged: window, schedules, D27, D31, D43, D61, the aircraft filter, classification, display text and grouping (except §8b). Every NOTAM of the corpus that is not in the change list gives exactly the same `evalNotams()` result in v1.13.0 and v1.14.0 (§10, TC-172-031, TC-172-032).

**Not in this module:** the GNSS NOTAM ruleset (`evalGNSS`, a separate module), weather, the airport card (`evalAirport`, `renderAptIssues`), and the legacy window code `xNW` / `nwOverlap` / `oETA` / `_notamWindow` in `src/airports.html` (not used by the NOTAM path since HF-5).

---

## 2. Module standard (ADR-005 §2.2)

| Item | v1.11.0 (v1.14.0 unchanged unless stated) |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. **v1.14.0:** `rules/notam-rules-next/notam-rules-v1.14.0.js`, listed as `notam-rules-next` so that the build (`build/build.js`, which inserts the `notam-rules` entry) keeps v1.13.0 in `index.html` until step 5e; TC-120-002 requires a manifest entry's file to live in `rules/<entry>/`, hence the folder. |
| Dual context | Node: `module.exports = API`. rules-loader (`new Function('module','exports','require', code)`): same. Browser, built into `index.html` unchanged: no `module` exists, so the API object is published once as the global **`NotamRules`**. All declarations live inside one factory function, so none of them collides with the app's names (for example the OFP ruleset's own `RULESET_TYPE`). |
| Metadata | `RULESET_TYPE = 'notam'`, `RULESET_VERSION = '1.14.0'`, `SCHEMA_VERSION = 2`, `RULESET_SOURCE` (ICAO Annex 15, Doc 8126, Doc 4444 App 6; FAA JO 7930.2, AIP GEN 3.1; Atlas Air / Polar Air Cargo OFP NOTAM briefing (NavBlue and FlightKeys); v1.13.0 adds "and FlightKeys"). |
| `SCHEMA_VERSION` | **2 — the current contract's value, kept.** It is the minimum `rules-loader.js` v1.0.0 requires for `'notam'` (`SCHEMA_VERSION_REQUIRED.notam = 2`) and the `schemaVersion` of the customer configuration. The `evalNotams()` arguments did not change; v1.13.0 only adds exports and one optional item field (`dateUnreadable`, present only when true, D61), so no increment. v1.14.0 likewise: four exports and one optional item field (`fkCategory`, present only for an item under a FlightKeys type heading). |
| Positions | **None (v1.13.0, D54).** The module reads text only. The FlightKeys parser reads the two-column briefing from positions and hands over item text in reading order (step 5d); the tests build that text from the fixtures' `items/` in test code (`test/lib/fk-briefing.js`). |
| `validateSchema()` | Yes (closes ledger ARCH-02). See §3. v1.14.0 also checks that every value of `OBSTACLE_RULE` is a RegExp (its `effect`, `other`, `undecided` groups: every pattern). |
| No app state, no DOM, no UI | No `window`, `document`, storage, network or app state. (`evalNotams` still returns its display text with the `nt-red` / `nt-yel` span markup, exactly as today — this is part of the return contract the card renders, see §8.) |
| Strict mode | **Off on purpose.** The code runs with the same semantics as the app's inline (non-strict) script it was copied from. |
| Clock | One environment input remains, as in the app: with **no flight date**, the year and month used to read dates come from the device clock (`new Date()`). Callers always pass the flight date. |
| Times | All UTC. `EST` in a NOTAM means an estimated end, never a time zone. No time-zone conversion anywhere. |

---

## 3. Exports

```js
{
  RULESET_TYPE, RULESET_VERSION, SCHEMA_VERSION, RULESET_SOURCE,   // metadata
  validateSchema,            // (ruleset?) -> { valid, errors[] }
  _splitNotams,              // (text) -> string[]   (v1.13.0: also FlightKeys item headers, §5)
  _fkHeader,                 // (text) -> FlightKeys header | null   (v1.13.0, §5a)
  _fkWindow,                 // (header, baseYear) -> { startMs, endMs } | null   (v1.13.0, §6)
  _fkScheduleText,           // (header) -> string   (v1.13.0, §7)
  DATE_UNREADABLE_FLAG,      // 'DATE NOT READABLE – CHECK NOTAM'   (v1.13.0, D61, §8)
  FK_TYPE_HEADINGS,          // the 17 FlightKeys type headings, frozen   (v1.14.0, §5b)
  _fkTypeHeading,            // (line) -> heading | null   (v1.14.0, §5b)
  OBSTACLE_RULE,             // the obstacle rule's pattern set, frozen   (v1.14.0, D67, §8a)
  _obstacleRule,             // (ruleText, fkCategory?) -> decision   (v1.14.0, D67, §8a)
  evalNotams,                // (notams, role, etaMin, acftProfile, flightDateISO, depMin?, getWingspan?) -> result (§8)   (v1.12.0: profile object; getWingspan passed in)
  xNW_standalone,            // (notamText, flightDateISO) -> { startMs, endMs } | null
  nwOverlap_standalone,      // (window, etaMin, flightDateISO, depMin?) -> boolean   (depMin: v1.11.1)
  _evalWindows,              // (etaMin, depMin, flightDateISO) -> [{ startMs, endMs }]   (v1.11.2, §6)
  _windowEndEstimated,       // (notamText) -> boolean   (D31 "EST" end)
  _resolveInlineDateRange,   // (startToken, endToken, baseYear, issYear, flightMo, flightISO) -> window | null
  _classifyNotamSlot,        // (nu, notamRaw, role, acftType, active, getWingspan?) -> { slot, level, label, keyRe, rwy, category }   (v1.12.0: getWingspan passed to the taxiway check)
  _apchTypeLabel,            // (nu) -> string | null
  _acftApplies,              // (notamText, acftProfile, getWingspan?) -> boolean   (v1.12.0: a non-object profile = unknown = true)
  NM,                        // pattern registry: every value is a RegExp
}
```

- The names, arguments and return values are the ones the app uses today. `rules-loader.js` v1.0.0 requires `RULESET_TYPE`, `RULESET_VERSION`, `SCHEMA_VERSION`, `RULESET_SOURCE`, `evalNotams`, `NM`, `_classifyNotamSlot`; all are present.
- **`validateSchema(ruleset)`** — `ruleset` defaults to this module's own exports. Returns `{ valid, errors }`. It checks: the loader's required exports and their types, plus `_splitNotams`, `xNW_standalone`, `validateSchema`; `RULESET_TYPE === 'notam'`; `RULESET_VERSION` is semver; `SCHEMA_VERSION` is an integer ≥ 2; `RULESET_SOURCE` is not empty; every `NM` entry is a RegExp.
- **Not exported any more (v1.12.0):** `buildAcftProfile`. The aircraft table, `getWingspan` and `buildAcftProfile` live in the aircraft-profile module (`AircraftProfile.AIRCRAFT_DATA`, `.getWingspan`, `.buildAcftProfile`). The required exports of the rules-loader are unchanged, so `SCHEMA_VERSION` stays 2.
- **Not exported any more (vs master v1.10.1):** `classifyNotam`, `extractNotamKeywords`, `deriveOperationalImpact`, `isNotamActive`. The app never calls them (EV-0 §1); they are not carried into the module (§9).

---

## 4. Inputs

| Argument | Meaning |
| :--- | :--- |
| `text` (`_splitNotams`) | One airport's NOTAM text from the OFP, **LF line endings** (the OFP parser normalises CRLF before it stores the text, `src/ofp-parse.html`). **FlightKeys (v1.13.0):** the item texts of one airport or FIR, in reading order, each from its header row to its last body line, with their line breaks and indentation (D54), page footer and running header removed by the parser (grammar §A.3, §A.10 row 10; the module also reads an item correctly if they are left in, TC-171-022). Category headings, airport and FIR block lines and empty-state boxes are not part of any item (§A.1 "Counting"). |
| `notams` | The array from `_splitNotams`. |
| `role` | `'ORIG'` for the departure airport; anything else is treated as arrival/alternate. The app passes `'ORIG'` or `'DEST'` (every alternate, ETP/CFS alternate and the destination → `'DEST'`). |
| `etaMin` | ETA (or departure time for ORIG) as minutes of the UTC day, 0–1439; `null` when unknown (no date or schedule check then: in effect). The app passes, per role: ORIG the departure time `S.outZ`; DEST `S.etaDest`; every alternate (`DEST ALT`, `EN ROUTE ALT`, `TKOF ALT`) its OFP ETA, recomputed from OUT/OFF; `CFS ALT` (ETOPS/ERA airports from the CFS block) the **midpoint of its CFS weather window**, not an ETA from the navlog. |
| `acftProfile` | The aircraft profile **object**, as the aircraft-profile module builds it (`AircraftProfile.buildAcftProfile('B744')` → `{ type, ws, mtow, code, wake, turbine, known }`). The app passes `AircraftProfile.buildAcftProfile(S.acftType \|\| '')`. An unknown **type** gives that module's worst-case profile (`known: false`), which filters as before. A type **string**, or nothing (`null`, `undefined`, `''`, any non-object), is the **unknown profile**: no aircraft filter, so every aircraft-restricted NOTAM is shown (fail-safe) and nothing else changes (TC-151-011). |
| `getWingspan` | Optional, the aircraft-profile module's `getWingspan(icaoType)` → metres or `null`. Used where the rules need the wingspan of a type **other than the aircraft's own**: the types a NOTAM names ("B744 AND ABOVE PROHIBITED", "B737 AND SMALLER ONLY") and the taxiway wingspan limit. Not passed (or not a function) → those types are unknown, so the NOTAM is shown (fail-safe; TC-151-012). The app always passes it. |
| `flightDateISO` | `'YYYY-MM-DD'` departure date D: the app passes the OFP's `DOF/yymmdd` (ICAO FPL item 18, the departure UTC date), or the OFP's plain `DD MON YY` date when no DOF is found. **The caller must pass it** (v1.11.0 has no `window._flightDateISO` fallback). Falsy → no flight date: dates are read against the device clock year (§2) and the window/day-of-month checks are not applied (in effect). |
| `depMin` | Departure (OUT) as minutes of the UTC day, or `null`/absent (the app passes `S.outZ`). Gives the UTC date of the ETA: D + 1 when `etaMin < depMin`, otherwise D (§6, `_evalWindows`). Unknown → both D and D + 1 are tried, by the window check and the schedule checks alike. |

---

## 5. Splitting

`_splitNotams` splits on every line that starts with `- ` and four capital letters (`/^(?=- [A-Z]{4}\b)/m`). If that gives one piece or none, the whole text is one NOTAM. It does not check for an ID (EV-0 §2.1 describes the consequences).

**v1.13.0 — FlightKeys.** When the text holds at least one FlightKeys item header (§5a), it is cut before each header row 1, **and only there** (a Company NOTAM body can hold lines such as `- FIRE RESCUE PH: …`, which the NavBlue rule would cut at). The pieces are exact substrings of the text, in order: joined, they give the text back byte for byte (D54). Text before the first header is its own piece, as in the NavBlue split. A text with no FlightKeys header is split by the NavBlue rule above, unchanged.

**v1.14.0 — FlightKeys type headings.** In FlightKeys text (a text with at least one item header) the split also cuts before every type heading line (§5b) and before the first non-blank line after it: each heading is a piece of its own (with the blank lines that follow it), never part of an item's piece. The pieces still give the text back byte for byte. NavBlue text: unchanged.

### 5a. FlightKeys item header (v1.13.0)

Grammar §A.5 / §A.7. Rows, as the parser hands them over:

```
<LOCATIONS> <ID>   <START> - <END>                 row 1
CREATED:<YYYY-Mon-DD HH:MM>   FL: <LO> - <HI>      row 2
[SCHEDULE:<text>]                                  D) cell, may wrap onto the next line(s)
[SUBJECT: <key>]                                   Company NOTAMs
<body>
```

| Part | Read as |
| :--- | :--- |
| Row 1 | Alone on its line: 0–7 location codes (3–4 capital letters, ICAO and IATA in either order), the ID, `START - END`, any spacing and indentation (a Company ID with no location sits at indent 75–77 pt). |
| Row 1, date cell not readable (QA F1) | The location/ID cell reads but the date cell (from its first digit to the end of the line) does not have the `START - END` shape: `2026-Nov-04 0700`, `2026-11-04 07:00`, `04-Nov-2026 07:00`, `… - PERM`, `… - UNK`, `… - UFN EST …`, `… 11:00 EST`, `… -`, an en dash `–`, `2O26-…`. Still a header — so the item is cut out and stands alone (D43) — when it has its ID (row 1 or a wrapped row) **and** its `CREATED:` row follows within 4 lines with no other row 1 between. `_fkHeader` then gives `dateUnreadable: true`, `dateText` (the cell as printed) and no start, end or `endKind`; no window (T6) → shown and flagged (D61, §8). Without the `CREATED:` row it is not a header (TC-171-101). |
| ID | `<series><nnnn>/<yy>` with or without the series letter (`0491/26`), or `ASHTAM nnnn` (one-line ASHTAM header, no `CREATED:`). **Required**: an item has an ID on row 1 or on a wrapped row (all 3,579 fixture items do). |
| Wrapped location cell ("header row desync") | More than 3 codes wrap: row 1 holds locations and dates, the next 1–3 rows hold further codes, the ID and/or the `FL:` cell, then `CREATED:`. Read only when a `CREATED:` row follows. |
| START / END | `YYYY-Mon-DD HH:MM` (UTC). END: a date, `UFN`, or `UFN(EST YYYY-Mon-DD HH:MM)`. `PERM` never occurs (grammar §A.5). |
| `CREATED:` / `FL:` | Row 2 (or after the wrapped rows; a page footer and running header left in between are tolerated, up to 4 lines). Recognised as header rows; they do not affect the evaluation (NavBlue's F)/G) line does not either). |
| `SCHEDULE:` | The first `SCHEDULE:` line and the lines it wraps onto: following lines made only of schedule words (digits, `dd-dd`, `hhmm-hhmm`, `hhmm/hhmm`, month and weekday names, `DLY`, `DAILY`, `EXC`, `AND`, `TO`, `EVERY`, `H24`, `SR`, `SS`, `BTN`, `HOL`, commas). Joined with single spaces **for the schedule readers only** (§7); the text itself is not changed. |
| `SUBJECT:` | Company NOTAMs. A content line for the rules; skipped for the display line (§8). |
| Two `CREATED:` rows in one text | Two items in one piece (a row 1 so garbled that even its location/ID cell does not read): the header is **not trusted** — no window, no schedule → shown and flagged (D61). Since F1 a row 1 with a readable location/ID cell is always cut, whatever its date cell holds. |

The location/ID cell and the `CREATED:` row are what is recognised, so an item whose date is impossible (`2026-Feb-30`, `25:00`, `Abc`) or unreadable (`PERM`, `–`) is cut out as its own item and shown on its own, flagged (TC-171-012, TC-171-101).

### 5b. FlightKeys type headings (v1.14.0)

Grammar §A.6. Inside an airport (or FIR) block the NOTAM Briefing prints the items under centred type headings, each at most once per block; the items under a heading run to the next heading or block. The FlightKeys parser keeps them in `notamsRaw` (the NOTAM section as printed) and removes them from `notams`.

| Rule | Detail |
| :--- | :--- |
| The list (closed, exact) | `RUNWAY`, `TAXIWAY`, `APPROACH AND LANDING`, `AIRPORT`, `OBSTACLE`, `NAVIGATION`, `COMMUNICATION`, `AIRSPACE`, `WARNING`, `GENERAL`, `RAMP`, `DEPARTURE PROCEDURES`, `ARRIVAL PROCEDURES`, `FACILITIES`, `N/A`, `HAZARD`, `SERVICE` (`FK_TYPE_HEADINGS`). |
| A heading line | Its text without leading and trailing spaces is exactly one of the 17 (capitals, as printed), **and** it is indented by at least 15 spaces. Centred headings print at indent 29–38 in the 26 packages (≥ 100 pt). A body line can be a heading word on its own (NavBlue 5 lines, FlightKeys 1 line, all at indent 0: `AIRSPACE`, `AIRPORT`), so an unindented line is never a heading. |
| Where | FlightKeys text only (a text with at least one item header, §5a). NavBlue text has no headings and is never read for them. |
| `_splitNotams` | Cuts each heading line out as a piece of its own (§5). |
| `evalNotams` | A piece that holds only heading lines (and blank lines) is not an item: it sets the category of the items after it, until the next heading. A heading line inside an item's piece (a piece not cut by `_splitNotams`, e.g. a heading left at the end of an item) is never item content: it is left out of the rule text and the display line; one above the item's row 1 is that item's category, one below it is the category of the items after it. `notamRaw` is the piece as given (D54). |
| Category | `issues[].fkCategory` = the heading, present only for an item under one. The `OBSTACLE` heading makes an item an obstacle NOTAM (§8a); no other heading changes any rule. |

---

## 6. Dates: the validity window

`xNW_standalone(text, flightDateISO)` returns one UTC window `{ startMs, endMs }` or `null`. **`null` = in effect** (fail-safe, D27/T6). The first pattern found decides, in this order:

| # | Wording | Notes |
| :--- | :--- | :--- |
| 1 | `B) yymmddhhmm C) yymmddhhmm` or `C) PERM` | |
| 2 | `WEF ddMMMhhmm UFC/UNTIL/TO ddMMMhhmm` or `PERM` | via `_resolveInlineDateRange` |
| 3 | `EFFECTIVE ddMMMhhmm UNTIL/TO ddMMMhhmm` or `PERM` | via `_resolveInlineDateRange` |
| 4 | `ddMMMhhmm-ddMMMhhmm [yyyy]` or `-PERM` — the **NavBlue header** (`- PANC A6531/26 03NOV1800-04NOV0200`) | the 4-digit year must be `20xx` on the **same line** (HF-1 R1) |
| 5 | `yymmddhhmm-yymmddhhmm` | |
| **0** | **v1.13.0: FlightKeys item header** (§5a) — checked **first**; when present it alone decides, and the body is never searched for another date (it is the item's B)/C)). | `_fkWindow` |

**FlightKeys windows (v1.13.0, `_fkWindow`).** A FlightKeys date carries its year, so the year inference of T1–T5 and D38 is not needed. The same outcomes as the NavBlue print of the same NOTAM (FK-P, matched pair `EOFP_UAAA-EHAM_27OCT26` / `FK_UAAA-EHAM_27OCT26`: 133 NOTAM IDs, 133 equal windows, TC-171-024):

| FlightKeys end | NavBlue print of the same NOTAM | Window |
| :--- | :--- | :--- |
| `YYYY-Mon-DD HH:MM` | `ddMMMhhmm-ddMMMhhmm [yyyy]` | start … end |
| `UFN` | `ddMMMhhmm-PERM` (e.g. `UAAA A5176/26`) | start … PERM end (1 JAN of flight year + 50): **no end (D31)** |
| `UFN(EST d)` | `ddMMMhhmm-ddMMMhhmm [yyyy] EST` (e.g. `EHAM A2422/26`) | start … d, and `_windowEndEstimated` = true → `evalNotams` removes the end: **no end (D31)**; the start still limits it |

**T6 for FlightKeys:** a date part that cannot be read (month name, day of month incl. 29 FEB in a non-leap year, hour > 23 other than `24:00`, minute > 59, year before 1900), a backwards window, an unreadable / earlier `EST` date, or a date cell that does not have the `START - END` shape at all (§5a, F1) → **no window → in effect**, and (D61) no schedule check and the flag (§8). Nothing is guessed or rolled over (`2026-Nov-31` is not 1 DEC). `24:00` = 00:00 the next day, as NavBlue's `2400`. `_windowEndEstimated` also reads the FlightKeys header first: true for `UFN(EST …)` only; an `EST` in the body is not read.

The year rules (`/YY` = the issue year from the NOTAM ID, e.g. `A0486/26` → 2026):

| Rule | Behaviour |
| :--- | :--- |
| **T1** | With `/YY`: the start year is the **earliest** year Y from the issue year to the end year with start(Y) ≤ end. |
| **T2** | Cross-month window with no end year: the start is in the issue year, never before it. |
| **T3** | `ddMMMhhmm-PERM`: the start year is the issue year (no `/YY` → the flight year). PERM end = 1 JAN of flight year + 50. |
| **T4** | `WEF` / `EFFECTIVE … PERM` with `/YY`: the start year is the issue year. |
| **T5** | No `/YY`: the flight-anchored window (unchanged from before HF-5). |
| **T6** | Nothing resolvable, a backwards window (start after end) on any path, or an **impossible date** (month outside 01–12, day outside the month, 29 FEB in a non-leap year, hour > 23, minute > 59) → no window → **in effect**. Impossible dates never roll over into another date. `2400` = 00:00 the next day. |
| **D38** | Year crossing. No `/YY`: when the end month is before the start month the end is in the next year, anchored to the flight month, so a late-DEC and an early-JAN flight get the same window. With `/YY` on `WEF`/`EFFECTIVE` (the New-Year window, HF-6): every start year from the issue year to the flight year is tried (end in the year after) and the first window that covers the flight date is used; if none does, the flight-anchored window (start never before the issue year). An issue year after the flight year → no window. |
| **D31** | `UFN` / `UFN(EST …)`: no date range is read → no window → in effect. An **estimated end** (`EST` right after the end of the range that was read, any of the 5 patterns) is **not an end**: `evalNotams` keeps the start and sets the end to infinity (`_windowEndEstimated`). PERM: see §11 (the body text is not read). |

**The evaluation window** — `_evalWindows(etaMin, depMin, flightDateISO)` (v1.11.2) is the **one** function that builds it. Exec rule (7 Nov): a NOTAM is shown only if it is in effect at some time during the airport's evaluation window (ETA ± 60 min) on the window's **actual** UTC date and time.

| Case | Window(s), UTC |
| :--- | :--- |
| Departure time known, ETA time ≥ OUT time | D + ETA − 60 … D + ETA + 60 |
| Departure time known, ETA time < OUT time (the flight crossed 0000Z) | D + 1 + ETA − 60 … D + 1 + ETA + 60 |
| Departure airport (ORIG: the "ETA" is the departure time itself) | D + OUT ± 60 (always D) |
| Departure time unknown (fail-safe) | two candidate windows, on D and on D + 1; in effect if in effect in either |
| Flight date given but unreadable | none → in effect (D27) |

The same rule applies to every airport role (departure, destination, alternates, ETOPS/ERA airports). A window that crosses 0000Z covers both UTC dates (ETA 2330Z → 2230Z … 0030Z the next day).

**In effect at the ETA** — `nwOverlap_standalone(w, etaMin, flightDateISO, depMin)`: true when the NOTAM's window overlaps a window of `_evalWindows`, **edges included** (`w.startMs <= window end && w.endMs >= window start`: a NOTAM ending exactly at ETA − 60, or starting exactly at ETA + 60, is in effect). No ETA or no flight date → true.

*v1.11.2 fix (P-23).* v1.11.0 placed the ETA on D and also tried D + 1 for an ETA before 1200Z; v1.11.1 also tried D + 1 for an ETA earlier than the departure time. Trying two days showed NOTAMs from the wrong day: a NOTAM dated only for the departure day was shown on a next-day arrival, and a departure at, say, 0300Z showed NOTAMs that start the next day. Both second-day tries are removed; with the departure time known exactly one date is checked. With the departure time unknown both days are still tried, now whatever the ETA time (v1.11.1 hid an arrival-day NOTAM at or after 1200Z in that case: app #41 QA finding 14 (a)).

---

## 7. Schedules (HF-8)

Applied only when the window check has not already said "not in effect", and only when `etaMin` is known. **Never applied to a NOTAM whose own date range is impossible or unreadable (D61, §8 step 3):** such a NOTAM is shown whatever its schedule says (day-of-month and daily alike, FlightKeys `SCHEDULE:` and NavBlue D) lines alike).

| Schedule | Rule |
| :--- | :--- |
| Day-of-month + daily time: a line `08-09 13-17 20-24 1510-2020` | Needs the flight date. Every minute of the `_evalWindows` window (§6) is checked on its **actual UTC date and time** (`_schedWindowMinutes` lists them; unknown `depMin` → both candidate windows). In effect if any minute is on a listed day inside the period. A period crossing 0000Z (`2200-0300`) also counts on the day after a listed day, up to the end time. |
| Daily time: a line starting `HHMM-HHMM` or `DLY HHMM-HHMM`, several windows separated by commas | Same every day, so only the window's times of day are used: in effect if any minute of ETA ± 60 (wrapping past 0000Z) is inside any window. Not applied when a day-of-month schedule is present. |
| **D27** | A day, a time or a date that cannot be read (hour > 24, minute > 59, `24xx` other than `2400`, day outside 1–31 or from > to, unreadable flight date) → the schedule is **not applied** (the NOTAM stays in effect). |

Weekday wording (`MON-FRI 0800-1700`) is not read (EV-0 G-6); such a NOTAM is not limited by it.

**FlightKeys (v1.13.0, `_fkScheduleText`).** The D) field is the `SCHEDULE:` cell. The two readers above read **that cell only**, with its wrapped lines joined (§5a) and a leading `DAILY` read as NavBlue's `DLY` (the same NOTAM: FlightKeys `SCHEDULE:DAILY 1600-0800`, NavBlue `DLY 1600-0800`, `EBBR D0587/26`); `SCHEDULE:0800-1600` = NavBlue `0800-1600`. Consequences, all on the shown side:

- A body line is never read as a schedule (NavBlue reads every line: a body line starting `0800-1600 …` would limit a NavBlue NOTAM; a FlightKeys item has its own D) cell).
- A wrapped cell is never read in pieces: `SCHEDULE:MON-THU 0630-0700` / `1630-1800 FRI 0630-0700` is one weekday schedule (not read, shown), never a daily 1630–1800 window; `SCHEDULE:0800-0900,` / `1400-1500` is read as both windows.
- No `SCHEDULE:` cell → no schedule. A header not trusted (§5a) → no schedule.

---

## 8. Evaluation — `evalNotams`

For each NOTAM, in this order:

**v1.13.0 — FlightKeys items.** The content rules (steps 1, 2, 4 and the red/yellow highlighting of 5) read the item's lines **except its header rows** (row 1, wrapped location rows, `CREATED:`/`FL:`): the D) and body lines, in order and unchanged, as a NavBlue NOTAM's text carries them under its `- ICAO ID dates` line. The header rows carry what a NavBlue header never does — IATA codes such as `SID`, `GLS`, `LDA` that the rules would take for keywords, `CREATED:`, `FL: SFC - UNL` (TC-171-016). `notamRaw` in the result is the whole item text, unchanged.

0. **Type heading (v1.14.0, §5b)** — a heading piece is no item: it sets the category of the items after it.
1. **Obstacle rule (v1.14.0, D67, §8a)** — an obstacle NOTAM is skipped unless the obstacle rule shows it. (v1.13.0, E1: skipped a NOTAM that says `OBST`, `CRANE` or `OBSTACLE` and has no approach/departure keyword, EV-0 R-OBS.)
2. **Aircraft filter** — `_acftApplies` hides a NOTAM only when it explicitly excludes the aircraft (EV-0 R-ACF, A1–A7). Rules unchanged; the aircraft's values come from the profile object, the wingspan of other named types from `getWingspan` (v1.12.0). An unknown profile (a string, nothing) shows every NOTAM.
3. **In effect** — window (§6), then schedules (§7). Not in effect → skipped. **D61 (v1.13.0):** a NOTAM with a NOTAM header (a FlightKeys item header, or a NavBlue `- ICAO [ICAO …] A1234/YY` line) and **no window** (the T6 path: its own date range is impossible or cannot be read) is in effect, and **no schedule is checked** for it (§7). An item with no NOTAM ID (e.g. NavBlue `- XXXX INFO LAST VERIFIED …`) has no date range of its own: unchanged (window and schedules as before), not flagged.
4. **Classify** — `_classifyNotamSlot` (first matching rule wins; ORIG and DEST/ALT rule sets; EV-0 §2.5 lists every rule).
5. **Display text** — the first body line (header, schedule lines skipped), at most 120 characters, HTML-escaped; the label (or highlighted keyword) is wrapped in `<span class="nt-red|nt-yel">`. FlightKeys (v1.13.0): the first line after the header rows, the `SCHEDULE:` cell and `SUBJECT:`. **D61 (v1.13.0):** for a NOTAM of step 3's D61 case, `text` starts with the escaped flag `DATE NOT READABLE – CHECK NOTAM — ` and so does `rowLabel` (plain text; the airport card escapes it), and the item carries `dateUnreadable: true`. The card shows `rowLabel` on the NOTAM's own row (`src/edit.html` `renderNotamGroups` / `renderAptIssues`): the flag appears there with the existing row markup, no new element (TC-171-104). Level, slot, label and grouping are unchanged.
6. **Duplicates (D43)** — two NOTAMs are duplicates **only** when they have the same location(s) and the same ID (`- ICAO [ICAO …] A1234/YY`); different IDs are always both kept. A NOTAM with no readable ID is a duplicate only of one whose text is identical after whitespace is normalised. The first copy is kept. FlightKeys (v1.13.0): the location codes of the header (ICAO and IATA, as printed, in order) and the ID; a header not trusted (§5a) → keyed by its text.

**Return object (v1.13.0: one optional item field):**

```js
{
  issues:     [{ slot, level, active, text, notamRaw, rwy, label, rowLabel, category, dateUnreadable?, fkCategory? }],
              // dateUnreadable: true only for D61 NOTAMs (absent otherwise);
              // fkCategory (v1.14.0): the FlightKeys type heading the item sits under (absent otherwise);
              // sorted: slot ascending, active first, red before yellow;
              // nothing kept → one green item { slot: 99, text: '✓ NOTAMs reviewed — no critical items', … }
  rwyGroups:  Map<key, { rwy, groupType: 'runway'|'taxiway'|'general', worst, label, items[] }>,
  sidIssues:  issues with category 'SID',  sorted by rowLabel
  starIssues: issues with category 'STAR', sorted by rowLabel
  infoIssues: issues with category 'INFO', sorted by label
  worst:      'red' | 'yellow' | 'green'
}
// No NOTAMs at all → { issues: [], rwyGroups: new Map(), worst: 'unknown' }
```

**Grouping** (`rwyGroups`): runway slots are 1, 2, 5, 6 at ORIG and 1–4 elsewhere; taxiway items (slots 3/6 with a `TWY` label) all go to one `TAXIWAYS` group; runway items go to `RWY-<rwy>` (`groupType 'runway'`, label `Approach RWY <rwy>`) or, with no runway, to `GENERAL` (label = the single item's `rowLabel`, or `General NOTAMs`). Items in a group are sorted by `rowLabel`; a group's `worst` is its most severe item.

### 8a. The obstacle rule (v1.14.0; Exec decisions D67 and D67a, 18 Nov)

> D67: "Obstacle NOTAMs should only show if it affects a runway, approach, SID or STAR heights or gradients." Both formats. Replaces E1.
>
> D67a (binding): show an obstacle NOTAM only when a procedure (runway, approach, SID, STAR, departure, missed approach, circling) is affected. O-22: a height given near a runway with no procedure named (incl. FAA crane NOTAMs) → hidden. O-23: obstacle-light outages, and men / equipment near a runway with no height given → hidden. O-24: FlightKeys items printed under OBSTACLE with no obstacle word → hidden unless they affect a procedure (the same test). O-25: the four extra other-content cases → shown, each in the card group whose row it belongs in (§8b). O-26: "OCA/H NOT AFFECTED" with a height near a runway and the take-off side not stated → undecided, shown.

**Obstacle NOTAM** = the rule text (FlightKeys: the D) and body lines; NavBlue: the NOTAM text) says `OBST`, `OBSTACLE` or `CRANE` (`OBSTACLE_RULE.obstacleWord`, the v1.13.0 test unchanged), **or** it is a FlightKeys item printed under the `OBSTACLE` type heading (§5b). Any other NOTAM is never touched by this rule.

**Own text (D67b F-3).** The rule reads only the NOTAM's own text (`_ownNotamText`): a NavBlue piece of the whole OFP text ends at its first line that begins another text — a METAR / TAF / SPECI, `NO … REPORTS FOUND`, `- NO OPERATIONAL NOTAMS`, or an FAA domestic NOTAM (`- AKN 03/022 …`, `- LOU 09/150 …`, which the split does not cut) — and a section heading just before such a line (`ETP ALTERNATES`, `OTHER`) is left out too (`OBSTACLE_RULE.notamEnd`, `sectionHeading`). The obstacle word and every pattern are read in that text only. A FlightKeys item is its own text. (So KSFO A5647/24, a crane height only, is no longer shown for another NOTAM's `VORTAC U/S`; and CYQX E2929/26, KCVG A3994/25, KZAU A0207/26, YBRK J5859/25, CZWG G2674/26, EDFH C1139/26 are no obstacle NOTAMs at all — their obstacle word stands in the text after them.)

**Reading.** The rule reads the rule text in capitals with every run of white space as one space (a wrapped statement is read as one; the text is not changed). Inside a pattern, "the same sentence" means up to the next full stop; a decimal point (`113.55`, `0.5NM`) does not end it. Two kinds of phrase are set aside first:

| Set aside | Pattern | Why |
| :--- | :--- | :--- |
| A stated non-effect | `noEffect`: `OCA/H`, `OCH`, `MINIMA`, `PROC…`, `APCH`, `IAP`, `SID`, `STAR`, `DEP…`, `TKOF` / `TAKE-OFF` (D67a), `OBST CLEARANCE` + `NOT AFFECTED` / `UNAFFECTED` / `NOT IMPACTED` / `UNCHANGED` / `NOT CHANGED`; `NO IMPACT / EFFECT / CHANGE ON …`; and (D67b) `MNM` / `MINIMA` / `OCA` / `PROC` / `APCH` / `IAP` / `SID` / `STAR` … `NO CHANGE` / `NC` (`WX MNM,INST APCH PROC,SID,STAR NO CHANGE`) | so that "OCA/H NOT CHANGED" or "PROCEDURES NOT AFFECTED" is not read as an effect; the decision records `noEffectStated` |
| An obstacle light out of service | `obstacleLight`: `OBST` / `OBSTRUCTION` / `TOWER` / `CRANE` / `ANTENNA` / `MAST` / `BLDG` / … + `LGT` / `LIGHT…` … `U/S` / `UNSERVICEABLE` / `OTS` / `INOP` / `NOT AVBL` / `UNLIT` … | so that "AD VORTAC OBST LGT U/S" or "OBST LGTS ON RWY 09 GLIDESLOPE U/S" is not read as a navaid or aerodrome light out of service |

**Tables (D67b F-4).** A tabular obstacle NOTAM carries the column title `FLT PROC/TAKE-OFF PATH AREA AFFECTED` (`FLIGHT PROCEDURE/…`, `OBSTACLE_RULE.tableTitle`). The title is never a procedure affected: it is removed, and the **values** after it decide — a runway with an approach / take-off / departure / missed-approach / circling path, or a procedure named (`tableValue`: `RWY35R VOR/DME FINAL APCH`, `RWY16L TAKE-OFF FLT PATH`) → `PROCEDURE_AFFECTED`, shown; every value `-` or empty → not affected (the rest of the rule decides; ZPPP U3121/26, U3512/26, ZSPD F0378/26, ZUCK U1704/26 hidden). The ZGSZ database coding tables are not this table: they change a procedure's path and altitudes (`PROCEDURE_ALTITUDE`, shown), re-checked.

**Decision** (the first pattern that matches is the reason, `_obstacleRule().pattern`):

| Step | Group | Patterns | Result |
| :--- | :--- | :--- | :--- |
| 0 | `DEFERRED` (D67b F-5) | `enRoute` an en-route NOTAM: an airway / route (`RTE`, `ROUTE`, `AWY`, or a V / J / Q / T airway — never a NOTAM ID) with an MEA / MOCA / MCA / MRA / MAA, set by an obstacle (KZOB A0408/26, KZID A0718/26, A0314/25) | **as v1.13.0**: hidden when its text says OBST / OBSTACLE / CRANE and holds none of v1.13.0's E1 keywords (`e1Keyword`), else shown. Deferred to a later iteration |
| 1 | `effect` (brief item 2; D67a: a procedure affected) | `MINIMA_CHANGED` approach minima raised or changed (DA/DH, MDA/MDH, OCA/OCH, minima; `CHANGE OF / IN … MINIMA / OCA`) · `MINIMA_VALUE` minima given as values (`DA 474/HAT 346`, `MDA 580`, `OCA 270`, `RVR 4500`, `VIS 1 1/4`, `MINIMA … 580`, `MINIMA TO READ`) · `NOT_AUTHORISED` a procedure or minima not authorised (`PROC NA`, `CIRCLING CAT C/D NA`, `NOT AUTH…`, `NOT PERMITTED`, `PROHIBITED`) · `GLIDE_PATH_VGSI` glide path / VGSI angle (`GP … ANGLE / DEG`, `VDA`, `VPA`) or a VGSI not coincident / unusable beyond · `OBSTACLE_CLEARANCE` obstacle clearance; MOC / MOCA / OCS / OIS raised or changed · `CLIMB_GRADIENT` missed-approach or departure climb gradient (`FT/NM`, `FT PER NM`, `%`, `PERCENT`, `PDG`, `MIN CLIMB`, `CLIMB GRADIENT`, missed approach … climb) · `TKOF_ODP` take-off minimums, ODP, obstacle departure procedure (the v1.13.0 TKOF keywords, unchanged) · `TKOF_MINIMA` take-off minima in other wordings (`TAKE-OFF MINIMUMS`, `TKOF MNM`) · `PROCEDURE_ALTITUDE` SID / STAR / approach altitude constraints changed (`AT OR ABOVE`, `ALT RESTRICTION`, `MIN ALT`, `CROSS … AT`, `ALT:750M` on a procedure, `TURN ALT 600FT VICE 500FT`, MSA raised, a procedure coding table) · **D67a:** `PROCEDURE_AFFECTED` a flight procedure or take-off path stated "affected" (moved from undecided: the procedure is affected) · `CLOSE_IN_OBSTACLE` a close-in obstacle (`CLOSE-IN OBST`, `LOW CLOSE END OBST`): it is noted on the SID / ODP for the departure (moved from undecided) | **shown** |
| 2 | `other` (brief item 3) | `NAVAID` a navaid out of service, unreliable or disturbed (bearing fluctuations, interference) · `LIGHTING` aerodrome lighting out of service · `PROCEDURE_AVAILABILITY` a procedure not available / suspended / withdrawn / U/S · `PROCEDURE_CHANGE` a procedure introduced, adjusted or amended (`VISUAL APCH REGULAR OPR`, `STAR … AMENDED`) · `DECLARED_DISTANCES` TORA / TODA / ASDA / LDA changed or given · `THRESHOLD` displaced / relocated / temporary threshold · `RWY_AVAILABILITY` runway or aerodrome closed / not available · `CLOSED_TO_TRAFFIC` an area closed to aircraft / traffic · `AREA_CLOSED` (D67b F-2) an area / airspace / zone closed, also `CLSD FM GND UP TO …` around an obstacle (LLBG A0701/26, A0720/26) · `TWY_AVAILABILITY` taxiway closed / restricted · `APRON_STAND` apron, stand or gate closed / not available · `LOW_VIS_OPS` low-visibility operations amended / suspended | **shown by its own content**, classified and displayed exactly as v1.13.0 (the classifier is unchanged); `APRON_STAND`, `CLOSED_TO_TRAFFIC`, `PROCEDURE_CHANGE`, `LOW_VIS_OPS` are given a card group with a row when the classifier gives them none (D67a O-25, §8b) |
| 3 | `undecided` (brief item 5; what D67a leaves undecided) | `SURFACE_PENETRATION` a protection surface penetrated / infringed (transitional, inner horizontal, OLS …) · `SURFACE_NAMED` an obstacle in or above a named surface (approach, take-off climb, transitional, inner horizontal, horizontal, conical; OLS, OFZ) · `RUNWAY_STRIP` in the runway strip / graded area / RESA · **`TAKEOFF_SIDE_UNSTATED`** (D67a O-26) every stated non-effect names the approach side only (OCA/OCH, minima, approach, IAP, STAR — not SID, departure, take-off or all procedures), and a height (`height`) and a runway (`runwayRef`) are given | **shown**; listed for the Exec (change list group U). **D67b O-31 / F-7:** a surface notice (`SURFACE_PENETRATION`, `SURFACE_NAMED`, `RUNWAY_STRIP`) that states minima / procedures unchanged (`noEffect`) → **hidden** (reason `STATED_UNCHANGED`; RJTT J0786/26, RJAA A1610/26 …, 27 rows) |
| 4 | — | none of the above: **hidden**. D67a O-22 / O-24: a height (`height`) and a procedure named (`procedureRef`: APCH, IAP, SID, STAR, ILS, LOC, GP, RNAV, missed approach …) with no effect stated → reason `HEIGHT_NEAR_PROCEDURE`; a height and a runway named (`runwayRef`: RWY, THR, RCL, APCH / DEP END, DER, FINAL, TORA …), no procedure → `HEIGHT_NEAR_RUNWAY` (incl. FAA `OBST CRANE … APCH END RWY 27 … FT AGL`). O-23: an obstacle-light outage is set aside (`obstacleLight`) and men / equipment near a runway with no height decide nothing → hidden | **hidden** |

The order inside a group only decides which reason is reported when several match (a navaid, light or procedure out of service before the runway it serves). `height` is a number with `FT` / `M` and `AGL` / `AMSL` / `MSL` (`254FT (243FT AGL)`, `105FT (32M) AGL`, `263 MSL`), or `HGT` / `HEIGHT` / `ELEV` + a number, or `UP TO … FT / M`.

**What the rule does not do.** It reads only the obstacle NOTAM's own text (and, FlightKeys, its heading). It does not decide whether an obstacle is significant for performance (take-off obstacle data): an obstacle with a height near a runway and no effect stated is hidden (D67a O-22), unless the approach side alone is stated not affected (O-26, U). It does not change any other filter: the aircraft filter, the window, the schedules, D61 and D43 apply after it exactly as before.

### 8b. Card groups of the four extra other-content cases (v1.14.0; D67a O-25)

The airport card draws a row only for the runway groups (`RWY-<rwy>`), `GENERAL`, `TAXIWAYS`, `SIDs` and `STARs` (E2; `src/edit.html` `renderAptIssues` / `renderNotamGroups`, unchanged). An obstacle NOTAM shown for one of the four cases below whose classification (`_classifyNotamSlot`, unchanged) gives it none of these — a catch-all slot 7/8, or an INFO item outside a runway slot — is given:

| Case (`OBSTACLE_RULE.other`) | Card group | Slot (ORIG / DEST) | Label |
| :--- | :--- | :--- | :--- |
| `APRON_STAND` apron, stand or gate closed / not available | `GENERAL` | 6 / 3, no runway | `APRON/STAND CLSD` or `APRON/STAND NOT AVBL` |
| `CLOSED_TO_TRAFFIC` an area closed to aircraft | `GENERAL` | 6 / 3, no runway | `AREA CLSD TO ACFT` |
| `AREA_CLOSED` an area closed (D67b F-2) | `GENERAL` | 6 / 3, no runway | `AREA CLSD` |
| `PROCEDURE_CHANGE` a SID named, at the departure airport | `SIDs` | 4 (category `SID`) | `<SID> CHANGE` |
| `PROCEDURE_CHANGE` a STAR named, at the destination / an alternate | `STARs` | 5 (category `STAR`) | `STAR <STAR> CHANGE` |
| `PROCEDURE_CHANGE` an approach or other procedure (or a SID / STAR in the other role) | its runway `RWY-<rwy>`; with no runway named `GENERAL` | 5 / 3 | `<APCH> PROC CHANGE RWY <rwy>`, `SID / STAR <name> CHANGE` |
| `LOW_VIS_OPS` low-visibility operations amended / suspended | its runway `RWY-<rwy>`; else `GENERAL` | 6 / 3 | `LVO CHANGED [RWY <rwy>]` |

Level yellow. A classification that already has a row is kept (e.g. a STAR the classifier reads as a STAR change). The runway is the first one named (`NM.RWY_ID`, `NM.ILS_RWY_EUR`). No case falls outside a group with a row: all 8 O-25 rows of the change list have a row as departure and as destination airport (TC-172-017, TC-172-033).

**Every other shown C or U NOTAM (D67b O-29 / F-1).** On the destination / alternate card (role `DEST`), a NOTAM that v1.14.0 shows and that has no card row after the classification and the mapping above goes to the airport's `GENERAL` group (slot 4, no runway; level and label as classified) when it is
- one v1.13.0's obstacle filter hid — its text (the whole text, as v1.13.0 read it) says OBST / OBSTACLE / CRANE and holds none of E1's keywords (`e1Keyword`): change-list group C — e.g. KCVG A3994/25 TACAN U/S, KZAU A0207/26 VORTAC unusable, YBRK J5859/25 beacon U/S; or
- an undecided obstacle NOTAM (group U).

A deferred en-route NOTAM (F-5) is never moved. A NOTAM v1.13.0 showed too keeps v1.13.0's result (open item O-32 below). Result: all 54 shown C / U / G rows of the change list have a row on the destination / alternate card (TC-172-033, TC-172-070). The departure card (role `ORIG`) is not changed here: §12, step 5e.

**Open item O-32.** Obstacle NOTAMs that v1.13.0 and v1.14.0 both show for an effect or other content and that have no destination-card row: 141 rows, 100 NOTAMs (NavBlue 95 / 70, FlightKeys 46 / 30) — mostly ODP / take-off minimums / climb gradients (TKOF_ODP, CLIMB_GRADIENT, CLOSE_IN_OBSTACLE), which the classifier files for the departure role only. Outside D67b's scope ("any other C row or newly shown U row"); not moved, so every NOTAM outside the change list stays identical to v1.13.0. **Closed (planning chat, 19 Nov, after QA2 QA-2):** not moved in v1.14.0. About 37 of the 141 rows (about 30 NOTAMs) are approach, STAR or approach-minima effects at the destination (e.g. KMIA A3054/26 RNP RWY 30 DA raised, KSFO A5323/26 sidestep MDA, ZSPD F1556/26 RWY 35R VOR/DME final); crews do not see them today either. **Step 5e** gives them a destination-card row, together with the departure-card rows (§12). The other 104 rows are take-off effects and get their row on the departure card in 5e.

### 8c. O-28 audit (v1.14.0; D67a O-28)

v1.13.0's obstacle filter E1 hid every NOTAM whose text said `OBST` / `OBSTACLE` / `CRANE` and held none of its keywords, whatever else it said. In the NavBlue whole-text corpus a piece can also carry the weather text after the last NOTAM of a section, so a NOTAM that is not an obstacle NOTAM (CYQX `TWY B CLSD`, KCVG `TACAN U/S`, YBRK `ABN U/S`) was hidden by an "OBST" in that text. The change list v1.1 (section "O-28 audit") lists:

- **(a)** every NOTAM of the corpus (NavBlue and FlightKeys) that E1 hid and that v1.14.0 decides as a procedure affected (effect) or as changing something else (other): **15 rows, 13 NOTAMs** (change list v1.2) — the EHAM circling OCA/H increases (4 NOTAMs, 5 rows), PASY ramp closed to aircraft, ZYSH surveillance minimum altitude, LLBG A0701/26 area closed (2 rows), and six NOTAMs that are no obstacle NOTAMs at all, their obstacle word standing only in the text after them (CYQX taxiway closure, KCVG TACAN, KZAU VORTAC, YBRK beacon, CZWG airspace warning, EDFH apron parking). v1.1 also listed KSFO A5647/24 (its VORTAC U/S belongs to another NOTAM, F-3) and ZPPP U3121/26, U3512/26 (table values all "-", F-4): now hidden by both, out of the audit. Each with the obstacle word and where it stands, the content and the missing keyword, the v1.14.0 group and card group. **All are shown by v1.14.0** (TC-172-061 on the corpus; TC-172-060 one synthetic test per kind, each failing on v1.13.0).
- **(c)** the beta exposure, read only: NOTAM v1.11.2 (git `cb473e5`, the bytes built into the beta's `index.html`, SHA-256 `faa8377d…`) over the NavBlue corpus, each NOTAM alone with no window: **29 NOTAMs hidden by v1.11.2 and shown by v1.14.0** (change list v1.2) — the 12 NavBlue NOTAMs of (a) and 17 undecided (U) NOTAMs (surface penetrations at EIDW, LIBG, YMML, YBRK). v1.1: 28. v1.11.2's obstacle filter is E1, as v1.13.0's.

---

## 9. What was not carried from the app's `src/notam.html`

None of these is called by the app's NOTAM path (EV-0 §1, and TC-120-004 checks that the module neither declares nor references them):
`classifyNotam`, `extractNotamKeywords`, `deriveOperationalImpact`, `isNotamActive`, `notamTimeToDate`, `SCHEDULE_PATTERNS`, `DAY_ABBR`, `decodeNotamSchedule`, `isActiveInSchedule`, `AIRPORT_TIMEZONES`, `getAirportTimezone`, `airportLocalTime`, `AIRCRAFT_WINGSPAN`, and the first of the two `_twyApplies` declarations (the browser uses the second one; so does the module).

The only edits to the copied code: the `window._flightDateISO` fallback is removed from `xNW_standalone`, `nwOverlap_standalone` and `evalNotams`, and the write/restore of that global in `evalNotams` is removed. Each edit is marked `v1.11.0` in the file.

---

## 10. Tests and evidence

`test/rules/notam-rules.test.js` (run by `npm test` through `test/unit/rules.test.js`; CI on every PR). Fixtures missing → the fixture tests **fail**, never skip.

| ID | Check | Result at extraction |
| :--- | :--- | :--- |
| TC-120-001 | Metadata; `validateSchema()` valid; a broken ruleset is rejected with each error | pass |
| TC-120-002 | `rules/manifest.json`: version, file and SHA-256 of every module file | pass |
| TC-120-003 | Node, rules-loader and browser contexts give the same API; the browser adds only `NotamRules`; no DOM/window/storage in the code | pass |
| TC-120-004 | Every module declaration equals the app source except the documented edits | 22 declarations, 3 with edits |
| TC-120-010 | **Equivalence** at the OFP ETA, every Navtech/eOFP fixture and release airport, called as `evalAirport()` calls it; whole result field by field | 30 fixtures, 142 airports, 3,870 NOTAMs; **0 differences** |
| TC-120-011 | **Equivalence** of every NOTAM's window, EST flag and overlap (airport text and the whole OFP text) | 11,574 NOTAMs; **0 differences** |
| TC-120-012 | **Equivalence** beyond the ETA: both roles, 9 times of day, departure known/unknown, no flight date | 7,668 calls; **0 differences** |
| TC-120-013 | The app's output does not depend on `window._flightDateISO` beyond the date passed (so removing the fallback is invisible) | 568 calls; 0 differences |
| TC-120-020 | Every existing NOTAM unit test (TC-110, TC-111, TC-113, copies-agree synthetic set; TC-121 from v1.11.1; TC-122 from v1.11.2) against the module | 66/66 (same as against the app); v1.11.1: 73/73; v1.11.2: 82/82 |
| TC-120-021 | The gate bites: the EST rule removed from a copy → NOTAM tests fail and the corpus comparison differs | 3 tests fail; 5 airports differ |
| TC-120-030 | Fixtures missing → TC-120-010..013 fail | pass |
| TC-121-001 … 007 | **v1.11.1** (`test/unit/notam-next-day.test.js`): arrival-day-only schedule, ETA on D + 1 at 0030Z, 1159Z, 1200Z, 1800Z, 2330Z → in effect (also through `evalAirport`); departure-day-only schedule with the window wholly on D + 1 and other negatives → not in effect; window crossing 0000Z both ways; day-of-month, weekday and `DLY` forms; unreadable schedule → shown; `nwOverlap_standalone` with and without `depMin` | 7/7 pass on v1.11.1; 6/7 fail on v1.11.0 (the negatives pass on both). v1.11.2: TC-121-007's departure-time-unknown asserts now expect D and D + 1 (in effect) |
| TC-122-001 … 009 | **v1.11.2** (`test/unit/notam-actual-window.test.js`): departure-day-only NOTAM on a D + 1 arrival (ETA 0030Z, 1300Z) → hidden; ORIG at 0300Z, NOTAM starting D + 1 → hidden; before ETA − 60 / after ETA + 60 on the actual date → hidden, exactly on an edge → shown (inline, B)/C), 10-digit, schedule); window across 0000Z on both dates; departure time unknown → D or D + 1 (date range and schedule, incl. at or after 1200Z); no ETA / no flight date / unreadable dates / UFN / EST / PERM → shown; day-of-month on the wrong / right day; `_evalWindows` is the only window builder; `evalAirport()` with `S.outZ` | 9/9 (94 assertions) pass on v1.11.2; on v1.11.1 7 of 9 tests fail (23 assertions); TC-122-006/007 (unchanged fail-safe and schedule rules) pass on both |
| Updated for v1.11.2 | The rule change makes "departure time unknown" try D + 1 whatever the ETA time. Tests that called `evalNotams` with no departure time at ETA 1200Z so that only D was checked now pass a departure time of 0000Z (ETA on D, as before): `notam-year` (T6/D38 section) and `notam-merge` (synthetic cases). TC-113-006: its frozen pre-HF-8 baseline tries two days, so the 23 shown → hidden of the corpus (below) are now an exact reviewed list; hidden → shown is unchanged | all pass |
| TC-151-001 … 030 | **v1.12.0** (`test/rules/notam-aircraft.test.js`): no table / `getWingspan` / `buildAcftProfile` in the module (code and exports), version, manifest, v1.11.2 removed from `rules/`; **equivalence with v1.11.2** — 42 synthetic NOTAMs (every branch of the aircraft filter and of the taxiway wingspan check, named types in and out of the table) × 70 types (62 table types, unknown and odd inputs): `_acftApplies()` and `evalNotams()` (ORIG, DEST) with the profile object and `getWingspan` give what v1.11.2 gave for the type string, on the standalone file and on the copy in `index.html` (`test/rules/data/acft-expected-v1.11.2.json`, recorded from the v1.11.2 file, SHA-256 `faa8377d…8997`); a string / empty / null / undefined / number aircraft → every aircraft-restricted NOTAM shown (positive) while a real profile hides them (negative); `getWingspan` passed vs not passed (positive and negative); `evalAirport()` hands `evalNotams()` the module's profile and `getWingspan` at every release airport of every fixture; one copy in `index.html`; the gate bites (4 broken variants) | 7/7 pass |
| Updated for v1.12.0 | The tests that call `evalNotams()` directly with an ICAO type string now call it as the app does (`test/lib/acft.js`: the profile built by the aircraft-profile module, `getWingspan` passed; harness `app.evalNotamsAs`), because a string is now the unknown profile. TC-120-001 (version), TC-130-004 (`deriveCallsign` is the module's), TC-150-004/010/011/020 (the old NOTAM and app copies are gone: the module is held to the SHA-256 of the v1.11.2 block, to the app's original `deriveCallsign` text, and to the copy built into `index.html`) | all pass |
| TC-171-001 … 040 | **v1.13.0** (`test/rules/notam-flightkeys.test.js`): §5a forms (synthetic, positive and negative); UFN = PERM, UFN(EST) = EST; impossible dates → only that NOTAM shown (14 forms, in a 5-item text); a FlightKeys item and its NavBlue twin shown at the same ETAs (6 pairs × 2 roles × 3 dates × 4 departure times × 97 ETAs = 13,972 cases, year end); SCHEDULE readers; D43; D54. **Fixtures** (26 FlightKeys packages, item texts built by `test/lib/fk-briefing.js` from `items/` with the two-column reading of grammar §A.1): every count of §A.5 equals the grammar doc (§10a); all 3,281 NOTAM items and 298 Company/HSCN items have a readable window; the split gives back exactly the items (7,158, with and without page furniture); 40 header rows split by a page and 13 wrapped location cells read whole; FK-P matched pair. **NavBlue unchanged:** no FlightKeys header in any of the 30 NavBlue/eOFP texts; split = v1.12.0 rule; windows, EST flag and `evalNotams()` (both roles, 9 times of day, departure unknown / 0000Z / 1140Z, with and without flight date) equal the results recorded from v1.12.0 (`test/rules/data/notam-v1.12.0-navblue.json`, SHA-256 of v1.12.0 `0d615a13…2557`): 7,704 NOTAMs, 22,572 calls, 0 differences. The gate bites: 5 broken variants caught | 16/16 pass |
| TC-171-012, 030, 101 … 104 | **v1.13.0 after QA (F1, D61).** TC-171-101: each of the 9 unreadable header-date forms of the QA (no colon, numeric month, day first, `PERM`, `UNK`, `UFN EST` without brackets, trailing `EST`, no end, en dash) and the 8 impossible ones (30 FEB, 29 FEB non-leap, 31 NOV, `25:00`, `12:60`, month `Abc`, backwards window, impossible EST), each directly after a NOTAM with a window and a daily schedule: two items, two IDs; the second shown and flagged at every one of 882 evaluations (ETA every 30 min and none, 3 flight dates incl. none, 3 departure times incl. unknown, both roles); the first identical to its evaluation alone and still hidden outside its schedule; also a wrapped location cell and a Company header split by a page; negatives (no `CREATED:`, a body line naming another NOTAM). TC-171-102: impossible / unreadable date + readable daily, `DAILY` or day-of-month schedule (FlightKeys and NavBlue, 12 cases) → shown outside the schedule, flagged; readable date + the same schedules (7 cases) → unchanged, no flag. TC-171-103: flag and body escaped; no ID → not flagged; obstacle filter and D43 unchanged. TC-171-104: the airport card shows the flag on the NOTAM's own row, same markup as an unflagged row. TC-171-030: NavBlue split and windows = v1.12.0; `evalNotams()` = v1.12.0 for every NOTAM except the 14 of the D61 list, each shown and flagged at all 120 sweep points. Each new test fails on the pre-QA head `30c7b61` (every one of the 17 forms individually) | 20/20 pass |
| Updated for v1.13.0 | TC-120-001 and TC-151-001: the version and file name asserts (1.12.0 → 1.13.0); TC-151-001 also checks that v1.12.0 is removed from `rules/` | all pass |
| TC-172-001 … 090 | **v1.14.0** (`test/rules/notam-obstacle.test.js`, 18 tests): module standard (version, manifest `notam-rules-next`, exports, `validateSchema` incl. a broken pattern set, Node / rules-loader / browser, no DOM) and **not built into `index.html`** (it carries v1.13.0 byte for byte); every v1.13.0 declaration except the edited ones (`RULESET_VERSION`, `_splitNotams`, `_splitAt`, `evalNotams`, `validateSchema`, `API`) byte-identical; **each effect pattern** shown with its reason and **the same NOTAM without the phrase hidden**, also when it still names the runway or procedure (v1.13.0 showed those: E1 gone), NavBlue and FlightKeys (18 cases × 2); **each other-content case** shown, classified as v1.13.0 classifies it, identical to v1.13.0 where v1.13.0 shows it, hidden without the change (19 × 2); **group U samples** shown, hidden without the surface / height (10 × 2); stated non-effects and obstacle-light outages (positive and negative); non-obstacle NOTAMs identical to v1.13.0; the `OBSTACLE` heading makes an item an obstacle NOTAM, the other 16 never; **headings**: each of the 17 cut out, byte for byte, never in an item or an issue, indent ≥ 15 only, NavBlue split unchanged; **a trailing heading hides nothing** (17 headings × 4 items × 2 ETAs; v1.13.0 hides under `OBSTACLE`: O-12); categories; **FlightKeys corpus** (the parser's `notamsRaw` of 137 airports from `expected/notam-rules-v1.14.0/fk-notams-raw.json`): 2,292 items with their printed categories, 635 headings, none in an item; with and without headings the same result for every item except the 13 `OBSTACLE`-category items of the change list; v1.13.0 (no headings) = v1.14.0 (`notamsRaw`) for every item not in the change list, no window and every airport window (12,372 calls); **NavBlue corpus**: 30 fixtures, 7,704 NOTAMs, split unchanged, every NOTAM not in the change list identical at the TC-171-030 sweep (43,416 calls), every B / C entry differs, every U entry shown; change list data = report; D61, D43, aircraft filter (TC-151 cases × every type) identical; the gate bites (E1 restored, headings not read, the `OBSTACLE` heading ignored, a non-effect read as an effect: each caught); fixtures missing → fail | 18/18 pass; `npm test` 488/488 |
| TC-172 after D67a | 23 tests (`npm test` 515/515). Updated: the effect cases add `PROCEDURE_AFFECTED`, `CLOSE_IN_OBSTACLE`; the U cases are what D67a leaves undecided; the `OBSTACLE` heading with a height near a runway / procedure is hidden. New: **TC-172-016** O-22 / O-23 / O-24 samples (FAA crane, crane by a threshold, crane near an approach course, obstacle-light outages, men / equipment) hidden, each shown once a procedure is affected; **TC-172-017** O-25: each case in its card group (§8b) as ORIG and DEST, a classification with a row kept, a non-obstacle NOTAM untouched; **TC-172-018** O-26 shown, 5 negatives hidden (take-off side stated, all procedures stated, no height, no runway); **TC-172-060** O-28 (b): 8 kinds + 2 NavBlue pieces whose obstacle word is in the weather — shown by v1.14.0, hidden by v1.13.0; **TC-172-061** O-28 (a) on the corpus; TC-172-031 / 032 check group G; TC-172-033 the v1.1 counts, audit and beta counts, card groups | 23/23 pass |
| TC-172 after D67b | 29 tests (`npm test` 521/521). New, each failing on the D67a head `dcf8378` on behaviour: **TC-172-070** O-29 / F-1 (shown C / U rows with no card row → GENERAL on the destination card; departure card unchanged; shown-by-both untouched), **TC-172-071** O-31 / F-7, **TC-172-072** F-5 (deferred = v1.13.0, incl. two cases D67a decided differently; `OBSTACLES` plural; a NOTAM ID is no airway), **TC-172-073** F-2, **TC-172-074** F-3 (a crane followed by another NOTAM's `VORTAC U/S`), **TC-172-075** F-4 (table values). Updated: TC-172-001/002 (`_ownNotamText`), 011 (`AREA_CLOSED`), 033 (v1.2: deferred four, 6 split pieces, 5e list, a destination row for every shown row), 050, 060, 061 | 29/29 pass |
| Change list | `test/corpus/notam-obstacle-changes.js`: v1.13.0 vs v1.14.0 over every NOTAM of the corpus — NavBlue each alone, no window + the TC-171-030 sweep (1,664,064 calls); FlightKeys each item alone from `notamsRaw`, no window + each airport window. **v1.2 (D67b): B 282 (276 NOTAMs + 6 split pieces, not NOTAMs), C 15 (13 NOTAMs), U 31 (29; 19 hidden by v1.13.0), G 8 (5), deferred 4; departure-card list for 5e 42 rows (39 NOTAMs)**; O-28 audit 15 (13); beta exposure (v1.11.2) 29; every other NOTAM identical (the script stops on any other difference). v1.1 (D67a): B 253, C 14, U 58, G 7. v1.0 (D67): B 132, C 12, U 221. `docs/RPT-NOTAM-ObstacleRule-ChangeList-UPD-20261119-v1.2.md`; data `test/rules/data/notam-v1.14.0-obstacle-changes.json` (keys and SHA-256 only) | — |
| Corpus | `test/corpus/notam-window-changes.js` vs v1.11.1: 30 fixtures, 142 airports, 3,870 NOTAMs; **23 shown → hidden, 0 hidden → shown**; every shown → hidden has readable dates wholly outside the actual window (`test/reports/NOTAM-v1.11.2-corpus-changes.md`). HF-5 oracle: hidden 0 | — |

To run the existing NOTAM tests against the module by hand: `PB_NOTAM_ENGINE=module npm test` (the harness then routes the tests' direct NOTAM calls to the module; the app's own `evalAirport` keeps the app engine).

### 10a. FlightKeys header forms on the 26 fixtures (TC-171-020)

| Form | Grammar doc | Module | Note |
| :--- | ---: | ---: | :--- |
| NOTAM Briefing items · Company items · HSCN | 3,281 · 272 · 26 | 3,281 · 272 · 26 | |
| Locations `IIII` · `IIII AAA` · `AAA IIII` · `IIII AAA AAA` | 1,871 · 807 · 474 · 32 | 1,871 · 807 · 474 · 32 | |
| `IIII IIII` · `IIII IIII IIII` · 7 × `IIII` · 5 × `IIII` | 51 · 33 · 11 · — | 51 · 33 · 11 · 2 | the two 5-code cells (L06, L23) are the doc's wrapped-cell example; the doc's line pattern did not count them as a location form |
| Company items with no location (incl. HSCN) | 186 | 186 | |
| ID without series letter · ASHTAM | 2 · 4 | 2 · 4 | |
| End: date · `UFN(EST …)` · `UFN` | 2,653 · 458 · 168 | 2,653 · 458 · 170 | the 2 five-code items end `UFN` (dates above the ID) |
| Company end: `UFN` · date (incl. HSCN) | 294 · 4 | 294 · 4 | |
| `FL: SFC - UNL` · `SFC - nnn` · `nnn - UNL` · `nnn - nnn` | 3,202 · 224 · 31 · 116 | 3,202 · 224 · 33 · 116 | the 2 five-code items carry `FL: 195 - UNL` on a wrapped row |
| `CREATED:` | 3,573 | 3,575 | the same 2 items |
| `SCHEDULE:` · wrapped location cell · header rows split by a page · items cut by a page | 381 · 13 · 40 · 202 | 381 · 13 · 40 · 202 | |
| NOTAM items with a readable window | — | 3,281 / 3,281 | per package in the TC-171-020 output |

---

## 11. Known limitations (unchanged from the app; not fixed by an extraction)

- **Obstacle rule (v1.14.0, D67a)** — the patterns read wording, not geometry. (a) A height near a runway or a procedure with no effect stated is hidden (D67a O-22: 121 B rows, mostly FAA `OBST CRANE … APCH END RWY 27 … FT AGL`); whether such an obstacle matters for take-off performance is not decided here. A height near a named procedure (e.g. a crane near an approach course) is hidden by the same test (4 B rows). (b) An obstacle NOTAM that names a runway but gives no height and no effect is hidden (O-23: obstacle lights out of service on hangars by a runway; men and equipment near a runway centre line). (e) Shown C / U NOTAMs with no card row go to GENERAL on the destination card (§8b); obstacle NOTAMs shown by both versions keep v1.13.0's classification and some have no destination-card row (O-32, §8b); the departure card is 5e (§12). (f) The NOTAM's own text is found by its end markers (§8a, F-3); a NavBlue NOTAM followed by text none of them marks is still read with that text. (c) The reason reported is the first pattern that matches; a phrase that is only a condition ("ONLY ACT WHEN RWY 07/25 CLSD") still counts as other content (shown). (d) In the NavBlue whole-text corpus a last NOTAM before the weather section carries that text; a match there decides the piece (listed with a note in the change list). In the app each airport's NOTAM text is cut per airport.
- **QA2 findings recorded, not changed in v1.14.0 (planning chat, 19 Nov):**
  - **QA-1 — NavBlue heavy-equipment surface notices.** 24 NavBlue NOTAMs (31 rows; e.g. RJAA A0757/26, A0509/26, A1385/26, RJBB B0651/26) report heavy equipment above an approach or transitional surface and state minima and procedures unchanged. They carry no OBST / OBSTACLE / CRANE word, so the obstacle rule does not apply and they are shown, as in v1.13.0. The FlightKeys copies (e.g. RJAA A1609/26, A1611/26) are hidden through the OBSTACLE heading (D67b). Accepted: shown is the safe side, NavBlue is deprecated, and nothing outside the change list changes. Not in the change list because v1.13.0 and v1.14.0 give the same result.
  - **QA-3 — YSSY H0942/26.** A crane active only while RWY 07/25 is closed is shown as a red "RWY 07/25 CLSD" row (same in v1.13.0; see (c) above). The label reads as a closure. Logged for a later ruleset.
  - **QA-4 — surface penetrated, no effect stated** (e.g. LIBG B1380/26, EPWA A3141/26) stays undecided and shown: Exec ruling 18 Nov (O-31) — surface notices that do not state their effect stay shown.
- **FlightKeys type headings** — read only at indent ≥ 15 spaces; a heading delivered without its indentation would be read as text. The FlightKeys parser keeps the indentation (D54).

- **FlightKeys (v1.13.0)** — read since v1.13.0 (§5a). Not reached in the app until the FlightKeys parser delivers item text (step 5d). Known differences from NavBlue, none of which hides a NOTAM NavBlue shows:
  - **Wording.** FlightKeys prints some words in full where NavBlue keeps the abbreviation (`LIGHTS` / `LGTS`, `APRON` / `APN`, `DURING` / `DURG`). The content rules then match differently in places: on the matched pair 3 of 133 NOTAMs get another slot (`CL LIGHTS U/S` → the RCLL rule). That is the text, not the header grammar; not changed here.
  - **NavBlue wrapped D) line.** NavBlue's own text wraps a long D) line and its schedule reader takes the wrapped part for a daily schedule (`LTAA A4767/26`, `A4769/26`, `A4770/26`: hidden at 0000Z although in effect per the full schedule). FlightKeys reads the cell whole, cannot read it, and shows them. NavBlue is locked (D47): reported for the fault log, not changed.
- **D61 scope.** (a) D61 removes the window and the schedules as reasons to hide; the content filters (obstacle, aircraft, §8 steps 1–2) are neither and still apply, and D43 still keeps one copy of a NOTAM printed twice. (b) The airport card draws a row only for NOTAMs in a runway, taxiway, general, SID or STAR group (`src/edit.html`, unchanged); a flagged NOTAM in another slot (e.g. the catch-all slots 7/8 or an INFO item) is returned by `evalNotams` with its flag but has no row of its own, exactly as an unflagged NOTAM of that slot. (c) On NavBlue, the 14 flagged NOTAMs of the fixtures print their range with the start year after the time (`07JAN0000 2026-05APR2359 2026`, `(05/238) 02JUN1200 2022-PERM`), a form the date reader has never read (T6 since HF-5); they were shown at every ETA before and are now also flagged. Teaching the reader that form is a separate change.
- **D52** is named in the brief's goal with D51; its wording is not in this repository or in plan v4.10. The FlightKeys path uses the one window builder (`_evalWindows`) unchanged, so whatever D51/D52 fix for NavBlue applies to FlightKeys identically.
- **D31 PERM**: the body text is not read for a period (EV-0 G-8). **D31 date-only end** ("valid through 2359Z"): no date-only form is read.
- Weekday schedules are not read (EV-0 G-6); the obstacle and aircraft filters have the gaps listed in EV-0 G-4/G-5.
- The `evalNotams` header comment's slot list is out of date (EV-0 §1); the code is authoritative.
- ARCH-03 (a `metadata` field in the return object), ARCH-04 (`worst` vocabulary), ARCH-05 (IIFE conversion per ADR-001) and ARCH-06 (`_apchTypeLabel` merge) remain deferred.

---

## 12. Integration notes

**v1.14.0 (step 5e).** v1.14.0 was not built into the app by this revision (D67a, D67b: no `index.html` / `src` change). O-21 (D67b, planning chat): `rules/notam-rules-next/` and the manifest key `notam-rules-next` stayed until 5e, where v1.14.0 replaced `notam-rules` (O-27). **Done in step 5e-1 (the switch PR):** the file moved to `rules/notam-rules/` unchanged, the `notam-rules` entry points at it, the `notam-rules-next` entry and the v1.13.0 file are removed (frozen copy `test/oracle/notam-rules-v1.13.0.js`, O-79); TC-120-001, TC-151-001, TC-171-001 and TC-162-022 re-pointed; on the app path 156 NOTAMs shown → hidden (all group B), 10 hidden → shown (C / U), 1 card colour (TC-174-005). The departure-card rows below (D67b) are not in 5e-1 (O-81).

**Departure card, for 5e (D67b).** The Exec wants approach-type NOTAMs (e.g. the EHAM circling OCA/H increases) on the departure card too, in GENERAL. These 42 change-list rows (39 NOTAMs) have a destination / alternate row but none on the departure card today. What drops them — there is no line that filters by role or by NOTAM type:
1. `src/airports.html` `evalAirport`, line 313: `const evalRole = aptRole === 'ORIG' ? 'ORIG' : 'DEST';` — the departure airport is evaluated with role `ORIG`. The module's ORIG classification (`_classifyNotamSlot`, ORIG branch) has no approach-minima, navaid or undecided-obstacle rule, so these items fall into catch-all slot 7; the D67b GENERAL fallback (§8b) is applied for role `DEST` only.
2. `src/airports.html` lines 325–327 keep only `rwyGroups`, `sidIssues`, `starIssues` for the card.
3. `src/edit.html` `renderAptIssues` (line 338) draws rows only from them (lines 377 STARs, 386 runway groups, 394 SIDs, 398 taxiway / general groups); a slot-7 item has no row.
The 5e change can be made in the rules alone — the same GENERAL fallback for role `ORIG` in `evalNotams` — with no `src` change, or in `src`; the Exec decides in 5e.

| # | Group | Package | Airport | NOTAM ID | Pattern | DEST/ALT card (v1.14.0) | Departure card today |
| --: | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | C | `EOFP_UAAA-EHAM_27OCT26_matchedpair_rev11` | EHAM | A2559/26 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 2 | U | `EOFP_UAAA-EHAM_27OCT26_matchedpair_rev11` | EHAM | A2421/26 | TAKEOFF_SIDE_UNSTATED | GENERAL | no row (slot 7) |
| 3 | C | `NB_EBLG-KORD_12OCT26_remarksdump_rev11` | CZWG CZYZ | G2674/26 | not an obstacle NOTAM | GENERAL | no row (slot 7) |
| 4 | C | `NB_EBLG-KORD_12OCT26_remarksdump_rev11` | KZAU | A0207/26 | not an obstacle NOTAM | GENERAL | no row (slot 7) |
| 5 | U | `NB_KCHS-LIBG_12MAR26_lcf_rev16` | LIBG | B1380/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 6 | U | `NB_KORD-EDDF_06MAY26_notam_rev10` | EIDW | N0033/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 7 | C | `NB_ELLX-KHSV_08MAR26_baseline_rev16` | KCVG | A3994/25 | not an obstacle NOTAM | GENERAL | no row (slot 7) |
| 8 | U | `NB_KLAX-RJAA_01MAY26_notam_rev5` | RJTT | J0971/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |
| 9 | C | `NB_KMIA-EHAM_12MAR26_etp_rev8` | EHAM | A3013/25 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 10 | U | `NB_KPSM-ETAR_19APR26_nat_rev12` | ETAR | P1854/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |
| 11 | C | `NB_KPSM-ETAR_19APR26_nat_rev12` | EDFH | C1139/26 | not an obstacle NOTAM | GENERAL | no row (slot 7) |
| 12 | C | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EHAM | A2091/26 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 13 | C | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EHAM | A2090/26 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 14 | U | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EIDW | N0116/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 15 | U | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EIDW | N0100/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 16 | U | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EIDW | N0093/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 17 | U | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | EIDW | N0088/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 18 | U | `EOFP_EHBK-RKSI_09SEP26_pkgC_rev16` | LRTR | A3286/26 | RUNWAY_STRIP | GENERAL | no row (slot 7) |
| 19 | C | `EOFP_EHBK-RKSI_09SEP26_pkgC_rev16` | ZYSH | A2102/26 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 20 | U | `NB_NZAA-YSSY_06APR26_qfa_rev3` | YMML | H0950/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 21 | U | `NB_NZAA-YSSY_06APR26_qfa_rev3` | YMML | H0788/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 22 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0935/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 23 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0934/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 24 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0933/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 25 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0625/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 26 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0536/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 27 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0423/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 28 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0422/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 29 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0311/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 30 | U | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J0095/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 31 | C | `NB_YSSY-RKSI_11MAR26_rda_rev6` | YBRK | J5859/25 | not an obstacle NOTAM | GENERAL | no row (slot 7) |
| 32 | U | `NB_LTFM-EBLG_11MAR26_thy_rev10` | LTFM | B0812/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |
| 33 | U | `NB_LTFM-EBLG_11MAR26_thy_rev10` | LTFM | B0651/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |
| 34 | C | `FK_UAAA-EHAM_27OCT26_prototype` | EHAM | A2559/26 | MINIMA_CHANGED | GENERAL | no row (slot 7) |
| 35 | U | `FK_UAAA-EHAM_27OCT26_prototype` | EHAM | A2421/26 | TAKEOFF_SIDE_UNSTATED | GENERAL | no row (slot 7) |
| 36 | U | `FK_ZUCK-UAAA_27OCT26_prototype` | UCFM | A0155/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 37 | U | `FK_KGSP-EPWA_03NOV26_nat-track-ddg_live` | EPWA | P3141/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |
| 38 | U | `FK_KGSP-EPWA_03NOV26_nat-track-ddg_live` | EPWA | A3141/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 39 | U | `FK_UBBB-RJFK_03NOV26_bcf-multicrew_live` | UCFM | A0155/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 40 | U | `FK_KORD-RKSI_03NOV26_etops-rda-dateline_live` | RKSS | A1541/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 41 | U | `FK_NZWN-NFFN_10NOV26_pax-remarks_live` | NFFN | A1211/26 | SURFACE_PENETRATION | GENERAL | no row (slot 7) |
| 42 | U | `FK_KDOV-ETAR_03NOV26_pax-nat-random_live` | ETAR | P8983/26 | SURFACE_NAMED | GENERAL | no row (slot 7) |

 The integration PR: moves `rules/notam-rules-next/notam-rules-v1.14.0.js` to `rules/notam-rules/` unchanged, points the `notam-rules` manifest entry at it, removes the `notam-rules-next` entry and the v1.13.0 file, rebuilds `index.html`; updates the version asserts (TC-120-001, TC-151-001, TC-171-001) and the FlightKeys parser's TC-162-022 (which expects the `OBSTACLE` heading to hide items under v1.13.0). The V0 NOTAM-at-ETA and app-path snapshots can then change only for NOTAMs of the change list (every other NOTAM gives identical results, TC-172-032); that PR measures and lists them. Publishing to Drive "00_General Rulesets / 00_Notam Rules": only after QA and the Exec's review of the change list.

Items 1–5 were for the v1.11.0 integration PR (velocemente/relief-pilot#39) and are done. Item 6 applies to every version.

1. Build `rules/notam-rules/notam-rules-v1.11.0.js` into `index.html` **unchanged**, before the code that uses it. It publishes `NotamRules`.
2. Remove the engine from `src/notam.html` (everything above the GNSS ruleset) and `_splitNotams` from `src/airports.html`, and bind the names the app uses, e.g. `const { evalNotams, _splitNotams } = NotamRules;` (the app calls only these two; the test harness also reads `xNW_standalone`, `nwOverlap_standalone`, `_windowEndEstimated`).
3. `evalAirport` already passes the flight date (`window._flightDateISO || ''`) and `depMin`; keep that. No other caller may rely on a global flight date.
4. Keep the GNSS ruleset where it is; it is a separate module.
5. Golden, V0 NOTAM-at-ETA and app-path snapshots must stay unchanged; TC-120-004 then compares against the module only (the app copy is gone) and must be adjusted in that PR.
6. Master copy (plan v4.3): before the PR is merged, a **separate session** publishes this exact file from the PR branch to Drive "00_General Rulesets / 00_Notam Rules", with its SHA-256 recorded (`rules/manifest.json`); the previous version (for v1.12.0: v1.11.2) moves to "90_Old Rulesets".

---

## 13. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| 1.10.1 | 2026-06-05 | Master | Ledger P-01 … P-13 (SPEC not in this repository). |
| 1.11.0 | 2026-11-07 | Old master (90_Old Rulesets) | Extracted from the app. Carries HF-1, HF-5, HF-6, HF-8 (ledger P-14 … P-20). `_splitNotams` moved in. Blueprint metadata and `validateSchema()` (ARCH-01, ARCH-02 closed). No app state. Unused code not carried. Behaviour identical to the app (§10). |
| 1.11.1 | 2026-11-08 | Master (previous) | P-22: the window check also tries D + 1 when the departure time places the ETA on D + 1 (`nwOverlap_standalone` gets `depMin`), so a NOTAM for the arrival day is no longer hidden on a flight that lands on D + 1 at or after 1200Z. Additive (hidden → shown only). Corpus: no NOTAM result changes on the 30 Navtech/eOFP fixtures. |
| 1.11.2 | 2026-11-08 | Master (previous) | P-23: NOTAMs are checked against the actual UTC date and time of the evaluation window (ETA ± 60) only. `_evalWindows` builds the one window (D, or D + 1 when the ETA time is earlier than OUT; departure time unknown → D and D + 1); the date-range and schedule checks use it. The ETA-before-1200Z rule and the second-day tries are removed; edges included. Corpus: 23 shown → hidden (dates wholly outside the actual window), 0 hidden → shown. |
| 1.12.0 | 2026-11-09 | Master (previous) | P-24: integration of the aircraft-profile module. `AIRCRAFT_DATA`, `getWingspan()` and `buildAcftProfile()` removed (one copy, in `rules/aircraft-profile`); `buildAcftProfile` no longer exported. `evalNotams()` takes the aircraft profile object; a type string or nothing is the unknown profile (no aircraft filter, every NOTAM shown). New optional trailing argument `getWingspan`, passed in by the caller, used by `_acftApplies` (named types) and `_twyApplies` (taxiway wingspan limit); absent → unknown → shown. No NOTAM rule changes; results identical to v1.11.2 for the profile object the app passes (42 NOTAMs × 70 types; golden, V0 NOTAM-at-ETA and app-path snapshots unchanged). |
| 1.13.0 | 2026-11-17 | Built into the app | P-25: the FlightKeys NOTAM item header (§5a): row 1 with location(s), ID and `YYYY-Mon-DD HH:MM - date | UFN | UFN(EST …)`; wrapped location cell; `CREATED:` / `FL:`; `SCHEDULE:` cell; `SUBJECT:`. `_splitNotams` cuts FlightKeys text at its item headers only; `xNW_standalone` / `_windowEndEstimated` read the header first (UFN = PERM, UFN(EST) = EST end; T6, no guessed dates); `evalNotams` reads the D) cell for schedules and the D) and body lines for the content rules, display line = first body line, D43 key = location(s) + ID. New exports `_fkHeader`, `_fkWindow`, `_fkScheduleText`. After QA: a row 1 whose date cell cannot be read is still a header when its location/ID cell reads and `CREATED:` follows (F1: it stands alone); **D61**: a NOTAM whose own date range is impossible or unreadable is always shown — no schedule check — with `dateUnreadable: true` and the flag `DATE NOT READABLE – CHECK NOTAM` on its text and row label; new export `DATE_UNREADABLE_FLAG`. NavBlue identical to v1.12.0 except the 14 D61 NOTAMs of the fixtures, flagged (TC-171-030; golden and V0 NOTAM-at-ETA snapshots unchanged; app path: 2 texts in 1 fixture, the flag). |
| **1.14.0** | 2026-11-18 | UPD (not built) | P-26: Exec decision D67 — the obstacle rule (§8a, `OBSTACLE_RULE`, `_obstacleRule`) replaces E1: an obstacle NOTAM (`OBST` / `OBSTACLE` / `CRANE`, or a FlightKeys item under the `OBSTACLE` heading) is shown only if it states an effect on runway / approach / SID / STAR heights or gradients, also changes something else, or cannot be decided (U). FlightKeys type headings (§5b, `FK_TYPE_HEADINGS`, `_fkTypeHeading`): cut out by `_splitNotams`, read by `evalNotams` as the category of the items after them (`issues[].fkCategory`), never as item content; a trailing heading hides nothing (O-12). Change list B 132, C 12, U 221; every other NOTAM identical (TC-172). Manifest entry `notam-rules-next`; `index.html` keeps v1.13.0. **2026-11-19, D67a:** a height near a runway or procedure with no effect stated, obstacle-light outages, men / equipment with no height → hidden (O-22 … O-24); `PROCEDURE_AFFECTED`, `CLOSE_IN_OBSTACLE` are effects; `TAKEOFF_SIDE_UNSTATED` undecided (O-26); the four extra other-content cases in a card group with a row (§8b, O-25); O-28 audit (§8c). Change list v1.1: B 253, C 14, U 58, G 7; audit 14; beta exposure 28 (TC-172: 23 tests). **2026-11-19, D67b + QA F-1 … F-8:** own text only (F-3); table values decide (F-4); surface notices stating minima / procedures unchanged hidden (O-31); `AREA_CLOSED` (F-2); en-route MEA / MOCA deferred, as v1.13.0 (F-5); shown C / U rows with no card row → GENERAL on the destination card (O-29); departure-card list for 5e (§12). Change list v1.2: B 282 (276 + 6 split pieces), C 15, U 31, G 8, deferred 4; 5e list 42; audit 15; beta exposure 29 (TC-172: 29 tests). |
