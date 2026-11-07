# EV-0 — NOTAM Evaluator Inventory

| Field | Value |
|---|---|
| **ID** | EV-0 |
| **Version** | v0.1 (design input; documents only) |
| **Date** | 2026-11-07 |
| **Purpose** | Input to the NOTAM evaluator sprint (programme step ② in the Import Platform sprint plan). Says what the evaluator does today, where it is weak, and what the Exec must decide. |
| **Code read** | `src/notam.html` and `src/airports.html` (plus the callers in `src/edit.html` and `src/render-descent.html`) at `origin/main` commit `d2177a9`. Line numbers below are for that commit. |
| **Changes** | Nothing in `src/`, `index.html`, tests or CI. This file only. |
| **Status** | Draft for Exec review. Nothing here is a decision. |

---

## In plain terms

- **What this is:** a list of every rule the app applies to a NOTAM before a crew sees it, with the code quoted, a real NOTAM ID for each rule, and the places where the rules overlap, cannot read the wording, or hide a NOTAM without proof.
- **Biggest findings** (numbers from the 30 Navtech/eOFP fixtures; see Appendix A):
  1. **Most NOTAMs that are "in effect" get no row on the airport card.** Of 2,997 NOTAMs the evaluator keeps, only 1,072 are filed into a runway, taxiway, SID or STAR group. The other 1,925 (the "catch-all" slot and the "General Information" items) only turn the card yellow. On 27 of 142 airports with NOTAMs, no NOTAM has a row at all (G-1).
  2. **The aircraft filter hides NOTAMs that apply to a 747-400** by reading `CAT D ACFT` (an approach category) as an aerodrome code, `MAX ICAO CODE D` as "code D only", and a runway-end-safety-area width as a wingspan (G-5, IDs in §3).
  3. **The obstacle filter hides every crane/obstacle NOTAM that lacks an approach keyword**, including circling-minima increases (G-4).
  4. **The departure airport is evaluated with only 17 of the 42 rules (27 are never applied there).** Approach-system U/S, runway lights, declared distances, GPS and others fall into the catch-all at the departure airport (G-3).
  5. **Schedules:** weekday wording (`MON-FRI 0800-1700`) is not read at all; the wording that is read is compared with the ETA minute, not the ETA ±60 min used everywhere else (G-6, G-7).
- **For the Exec:** 13 plain-English questions in §5, including the approach category of each fleet type.

### What this document could not check

- **D27, D31, D34, D43 and D44 are not written down in this repository.** The decision register in `docs/ADR-004-canonical-briefing-model-v1.3.md` ends at D21 and the sprint plan v2.4 at D22. What I know about them comes from the task brief and from code/test comments: D43 (the NOTAM ID is the identifier — `src/notam.html:2265`), D27 ("anything unresolvable is shown" — `test/unit/notam-merge.test.js`), D38 (year crossing — `src/notam.html:454`). For D31, D34 and D44 I used only the wording of the brief. **If a decision says something different, the decision wins; please send the text.**
- Counts come from running the app's own code (the test harness) over the fixtures, one NOTAM at a time, at the fixture's flight date, ETA and aircraft type. They are measurements of the 30 packages, not of the whole fleet's traffic. The measuring scripts are not committed (documents only); the method is in Appendix A.
- FlightKeys packages are not covered: the app does not store their NOTAM text today (`test/known-gaps.json`), so the evaluator never runs on them.
- No fixture text, crew name or employee number appears here. NOTAM IDs are written as `ICAO ID` (for example `KORD A1334/26`).

---

## 1. How a NOTAM reaches the crew

```
OFP text ──▶ airportData[icao].notams  (one text blob per airport)
                │
   evalAirport(icao, etaZ, notamText, weatherText, wxWindow, role, acftType)   src/airports.html:281
                │   etaMin = pZM(etaZ)                      role: ORIG stays ORIG, everything else becomes DEST
                ▼
   _splitNotams(text)                                        src/airports.html:682
                ▼
   evalNotams(notams, role, etaMin, acftType, flightDateISO) src/notam.html:2124
        per NOTAM, in this order:
        1 obstacle filter ─ 2 aircraft filter ─ 3 in-effect window ─ 4 inline day/time schedule
        ─ 5 daily time schedule ─ 6 classify into a slot ─ 7 duplicate check ─ 8 build text
                ▼
   sort, build rwyGroups / sidIssues / starIssues / infoIssues
                ▼
   evalAirport: keeps level ≠ green → issues[], bumps the airport colour,
                appends GNSS detail (evalGNSS), then runs the WEATHER rules
                ▼
   renderAptIssues(status)                                   src/edit.html:333
        draws: STARs, weather pills, runway groups, SIDs, taxiway/general groups
        does NOT draw: status.issues NOTAM entries, infoIssues, catch-all slots 7/8
```

`evalAirport` is called from `buildAirportCards` (`src/airports.html:15`), `refreshAptCard` (`src/airports.html:144`, passes `null` instead of the CFS weather window) and twice in `src/render-descent.html` (lines 150 and 450), where `status.issues` feeds the NOTAM/WX/CURFEW badges through `_issueCategory` (`src/render-descent.html:422`).

### Code that exists but is never called by the app

Searched `src/`, `build/`, `tools/`, `test/`. Each of these only references itself.

| Item | File:line | Note |
|---|---|---|
| `classifyNotam` | `src/notam.html:12` | A second, Q-code based classifier (P1–P4). Not used. |
| `extractNotamKeywords` | `:129` | Not used. |
| `deriveOperationalImpact` | `:192` | Plain-English impact text per category. Not used. |
| `isNotamActive`, `notamTimeToDate` | `:337`, `:643` | Not used; `notamTimeToDate` reads the wall clock. |
| `SCHEDULE_PATTERNS`, `decodeNotamSchedule`, `isActiveInSchedule` | `:665`, `:699`, `:722` | A D-item schedule reader (`DAILY hhmm-hhmm`, `MON-FRI hhmm-hhmm`, `SR-SS`). **It reads weekday wording; `evalNotams` does not use it.** |
| `AIRPORT_TIMEZONES`, `getAirportTimezone`, `airportLocalTime` | `:768`, `:864`, `:878` | Local-time conversion. Not used; rule 1 (times are UTC) says it should stay that way. |
| `xNW`, `nwOverlap`, `oETA`, `_notamWindow`, `_parseNotamToken` | `src/airports.html:605`, `:665`, `:678`, `:690`, `:592` | The legacy window code with the pre-hotfix year rules. `evalNotams` no longer calls it (`src/notam.html:2167`). |
| First `_twyApplies` | `src/notam.html:1185` | A wrapper around `_acftApplies`. **Overridden** by the second `_twyApplies` at `:1490` (the later function declaration wins; confirmed in the harness: the effective one reads wingspan and `TWY_TYPE`). |
| `NM.RWY_ID_ALL`, `NM.TWY_WS`, `NM.CURFEW`, `NM.NAVAID_US` | `:1197`, `:1208`, `:1317`, `:1328` | Defined, never referenced. `RWY_ID_ALL` was meant for grouping (G-9). |

The header comment of `evalNotams` (`:894`–`:927`) lists slot numbers that no longer match the code (it puts taxiways at ORIG slot 2 and SIDs at slot 3; the code uses slot 2 for take-off minima/FICON, slot 3 for taxiways, slot 4 for SIDs).

---

## 2. Rule inventory

Example IDs are NOTAMs from the NavBlue (Navtech company PDF) and eOFP fixtures in which that rule is the one that decided the NOTAM. "—" means no NOTAM in the 30 fixtures reaches that rule; where a regex matches but another rule wins, that is said.

### 2.1 Splitting the airport text — `_splitNotams` (`src/airports.html:682`)

```js
const parts = text.split(/^(?=- [A-Z]{4}\b)/m).filter(s => s.trim());
return parts.length > 1 ? parts : [text]; // fallback: treat as single block
```

A new NOTAM starts at any line beginning `- ` and four capital letters. It does not check for an ICAO location or an ID. In the corpus, 6 chunks have no readable ID (lines inside Company text or forms that start with `- ` and four capital letters but are not NOTAM headers); 4 of them are kept as "in effect" and go to the catch-all. If a real NOTAM's body ever has a line that starts this way, the NOTAM is cut in two and the second half loses its dates.

