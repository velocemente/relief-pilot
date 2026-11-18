# NOTAM Ruleset — Revision Ledger

**File Standard:** `RPT-NOTAM-RevisionLedger-UPD-20261118-v1.6.md` (supersedes `RPT-NOTAM-RevisionLedger-UPD-20261117-v1.5.md`)
**Ruleset:** `notam-rules` — built into the app: `rules/notam-rules/notam-rules-v1.13.0.js` (manifest `notam-rules`); next revision, not built: `rules/notam-rules-next/notam-rules-v1.14.0.js` (manifest `notam-rules-next`, step 5e)
**Current Version:** 1.14.0 (not built into the app; the app runs 1.13.0, the beta 1.11.2)
**Lines:** 2,537 (v1.13.0: 2,289)
**Patterns:** 66 NM, unchanged. v1.14.0 adds the obstacle rule's pattern set `OBSTACLE_RULE` (exported, §8a of the file): 9 effect, 11 other-content, 4 undecided patterns and `obstacleWord`, `height`, `runwayRef`, `procedureRef`, `noEffect`, `obstacleLight`
**QA Status:** TC-120-001 … 030 PASS (11/11); TC-121-001 … 007 PASS (7/7); TC-122-001 … 009 PASS (9/9); NOTAM unit tests 82/82 PASS against the module; TC-151-001 … 030 PASS (7/7); TC-171-001 … 040 PASS (16/16, v1.13.0 after QA: 20/20); **TC-172-001 … 090 PASS (18/18, v1.14.0)**. Independent QA of v1.14.0 pending
**Last Updated:** 2026-11-18

---

## Summary

