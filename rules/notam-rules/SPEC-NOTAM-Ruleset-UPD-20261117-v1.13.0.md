# SPEC-NOTAM-Ruleset

**Version:** v1.12.0 | **Status:** UPD | **Date:** 2026-11-09
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/notam-rules/notam-rules-v1.12.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1–2.3, §2.5 (module catalogue, module standard, master copies and CI)
**Ledger:** `RPT-NOTAM-RevisionLedger-UPD-20261109-v1.4.md` (beside this file)
**Supersedes:** v1.11.2, which superseded v1.11.1 (previous master, Drive "00_General Rulesets / 00_Notam Rules"), v1.11.0 and master `notam-rules-v110-1.js` (v1.10.1)

---

## 1. What this module is

The NOTAM ruleset decides, for one airport, which NOTAMs are in effect around the ETA (or the departure time), which ones apply to the aircraft, how serious each one is, and how they are grouped on the airport card.

v1.11.0 is an **extraction**: it is the NOTAM engine the PilotBrief app runs today (`src/notam.html` and `_splitNotams` from `src/airports.html`, on `main` at `17701d0`), copied into one standalone file. **Its behaviour is identical to the app's.** The proof is in §10: the module and the app give the same output, field by field, on every release airport of every Navtech/eOFP fixture.

v1.11.0 itself did not change the app; it was built into `index.html` by a separate integration PR (velocemente/relief-pilot#39, ADR-005 §2.3.3). Since then each module **revision** is built into `index.html` in its own PR (plan v4.1 / v4.3 §2): the module file in `rules/notam-rules/` changes, `index.html` is rebuilt from it, and nothing in `src/` changes.

**v1.11.1** was a revision (ledger P-22): the date-range check also tried D + 1 for a flight that lands on the next UTC day at or after 1200Z (velocemente/relief-pilot#41).

**v1.11.2** is a revision (ledger P-23): NOTAMs are checked against the **actual** UTC date and time of the evaluation window only (§6). One function, `_evalWindows`, builds the window; the date-range and schedule checks both use it. The second-day tries of v1.11.0/v1.11.1 are removed when the departure time is known. Built into `index.html` in the same PR (plan v4.3 §2 module revision).

**v1.12.0** is a revision (ledger P-24, plan v4.5 §2): the module no longer holds aircraft data. `AIRCRAFT_DATA`, `getWingspan()` and `buildAcftProfile()` are removed; there is one copy, in the aircraft-profile module (`rules/aircraft-profile`, v1.0.0), which the app builds into `index.html` just above this module. `evalNotams()` takes the aircraft **profile object** that module builds. **No NOTAM rule changes and the app's behaviour is identical** (§10, TC-151). The aircraft filter and the taxiway check read two things from that module, and both now come in as arguments: the profile (the aircraft's own values) and `getWingspan` (the wingspan of any other type a NOTAM names).

**Not in this module:** the GNSS NOTAM ruleset (`evalGNSS`, a separate module), weather, the airport card (`evalAirport`, `renderAptIssues`), and the legacy window code `xNW` / `nwOverlap` / `oETA` / `_notamWindow` in `src/airports.html` (not used by the NOTAM path since HF-5).

---

## 2. Module standard (ADR-005 §2.2)

| Item | v1.11.0 |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. |
| Dual context | Node: `module.exports = API`. rules-loader (`new Function('module','exports','require', code)`): same. Browser, built into `index.html` unchanged: no `module` exists, so the API object is published once as the global **`NotamRules`**. All declarations live inside one factory function, so none of them collides with the app's names (for example the OFP ruleset's own `RULESET_TYPE`). |
| Metadata | `RULESET_TYPE = 'notam'`, `RULESET_VERSION = '1.12.0'`, `SCHEMA_VERSION = 2`, `RULESET_SOURCE` (ICAO Annex 15, Doc 8126, Doc 4444 App 6; FAA JO 7930.2, AIP GEN 3.1; Atlas Air / Polar Air Cargo OFP NOTAM briefing (NavBlue)). |
| `SCHEMA_VERSION` | **2 — the current contract's value, kept.** It is the minimum `rules-loader.js` v1.0.0 requires for `'notam'` (`SCHEMA_VERSION_REQUIRED.notam = 2`) and the `schemaVersion` of the customer configuration. The export shape and the `evalNotams()` return shape did not change, so no increment. |
| `validateSchema()` | Yes (closes ledger ARCH-02). See §3. |
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
  _splitNotams,              // (text) -> string[]
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
| `text` (`_splitNotams`) | One airport's NOTAM text from the OFP, **LF line endings** (the OFP parser normalises CRLF before it stores the text, `src/ofp-parse.html`). |
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

Applied only when the window check has not already said "not in effect", and only when `etaMin` is known.