### 2.2 Pre-filters in `evalNotams`

**R-OBS Obstacle filter** (`src/notam.html:2154`–`2159`). Hides a NOTAM that says OBST, CRANE or OBSTACLE unless it also contains an approach/departure keyword.

```js
const hasTkofKeyword = /\bTAKEOFF\s+MINIMUMS?\b|\bOBST(?:ACLE)?\s+DEP(?:ARTURE)?\s+PROC|\bODP\b|\bMINIMUM\s+CLIMB\b|\bMIN\s+CLIMB\b|\bCLIMB\s+GRADIENT\b/i.test(notamRaw);
const hasApchKeyword = hasTkofKeyword || /\b(?:ILS|LOC|GLS|RNAV|RNP|NDB|VOR|LDA|GBAS|GS|G\/S|G\/P|GP|IFR\s+APCH|IAP|APCH|PROC|RWY|SID|STAR|CAT\s+I{1,3})\b/i.test(notamRaw);
if (/\bOBST\b|\bCRANE\b|\bOBSTACLE\b/.test(nu) && !hasApchKeyword) continue;
```

Decides: hide. No proof is checked that the obstacle is irrelevant. Example IDs (hidden by it): `EHAM A2561/26`, `EHAM A2559/26`, `EHAM A2538/26`. See G-4.

**R-ACF Aircraft applicability** — `_acftApplies(notamText, profile)` (`:1069`), called at `:2164`. The profile comes from `buildAcftProfile(type)` (`:1042`) and the table `AIRCRAFT_DATA` (`:938`). An unknown type gets a worst-case profile (`ws:999, mtow:999999, code:'F', wake:'H'`) so nothing is hidden by mistake. Returns `true` (show) unless a rule below decides otherwise; the first rule that fires returns.

| # | What it looks for | Decides | Example ID (decided by this rule) |
|---|---|---|---|
| A1 | `WINGSPAN`, `ACFT SPAN`, `WS` + number + `M`, **or `WIDTH` + up to 3 words + number + `M`** | Shows only if our wingspan is **greater** than the number | `ZGSZ G4790/25` (hidden for B77L, see G-5) |
| A2 | `MTOW`/`TOW`/`TAKEOFF WEIGHT` + number + `T`/`TONNES`/`KG`; `OVER n LBS PROHIBITED` | Shows only if our MTOW is greater | — |
| A3 | `HEAVY ACFT ONLY`, `FOR HEAVY ACFT`, `HEAVY AND SUPER`; `HEAVY ACFT NOT AUTH/PROHIBITED/NA`; `LIGHT ACFT ONLY` | Heavy/Super → show; light-only → hide | — (`RKSO L0013/26` says WIDE BODY/HEAVY but not in a restricting form; shown) |
| A4 | `CODE`/`CAT`/`CATEGORY` + letters A–F + `ACFT`/`AIRCRAFT` (letters joined by `AND`, `/`, `,`); `CODE x ONLY/ACFT` | Shows only if **our aerodrome code letter is in the list** (no direction: not "up to", "from", "max") | `EIDW A1887/26`, `UAAA A6143/26` (hidden, B744 is code E); `EINN A1598/26`, `LHBP A0786/26` (see G-5) |
| A5 | A type designator from a fixed list (`A380 B748 B744 B773 B77W/L B772 B778 B779 B762–4 B752/3 B73x … MD11 DC10 BLCF`) | Our type listed → show. Then, by words anywhere in the text: `AND ABOVE PROHIBITED/NOT AUTH/NA` (wingspan compare), `AND SMALLER ONLY`, any `PROHIBITED/NOT AUTH/NA`, any `ONLY`, or `DISREGARD` + a restriction noun (inverted) | `PHNL M0010/26` (hidden for B763: lists other types and says ONLY) |
| A6 | `JET/TURBOJET/TURBOFAN/TURBINE ACFT PROHIBITED/NOT AUTH/NA`; `PROP/PISTON (ACFT) ONLY` | Jet → shown / hidden accordingly | — |
| A7 | Nothing found | Show | all other NOTAMs |

Fleet values in `AIRCRAFT_DATA`: `B744 ws 64.4 code E wake H`; `B748 68.4 F H`; `BLCF 68.4 F H`; `B763 47.6 D H`; `B77L 64.8 E H`. These are the aerodrome code letters from wingspan, **not** approach categories (§4.1).

### 2.3 "In effect" — the validity window

`xNW_standalone(text, flightDateISO)` (`:450`) finds one window `{startMs, endMs}` in UTC; `nwOverlap_standalone` (`:610`) compares it with the ETA. Anything that cannot be resolved is **in effect** (T6 fail-safe: `if (w) active = nwOverlap_standalone(...)`, `:2170`–`2171`).

| # | Wording read | Code | Example ID |
|---|---|---|---|
| W1 | `B) yymmddhhmm C) yymmddhhmm \| PERM` | `bcRe` | — (no fixture uses it) |
| W2 | `WEF ddmmmhhmm UFC\|UNTIL\|TO ddmmmhhmm\|PERM` | `wefRe` → `_resolveInlineDateRange` | — |
| W3 | `EFFECTIVE ddmmmhhmm UNTIL\|TO …` | `effRe` | — |
| W4 | `ddmmmhhmm-ddmmmhhmm` or `-PERM`, optional same-line 4-digit year after the end | `inlineRe` (the Atlas/Navtech header) | `KORD A1334/26` (all NOTAMs with a header) |
| W5 | `yymmddhhmm-yymmddhhmm` | `tenRe` | — |

Year rules (`/YY` from the NOTAM ID, D38 flight-month anchor, T1–T6) are in `:494`–`:599`. `EST` after the dates is ignored (the end date is taken as firm). The match is made by `w.startMs < winEnd && w.endMs > winStart` with `winStart/winEnd = ETA ∓ 60 min` (`:619`–`621`). When `etaMin < 720` the next day is also tried ("cross-midnight guard", `:629`), which can only show more.

Not resolved (kept as in effect): header with a year on the start date, i.e. `ddmmmhhmm yyyy-ddmmmhhmm [yyyy]` — `LIBD B0056/24`, `RODN M2326/25`, `KMIA A3340/25`, `KMIA A3337/25`, `YSSY H0353/25` (all have a year after the start date).

**PERM:** the end becomes 1 Jan of flight year + 50 (`:503`, `:562`). The start year is the issue year (`/YY`) or the flight year. The body text is not read (G-8).

### 2.4 Schedules inside the validity window

Two blocks in `evalNotams`, both only when `etaMin !== null`; both compare the **ETA minute**, not ETA ±60.

| # | Wording read | Code | Decides | Example ID |
|---|---|---|---|---|
| S1 | A line that is only day-of-month ranges + one time range: `08-09 13-17 20-24 1510-2020` | `ofpSchedM`, `:2178` | ETA UTC day must be in a day range **and** ETA time in the range (both ends inclusive; cross-midnight allowed) | `EBBR G2488/26`, `RKSS Z0305/26`, `RJAA A0524/26` |
| S2 | A line that **starts** with `HHMM-HHMM` or `DLY HHMM-HHMM`, several windows separated by commas | `dlyLine`, `:2209` | ETA time in any window (cross-midnight allowed) | `EBBR A3968/26`, `EBBR A3967/26`, `EHAM A2571/26` |

S2 skips the NOTAM if S1's pattern is present (`hasDayRangeSched`). If the first matching line is not a schedule (any line that begins with two 4-digit numbers joined by a dash), it is still used as one.

### 2.5 Classification — `_classifyNotamSlot` (`:1578`)

First matching rule wins; the order below is the order in the code. `rwy` is taken with `NM.RWY_ID` (first runway only, `RW`/`RWY` + number, `/` or `AND` joins a pair) and zero-padded (`_pad2`); a few rules also try `APCH_RWY`, `APCH_NAME` or `ILS_RWY_EUR` (ILS 25C without the word RWY).

**Shared (both roles)**

