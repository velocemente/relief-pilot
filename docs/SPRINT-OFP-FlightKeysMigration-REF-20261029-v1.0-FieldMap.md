# SPRINT-OFP-FlightKeysMigration — Field Map Reference

**Version:** v1.0-REF | **Status:** REF | **Date:** 2026-10-29
**What this file is:** the FlightKeys field map (§2) from SPRINT-OFP-FlightKeysMigration v1.0, kept as the reference for sessions P2a/P2b.
**Superseded parts removed:** that plan's architecture, decisions, budget and prompts. These are replaced by **ADR-004 v1.2** and **SPRINT-OFP-ImportPlatform v2.1**.
**Updated 2026-10-29 (pdf.js re-verification and Exec input):**
- Row 32: TLR **will** be present in live packages (Exec) → ❓, pending a live fixture.
- Row 33: nav log returns only 1 point on FlightKeys under pdf.js → 🔴.
- Row 34: TOC now returns a value under pdf.js → 🟡; correctness still to be checked.
- The matched pair UAAA–EHAM 27 OCT differs on en-route alternates because the Navtech release was a redispatch plan (RAPT EDDP, RALT EDDB). This is a plan difference, not an import gap.
- **Two SME questions open** (needed before P2b): what the `IA` / `TA` windows in the briefing mean, and what the `Q` token on the ORIG/DEST/PALT lines means.

> **Repository copy:** crew names, employee numbers and the dispatcher name in this file were replaced with the stable fake values produced by `tools/redact` (this repository is public). The Drive original is unchanged. The Drive source also ends mid-word in §2.7 (see the end of this file); nothing has been added to complete it.
> Status icons in the Drive export were corrupted (🔴/🟡 appeared as `ð´`/`ð¡`); they are restored here from the §2.7 summary.

---

## 1. Evidence Base

| Input | Detail |
|---|---|
| Training file A | `ZUCKUAAA Prototype.pdf` — GTI8153/26 ZUCK–UAAA, B744, 24 pp — Drive `1Qj7Y6RFfhuwOkcl_70xNP6qtPGlSiPWn` |
| Training file B | `UAAAEHAM Prototype.pdf` — GTI8153/27 UAAA–EHAM, B744, 34 pp — Drive `1g_tJ0tEfmia_bP34Uhiy1mPel1S_-Y69` |
| Legacy control | `gti-7134-260911.1315-rjaa-panc-fp_wx_ntm-03.pdf` (Navtech, 58 pp) |
| Ruleset baseline | `CODE-OFP-AtlasPolar5yRuleset` v1.0 + v1.1 UPD + v1.2 UPD (internal 1.9.9-r3) |
| Method | Ran `_ofpRulesetParse()` (v1.0 base) on all three PDFs; diffed outputs; manually located each field in the FlightKeys layout. |
| Producer | Legacy: `navtech` / Haru. FlightKeys: **Apache FOP 2.11**, embedded outline present: *High Severity Company NOTAMS · pdf-dev-ofp · NOTAM Briefing · Weather Briefing · Hazard Briefing*. |

**Fidelity.** Originally mapped on poppler text. **Re-verified 2026-10-29 on pdf.js 3.11.174** using the app's own line assembly; findings hold, with the row 33/34 updates noted above.

---

## 2. Field Map — Current Ruleset → FlightKeys

Legend: **✅ SAME** works unchanged · **🟡 ADAPT** located, pattern change needed · **🔴 SILENT** returns empty/wrong with no error · **⚪ ABSENT** not in FK package · **❓ UNVERIFIED** no FK fixture exercises it. **SC** = Safety-Critical field (Operating Practice III-1).

### 2.1 Flight identity & header (OFP page 1)