| Schedule | Rule |
| :--- | :--- |
| Day-of-month + daily time: a line `08-09 13-17 20-24 1510-2020` | Needs the flight date. Every minute of the `_evalWindows` window (§6) is checked on its **actual UTC date and time** (`_schedWindowMinutes` lists them; unknown `depMin` → both candidate windows). In effect if any minute is on a listed day inside the period. A period crossing 0000Z (`2200-0300`) also counts on the day after a listed day, up to the end time. |
| Daily time: a line starting `HHMM-HHMM` or `DLY HHMM-HHMM`, several windows separated by commas | Same every day, so only the window's times of day are used: in effect if any minute of ETA ± 60 (wrapping past 0000Z) is inside any window. Not applied when a day-of-month schedule is present. |
| **D27** | A day, a time or a date that cannot be read (hour > 24, minute > 59, `24xx` other than `2400`, day outside 1–31 or from > to, unreadable flight date) → the schedule is **not applied** (the NOTAM stays in effect). |

Weekday wording (`MON-FRI 0800-1700`) is not read (EV-0 G-6); such a NOTAM is not limited by it.

---

## 8. Evaluation — `evalNotams`

For each NOTAM, in this order:

1. **Obstacle filter** — skips a NOTAM that says `OBST`, `CRANE` or `OBSTACLE` and has no approach/departure keyword (EV-0 R-OBS).
2. **Aircraft filter** — `_acftApplies` hides a NOTAM only when it explicitly excludes the aircraft (EV-0 R-ACF, A1–A7). Rules unchanged; the aircraft's values come from the profile object, the wingspan of other named types from `getWingspan` (v1.12.0). An unknown profile (a string, nothing) shows every NOTAM.
3. **In effect** — window (§6), then schedules (§7). Not in effect → skipped.
4. **Classify** — `_classifyNotamSlot` (first matching rule wins; ORIG and DEST/ALT rule sets; EV-0 §2.5 lists every rule).
5. **Display text** — the first body line (header, schedule lines skipped), at most 120 characters, HTML-escaped; the label (or highlighted keyword) is wrapped in `<span class="nt-red|nt-yel">`.
6. **Duplicates (D43)** — two NOTAMs are duplicates **only** when they have the same location(s) and the same ID (`- ICAO [ICAO …] A1234/YY`); different IDs are always both kept. A NOTAM with no readable ID is a duplicate only of one whose text is identical after whitespace is normalised. The first copy is kept.

**Return object (unchanged):**

```js
{
  issues:     [{ slot, level, active, text, notamRaw, rwy, label, rowLabel, category }],
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
| Corpus | `test/corpus/notam-window-changes.js` vs v1.11.1: 30 fixtures, 142 airports, 3,870 NOTAMs; **23 shown → hidden, 0 hidden → shown**; every shown → hidden has readable dates wholly outside the actual window (`test/reports/NOTAM-v1.11.2-corpus-changes.md`). HF-5 oracle: hidden 0 | — |

To run the existing NOTAM tests against the module by hand: `PB_NOTAM_ENGINE=module npm test` (the harness then routes the tests' direct NOTAM calls to the module; the app's own `evalAirport` keeps the app engine).

---

## 11. Known limitations (unchanged from the app; not fixed by an extraction)

- **FlightKeys header style** (`PANC A6531/26 2026-Nov-03 18:00 - 2026-Nov-04 02:00`, `UFN(EST …)` with ISO-like dates) is **not read**: ADR-005 §2.5 gives it to this ruleset, but the app does not read it today, so the module does not either. Such a NOTAM has no window and is shown (fail-safe). A later minor version adds it.
- **D31 PERM**: the body text is not read for a period (EV-0 G-8). **D31 date-only end** ("valid through 2359Z"): no date-only form is read.
- Weekday schedules are not read (EV-0 G-6); the obstacle and aircraft filters have the gaps listed in EV-0 G-4/G-5.
- The `evalNotams` header comment's slot list is out of date (EV-0 §1); the code is authoritative.
- ARCH-03 (a `metadata` field in the return object), ARCH-04 (`worst` vocabulary), ARCH-05 (IIFE conversion per ADR-001) and ARCH-06 (`_apchTypeLabel` merge) remain deferred.

---

## 12. Integration notes

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
| **1.12.0** | 2026-11-09 | UPD | P-24: integration of the aircraft-profile module. `AIRCRAFT_DATA`, `getWingspan()` and `buildAcftProfile()` removed (one copy, in `rules/aircraft-profile`); `buildAcftProfile` no longer exported. `evalNotams()` takes the aircraft profile object; a type string or nothing is the unknown profile (no aircraft filter, every NOTAM shown). New optional trailing argument `getWingspan`, passed in by the caller, used by `_acftApplies` (named types) and `_twyApplies` (taxiway wingspan limit); absent → unknown → shown. No NOTAM rule changes; results identical to v1.11.2 for the profile object the app passes (42 NOTAMs × 70 types; golden, V0 NOTAM-at-ETA and app-path snapshots unchanged). |