| Rule | Looks for | Slot / level | Label | Example ID |
|---|---|---|---|---|
| AD_CLSD | `AD CLSD`, `AIRPORT CLSD` | 1 red | `AD CLSD` | `PGUA M0695/26` (ORIG) |
| RWY_CLSD | `RWY` + (`ALL CLSD` or number [pair] + `CLSD`) | 1 red | `RWY nn CLSD` | `KORD A1334/26` (DEST), `KORD A9541/26` (ORIG) |
| VOLCANIC | `VOLCANIC ASH` | 1 red | `VOLCANIC ASH` | — |

**ORIG role (departure airport)** — 17 rules in all (the 3 shared ones plus 14 of its own)

| Rule | Looks for | Slot / level | Label | Example ID |
|---|---|---|---|---|
| TKOF_MIN | `TAKEOFF MINIMUM(S)`, `OBST DEP PROC`, `MINIMUM CLIMB OF n FT PER NM`, `CLIMB GRADIENT` | 2 yellow | `TKOF MIN RWY nn [n FT/NM]` | `KORD A9276/26`, `KCHS A0147/26` (with rate) |
| TWY_CLSD / TWY_RESTR | `TWY x CLSD`; or `TWY` + restriction words and `_twyApplies` true | 3 red (CLSD) or yellow | `TWY x CLSD/RESTR` | `UAAA A6784/26`, `KCHS A0029/26` |
| SID | `SID` within 600 chars of `AMDT/CHANGE/INOP/CLSD/TEMP/PROC/NOT AVBL/SUSPENDED/NA` | 4 yellow, category SID | `<sid> DEP` (name from `SID_NAME`, or a prose "… DEPARTURE") | `EHAM A0511/26`, `EHAM A0439/26` |
| CAT_II_NA | `CAT II/III` then `NOT AVBL/NA/SUSPENDED/OTS/U/S/NOT AUTH` within 30 non-period characters | 5 red | `<apch> RWY nn CAT II/III N/A` | `NZAA F0977/26` |
| GS_US | `G/S`, `GLIDE SLOPE/PATH` + `U/S/OTS/INOP/NOT AVBL/OUT OF SVC` | 5 red | `ILS GS U/S RWY nn (LOC ONLY)` | `KORD A7099/26`, `PGUA M0759/26` |
| APCH_CHG / APCH_MIN / IAP_CHG | approach name + `AMDT/CHANGE/REVISED/TEMP/MINIMA RAISED/PROC NA…`; `DA/MDA/CAT n RAISED/INCREASED…`; `IAP/ILS/LPV/LNAV/RNAV/RNP` + `INCREASED FR n / AMDT n / DA n…` | 5 yellow | `<apch> RWY nn CHANGE` | `KCHS A0155/26`, `KCHS A0159/26` |
| APCH_TYPE_NA | `LOC ONLY`, `BACKCOURSE … NA`, `VOR APCH … NA`, `CAT I ONLY`, … | 5 yellow | `APCH TYPE CHG` | `VHHH A0916/26`, `EHBK A2066/26` |
| DME_US | `DME … U/S/OTS/INOP…` | 5 yellow | `ILS DME U/S` | `KGTB V0083/26`, `KORD A7210/26` |
| PAPI_US | `PAPI/VASI/PVASI/APAPI/T-VASIS … U/S…` | 5 yellow | `PAPI/VASI U/S` | `KCHS M0066/26`, `KORD A8810/25` |
| ALT_MINS_CHG | `ALTN MINS … CHANGE/RAISED/NA…` | 5 yellow | `ALT MINS CHG` | — (matches `KORD A7782/26`; a change rule wins first) |
| ALT_MA | `ALTN PROC`, `ALTN MA`, `MISSED APCH … PROC/CHANGE/AMDT` | 6 yellow | `ALT MA PROC CHANGE` | — |
| FICON / SNOWTAM_BA | `FICON`, `SNOWTAM`, braking action, RWYCC, MU, `FICON n/n/n`, … (poor: ice, RWYCC 0–2, BA POOR/NIL, MU ≤ 39) | 2 (runway) or 3 (`TWY`/`APN`/`RAMP`); red if poor else yellow | `RWY nn FICON` / `TWY x FICON` | `KMIA A2656/26` |
| LVP | `LVP`/`LOW VIS PROC … IN FORCE/ACTIVATED/CANCELLED/NOT IN FORCE` | 6 red (yellow if cancelled) | `LVP IN FORCE` / `LVP CANCELLED` | — |
| ARFF_RED | `ARFF/RFFS/RESCUE FIRE FIGHTING … REDUCED/CAT n/NIL/DOWNGRADED/…` | 6 red | `ARFF/RFFS DOWNGRADED` | `KWRI M0467/26`, `RODN M0484/26` |
| (none) | everything else | **7 yellow if active, 8 if not; no label** | — | `UAAA A7110/26`, `UAAA A7105/26` (616 NOTAMs in the corpus) |

**DEST / ALT role (arrival, alternates, ETP/CFS alternates — everything that is not ORIG)** — 42 rules (the 3 shared ones plus 39 of its own)