| # | Return field | Current pattern | FlightKeys location / form | Status |
|---|---|---|---|---|
| 1 | `fltNum` | `FLIGHT_ID` | `GTI8153/26 ZUCK - UAAA 27 OCT 26 N498MC` — identical. Running header `GTI8153/26OCT/…` does not false-match (no `\b`). | ✅ |
| 2 | `acftType`, `isHeavy` | `AIRCRAFT_TYPE`, `FPL_WAKE` | ICAO FPL block unchanged: `-B744/H-…` | ✅ |
| 3 | `weightUnit` | `WEIGHT_UNIT` | `B747-400F / CF6-80C2-B1F / KG / IFR / FF +5.4` — `KG` (was `KGS`); regex `KGS?` normalises to `KGS`. LB variant unseen. | ✅ / ❓LB |
| 4 | `dateStr`, `flightDateISO` | `DATE_DOF` | `DOF/261027` in FPL — unchanged. | ✅ |
| 5 | `origIcao`, `offFromOFP` | `APT_LINE_TEMPLATE('ORIG')` | `ORIG ZUCK/CKG CHONGQING/JIANGBEI Q N29432E106384 0200Z` — new **`Q`** token before coords; current template tolerates it. Meaning of `Q` to confirm (SME question). | ✅ |
| 6 | `destIcao`, `etaDest`, `destEtaOffsetMins` | `APT_LINE_TEMPLATE('DEST')` | `DEST UAAA/ALA ALMATY Q N43213E077026 0658Z` | ✅ |
| 7 | `altData[]` (PALT) | `ALT_PATTERNS` | `PALT UCFM/BSZ BISHKEK/MANAS Q … 0726Z` | ✅ |
| 8 | `altData[]` (SALT/RALT/RAPT/TALT) | `ALT_PATTERNS` | Not present in either fixture. | ❓ |

### 2.2 Fuel (OFP page 1) — SC

| # | Return field | Current pattern | FlightKeys form | Status |
|---|---|---|---|---|
| 9 | `blockFuelRaw` **SC** | `BLOCK_FUEL` | `BLOCK 078200 07.28` — now carries a time column; capture unaffected. | ✅ |
| 10 | `minfFuelRaw` **SC** | `MINF_FUEL` | `MINF 064387 05.52 ....` | ✅ |
| 11 | `fresFuelRaw` | `FRES_FUEL` | `FRES 004496 00.30` | ✅ |
| 12 | `taxiFuelRaw`, `taxiMins` | `TAXI_FUEL`, `TAXI_TIME` | `TAXI 001350 00.30` | ✅ |
| 13 | `tripMinutes` | `TRIP_TIME` | `TRIP 050584 04.28 1923` (column header now `GDIS`, was `DIST`) | ✅ |
| 14 | `alt1Fuel` | `ALT1_FUEL` | `ALT1 004811 00.27 0138` | ✅ |
| 15 | `destRemf` | `REMF_DEST` | `REMF 026266 02.55 ....` | ✅ |
| 16 | `ballastFuel` | `BALLAST_FUEL` | Not in fixtures. | ❓ |
| 17 | `porMinf` | `POR_MINF` | RDA OFP needed. | ❓ |
| 18 | `zfwIncrFactor` | `ZFW_INCR_FACTOR` | `ZFW INC/1000 X 122 MINF ADJ` — **`INC` not `INCR`** → null → MINF ADJ cascade lost. | 🔴 |
| 19 | `addlFfAdj` | `ADDL_FF_ADJ` | `*ADDL FF ADJ +1.00 *` — **space before closing `*`** → null. New companion line in MEL block: `Dispatcher applied ADHOC penalty: - All fuel flow values increased by 1.00 PCT`. | 🔴 |

### 2.3 Weights (OFP page 1)

| # | Return field | Current pattern | FlightKeys form | Status |
|---|---|---|---|---|
| 20 | `zfwActual/Limit` | `ZFW` | `ZFW 270718 ...... S288031 ZFW INC/1000 …` | ✅ |
| 21 | `togwActual/Limit` | `TOGW` | `TOGW 347568 ...... L352676 MTOW LTD BY VZFW/CK LIMITS` | ✅ |
| 22 | `ldgwActual/Limit` | `LDGW` | `LDGW 296984 S302092` | ✅ |
| 23 | `hasVzfwCkLimit` | `VZFW_CK_LIMIT` | **Asterisks removed**: `MTOW LTD BY VZFW/CK LIMITS` (inline on TOGW row) → red weight alert suppressed. | 🔴 |

### 2.4 Remarks / release page (OFP page 2) — SC