| Metric | Value |
|:-------|:------|
| Total Patches | 26 (P-01 through P-26) |
| Current Version | 1.14.0 (not built; app 1.13.0) |
| First Integration | v1.9.7 |
| Latest Integration | app 1.9.9-hf3 (P-14 … P-21: module 1.11.0, velocemente/relief-pilot#39 and #40); module 1.11.1 on `main` (P-22, velocemente/relief-pilot#41); module 1.11.2 on `main` (P-23); module 1.12.0 on `main` (P-24); module 1.13.0 on `main` (P-25, velocemente/relief-pilot#61); module 1.14.0 not built (P-26, velocemente/relief-pilot#64; step 5e) |
| Gate Status | P-01 … P-21 PASS (1.9.9-hf3 gate GO); P-22 independent QA APPROVE-FOR-EXEC, merged (#41); P-23 merged; P-24 merged; P-25 merged (#61); P-26 pending the Exec's review of the change list and independent QA (ADR-005 §2.2.6) |
| Open DEFs Against This Ruleset | 4 (ARCH-03 through ARCH-06, all DEFERRED S4). ARCH-01 and ARCH-02 closed by P-21. |

**What changed in v1.1 of this ledger.** The entries P-01 … P-13 of v1.0 are kept unchanged below. P-14 … P-20 record the NOTAM fixes made in the app (`src/notam.html`) since June, which the master v1.10.1 never received (ADR-005 §1.2). P-21 is the extraction of the module. The planned patch numbers of the ARCH items (v1.0: P-14 … P-19) are therefore re-assigned (see "Pending Architecture Items"). A reconciliation of master v1.10.1 against the app follows the patch chain.

---

## Patch Chain

### P-01 — CRLF normalization fix

| Field | Value |
|:------|:------|
| Date | 2026-05-08 |
| Ruleset Version | 1.0.1 |
| Type | BUG |
| DEF-ID | N/A (pre-register) |
| Summary | pdf.js produces `\r\n`; multiline `^` does not match after `\r`. Normalize line endings before splitting NOTAM blocks. |
| Patterns Affected | `_splitNotams` regex |
| Gate Result | PASS — 2026-05-08 |
| Integrated In | v1.9.7 |
| QA Verification | RUN-101 |

---

### P-02 — RWY closure patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-10 |
| Ruleset Version | 1.1.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Added runway closure detection patterns (RWY CLSD, RWY [nn] CLSD, closed for construction, etc.) |
| Patterns Affected | RWY_CLOSED family |
| Gate Result | PASS — 2026-05-10 |
| Integrated In | v1.9.7 |
| QA Verification | RUN-101 |

---

### P-03 — NAV/ILS/LOC equipment patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-12 |
| Ruleset Version | 1.2.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Navigation aid outage patterns: ILS, LOC, GS, VOR, DME, NDB U/S or out of service. |
| Patterns Affected | NAV_OUTAGE family |
| Gate Result | PASS — 2026-05-12 |
| Integrated In | v1.9.7 |
| QA Verification | RUN-101 |

---

### P-04 — SID/STAR impact patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-14 |
| Ruleset Version | 1.3.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | SID/STAR procedure NOTAMs: amendments, suspensions, altitude/speed restrictions. |
| Patterns Affected | SID_IMPACT, STAR_IMPACT families |
| Gate Result | PASS — 2026-05-14 |
| Integrated In | v1.9.8 |
| QA Verification | RUN-101 |

---

### P-05 — Approach restriction patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-16 |
| Ruleset Version | 1.4.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Approach procedure restrictions: minimums changes, circling restrictions, approach not authorized. |
| Patterns Affected | APCH_RESTRICT family |
| Gate Result | PASS — 2026-05-16 |
| Integrated In | v1.9.8 |
| QA Verification | RUN-101 |

---

### P-06 — ETOPS/diversion field patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-18 |
| Ruleset Version | 1.5.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | ETOPS alternate and diversion airport restrictions: ETP/CFS alternate handling with `role='ALT'`. |
| Patterns Affected | ETOPS_DIVERT family |
| Gate Result | PASS — 2026-05-18 |
| Integrated In | v1.9.8 |
| QA Verification | RUN-101 |

---

### P-07 — Scheduling/time-window engine

| Field | Value |
|:------|:------|
| Date | 2026-05-20 |
| Ruleset Version | 1.6.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | NOTAM effective/expiry time-window evaluation. Filters NOTAMs not active during flight window. All times UTC — no timezone conversion. |
| Patterns Affected | Time-window evaluation engine (cross-cutting) |
| Gate Result | PASS — 2026-05-20 |
| Integrated In | v1.9.8 |
| QA Verification | RUN-101 |

---

### P-08 — Taxiway/apron patterns

| Field | Value |
|:------|:------|
| Date | 2026-05-25 |
| Ruleset Version | 1.7.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Taxiway and apron closure/restriction patterns. |
| Patterns Affected | TWY_CLOSED, APRON_RESTRICT families |
| Gate Result | PASS — 2026-05-25 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 |

---

### P-09 — Airport lighting patterns

| Field | Value |
|:------|:------|
| Date | 2026-06-01 |
| Ruleset Version | 1.8.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Airport lighting NOTAMs: ALS, PAPI, VASI, edge lights, centerline lights U/S. |
| Patterns Affected | LIGHTING_OUTAGE family |
| Gate Result | PASS — 2026-06-01 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 |

---

### P-10 — Integration contract + role='ALT'

| Field | Value |
|:------|:------|
| Date | 2026-06-02 |
| Ruleset Version | 1.9.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Formalized integration contract block comment. CFS/ETP alternates must be called with `role='ALT'`. Mandatory display ordering defined. |
| Patterns Affected | Integration contract (header block), role parameter handling |
| Gate Result | PASS — 2026-06-02 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 |

---

### P-11 — BIRD_HAZARD + general info bucket

| Field | Value |
|:------|:------|
| Date | 2026-06-03 |
| Ruleset Version | 1.10.0 |
| Type | PATTERN |
| DEF-ID | N/A |
| Summary | Added BIRD_HAZARD pattern. Informational items route to General Information section (not suppressed). |
| Patterns Affected | BIRD_HAZARD, INFO_GENERAL families |
| Gate Result | PASS — 2026-06-03 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 |

---

### P-12 — evalNotams return shape finalized

| Field | Value |
|:------|:------|
| Date | 2026-06-04 |
| Ruleset Version | 1.10.0 |
| Type | REFACTOR |
| DEF-ID | N/A |
| Summary | Finalized `evalNotams()` return shape: `{ issues, rwyGroups, sidIssues, starIssues, infoIssues, worst }`. |
| Patterns Affected | Return contract (cross-cutting) |
| Gate Result | PASS — 2026-06-04 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 |

---

### P-13 — Edge-case regex fixes

| Field | Value |
|:------|:------|
| Date | 2026-06-05 |
| Ruleset Version | 1.10.1 |
| Type | BUG |
| DEF-ID | N/A |
| Summary | Final edge-case regex corrections across multiple patterns. Achieved 138/138 TC pass rate. |
| Patterns Affected | Multiple (edge-case refinements) |
| Gate Result | PASS — 2026-06-05 |
| Integrated In | v1.9.9 |
| QA Verification | RUN-102 (15/15 TCs including TC-102-014 manual cold start) |

---

### P-14 — HF-1: NOTAM validity year (DEF-A, R1 + R2)

| Field | Value |
|:------|:------|
| Date | 2026-10-29 (merged) |
| Ruleset Version | app 1.9.9 hotfix; first in module 1.11.0 |
| Type | BUG |
| DEF-ID | DEF-A (RPT-OFP-LiveDefectDiagnosis) |
| PR | velocemente/relief-pilot#3 (commit 2c040c6) |
| Summary | R1: the trailing year after a `ddMMMhhmm-ddMMMhhmm` header must be `20xx` on the same line; a daily schedule on the next line (`1410-2030`) was read as year 1410 and hid the NOTAM. R2: with a `/YY` NOTAM ID the start year is taken from the issue year (refined by P-15). Fixed 214 NOTAMs wrongly "not in effect". |
| Patterns Affected | `xNW_standalone` inline header pattern; start-year inference |
| Gate Result | PASS — 2026-10-29 (PR review, CI golden unchanged) |
| Integrated In | app 1.9.9-hf1 |
| QA Verification | TC-110-S01 … S08 (added as TC-110-001 … 006, N01, N02; renamed by P-15), TC-110-001 |

---

### P-15 — HF-5: start year from the issue year (T1–T5); fail-safe (T6); legacy window code dropped

| Field | Value |
|:------|:------|
| Date | 2026-11-03 |
| Ruleset Version | app hotfix; first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-5 (DEF-A follow-up) |
| PR | velocemente/relief-pilot#27 (commit f84c736) |
| Summary | T1/T2: with `/YY` the start year is the EARLIEST year from the issue year with start ≤ end (was the latest). T3: `-PERM` start year = issue year. T4: `WEF`/`EFFECTIVE … PERM` with `/YY` start in the issue year. T5: no `/YY` unchanged. T6: no resolvable or an inverted window → no window → in effect. `evalNotams` no longer falls back to the legacy `xNW()`/`nwOverlap()` (pre-hotfix year rules). Windows not covering the flight date fell from 998 to 281 on the corpus. |
| Patterns Affected | `xNW_standalone`, `_resolveInlineDateRange`, `evalNotams` active-status block |
| Gate Result | PASS — 2026-11-03 |
| Integrated In | app 1.9.9-hf2 |
| QA Verification | TC-110-S09 … S12, TC-110-001 … 005, 007 … 009 |

---

### P-16 — HF-5 audit: T6 on every date path; impossible dates; D38 year crossing

| Field | Value |
|:------|:------|
| Date | 2026-11-03 |
| Ruleset Version | app hotfix; first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-5 audit; D27, D38 |
| PR | velocemente/relief-pilot#27 (commit 621398b) |
| Summary | T6 on `B)/C)` items and 10-digit pairs (start after end → no window). Impossible date parts (month, day of month, 29 FEB in a non-leap year, hour, minute) rejected before a date is built (`_validDateParts`): nothing rolls over into another date; `2400` still = 00:00 next day. D38 (no `/YY`): a window whose end month is before its start month crosses New Year, anchored to the flight month, on every path (`WEF`/`UFC`, `EFFECTIVE`/`UNTIL` too); any other backwards window → no window. |
| Patterns Affected | `_parseDateToken`, `_validDateParts` (new), `xNW_standalone`, `_resolveInlineDateRange` |
| Gate Result | PASS — 2026-11-03 |
| Integrated In | app 1.9.9-hf2 |
| QA Verification | TC-110-020 … 027 |

---

### P-17 — HF-6: duplicates only by NOTAM ID (D43)

| Field | Value |
|:------|:------|
| Date | 2026-11-03 |
| Ruleset Version | app hotfix; first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-6 F1; D43 |
| PR | velocemente/relief-pilot#28 (commit 987ed75) |
| Summary | `evalNotams` merged NOTAMs that shared slot, level and label (or the first 40 characters), hiding different NOTAMs. Now two NOTAMs are duplicates only with the same location(s) and the same ID; a NOTAM with no readable ID only when its whitespace-normalised text is identical. The first copy is kept. |
| Patterns Affected | `evalNotams` duplicate key |
| Gate Result | PASS — 2026-11-03 |
| Integrated In | app 1.9.9-hf2 |
| QA Verification | TC-111-001 … 005 |

---

### P-18 — HF-6: `/YY` WEF / EFFECTIVE window across New Year (D38)

| Field | Value |
|:------|:------|
| Date | 2026-11-03 |
| Ruleset Version | app hotfix; first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-6 F2; D38, D27 |
| PR | velocemente/relief-pilot#28 (commit 987ed75) |
| Summary | A `WEF`/`UFC` or `EFFECTIVE`/`UNTIL` window whose end month is before its start month and whose ID carries `/YY` tries every start year from the issue year to the flight year (end the year after) and uses the one covering the flight date; else the flight-anchored window. No candidate year or an impossible date → no window (shown, D27). |
| Patterns Affected | `_resolveInlineDateRange` |
| Gate Result | PASS — 2026-11-03 |
| Integrated In | app 1.9.9-hf2 |
| QA Verification | TC-111-006, TC-111-006N; copies-agree synthetic set TC-111-020 … 024 |

---

### P-19 — HF-8: schedules on the actual UTC date and time of ETA ± 60 (H1)

| Field | Value |
|:------|:------|
| Date | 2026-11-07 |
| Ruleset Version | app (main, unreleased); first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-8 H1; EV-0 G-7; D27 |
| PR | velocemente/relief-pilot#36 (commit 5148e95) |
| Summary | The day-of-month and daily schedule checks used the ETA minute on the departure date. Now every minute of ETA ± 60 (ORIG: departure ± 60) is checked on its actual UTC date: D + 1 when the ETA time is earlier than the departure time (`depMin`, new 6th argument of `evalNotams`); unknown departure → D and D + 1. A window crossing 0000Z is checked on both dates; a period crossing 0000Z also counts on the day after a listed day. A schedule or date that cannot be read is not applied (D27). |
| Patterns Affected | `evalNotams` schedule blocks; `_schedWindowMinutes`, `_schedHM`, `_inDailyPeriod` (new) |
| Gate Result | PASS — 2026-11-07 |
| Integrated In | app `main` (after 1.9.9-hf2) |
| QA Verification | TC-113-001 … 003, 006, 011 … 015 |

---

### P-20 — HF-8: an estimated end (EST) is not an end; UFN (D31)

| Field | Value |
|:------|:------|
| Date | 2026-11-07 |
| Ruleset Version | app (main, unreleased); first in module 1.11.0 |
| Type | BUG |
| DEF-ID | HF-8 H2; D31 |
| PR | velocemente/relief-pilot#36 (commit 5148e95) |
| Summary | When `EST` follows the end of the date range that was read (any of the five patterns), the NOTAM stays in effect until cancelled or replaced: only its start still limits it. `UFN` / `UFN(EST …)` has no date range and is already in effect (T6). `xNW_standalone` itself is unchanged. |
| Patterns Affected | `_windowEndEstimated` (new); `evalNotams` active-status block |
| Gate Result | PASS — 2026-11-07 |
| Integrated In | app `main` (after 1.9.9-hf2) |
| QA Verification | TC-113-004, 005, 010 |

---

### P-21 — Module extraction v1.11.0 (ADR-005); Blueprint metadata and `validateSchema()`

| Field | Value |
|:------|:------|
| Date | 2026-11-07 |
| Ruleset Version | 1.11.0 |
| Type | REFACTOR (no behaviour change) |
| DEF-ID | ARCH-01, ARCH-02 (closed) |
| PR | this PR (relief-pilot, branch `claude/upbeat-edison-lqm0e5`) |
| Summary | The app's NOTAM engine on `main` (17701d0) copied into one standalone dual-context file: Node / rules-loader via `module.exports`, browser via the global `NotamRules`. `_splitNotams` moved in from `src/airports.html`. Metadata `RULESET_TYPE 'notam'`, `RULESET_VERSION '1.11.0'`, `SCHEMA_VERSION 2` (current contract value, rules-loader minimum), `RULESET_SOURCE`; `validateSchema()`. No app state: the `window._flightDateISO` fallback and write removed (the app's only caller passes the date; TC-120-013 proves the app's output does not depend on it). Code the app never calls not carried (SPEC §9). Exports `classifyNotam`, `extractNotamKeywords`, `deriveOperationalImpact`, `isNotamActive` dropped. |
| Patterns Affected | none (all 66 NM patterns verbatim) |
| Gate Result | Pending — Exec gate and independent QA session (ADR-005 §2.2.6) |
| Integrated In | not integrated (separate PR, ADR-005 §2.3.3) |
| QA Verification | TC-120-001 … 004, 010 … 013, 020, 021, 030: equivalence 0 differences on 30 fixtures / 142 airports / 3,870 NOTAMs at ETA, 11,574 NOTAM windows, 7,668 sweep calls; existing NOTAM tests 66/66 against the module |

---

### P-22 — Next-day arrival at or after 1200Z: the window check uses the ETA's UTC date (v1.11.1)

| Field | Value |
|:------|:------|
| Date | 2026-11-08 |
| Ruleset Version | 1.11.1 |
| Type | BUG |
| DEF-ID | HF-8 QA S2 (velocemente/relief-pilot#36), 1.9.9-hf3 gate known item (velocemente/relief-pilot#40); D27 |
| PR | relief-pilot, branch `claude/zealous-wozniak-gpofza` |
| Summary | `nwOverlap_standalone` anchored the ETA on the departure date D and tried D + 1 only when the ETA time was before 1200Z (`etaMin < 720`). On a flight that lands on D + 1 at or after 1200Z, a NOTAM dated only for the arrival day failed the window check and was skipped before its schedule was read; the schedule check (`_schedWindowMinutes`, P-19) already used D + 1. Now `nwOverlap_standalone` takes `depMin` (passed by `evalNotams`) and also tries D + 1 when the departure time is known and `etaMin < depMin`, the same rule as the schedule check. Additive: every date tried before is still tried (hidden → shown only). Departure time unknown: unchanged. |
| Patterns Affected | none (NM unchanged); `nwOverlap_standalone` (new optional 4th argument `depMin`), `evalNotams` window call |
| Gate Result | Independent QA APPROVE-FOR-EXEC (velocemente/relief-pilot#41); merged to `main` |
| Integrated In | velocemente/relief-pilot#41 (module revision, plan v4.1 §2) |
| QA Verification | TC-121-001 … 007 (7/7; 6 of 7 fail on v1.11.0, the negatives pass on both). All existing tests pass. Corpus: no NOTAM result changes on 30 Navtech/eOFP fixtures / 142 airports / 3,870 NOTAMs (43 airports land on D + 1, none at or after 1200Z); golden, V0 NOTAM and app-path snapshots unchanged. |

---

### P-23 — The evaluation window on its actual UTC date only; one window builder (v1.11.2)

| Field | Value |
|:------|:------|
| Date | 2026-11-08 |
| Ruleset Version | 1.11.2 |
| Type | BUG (safety: NOTAMs not in effect were shown) |
| DEF-ID | Exec finding on beta 1.9.9-hf3; app #41 QA finding 14 (a) and (b); Exec rule 7 Nov |
| PR | relief-pilot, branch `claude/charming-mccarthy-lq7k8y`; companion fixtures branch of the same name |
| Summary | Exec rule (7 Nov): a NOTAM is shown only if it is in effect at some time during the airport's evaluation window (ETA ± 60 min) on the window's **actual** UTC date and time. v1.11.1 placed the ETA on the flight date D **and** also tried D + 1 (ETA before 1200Z, or ETA earlier than the departure time), so a NOTAM in effect only on the other day was shown. New `_evalWindows(etaMin, depMin, flightDateISO)` is the one function that builds the window: D (DOF), or D + 1 when the ETA time of day is earlier than the departure (OUT) time; departure time unknown → two candidate windows, D and D + 1 (fail-safe). `nwOverlap_standalone` and `_schedWindowMinutes` both use it; DLY keeps the window's times of day. The `etaMin < 720` rule and every second-day try with the departure time known are removed. Window edges are included (a NOTAM ending exactly at ETA − 60, or starting exactly at ETA + 60, is in effect). A flight date that is given but cannot be read → in effect (D27). Unchanged: no ETA / no flight date / no readable window → in effect (T6, D27); UFN / EST → no end (D31); PERM → no end; T1–T5. |
| Patterns Affected | none (NM unchanged); new `_evalWindows` (exported); `nwOverlap_standalone`, `_schedWindowMinutes` rewritten on it |
| Gate Result | Pending — Exec gate and independent QA session (ADR-005 §2.2.6) |
| Integrated In | this PR (module revision, plan v4.3 §2) |
| QA Verification | TC-122-001 … 009 (9/9; on v1.11.1 23 of their assertions fail — every new "hidden" case, the edges, the departure-time-unknown arrival-day case at or after 1200Z — and TC-121-007's departure-unknown case fails). TC-121-001 … 006 unchanged. Updated for the new rule (SPEC §10): TC-121-007 (departure time unknown → D and D + 1), TC-113-006 (the 23 shown → hidden are now an exact reviewed list), and the synthetic cases of `notam-year` (T6/D38 section) and `notam-merge` evaluated at ETA 1200Z now pass a departure time of 0000Z so the ETA stays on the flight date, as v1.11.1 gave them with no departure time. Corpus vs v1.11.1: 30 Navtech/eOFP fixtures, 142 airports, 3,870 NOTAMs: **23 shown → hidden, 0 hidden → shown**; every one of the 23 has readable dates wholly outside the actual window (`test/reports/NOTAM-v1.11.2-corpus-changes.md`). HF-5 oracle: hidden 0. V0 NOTAM-at-ETA and app-path snapshots of 9 fixtures updated (the 23 IDs only); golden unchanged. |

### P-24 — The aircraft data leaves the module: one aircraft profile module (v1.12.0)

| Field | Value |
|:------|:------|
| Date | 2026-11-09 |
| Ruleset Version | 1.12.0 |
| Type | REFACTOR (no behaviour change; ADR-005 integration step, plan v4.5 §2) |
| DEF-ID | N/A |
| PR | relief-pilot, branch `claude/eloquent-thompson-1xgj6g` |
| Summary | `AIRCRAFT_DATA`, `getWingspan()` and `buildAcftProfile()` are removed from the module: the aircraft table now has ONE copy, in `rules/aircraft-profile` v1.0.0 (extracted from this module's v1.11.2, byte for byte), which the app builds into `index.html`. `evalNotams()` takes the aircraft profile object that module builds; a type string or nothing is the unknown profile — no aircraft filter, every aircraft-restricted NOTAM shown (fail-safe). The rules also read the table in two other places, for the wingspan of a type **other than the aircraft's own** (`_acftApplies`: the types a NOTAM names with "AND ABOVE" / "AND SMALLER ONLY"; `_twyApplies`: the taxiway wingspan limit). A profile for the aircraft's own type cannot answer those, so `getWingspan` (the aircraft-profile module's) is a new optional trailing argument of `evalNotams()`, passed down to `_classifyNotamSlot()`, `_twyApplies()` and `_acftApplies()`; not passed → those types are unknown → the NOTAM is shown (the old defaults 0 / 999 / `null`). Exec decision (9 Nov): pass it as a 7th argument. The call sites are the only edits to `_acftApplies`, `_twyApplies` and `_classifyNotamSlot`, each marked `v1.12.0`; every pattern and rule is unchanged. `SCHEMA_VERSION` stays 2 (the loader's required exports are unchanged; `buildAcftProfile` was never one of them). |
| Patterns Affected | none (NM unchanged) |
| Gate Result | Pending — Exec gate and independent QA session (ADR-005 §2.2.6) |
| Integrated In | this PR (module revision with `build/build.js`, `src/airports.html`, `src/ofp-parse.html`) |
| QA Verification | TC-151-001 … 030 (7/7): 42 synthetic NOTAMs × 70 types give exactly what v1.11.2 gave for the type string — `_acftApplies()` and `evalNotams()` (ORIG, DEST), standalone file and `index.html` (0 differences); string / empty / null / undefined / number aircraft → every aircraft-restricted NOTAM shown, real profile hides them; `getWingspan` passed / not passed, positive and negative; `evalAirport()` passes the module's profile and `getWingspan` at every release airport of the 30 Navtech/eOFP fixtures; one copy in `index.html`; the gate bites. Golden, V0 NOTAM-at-ETA and V0 app-path snapshots unchanged (33/33 each); HF-5 oracle: hidden 0, not found 0. |

### P-25 — FlightKeys NOTAM item headers (v1.13.0)

| Field | Value |
|:------|:------|
| Date | 2026-11-17 |
| Ruleset Version | 1.13.0 |
| Type | FEATURE (FlightKeys grammar) + SAFETY (D61: unreadable dates always shown, flagged; NavBlue and FlightKeys) |
| DEF-ID | ADR-005 §2.5 (the NOTAM ruleset reads both header styles); plan v4.10 §6 (brief 5c); SPEC v1.12.0 §11 limitation "FlightKeys header style not read" (closed); 5c QA finding F1 (a header with an unreadable date joined the NOTAM above it; closed); **Exec decision D61 (16 Nov)**: a NOTAM whose own date range is impossible or unreadable is always displayed — no window and no schedule may hide it — and carries the flag "DATE NOT READABLE – CHECK NOTAM" (closes QA F3) |
| PR | relief-pilot, branch `claude/notam-v1.13.0`; fixtures companion branch `claude/notam-v1.13.0` (app-path snapshot of `NB_KMIA-EHAM_12MAR26_etp_rev8`: 2 texts gain the D61 flag) |
| Summary | The module reads the FlightKeys NOTAM item header (`RPT-OFP-FlightKeys-BriefingGrammar` §A.5, §A.7): row 1 `[locations] [ID]  YYYY-Mon-DD HH:MM - YYYY-Mon-DD HH:MM / UFN / UFN(EST …)`, the wrapped location cell (> 3 codes), `CREATED:` / `FL:`, the `SCHEDULE:` cell with its wrapped lines, `SUBJECT:`, ASHTAM. `_splitNotams` cuts FlightKeys text at each item header and only there. `xNW_standalone` and `_windowEndEstimated` read the header first, and it alone decides: UFN = NavBlue `-PERM` (start kept, no end), UFN(EST) = NavBlue `… EST` (start kept, no end; D31); a date that cannot be read or a backwards window → no window → shown (T6), never a guessed or rolled-over date. `evalNotams` reads the `SCHEDULE:` cell (joined, `DAILY` = `DLY`) with the NavBlue schedule readers and never a body line; the content rules read the D) and body lines (not the header rows, which hold IATA codes and `CREATED:`/`FL:`); display line = first body line; D43 key = location(s) + ID; a text holding two `CREATED:` rows is not trusted (no window, no schedule → shown). Evaluation window unchanged (`_evalWindows`: actual UTC date, ETA ± 60, D51). D54: the module reads text only, line by line; split pieces are exact substrings; `notamRaw` unchanged. New exports `_fkHeader`, `_fkWindow`, `_fkScheduleText`. A text with no FlightKeys header takes the v1.12.0 path. **After QA (F1):** a row 1 whose location/ID cell reads but whose date cell does not (`PERM`, en dash, numeric month, missing colon, trailing `EST` …) is still an item header when its `CREATED:` row follows within 4 lines with no other row 1 between: the NOTAM stands alone (D43) with no window (T6); the SPEC's "garbled header" limitation is removed. **D61:** in `evalNotams`, a NOTAM with a NOTAM header (FlightKeys item header, or NavBlue `- ICAO … A1234/YY`) and no window (the T6 path) skips every schedule check (day-of-month and daily/`DLY`), is shown, and its item carries `dateUnreadable: true`; its `text` (escaped) and `rowLabel` start with `DATE NOT READABLE – CHECK NOTAM — `. The airport card already renders `rowLabel` on the NOTAM's row through `esc()` (`src/edit.html`), so no `src/` change. Window rule, content filters (obstacle, aircraft) and D43 unchanged. New export `DATE_UNREADABLE_FLAG`. |
| Patterns Affected | none of the 66 NM patterns; new module-private `_FK_DATE`, `_FK_ID`, `_FK_ROW1`, `_FK_ROW1_UNREAD` (F1), `_FK_WRAP`, `_FK_CREATED`, `_FK_SCHEDULE`, `_FK_SUBJECT`, `_FK_SCHED_CONT`, `_NB_ID_HDR` (D61, the D43 key pattern); `_splitNotams`, `xNW_standalone`, `_windowEndEstimated`, `evalNotams` (each edit marked `v1.13.0`) |
| Gate Result | Pending — Exec gate and independent QA session (ADR-005 §2.2.6) |
| Integrated In | this PR (module revision with rebuilt `index.html`; no `src/` change) |
| QA Verification | TC-171-001 … 040 (16/16): every §A.5 form on the 26 FlightKeys fixtures counted as in the grammar doc (2 five-code wrapped cells added to its location forms); 3,281/3,281 NOTAM items and 298/298 Company/HSCN items with a readable window; split = the items (7,158); 40 header rows split by a page and 13 wrapped cells read whole (L07 example); 14 impossible-date forms → only that NOTAM shown; FlightKeys/NavBlue twins shown at the same ETAs (13,972 cases); matched pair: 133/133 equal windows, shown equal except 3 FlightKeys-shown/NavBlue-hidden (NavBlue's wrapped D) line). NavBlue: 30 fixtures, 7,704 NOTAMs, 22,572 `evalNotams` calls equal to recorded v1.12.0 results; golden, V0 NOTAM-at-ETA and app-path snapshots unchanged (33/33 each); HF-5 oracle: hidden 0, not found 0 (7,538 oracle NOTAMs). All 439 unit tests pass. **After QA (F1, D61): TC-171 20/20, unit tests 443/443.** TC-171-101: 9 unreadable + 8 impossible header-date forms, each after another NOTAM — two items, two IDs, the second shown and flagged at all 882 evaluations each, the first unchanged; TC-171-102: impossible/unreadable date + readable schedule shown outside the schedule, flagged (12 cases), readable date + schedule unchanged (7 cases); TC-171-103: escaped, scope, filters, D43; TC-171-104: flag on the card's NOTAM row, same markup; TC-171-012 now asserts the F1 split. Each fails on the pre-QA head `30c7b61`. NavBlue vs v1.12.0 (30 fixtures, every NOTAM alone, 924,480 calls): differences only in the 14 D61 NOTAMs (8 IDs; `test/reports/NOTAM-v1.13.0-D61-changes.md`), each already shown at every ETA, now flagged; TC-171-030 re-recorded from v1.12.0 with those 14 left out of the sweep (the other 21 fixtures' digests unchanged). FlightKeys fixtures: split still 7,158, no item flagged. Golden and V0 NOTAM-at-ETA 33/33 unchanged; app path: 1 fixture, 2 texts flagged (snapshot updated on the fixtures branch); HF-5 oracle 0 hidden. |

### P-26 — Obstacle NOTAMs shown only when they affect heights or gradients (D67); FlightKeys type headings (v1.14.0)

| Field | Value |
|:------|:------|
| Date | 2026-11-18 |
| Ruleset Version | 1.14.0 |
| Type | RULE CHANGE (Exec decision D67) + FEATURE (FlightKeys grammar §A.6) |
| DEF-ID | **Exec decision D67 (18 Nov)**: obstacle NOTAMs "should only show if it affects a runway, approach, SID or STAR heights or gradients", both formats; replaces E1 (v1.13.0 lines 1953–1958). FlightKeys parser v0.3.0 open item **O-12** (5c QA F2): a type heading left at the end of an item hid it under `OBSTACLE` in v1.13.0 (994 items at 1,710 evaluations) |
| PR | relief-pilot #64, branch `claude/notam-v1.14.0`; fixtures companion branch `claude/notam-v1.14.0` (`expected/notam-rules-v1.14.0/fk-notams-raw.json`: the FlightKeys parser v0.3.0 output per airport, for TC-172 and the change list) |
| Summary | **Obstacle rule (SPEC §8a).** Obstacle NOTAM = the rule text says `OBST`, `OBSTACLE` or `CRANE` (as before), or a FlightKeys item printed under the `OBSTACLE` heading. Shown only if (1) the text states an effect on runway / approach / SID / STAR heights or gradients (`OBSTACLE_RULE.effect`: minima raised / changed / given, not authorised, glide path / VGSI angle, obstacle clearance, climb gradient, take-off minimums / ODP — today's TKOF keywords unchanged —, procedure altitudes), or (2) it also changes anything else, and is then shown by its own content exactly as v1.13.0 shows it (`OBSTACLE_RULE.other`: navaid, lighting, procedure availability or change, declared distances, threshold, runway / taxiway / apron / stand availability, area closed, low-visibility operations), or (3) the patterns cannot clearly decide (`OBSTACLE_RULE.undecided`: a surface penetrated or named, runway strip, a procedure area "affected"; a height near a procedure or a runway) — shown and listed for the Exec (group U). Otherwise hidden. Stated non-effects (`OCA/H NOT AFFECTED`) and obstacle-light outages are set aside before the patterns are read. One documented pattern set, exported as `OBSTACLE_RULE`; `_obstacleRule(ruleText, fkCategory)` gives the decision and its reason. **FlightKeys type headings (SPEC §5b).** The 17 heading lines (exact text, indent ≥ 15) are cut out by `_splitNotams` as pieces of their own (byte for byte); `evalNotams` reads a heading piece, or a heading line inside a piece, as the category of the items after it (`issues[].fkCategory`) and never as item content. NavBlue text: no headings, unchanged path. Unchanged: window, schedules, D27, D31, D43, D61, aircraft filter, classification, display text, grouping. Not built into `index.html` (manifest entry `notam-rules-next`). |
| Patterns Affected | none of the 66 NM; E1 (the obstacle filter in `evalNotams`) replaced by `_obstacleRule`; new `OBSTACLE_RULE`, `FK_TYPE_HEADINGS`, `_fkTypeHeading`, `_fkHeadingLines`, `_fkHeadingPiece`; `_splitNotams`, `_splitAt`, `evalNotams`, `validateSchema` (each edit marked `v1.14.0`) |
| Gate Result | Pending — the Exec's review of the change list, then independent QA (ADR-005 §2.2.6); published to Drive only after both |
| Integrated In | not built into the app (step 5e) |
| QA Verification | TC-172-001 … 090 (18/18). Change list `docs/RPT-NOTAM-ObstacleRule-ChangeList-NEW-20261118-v1.0.md`: v1.13.0 vs v1.14.0 over the 30 NavBlue/eOFP fixtures (7,704 NOTAMs, each alone, no window and the TC-171-030 sweep, 1,664,064 calls) and the 26 FlightKeys packages (137 airports, 2,292 items from `notamsRaw` under 635 headings, no window and each airport window): **B 132 shown → hidden (63 NOTAMs), C 12 hidden → shown (11), U 221 undecided, shown (159; 37 hidden by v1.13.0)**; every other NOTAM identical. TC-172-031 / 032 hold every NOTAM not in the list to identical results in CI. `npm test` 488/488; golden 33/33; extractor 56/56; `index.html` unchanged. |

---

## Reconciliation — master v1.10.1 vs the app (2026-11-07)

Method: the master `notam-rules-v110-1.js` (128,922 bytes, SHA-256 `5b95b64a…913bd`) was compared line by line with the app's NOTAM engine on `main` and with the engine as synced from production v1.9.9 (relief-pilot#1, commit c849cd9, before any hotfix).

**Finding:** the production v1.9.9 engine is **byte-identical** to the body of master v1.10.1 (only the file header, `'use strict'` and the export block differ). Every difference between the master and today's app therefore comes from the hotfixes since June.

**(a) Fixes made since June — the module follows the app** → one ledger entry each:

| Difference (app vs master) | Entry |
|:---|:---|
| Same-line `20xx` trailing year; `/YY` issue-year anchor | P-14 (HF-1, #3) |
| T1–T5 issue-year rules; T6 no window → in effect; legacy `xNW()`/`nwOverlap()` fallback removed from `evalNotams` | P-15 (HF-5, #27) |
| `_validDateParts`; T6 on B)/C) and 10-digit paths; D38 flight-month crossing on every path | P-16 (HF-5 audit, #27) |
| Duplicate key = location(s) + NOTAM ID (D43), was slot:level:label | P-17 (HF-6, #28) |
| `_resolveInlineDateRange` `/YY` New-Year window (`flightISO` argument) | P-18 (HF-6, #28) |
| `depMin` argument; `_schedWindowMinutes`, `_schedHM`, `_inDailyPeriod`; ETA ± 60 on the UTC date; D27 unreadable schedule | P-19 (HF-8, #36) |
| `_windowEndEstimated`; EST end → open end | P-20 (HF-8, #36) |

**(b) Differences older than June (app ≠ master before any hotfix) — the module follows the app:**

1. `_splitNotams` is in the app (`src/airports.html`, unchanged since the production sync) and was never in the master file. Moved into the module unchanged.
2. Ledger v1.0 P-01 says CRLF normalisation was added to `_splitNotams`; neither the master file nor the app's `_splitNotams` has it. The app normalises CRLF earlier, in the OFP parser (`src/ofp-parse.html`, `t.replace(/\r\n/g, '\n')`), before NOTAM text is stored. The module follows the app (no CRLF step); callers pass LF text (SPEC §4).
3. File frame only: the master's header comment and export block vs the app's inline banner. Not behaviour.

No difference older than June exists in the engine code itself.

**(c) Content only in v1.10.1 — not added to the module:**

1. `'use strict'` directive (the module stays non-strict so it runs with the app's semantics).
2. The v1.10.1 / v1.10.0-dev changelog header comment.
3. Exports of `classifyNotam`, `extractNotamKeywords`, `deriveOperationalImpact`, `isNotamActive` — these functions exist in both the master and the app but the app never calls them; not carried (SPEC §9).
4. The `window.xNW` / `window._flightDateISO` integration fallbacks in `evalNotams` — removed in the app by P-15, and the global read/write removed by P-21.

No pattern, rule or function exists only in v1.10.1.

---

## Pending Architecture Items (DEFERRED to v2.0.0)

These are tracked in the Defect Register as ARCH-01 through ARCH-06. ARCH-01 and ARCH-02 were closed by P-21; the patch numbers planned for the others in v1.0 (P-16 … P-19) were taken by P-14 … P-21 and are re-assigned to the next free numbers when the work is done.

| DEF-ID | Summary | Status |
|:-------|:--------|:-------------|
| ARCH-01 | Blueprint metadata constants | CLOSED — P-21 (v1.11.0) |
| ARCH-02 | `validateSchema()` implementation | CLOSED — P-21 (v1.11.0) |
| ARCH-03 | `metadata` return field | DEFERRED (adding a field to the `evalNotams` result is a contract change; not in an extraction) |
| ARCH-04 | `worst` vocabulary mapping | DEFERRED |
| ARCH-05 | ADR-001 IIFE conversion | DEFERRED (v1.11.0 wraps the module in a factory function for dual context; the full ADR-001 conversion is not done) |
| ARCH-06 | `_apchTypeLabel` merge | DEFERRED |

---

## Changelog

| Date | Action |
|:-----|:-------|
| 2026-06-09 | Initial ledger created. 13 patches documented (P-01 through P-13). All gate results PASS. |
| 2026-11-07 | v1.1: P-14 … P-20 (app hotfixes since June: HF-1, HF-5, HF-6, HF-8) and P-21 (module extraction v1.11.0) added; reconciliation of master v1.10.1 against the app; ARCH-01/02 closed. v1.0 entries unchanged. |
| 2026-11-08 | v1.2: P-22 (v1.11.1, next-day arrival at or after 1200Z) added; summary updated for the 1.9.9-hf3 integration of P-21. P-01 … P-21 entries unchanged. |
| 2026-11-08 | v1.3: P-23 (v1.11.2, the evaluation window on its actual UTC date; `_evalWindows`) added; P-22 gate result and integration recorded (#41). P-01 … P-21 entries unchanged. |
| 2026-11-09 | v1.4: P-24 (v1.12.0, the aircraft data leaves the module; one aircraft-profile module; `evalNotams()` takes the profile object and `getWingspan`) added. P-01 … P-23 entries unchanged. |
| 2026-11-17 | v1.5: P-25 (v1.13.0, FlightKeys NOTAM item headers) added; P-24 recorded as merged. P-01 … P-24 entries unchanged. |
| 2026-11-17 | v1.5 (QA rework, before merge): P-25 extended with QA F1 (header with an unreadable date stands alone) and Exec decision D61 (unreadable/impossible dates always shown, flagged, no schedule check). P-01 … P-24 entries unchanged. |
| 2026-11-18 | v1.6: P-26 (v1.14.0, Exec decision D67 obstacle rule; FlightKeys type headings, O-12) added; P-25 recorded as merged (#61). P-01 … P-25 entries unchanged. |