| Rule | Looks for | Slot / level | Label | Example ID |
|---|---|---|---|---|
| CAT_II_NA | as above | 2 red | `<apch> RWY nn CAT II/III N/A` | `KORD A1206/26`, `KIND A4125/26`, `EDDB A5513/26` |
| GS_US | as above | 2 red | `ILS GS U/S RWY nn (LOC ONLY)` | `KORD A5736/26`, `ETAR P2531/26` |
| LOC_US | `LOCALIZER … U/S…` (full word only) | 2 red | `LOC U/S RWY nn` | — (no fixture) |
| APCH_US | `ILS/LOC/GLS/RNAV/LNAV/LDA/SDF/NDB/VOR/GBAS/SRA [rwy] … U/S/OTS/INOP/SUSPENDED/UNREL/OUT OF SVC/ON FLT CLBR` | 2 red | `<apch> RWY nn U/S` | `EBBR D0525/26`, `EDDF A0998/26`, `RJTT J0536/26` |
| DME_US | `DME … U/S…` | 2 red if the text has `ILS DME`/`APCH DME`, else yellow | `DME U/S RWY nn` | `PANC A2761/26`, `PANC A2763/26` |
| VORTAC_US | `VORTAC … U/S…` | 2 yellow | `VORTAC U/S` | `PASY M0192/26` |
| APCH_CHG / APCH_MIN / IAP_CHG | as above | 3 yellow | `<apch> RWY nn PROC CHANGE` | `KORD A8927/26`, `EDDP A4559/26`, `EPPW V0172/26` |
| APCH_TYPE_NA | as above | 3 yellow | `APCH TYPE CHG` | — (matches only at ORIG in the corpus) |
| ALT_MINS_CHG | as above | 3 yellow | `ALT MINS CHG` | — (matches `PHOG A0748/26`; a change rule wins first) |
| MARKER_US | `OM/MM/IM/LOM/LMM/OUTER MARKER … U/S…` | 3 yellow | `OM/LOM U/S` or `MARKER U/S` | `PHNL A0430/26`, `KORD A2754/26` |
| GPS_US | `GPS/GNSS/SATNAV … U/S/UNRELIABLE/INTERFERENCE/DEGRADED…` | 3 red (hard outage) / yellow | `GPS/GNSS U/S — RNAV N/A` / `GPS/GNSS UNRELIABLE` | — (`KIND A4424/26` matches; outside the ETA window) |
| RAIM_NA | `RAIM … NOT AVBL/OUTAGE…` | 3 yellow | `RAIM NOT AVBL (RNP N/A)` | — |
| ALS_US | `ALS/ALSF/SSALS/MALSR/ODALS/RAIL/APCH LIGHTING … U/S/SHORTENED/REDUCED…` | 3 red if ALSF/MALSR/SSALR/SSALF else yellow | `ALS U/S RWY nn` | `PASY M0191/26`, `KHSV A0227/26` |
| PAPI_US | as above | 3 yellow | `PAPI/VASI U/S RWY nn` | `KORD A8809/25`, `KBOS A1183/26` |
| REIL_US | `REIL … U/S…` | 3 yellow | `REIL U/S` | — |
| RCLL_US | `RCLL/RCLM/RUNWAY CENTERLINE LIGHTS … U/S…` | 3 yellow | `RCLL U/S … (CAT II/III IMPACT)` | `RJTT J0376/26`, `RJTT J0613/26` |
| TDZ_US | `TDZ(L)/TOUCHDOWN ZONE LIGHTS … U/S…` | 3 yellow | `TDZ LGTS U/S … (CAT II/III IMPACT)` | `UAAA A0958/26`, `YMML H2612/26` |
| RWY_LGTS_US | `HIRL/MIRL/LIRL/REIL/HIL/MIL/RUNWAY (EDGE) LIGHTS/LEAD OFF/TKOF HOLD LGT … U/S…` | 3 yellow | `HIRL/MIRL/LIRL/LEAD OFF LGT/TKOF HOLD LGT/RWY LGTS U/S` | `KORD A7060/26`, `KORD A8445/26` |
| DSPLCD_THR | `DSPLCD THR`, `THRESHOLD … DISPLACED` | 3 yellow | `DSPLCD THR RWY nn` | — (`EIDW A1124/26` matches; outside the ETA window) |
| ALT_MA | as above | 4 yellow | `ALT MA PROC CHANGE` | — (`EDDS A0560/26` matches; an approach-change rule wins) |
| STAR | `STAR` within 600 chars of `AMDT/CHANGE/INOP/CLSD/TEMP/PROC/NOT AVBL/SUSPENDED` | 5 yellow, category STAR | `STAR <name> CHANGE` | `EDDS A0559/26` |
| TWY_CLSD / TWY_RESTR | as above | 6 red / yellow | `TWY x CLSD/RESTR` | `EHAM A2477/26`, `EDDB A5273/26` (CLSD); `EDDB A5274/26`, `EIDW A1084/26` (RESTR) |
| FICON / SNOWTAM_BA | as above | 6 (taxiway/apron) or 3 (runway); red if poor | `TWY x FICON` / `RWY nn FICON` | `PANC A2811/26`, `PANC A2818/26` |
| LVP | as above | 3 red / yellow | `LVP IN FORCE` | — |
| ARFF_RED | as above | 3 red | `ARFF/RFFS DOWNGRADED` | — (none at a destination in the corpus) |
| RNP_AR | `RNP AR … NA/SUSPENDED/…` | 3 yellow | `RNP AR N/A` | — |
| DECL_DIST | `DECLARED DISTANCE(S)`, `TORA/TODA/ASDA/LDA … CHANGED/REDUCED/NOW n…`; `RESTRICTED AVBL RWY LENGTH FOR TKOF` | 3 yellow | `DECL DIST RWY nn` | `RJAA A0419/26`, `EHAM A0545/26` |
| FUEL_UNAV | `JET A/JET FUEL/AVJET … NOT AVBL/SHORTAGE/NIL…`; `AD AP FUEL NOT AVBL` | 3 red | `JET FUEL UNAVBL` | `EDDL A1480/26`, `CYYT E0323/26` |
| TRANS_ALT | `TRANSITION ALTITUDE/LEVEL … CHANGED/NOW n` | 5 yellow, category INFO | `TRANS ALT/LVL CHANGED` | — |
| BIRD_HAZARD | `BIRD ACTIVITY/FLOCKS/STRIKE/HAZARD/MIGRATION`, `WILDLIFE …` | 5 yellow, INFO | `BIRD/WILDLIFE HAZARD` | `KORD A0452/26`, `PANC A3259/26` |
| MINIMA_INC | `OCA/OCH/MOCA/MEA/DA/MDA/MINIMA … RAISED/INCREASED/AMENDED/CHANGED`; `CAT A-D INCREASED TO` | 3 yellow | `<apch> MINIMA RAISED RWY nn` | `EHAM A2565/26`, `EHAM A2558/26` |
| CAT_DG | `ILS RWY nn DOWNGRADED`, `CAT II AND III U/S/NOT AUTH`, `DOWNGRADED TO CAT n` | 3 red | `<apch> DOWNGRADED RWY nn` | `EHAM A2574/26`, `EDDF A1171/26`, `UAAA A1660/26` |
| PCR_CHG | `PCR/PCN CHANGED/REVISED…`, `RWY nn PCR/PCN`, `PCN n/F/A/W/T` | 3 yellow | `PCR/PCN CHANGED` | `ZGSZ G0629/26`, `ZUCK U4111/26` |
| RESA_CHG | `RESA [DIMENSIONS] CHANGED/REDUCED/…` | 3 yellow | `RESA REDUCED` | — (`ZGSZ G4790/25` matches; hidden by the aircraft filter first, G-5) |
| DEICE_LTD | `DE-ICING/ANTI-ICING … NOT AVBL/REDUCED/LIMITED/NIL…` | 5 yellow, INFO | `DE-ICING LIMITED` | `EPRZ E0929/26` |
| BEACON_US | `ROTATING BEACON/AD BEACON/ABN … U/S…` | 5 yellow, INFO | `AD BEACON U/S` | `LIBG B7395/25` |
| NAV_FALSE_SIG | `DO NOT USE`, `FALSE INDICATIONS POSS`, `ON FLT CLBR`, `ON TEST … DO NOT USE` | 2 red | `<navaid> DO NOT USE` | `EDDB A5350/26`, `LIBG B1581/26`, `EDDF A0473/26` |
| DISREGARD_RESTR | `DISREGARD` + restriction noun / `FOR ACFT` | 3 yellow | `TWY x RESTR (VERIFY)` | `EDDF A2178/26` |
| NEW_INFRA | `NEW TWY/RWY/STAND x … IN OPR / OPENED` | 5 yellow, INFO | `NEW TWY x IN OPR` | `EDDF A1648/26`, `EDDF A1647/26` |
| (none) | everything else | **7 yellow if active, 8 if not; no label** | — | `EHAM A2552/26`, `EHAM A2551/26` (1,292 NOTAMs) |

Key regexes quoted from `NM` (`src/notam.html:1189`–`1451`):

```js
CAT_II_NA: /CAT\s*I{2,3}[^.]{0,30}(?:NOT\s+AVBL|NOT\s+AVAILABLE|\bNA\b|SUSPENDED|OTS|U\/S|NOT\s+AUTH)/i,
GS_US:     /\b(?:G[\/\-]?[SP]|GLIDE\s+(?:SLOPE|PATH)|GLIDESLOPE)\s*(?:U\/S|UNSERVICEABLE|OTS|INOP|INOPERATIVE|NOT\s+AVBL|UNUSBL|OUT\s+OF\s+(?:SVC|SERVICE))\b/i,
RWY_ID:    /RW(?:Y)?\s*(\d{1,2}[LCRB]?(?:\s*(?:\/|AND)\s*\d{1,2}[LCRB]?)?)/,
US_WORDS:  /\b(?:U\/S|UNSERVICEABLE|OTS|OUT\s+OF\s+SERVICE|INOP|INOPERATIVE|UNUSBL|UNUSABLE|NOT\s+AVBL|NOT\s+AVAILABLE|UNRELIABLE|UNREL)\b/i,
CLSD_WORDS:/\bCLSD\b|\bCLOSED\b/i,
```

### 2.6 Severity and highlighting

- **Level** comes from the rule that classified the NOTAM (table above): `red` for closures, U/S of approach guidance, CAT II/III N/A, downgrade, FICON poor, LVP in force, ARFF, fuel, do-not-use; `yellow` for the rest. Catch-all is always `yellow`.
- `worst` = highest level among the kept NOTAMs (`_bumpW`). With no kept NOTAM it adds `✓ NOTAMs reviewed — no critical items` (slot 99, green), which `evalAirport` drops.
- Highlight: `label` rules show `<span class="nt-red|nt-yel">label</span> — first line`; catch-all colours the first line red if it has `U/S` or `CLSD` words, else yellow restriction words (`:2255`–`2262`). All text goes through `_esc`/`_hlText` (HTML-escaped), and `renderNotamGroups` runs `esc()` again on labels and raw text.
- The display line is the first body line that is not a header, a day/time schedule or blank, cut to 120 characters.

### 2.7 Duplicates (D43) — `src/notam.html:2265`