| # | Return field | Current pattern | FlightKeys form | Status |
|---|---|---|---|---|
| 24 | `catIiIiiApproaches` **SC** | `CAT_II_III_PATTERNS` | **Header `AUTHORIZED CAT II/III APPROACHES` removed.** Bare lines in Remarks: `UAAA CAT II - RWY 23R/23L` / `UAAA CAT III - RWY 23R/23L` / `EHAM CAT II/III - RWY 6/18C/18R/27/36C/36R`. Lists alternates & en-route airports too. `AIRPORT_ENTRY` still matches lines; anchor must change. | 🔴 |
| 25 | `ddgItems`, `melItems` | `MEL_BLOCK`, `ATA_CODE` | One line per item: `MEL 34-46-01-03A - GPWS - Glideslope Deviation(s) - One Operative`. `ATA_CODE` requires code on its own line → empty. Block terminator `Flight Release` still valid; must exclude `Dispatcher applied ADHOC penalty`. CDL prefix form unseen. | 🔴 |
| 26 | `crewMembers` **SC** | `parseCrew()` | `CA 918839 GRANARWICK, GRANARWELL .. .. ..` — **`LAST, FIRST`** with comma; field truncation `LANALTON NORARWICK, MORONDALE (DENANTON..`; currency now `TO/LNDG Expiry:` (was `LAST TO/EXPIRY`). Three `FO`s — role labelling must reproduce the current parser's rule exactly. SEN marker form unseen. | 🔴 |
| 27 | `hasPerishables` | `PERISHABLE` | Legacy source (`PERISHABLES O/B - NIL` in Remarks) **gone**; Remarks now = dispatcher + RAIM only. Company NOTAM boilerplate *"…PERISHABLES OR LIVE ANIMALS ARE ON BOARD"* must not false-trigger (current pattern safe). | ❓ |
| 28 | `hasTemperatureControl` | `TEMPERATURE_CONTROL` | Not in fixtures. | ❓ |
| 29 | `dotExemption` **SC** | `DOT_EXEMPT`, `EXEMPTION_NO` | Not in fixtures. | ❓ |
| 30 | `slotTime` **SC** | `SLOT_TIME_*` chain | No `WHEELS UP` in fixtures. FK may carry slot restrictions as Company NOTAMs (`SUBJECT: EHAM-ARRL CRF`). | ❓ |
| 31 | `parsedVerbalCallsign` | `VERBAL CALLSIGN - {NAME}` | Not in fixtures. | ❓ |
| 32 | `oeiData`, `ddgItems[].tlr` | `TLR_PATTERNS`, `crossRefTlrRmks()` | Not in the two prototypes; **present in live FlightKeys packages** (Exec, 2026-10-29). Layout unknown until a live fixture is supplied. | ❓ (live fixture needed) |

### 2.5 Route, nav log, sections

| # | Return field | Current pattern | FlightKeys form | Status |
|---|---|---|---|---|
| 33 | `navLog[]` | `parseNavLog()` | Two-line header reordered (`AWY/MORA`, `WPT MTK/TTK`…); MORA prefixed `^117`; new pseudo-waypoints `TOP OF STEP CLB/DSC`, `TOD`; FIR-boundary rows `(ZLHW) AT OMBON 00.43 LANZHOU FIR`. Under pdf.js the current parser returns 1 point. | 🔴 |
| 34 | `tocOffsetMins` | `parseTOC()` | `W80 TOC` / `TIPSA1A TOC` row present. Under pdf.js the current parser returns 18 / 14 min; correctness unverified against TOT-T. | 🟡 |
| 35 | `overflightPerms` | `OVERFLIGHT` | Terminators `AWY WPT` / `____` gone. FK: `--- TAKEOFF PERMIT` / `--- OVERFLIGHT PERMITS` + `CHINA CAD/2026W0508` + route string. | 🔴 |
| 36 | `altRoutes[]` | `ALT_ROUTE_PATTERNS` | Underline-bounded regex fails. FK: `Destination Primary Alternate Route` / `EHAM L18R WOODY WOODY9A EBBR` / `EHAM/0220` / `GCD 85 GDIS 118 FUEL 5424 TIME 00.27`. **No MORA line** → `mora` empty. | 🔴 |
| 37 | `ofpSections[]` | `buildOfpSections()` + `PAGE n OF N` | Footers now `FUFI: <uuid> PAGE 1/9` (OFP part) and `Page 1 of 10 <uuid>` (each briefing restarts). Page resolution must use PDF page index, not footer. FK PDFs carry an embedded outline, but PilotBrief bookmarks are always used (D7). | 🔴 |
| 38 | `ofpFormat` / `ofpSource` | `OFP_FORMAT` / opts | New module returns `'atlas-fk'`. Outline present → `ofpSource:'company'` semantics hold. | 🟡 |
| 39 | `etopsEntry/Exit/Spec`, `…Mins` **SC** | `ETOPS_*`, `CFS_PATTERNS` | No ETOPS segment in fixtures. | ❓ **blocker** |
| 40 | `porWpt`, `porOffsetMins` | `POR_*` | No RDA OFP. | ❓ |
| 41 | `etpPoints[]`, CFS `altData` | `CFS_PATTERNS.ETP_LINE` | No CFS block. | ❓ **blocker** |
| 42 | `natTrack` | `window.parseNatTrack` | No NAT/PAC tracks page. | ❓ |