```js
const idM    = notamRaw.match(/^\s*-\s+((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})(?=\s|$)/);
const dupKey = idM
  ? `ID:${idM[1].trim().split(/\s+/).join(' ')} ${idM[2]}`
  : `TXT:${notamRaw.replace(/\s+/g, ' ').trim()}`;
if (seen.has(dupKey)) continue;
```

Same location(s) + same ID = the same NOTAM printed twice; the first copy is kept. No readable ID: duplicate only if the whitespace-normalised text is identical. The corpus has 0 repeats. Note the check runs **after** the in-effect and filter steps, and keeps the **first** copy even if a later copy has different text (§4.3).

### 2.8 Grouping — `evalNotams` `:2305`–`2399`, drawn by `renderNotamGroups` (`src/edit.html`)

- Slots that can be filed: DEST `{1,2,3,4}`, ORIG `{1,2,5,6}`; taxiway slots `{3,6}`.
- An item with a label starting `TWY` in a taxiway slot → group `TAXIWAYS` (all taxiways together).
- Otherwise a runway slot item → `RWY-nn` (the **first** runway found), or `GENERAL` when none was found.
- Items sort alphabetically by label. On the card, runway groups are sub-divided by `_subCat` (Closed, Takeoff Minimums/ODP, Approach/Navaid, Runway Lighting, Procedure Changes, Other), using words in the label.
- `sidIssues` (category SID, ORIG only), `starIssues` (category STAR, DEST/ALT only) and `infoIssues` (category INFO, DEST/ALT only) are separate lists. `evalAirport` returns the first two. **It does not return `infoIssues` and no renderer draws them** (G-1).

### 2.9 What `evalAirport` adds around the NOTAM evaluation (`src/airports.html:281`)

- Role: `ORIG` stays `ORIG`; `DEST`, `DEST ALT`, `ALT`, ETP alternates all become `DEST`.
- ETA: `pZM(etaZ)` — minutes of day; `null` when unknown (then everything is "in effect").
- **GNSS enrichment** (`:326`–`347`): `evalGNSS` (`src/notam.html:2420`) reads radius and altitude band from any NOTAM; the text is appended to the **first** issue whose text contains `GPS`, `GNSS` or `RAIM`, which need not be the same NOTAM.
- **Weather** (`:356`–`458`), used by the colour and by D34: the source is `airportData[icao].weather`, or `ewinsWeather` when present (E-WINS WSITAF from OFP Remarks, `src/ofp-parse.html:1131`). `extractEtaWindow` (`src/airports.html:478`) keeps the TAF groups that overlap ETA ±60 min, or the OFP-given window for CFS airports. Ceiling, visibility, RVR, TEMPO, PROB, TSRA, FZ precipitation and wind-shear are then classified.

---

## 3. Gaps and conflicts

Each item: what happens, why it matters, evidence (IDs only), and which Exec decision it touches. Severity: **S** = can hide something a crew needs; **M** = misleading or inconsistent; **L** = housekeeping.

### G-1 (S) In effect, but no row — the catch-all and INFO items  *(D27)*

Slot 7 / 8 (no rule matched) and category-INFO items are kept, so they colour the card yellow ("REVIEW"), but they are not in any group, so `renderAptIssues` draws no row for them. Corpus: 2,997 kept; 1,072 have a row (runway, taxiway, SID, STAR group); 1,925 do not — 616 at departure airports and 1,292 at destinations/alternates in the catch-all, 17 INFO items (`KORD A0452/26`, `PANC A3259/26`, `EPRZ E0929/26`, `EDDF A1648/26`, `LIBG B7395/25`). On 27 of 142 airports with NOTAM text no NOTAM has a row. This is "shown" to the colour logic and "hidden" from the reader. Also, `status.issues` entries for NOTAMs are used only for the descent-screen badge, and `_issueCategory` decides NOTAM vs WX from the words in the label, so a NOTAM whose first line contains `VIS`, `CIG` or `TS` is counted as weather (`src/render-descent.html:427`).
Any change here is a visible change (rule 3): the Exec must approve it.

### G-2 (M) Rules shadow each other — first match wins

132 of 1,103 NOTAMs that match any slot rule match two or more. The top pairs (winner > shadowed):

| Winner > shadowed | Count | Example IDs |
|---|---|---|
| DEST `APCH_US` > `DME_US` | 30 | `RJTT J0536/26`, `RJTT J0683/26` |
| DEST approach-change > `STAR` | 16 | `RJBB B0651/26`, `RJTT J0516/26` |
| DEST approach-change > `MINIMA_INC` | 15 | `KORD A8927/26`, `KORD A8141/26` |
| DEST `CAT_II_NA` > approach-change | 10 | `KORD A1206/26`, `KIND A4125/26` |
| DEST approach-change > `ALS_US` | 10 | `KIND A4390/26`, `KIND A4383/26` |
| ORIG approach-change > `DME_US` | 10 | `KCHS A0156/26`, `KLAX A1613/26` |
| ORIG `TKOF_MIN` > `SID` | 7 | `KCHS A0148/26`, `KCHS A0149/26` |
| DEST `DME_US` > approach-change | 7 | `PANC A2761/26`, `PANC A2763/26` |
| ORIG `SID` > approach-change | 7 | `RJAA A1385/26`, `RJAA A1384/26` |
| DEST `CAT_II_NA` > `CAT_DG` and `ALS_US` | 1 | `CYYT E1560/26` |

One NOTAM gets one label. A NOTAM that says "LPV minima raised, and ALS U/S" is labelled only as the first; the second fact is in the raw text but not in the label or the colour. Also: `ORIG` has `CAT_II_NA` → `GS_US` → approach-change, but only `GS_US` knows "LOC ONLY"; `DEST` has `LOC_US` (full word LOCALIZER only) in front of `APCH_US`, while `LOC U/S` written with the abbreviation goes to `APCH_US`. `APCH_TYPE_NA`, `ALT_MA`, `ALT_MINS_CHG` almost never win because an approach-change rule matches the same words first.
Rules with no winner anywhere in the corpus: ORIG `VOLCANIC`, `ALT_MINS_CHG`, `ALT_MA`, `LVP`; DEST `VOLCANIC`, `LOC_US`, `APCH_TYPE_NA`, `ALT_MINS_CHG`, `GPS_US`, `RAIM_NA`, `REIL_US`, `DSPLCD_THR`, `ALT_MA`, `LVP`, `ARFF_RED`, `RNP_AR`, `TRANS_ALT`, `RESA_CHG`, `AD_CLSD`. They are untested against real wording.

### G-3 (S) The departure airport is a smaller evaluator  *(D27)*

ORIG uses 17 rules; DEST uses 42. These are **not** applied at the departure airport: `LOC_US`, `APCH_US`, `VORTAC_US`, `MARKER_US`, `GPS_US`, `RAIM_NA`, `ALS_US`, `REIL_US`, `RWY_LGTS_US`, `RCLL_US`, `TDZ_US`, `DSPLCD_THR`, `STAR`, `NAV_FALSE_SIG`, `RNP_AR`, `DECL_DIST`, `TRANS_ALT`, `DISREGARD_RESTR`, `NEW_INFRA`, `FUEL_UNAV`, `BIRD_HAZARD`, `MINIMA_INC`, `CAT_DG`, `PCR_CHG`, `RESA_CHG`, `DEICE_LTD`, `BEACON_US`. Departure NOTAMs that match them fall into the catch-all (G-1): `APCH_US` 21 (`KORD A9544/26`, `KORD A9475/26`), `MARKER_US` 45 (`KCHS A0640/25`, `KORD A4566/26`), `RWY_LGTS_US` 15 (`KORD A0010/26`, `KORD A7060/26`), `BIRD_HAZARD` 10 (`RODN M0357/26`, `EHAM A0990/26`), `MINIMA_INC` 7 (`EHAM A1058/26`, `EHAM A1056/26`), `ALS_US` 4 (`UAAA A5153/26`), `DECL_DIST` 1 (`RJAA A0419/26`), `FUEL_UNAV` 1 (`KMIA A0448/26`), `CAT_DG` 1 (`EHAM A1043/26`), `PCR_CHG` 1 (`KGTB M0010/26`), `BEACON_US` 1 (`PGUA M0685/26`). The code comment on `DECL_DIST` itself says TORA/TODA affect departure performance. The departure airport is also the return airport after a turn-back (D15, BTB/ATB).

### G-4 (S) Obstacle filter hides without proof  *(D27)*

In the corpus the filter hides 510 chunks (356 distinct IDs). Most are obstacle-light outages and crane notices, which is the intent. But the "approach keyword" list lacks `APPROACH`, `CIRCLING`, `MINIMA`, `OCA`, `OCH`, `DEPARTURE`, `TWY`: 7 hidden NOTAMs mention minima/OCA (`EHAM A2559/26` — circling minima by category, `EHAM A0894/26`, `EHAM A0860/26`), 4 mention circling (`EHAM A3013/25`, `EHAM A2091/26`), 2 mention taxiways (`PHNL M0050/26`, `PHNL M0047/26`). A crane NOTAM that closes or restricts a taxiway without the word `RWY` is hidden. The same crane NOTAM is shown if it mentions `RWY`, `ILS`, `PROC`… anywhere (278 distinct NOTAMs pass this way), so the filter's effect depends on incidental words.

### G-5 (S) Aircraft filter reads wording wrongly  *(D44)*

Of the 12 NOTAMs it hid in the corpus (each at the fixture's own aircraft), these are wrong or doubtful:

| ID | Aircraft | What the evaluator did | Problem |
|---|---|---|---|
| `LHBP A0786/26` | B744 | Read `MAX ICAO CODE D ACFT` as "code D aircraft" and hid it (we are code E) | "Max code D" **excludes** us: the restriction applies to a 747. Hidden although it applies. |
| `EINN A1598/26`, `EINN A2773/26` | B744 | Read `CAT D ACFT` as aerodrome code D and hid it (we are code E) | `CAT D` is normally the **approach category** (speed), not a wingspan code. If the 747-400 is category D, these apply and were hidden. Depends on §5 Q1. |
| `ZGSZ G4790/25` | B77L | Read `WIDTH 150M` in a runway-end-safety-area dimension change as a wingspan limit (ours 64.8 < 150) and hid it | Not an aircraft restriction at all; `RESA_CHG` would have classified it. Hidden although it applies. |
| `EIDW A2625/26` | B744 | Read `CAT A AND B ACFT` as codes A and B and hid it | Right result (not category A/B) for the wrong reason; same reading error. |
| `EIDW A1887/26`, `EIDW A3078/26`, `NZAA F0048/26`, `NZAA F0049/26`, `YMML H1663/26` | B744 | `CODE F ACFT` → hidden (we are code E) | Correct for the B744. For the B748/BLCF (code F) the same NOTAMs are shown. Direction words (`UP TO`, `AND ABOVE`) are not read. |
| `UAAA A6143/26` | B744 | `CODE C ACFT` → hidden | Probably right (stands for code C). |
| `PHNL M0010/26` | B763 | Lists other types plus `ONLY` → hidden | Probably right. |

Method flaw behind all of these: section A4 treats a letter list as an exact set with no direction, A1 treats any `WIDTH … nn M` as a wingspan, and A5's `ONLY`/`NA`/`PROHIBITED` checks look at the whole NOTAM, not at the phrase that names the types. The text `NA` also matches the plain word "NA".
Related: the taxiway test (`_twyApplies`, `:1490`) reads a wingspan number as "applies if our wingspan is greater". `EHAM A1813/26` (wingspan more than 68 m) and `EHAM A3004/25` (more than 69 m) therefore do not apply to a B744 (64.4 m) and fall into the catch-all (G-1), which is right for the B744; for the B748 or BLCF (68.4 m) the first one applies. `EHAM A2170/26` is read the same way. The table values are the only margin: a wrong wingspan in `AIRCRAFT_DATA` changes which taxiway restrictions a crew sees.

### G-6 (S) Schedule wording the evaluator cannot read  *(D27)*

Read: S1 and S2 (§2.4). Not read — the NOTAM is shown whenever its window overlaps the ETA:

| Wording | NOTAMs in the corpus | Example IDs |
|---|---|---|
| Weekday name(s) + time: `MON-FRI 0800-1700` | 54 (46 shown) | `EIDW A2625/26`, `EHAM A2392/26`, `EHAM A2539/26` |
| Several weekday clauses, one of them `H24` | 4 | `EHAM A2565/26`, `UAKK K0780/26`, `ZSAM M0467/26` |
| `H24` / `HJ` / `HN` / `HO` alone | 2 | `YPDN N0487/26`, `YPDN J0527/26` |
| Sunrise/sunset (`SR`, `SS`, `SS PLUS30`) | 12 | `YPDN N0707/26`, `KHSV A0360/26`, `YSSY F1048/26` |
| `EXC` weekday / holiday | 1 | `EHAM A1030/26` |
| Date lists (`DEC 01 02 03 …`) | 5 | `RJTT E1262/26`, `VHHH A0914/26`, `RJBB B0599/26` |
| Times with `UTC`/`Z`/`HRS` | 5 | `RODN M0220/26`, `PAED M0239/26`, `RKSI A0407/26` |

These are the safe direction (shown when in doubt). The dead `SCHEDULE_PATTERNS` code reads the weekday and `SR/SS` forms only partly (it also cannot compute sunrise). Weekday names in a NOTAM are UTC days like its times, so reading them needs no time-zone conversion (rule 1). A time with a local-time suffix (`hhmm-hhmmL`, `RKSO L0013/26`) is a different case: it is not read and must not be converted (rule 1); it needs an Exec answer (Q8).

### G-7 (M) Schedules use the ETA minute; windows use ETA ±60  *(D27)*

The validity window is overlap-tested against ETA ±60 min, but S1 and S2 test the single ETA minute. A NOTAM whose daily window starts 30 minutes after the ETA is hidden although it is inside the ±60 min the crew is briefed on. In the corpus 152 NOTAMs are hidden by S1/S2 (16 + 136), and 24 of them have a daily window that touches ETA ±60: `RJAA A0489/26`, `EBBR A3859/26`, `EIDW A1035/26`, `RJTT J0030/26`, `RKSI A0291/26`, `PANC A3903/26`. Not seen in the corpus, found by reading: S1 compares the ETA's UTC day, so a window that crosses midnight (`2200-0300`, days `08-09`) is judged on the ETA day, and an ETA of 0100 on the 10th is outside `08-09` although the NOTAM is active from the 9th.

### G-8 (M) PERM NOTAMs whose text gives a period  *(D31)*

166 distinct NOTAMs have a `-PERM` header. The evaluator sets the end to 1 Jan of the flight year + 50 and never reads the body. 20 of them state dates or periods in the body (`WEF`, `FROM`, a date, a recurring maintenance or flow-control window) and all 20 are shown (as "in effect now"): `EHAM A0511/26`, `EHAM A0439/26`, `EHAM A0438/26`, `EDDP A4559/26` (AIP pages effective one day before the header start), `AYPY A1549/25`, `LIBG B7431/25` (maintenance on the first Wednesday of April and October), `YMML H0221/25` (a daily window inside a PERM), Shown is the safe direction. The risk is the other one: a PERM NOTAM whose body says "from <future date>" is shown as active today. Because the new canonical record (`src/import/notam-record.js`, D8) will carry a flag for unresolvable windows, what the evaluator does with the body period is for the evaluator sprint.

### G-9 (M) Runway: first one only

`RWY_ID` returns the first runway in the text. 59 grouped NOTAMs name more than one distinct runway but are filed under one (`EDDB A4647/26`, `EDDP A4708/26`, `KIND A4389/26`, `KIND A4382/26`). `RWY_ID_ALL`, written for this, is unused. 93 grouped NOTAMs have no runway found and sit in "General" (`EDDB A5513/26`, `EDDB A5350/26`, `EDDP A4559/26`, `LIBG B1581/26`). The European form `ILS 25C` without `RWY` is understood only by `APCH_US` and `CAT_DG`.

### G-10 (M) `EST` end dates

`EST` after the dates means the end is estimated; the NOTAM stays in force until cancelled. The evaluator ignores `EST` and hides a NOTAM whose estimated end has passed (rule 1 of CLAUDE.md says `EST` is an estimated end, not a time zone). 749 NOTAM chunks in the corpus carry `EST`; 3 chunks (2 distinct NOTAMs) are hidden because the estimated end is before the flight date: `EINN A4292/25`, `RJTT J0971/26`. Whether a package would still contain such a NOTAM is a question for the Exec (§5 Q9).

### G-11 (L) Year form the window reader cannot parse

A year after the **start** date (`ddmmmhhmm yyyy-ddmmmhhmm yyyy`) is not read; the NOTAM is "in effect": `LIBD B0056/24`, `RODN M2326/25`, `KMIA A3340/25`, `KMIA A3337/25`, `YSSY H0353/25`.

### G-12 (L) Splitting, GNSS detail, refresh, drift

- `_splitNotams` splits on any `- WORD` line (§2.1).
- The GNSS detail goes to the first row that contains `GPS|GNSS|RAIM`, not necessarily the right NOTAM, and the rows it is written into (`status.issues`) are not drawn on the card.
- `refreshAptCard` passes `null` as the CFS weather window, `buildAirportCards` passes the OFP window; after an edit a CFS airport's weather is judged on a different window than at first draw. NOTAMs use ETA ±60 in both.
- ETA for ALT/ETP airports is `apt.eta`/`currentEta`; the OFP weather window for those airports is not used for NOTAMs.
- Unused duplicate code (§1) carries rules that disagree with the live ones (legacy year logic, a second classifier, a schedule reader).
- The header comment of `evalNotams` no longer matches the slot numbers.

### G-13 (M) Departure-airport "ETA" is the departure time

For ORIG, `apt.eta` is the OUT time (`S.outZ`, `src/edit.html:141`); the window ETA ±60 therefore covers the take-off hour only. NOTAMs that begin 90 minutes after pushback but before the aircraft is back (turn-back) are outside. Not a defect against the current brief; listed so the evaluator sprint states the window it wants for the origin.

---

## 4. Design notes for three Exec decisions

These are notes for the evaluator sprint, not decisions. The decision text is not in the repository (see "What this document could not check").

### 4.1 D44 — show only the aircraft's approach-category minima within a NOTAM

**Which NOTAM wordings carry categories.** (The counts overlap; a NOTAM can be in several rows.) Approach categories are letters A–E (and H, DL); ILS categories are roman numerals (I, II, III) and must not be mixed up. In the corpus there are 2,755 distinct NOTAM IDs; the category-bearing families are:

| Wording family (generic form) | Distinct NOTAMs | Example IDs |
|---|---|---|
| One value per category: `CAT A <v>, CAT B <v>, CAT C <v>, CAT D <v>` (values in several forms, sometimes `n(m)` = OCA(OCH)) | about 90 with a category letter followed by a number | `EHAM A2565/26`, `EHAM A2392/26`, `EHAM A2539/26` |
| Range: `CAT A-D`, `A-DL`, `D-DL` | 37 | `EHAM A2565/26`, `EHAM A2558/26` |
| Grouped: `CAT A AND B … CAT C AND D AND DL …` | 60 with category + a minima word | `EHAM A2559/26` (circling) |
| Slash / "all": `CAT A/B/C`, `CATS C/D`, `ALL CATS`, `CIRCLING ALL CATS` (US instrument approach procedure NOTAMs) | many of the 44 circling/manoeuvring NOTAMs | `KCHS A0155/26`, `KORD A8927/26` |
| `ACFT CAT` / `APCH CAT` label before the value | 25 | `EHAM A2558/26`, `EHAM A2392/26` |
| "Not available for CAT D ACFT" (a restriction, no value) | 2 | `EINN A1598/26`, `EINN A2773/26` |
| `CAT A AND B ACFT` as a qualifier for a minima change | 1 | `EIDW A2625/26` |
| `UP TO CAT E (A B C D E)` — here **CAT means aerodrome/taxiway code** (with a wingspan) | 1 | `LTFM B0164/26` |
| `MAX ICAO CODE D ACFT` — code, with direction "max" | 1 | `LHBP A0786/26` |
| `CODE <letter> ACFT` — aerodrome code | 7 | `EIDW A1887/26`, `NZAA F0049/26`, `UAAA A6143/26` |
| Table of A B C D column headings (value row below) | 1 | `LTFM B0164/26` (shares the heading style) |

The same letters therefore mean two things: approach category (speed-based, in minima and procedure restrictions) and aerodrome reference code (wingspan, in stands and taxiways). The live code (`_acftApplies` section A4) treats all of them as aerodrome codes (G-5). Minima NOTAMs that today reach the crew do so through `MINIMA_INC`/`APCH_CHG` and show the whole text; there is no per-category extraction anywhere.

**How the aircraft's category would be known.** Today nowhere. The app knows the ICAO type (`S.acftType`, from `PATTERNS.AIRCRAFT_TYPE`, `src/ofp-parse.html:439`), and `AIRCRAFT_DATA` holds wingspan, MTOW, aerodrome code and wake category. Types in the fixtures: `B744` (22), `B748` (6), `B763` (3), `BLCF` (1), `B77L` (1). The OFP type alone cannot tell the 747-400F, 747-400BCF and 747-400 passenger aircraft apart: all are `B744`. Options: (a) a fixed table type → approach category, set by the Exec (§5 Q1); (b) per flight, from reference landing speed at the landing weight in the OFP (the OFP has landing weight; the speed is in the aircraft manual, not in the OFP) — this depends on the real landing weight and so on the day; (c) crew choice on the existing edit popover (a UI change). Option (a) is the smallest and is testable with fixtures. Whether circling uses a higher category than the straight-in approach is a company practice question (Q2).

**When the category is unknown** (type not in the table, blank type, or the NOTAM wording is not recognised as a category): the safe design is to show **all** categories exactly as the NOTAM states them, as today, and never drop a value. Only when (1) the type is in the table, **and** (2) the NOTAM wording matches a recognised family with positive proof that each omitted category is not ours, would the display be narrowed. A NOTAM that mixes the two meanings (A4-style `CAT D ACFT` restrictions) should not be narrowed until the Exec states which meaning applies.
Test needs (CLAUDE.md rule 6, safety-critical): a positive test (a NOTAM listing A–D with our category C narrows to C) and a negative test (unknown type, odd wording, or `ALL CATS` leaves the full text), per wording family above, using the IDs listed.
The result is a visible change on the airport card; it needs Exec approval of the screen (rule 3).

### 4.2 D34 — remarks weather as a second weather source for the evaluator

**What exists.** The weather source for an airport is `airportData[icao].weather` (the OFP weather briefing). `evalAirport` already has one second source: E-WINS. When the OFP Remarks carry `***FLIGHT RELEASED UNDER E-WINS AUTHORITY FOR TAF (ICAO)` followed by a `WSITAF …` block, `extractEwins` (`src/ofp-parse.html:1131`) stores it as `ewinsWeather` (with role and window) and `evalAirport` uses it **instead of** the briefing TAF (`src/airports.html:290`–`297`); the card shows an `EWINS` tag.

**What the remarks hold.** In the Remarks section of the 33 fixtures, 11 mention weather words. Most say `WX` (routing or fuel remarks that mention weather; they contain no weather values). Two contain weather values:
- `NB_KCHS-LIBG_12MAR26_lcf_rev16`: the Remarks section carries a full destination TAF under a TAF heading, followed by a standard dispatcher sentence about the TAF covering the ETA. The same issue time and period appear in the company weather product later in the package (as a `WSITAF` line) and in the weather the app stored for that airport, so here the remarks repeat the briefing; they are not a different forecast. The remarks text itself is kept only as Company Remarks (`opsNotes`) and is never handed to the weather rules.
- `NB_KWRI-EPRZ_08APR26_cmb-nat_rev30`: an E-WINS release for one airport (already handled as above) plus a TAF heading and a destination-forecast remark.

So in the 33 fixtures there is no case where the remarks hold a forecast that the app does not already have. What a second source adds is protection when the briefing weather is missing, out of date or different, and the remarks say so. That case needs a fixture; none exists yet.

**Design questions the evaluator sprint has to settle.**
1. *What counts as remarks weather:* a TAF/METAR in the standard form only (header `TAF ICAO ddhhmmZ dddd/dddd …`), or also free-text such as "TEMPO WX"? Free text cannot be evaluated with the existing parsers (`pCeil`, `pVis`, `pRVR`) and should be shown, not scored.
2. *Parsing rule:* extract the TAF block and pass it through the same `extractEtaWindow` + ceiling/visibility/RVR code; no new weather logic.
3. *Precedence when two sources exist* (briefing TAF vs remarks TAF, or vs E-WINS): E-WINS today replaces. For remarks, options are (a) replace like E-WINS, (b) evaluate both and take the **worse** level (fail-safe), (c) evaluate both and show the difference. Option (b) is the only one that cannot hide a worse forecast; it needs the Exec's answer (Q10).
4. *Validity:* the remarks TAF carries its own issue time and period; apply the same ETA ±60 window, and use the OFP CFS window when one exists.
5. *Provenance:* the card must say which source produced a weather line (visible change, needs approval). The golden snapshot and the `opsNotes` text must not change for airports that have no remarks weather.
6. *Safety class:* weather is safety-critical (rule 6): positive test (remarks TAF with a low ceiling in the window turns the card red) and negative test (remarks TAF outside the window, or free text, does not).

### 4.3 D43 — the NOTAM ID is the identifier

**Already in code.** `evalNotams` keys duplicates on location(s) + ID (`src/notam.html:2265`); the V0 goldens (`test/lib/v0-snapshots.js`) record every NOTAM by `loc ID`; `test/unit/v0-invariants.test.js` and `notam-merge.test.js` check that a NOTAM with a new ID is never dropped. The ADR-004 changes card compares NOTAMs by ID (added/removed). The FlightKeys parser has its own ID pattern (`src/import/atlas-fk.js:370`, `[A-Z]\d{4}\/\d{2}` with an optional 3-letter FAA prefix).

**Points for the sprint.**
- The ID pattern accepts `[A-Z]\d{1,4}\/\d{2}`, only in the first line, and only after `- ICAO[ ICAO…]`. FAA-style serial numbers in brackets after the ID (`(6/0883)`) are ignored and not part of the identifier.
- Same ID, different text (a replacement or a corrected print): the first copy is kept, the later is dropped (no corpus case). Whether the later should win belongs to the Exec (Q12).
- The same ID at two different locations is kept (location is part of the key); the same NOTAM listed under two airports of one package is counted once per airport.
- NOTAMs without a readable ID (the 6 mis-split chunks) fall back to the text key and are not identifiable on a changes card.
- The ID is `loc + number/year`; the year is two digits. IDs of different series (A, B, D, G, H, J, K, L, M, N, P, U, V, Z, …) are distinct. Series letters come from the issuing office; the evaluator does not use them.
- The new canonical record (`src/import/notam-record.js`) and the evaluator should share one key function so that the changes card, the duplicate check and the goldens cannot drift apart.

---

## 5. Questions for the Exec (domain decisions only)

**Approach category of each fleet type (Q1).** Please fill in the approach category (A, B, C, D or E) the crews use for each type, and say if it changes with weight, flap setting or company practice.

| Fleet type | ICAO type in the OFP (code in app) | Approach category (A–E) |
|---|---|---|
| 747-400F / 747-400BCF | `B744` (both freighter and BCF have the same type code) | |
| 747-400 passenger | `B744` | |
| 747-8F | `B748` | |
| 777F | `B77L` | |
| 767-300 | `B763` | |
| 747 LCF | `BLCF` | |

Additional questions:

- **Q2 — Circling.** Does any type use a higher category for circling than for the straight-in approach? Does the company limit circling (so only some categories matter)?
- **Q3 — What "CAT D ACFT" means.** When a NOTAM says "not available for CAT D ACFT" or "CAT A AND B ACFT", do you read that as approach category (speed)? When it says "CODE E ACFT" or "MAX ICAO CODE D", do you read that as the aerodrome code (size)? If a NOTAM says "MAX CODE D", does the restriction apply to a 747-400 (code E)?
- **Q4 — Unknown category.** If the app does not know the category, or the wording is unusual, should it show every category as written (recommended), or nothing?
- **Q5 — Obstacle and crane NOTAMs.** Which of these must a crew always see: a crane that raises circling/approach minima; a crane or obstacle that restricts a taxiway; an obstacle-light outage; any other obstacle notice? (Today all of them are hidden unless they contain a runway or approach word.)
- **Q6 — The departure airport.** For the origin, which of the arrival-side items matter to you: approach system out of service (return after a turn-back), approach/runway lighting, declared distances and runway length, GPS/RAIM, pavement strength, de-icing, fuel, bird hazard, minima raised? Which are not needed?
- **Q7 — NOTAMs that are "in effect" but no rule recognises (1,925 of 2,997 in the test packages).** Should the airport card list them in some form, or is the colour alone enough? (This would be a screen change and needs your approval of the screen.) And should the card be yellow ("REVIEW") when the only reason is such a NOTAM?
- **Q8 — Schedules.** When a NOTAM has a schedule the app cannot read (weekday names, sunrise/sunset, "H24", several clauses, or a time marked as local time), should it be shown as active with a "check schedule" note (recommended), or treated as inactive? And should a daily window be judged on the ETA minute or on ETA ±60 minutes, as the date window is?
- **Q9 — Estimated end (`EST`).** If the estimated end has passed but the NOTAM is still in the package, treat it as still in force (recommended)?
- **Q10 — PERM with a period in the text (D31) and weather in remarks (D34).** For a PERM NOTAM whose text says "from <date>" or gives a recurring period: show it always, show it only when the period applies, or show it always with a note? For weather found in Remarks: when the Remarks TAF and the briefing TAF differ, use the worse of the two (recommended), the Remarks one, or show both?
- **Q11 — NOTAMs about more than one runway.** File the NOTAM under every runway it names, or once under the first?
- **Q12 — Same ID, different text (D43).** If two copies of the same NOTAM ID in one package differ, which one counts: the first printed, the later printed, or both?
- **Q13 — Which fleet data do you want kept?** The app holds wingspan, weight and aerodrome code for each type (747-400 is code E, 64.4 m; 747-8 and LCF are code F; 777F is code E; 767-300 is code D). Please confirm or correct these, and say whether the aerodrome code for a stand/taxiway restriction should follow ICAO code letters or the company's own taxi limits.

---

## Appendix A — How the numbers were obtained

- **Corpus:** the 30 `navtech-company` (26) and `navtech-eofp-ios-print` (4) fixtures in `velocemente/pilotbrief-fixtures` (3 FlightKeys fixtures excluded: no NOTAM text is stored). 3,870 NOTAM chunks, 2,755 distinct IDs, 142 airports with NOTAM text.
- **Path:** the app's own import path (`test/lib/app-path.js`: `processPDF` → `parseOFP`) on each fixture's stored text items, then, per airport, `_splitNotams` and `evalNotams` exactly as `evalAirport` calls them (role mapping, ETA, aircraft type, flight date). Each NOTAM was also evaluated alone so that the duplicate check could not hide it. The harness loads `index.html` unchanged.
- **Rule matches** use the live `NM` table from the app; "winner" is the label and slot returned. "Shadowed" counts use the rule order in §2.5.
- **"Has a row"** = the NOTAM is in `rwyGroups`, `sidIssues` or `starIssues` of the result. `infoIssues` and slot 7/8 items are not drawn by `renderAptIssues` (read in `src/edit.html:333`; and the empty-card check was run: no airport card was empty of every row because the weather "Open" line is always drawn).
- **Hidden-by-reason** counts: obstacle filter and aircraft filter by re-running their tests; window by `xNW_standalone` + `nwOverlap_standalone`; schedule by the two regexes in `evalNotams`.
- **Not done:** no production NOTAM feed, no FlightKeys, no live clock (the harness clock is fixed at 2026-10-30), no manual review of every hidden NOTAM. Counts of "wrong" readings (G-5) are limited to the 12 aircraft-filter hits that were read by hand.
- Re-running requires a throwaway script outside the repository; none is added here.