### 2.6 Weather, NOTAM, Company NOTAM (briefing package)

| # | Return field | Current pattern | FlightKeys form | Status |
|---|---|---|---|---|
| 43 | `airportData[icao].weather` | `WX_SECTION_LABELS`, `WX_METAR_ANCHOR` | **0 chars for every airport.** FK *Weather Briefing*: per-airport header `ZUCK CKG - CHONGQING/JIANGBEI` / `RWYS:` / role+window `DEPARTURE 27 01:45 - 27 03:00`, then `METAR`, `TAF`, `ATIS` sub-blocks, **two-column layout** (interleave risk). Labels: `DEPARTURE` (was `ORIGIN`), `DESTINATION`, plus `IA` / `TA` windows (SME question). | 🔴 |
| 44 | `airportData[icao].notams` | `WX_NOTAM_START` (`- ICAO`) | **0 chars for every airport.** FK *NOTAM Briefing*: `APT` → `EHAM AMS - AMSTERDAM/SCHIPHOL` / `RWYS:` / role windows / category headers (`RUNWAY`, `APPROACH AND LANDING`, `AIRPORT`, `OBSTACLE`, `NAVIGATION`) / items `EHAM A2476/26` · `CREATED:…` · `2026-Oct-26 06:00 - 2026-Oct-27 16:00` · `FL: SFC - UNL` · body. Items repeat across sections → dedupe by NOTAM ID. | 🔴 |
| 45 | `airportData` for alternates | — | No entries created for UCFM / EBBR at all. | 🔴 |
| 46 | `airportData[icao].curfew` | `COMPANY_NOTAM.*` | Anchors `STATION COMPANY NOTAMS` / `Oper: Y` gone. FK Company NOTAMs: `ZUCK A0926/26` / `SUBJECT: ZUCK-CURFEW` → strong, machine-readable key. **Live miss: CKG departure curfew 0100Z–1300Z vs OFF 0200Z.** | 🔴 |
| 47 | `airportData[icao].opsNotes` | `extractAptOpsNotes()` + v1.2 guard | Station remarks moved from OFP Remarks to Company NOTAMs; current extractor attaches raw Company NOTAM text (ZUCK 615 chars) — mis-sourced. | 🔴 |
| 48 | `airportData[icao].ewins*` | `extractEwins()` | Not in fixtures. | ❓ |
| 49 | `enrouteNotams.{route,fir,airway,waypoint,geographic}` | `extractEnrouteNotams()` | All 0. FK: `FIR` blocks `UACN ASTANA FIR`, `EDUU RHEIN UIR`, with same item grammar. | 🔴 |
| 50 | Page-header stripping | `WX_PAGE_HEADER` | New running headers injected **mid-NOTAM**: `GTI8153 / UAAA - EHAM / 2026-10-27 / N498MC 2026-Oct-27 04:17`, `Page n of N <uuid>`, `FUFI:…`, `OPERATIONAL FLIGHT PLAN -- NOT RELEASED --`. Must strip before any segmentation. | 🔴 |

### 2.7 Summary

| Status | Count | Fields |
|---|---|---|
| ✅ SAME | 17 | identity, FPL, date, ORIG/DEST/PALT, all fuel except ZFW INC & FF ADJ, all weights |
| 🔴 SILENT | 17 | #18 19 23 24 25 26 33 35 36 37 43 44 45 46 47 49 50 |
| 🟡 ADAPT | 2 | #34 TOC (value returned, unverified), #38 ofpFormat/ofpSource |
| ❓ UNVERIFIED | 14 | ETOPS, CFS/ETP, POR, NAT, slot, DOT exemption, perishables, temp control, ballast, verbal callsign, E-WINS, SALT/RALT/TALT, LB unit, **TLR** |

**Safety-Critical fields affected:** `catIiIiiApproaches` 🔴, `crewMembers` 🔴, airport NOTAM/WX/curfew 🔴, `etops*` ❓, `slotTime` ❓, `dotExemption` ❓. Fuel fields `blockFuelRaw`/`minfFuelRaw` are ✅.

**New FK data worth considering (additive, deferred — not in scope v1.0):** release status `-- NOT RELEASED --`, `Release Valid Until 0600Z 27OCT26`, dispatcher `FARERMAN ROSINTON DESK: 61`, `Coldest Fuel Tem

<!-- Source text ends here (mid-word) in the Drive copy. -->
