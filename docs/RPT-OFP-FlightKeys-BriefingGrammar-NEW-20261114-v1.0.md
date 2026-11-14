# RPT-OFP-FlightKeys — Briefing Grammar (NOTAM and Weather Briefing) and Beta Live Risk

**Version:** v1.0-NEW | **Status:** NEW | **Date:** 2026-11-14
**Input for:** NOTAM ruleset v1.13.0 and parser step 5d (`ofp-flightkeys` briefing reader); D54 (NOTAM layout preservation).
**Evidence:** the 26 FlightKeys packages on fixtures branch `claude/fk-live-19` (velocemente/pilotbrief-fixtures#11): 23 live (L01–L23) and 3 prototypes (T1–T3). Labels and the package list are those of the FlightKeys field map v1.1 (`docs/SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md`, §1.1).
**What it is not:** a parser or a code change. Nothing in the app changes.

> **Public repository.** NOTAM, weather and Company NOTAM text is quoted as printed (it is public aeronautical information or company operational text). No crew names, employee numbers, dispatcher names or phone numbers appear. Texts and positions were passed through `tools/redact` before analysis; running headers are shown with placeholders.

---

## Part A — Briefing grammar

### A.1 Method

| Step | Detail |
|---|---|
| Input | `items/<id>.items.json` (pdf.js 3.11.174 text items with x/y, from `tools/extract`) and `text/<id>.raw.txt`, both through `tools/redact` into a scratch folder. |
| Columns | Every briefing page is landscape (842 × 595 pt) and printed in **two columns**. Items with x < 411 pt are the left column, the rest the right column (no item sits between x ≈ 400 and 430 in any package). Lines with y < 30 pt are the running header, y > 565 pt the footer. Reading order is: header, left column top to bottom, right column top to bottom, footer. |
| Indentation | Reported as points from the column's left edge (left column 28 pt, right column 430 pt). "Indent 0" = flush left in the column. |
| Counting | One pattern per form over all 26 packages, in reading order. A "NOTAM item" starts at an item header line (§A.5) and ends at the next item header, category heading, airport/FIR block or section end. |
| Documents | A briefing document is a run of pages whose footer reads `Page n of N <uuid>`; numbering restarts at 1 for each document. |

### A.2 Documents and where they sit

Every package has the same four briefing documents (26/26), in this order around the release and before the TLR:

| Document | Footer | First heading | Content |
|---|---|---|---|
| High Severity Company NOTAMs | `Page 1 of 1 <uuid>` | `HIGH SEVERITY COMPANY NOTAMS` | 1 page, 1 item (`P0110/26 … SUBJECT: FlightKeys OFP`) in 26/26 |
| Company NOTAMs + NOTAM Briefing | `Page n of N <uuid>` (5–18 pages) | `COMPANY NOTAMS` then `GENERAL` | Company NOTAMs (general, then per airport), then airport blocks, then FIR blocks |
| Weather Briefing + Hazard Briefing | `Page n of N <uuid>` (2–21 pages) | first airport block | airport blocks (TAF / METAR / ATIS), then FIR blocks (SIGMET) |
| Volcanic Ash Advisories | `Page1of1 <uuid>` (no spaces) | — | `NO VOLCANIC ASH ADVISORIES` or advisories |

The outline embedded in the PDF names them ("High Severity Company NOTAMS", "NOTAM Briefing", "Weather Briefing", "Hazard Briefing"), but the outline is not part of the extracted text; the reader must find the documents by content (heading + footer restart).

Per package (PDF pages; counts of items and blocks):

| Pkg | NOTAM doc | WX doc | HSCN items | Company items | Airport NOTAM items | FIR NOTAM items | Airport blocks NOTAM | Airport blocks WX | FIR blocks NOTAM | FIR blocks WX | `UFN(EST …)` | `UFN` | `SCHEDULE:` | Items cut by a page | Curfew items |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L01 | 8-14 | 15-18 | 1 | 9 | 58 | 14 | 3 | 7 | 5 | 5 | 11 | 5 | 1 | 8 | 0 |
| L02 | 32-48 | 49-68 | 1 | 14 | 171 | 41 | 7 | 14 | 7 | 7 | 21 | 4 | 45 | 16 | 3 |
| L03 | 13-23 | 24-39 | 1 | 13 | 64 | 50 | 6 | 10 | 7 | 7 | 14 | 3 | 15 | 11 | 1 |
| L04 | 8-14 | 15-17 | 1 | 8 | 45 | 20 | 3 | 7 | 3 | 3 | 8 | 0 | 14 | 7 | 0 |
| L05 | 7-13 | 14-19 | 1 | 7 | 73 | 18 | 4 | 9 | 6 | 6 | 9 | 2 | 2 | 8 | 0 |
| L06 | 10-17 | 18-21 | 1 | 10 | 26 | 35 | 3 | 8 | 10 | 10 | 17 | 11 | 4 | 8 | 0 |
| L07 | 11-18 | 19-20 | 1 | 7 | 25 | 57 | 3 | 7 | 6 | 6 | 36 | 8 | 10 | 8 | 0 |
| L08 | 10-17 | 18-28 | 1 | 7 | 51 | 29 | 5 | 14 | 11 | 11 | 17 | 7 | 5 | 6 | 0 |
| L09 | 13-23 | 24-34 | 1 | 14 | 89 | 41 | 6 | 9 | 5 | 5 | 15 | 1 | 13 | 11 | 1 |
| L10 | 12-19 | 20-26 | 1 | 9 | 55 | 21 | 4 | 9 | 9 | 9 | 7 | 5 | 2 | 9 | 0 |
| L11 | 12-23 | 24-28 | 1 | 7 | 89 | 42 | 6 | 14 | 14 | 14 | 40 | 7 | 15 | 12 | 0 |
| L12 | 10-18 | 19-24 | 1 | 8 | 103 | 23 | 5 | 12 | 13 | 13 | 26 | 7 | 4 | 9 | 0 |
| L13 | 17-29 | 30-37 | 1 | 13 | 33 | 47 | 7 | 13 | 10 | 10 | 5 | 13 | 8 | 14 | 0 |
| L14 | 13-30 | 31-47 | 1 | 18 | 187 | 49 | 11 | 18 | 9 | 9 | 27 | 6 | 43 | 18 | 3 |
| L15 | 10-21 | 22-30 | 1 | 11 | 134 | 30 | 6 | 13 | 8 | 8 | 4 | 3 | 9 | 12 | 0 |
| L16 | 12-20 | 21-30 | 1 | 8 | 67 | 30 | 3 | 9 | 5 | 5 | 13 | 2 | 5 | 10 | 0 |
| L17 | 13-30 | 31-34 | 1 | 7 | 92 | 53 | 5 | 11 | 10 | 10 | 37 | 11 | 27 | 16 | 0 |
| L18 | 11-25 | 26-39 | 1 | 11 | 184 | 30 | 6 | 12 | 8 | 8 | 29 | 1 | 32 | 16 | 1 |
| L19 | 9-20 | 21-28 | 1 | 9 | 113 | 34 | 5 | 12 | 10 | 10 | 38 | 5 | 6 | 13 | 0 |
| L20 | 32-48 | 49-69 | 1 | 20 | 182 | 46 | 9 | 18 | 7 | 7 | 19 | 5 | 40 | 17 | 3 |
| L21 | 23-27 | 28-30 | 1 | 11 | 25 | 3 | 4 | 8 | 3 | 3 | 2 | 5 | 6 | 5 | 0 |
| L22 | 26-35 | 36-40 | 1 | 12 | 45 | 44 | 6 | 12 | 12 | 12 | 18 | 11 | 3 | 11 | 0 |
| L23 | 26-33 | 34-39 | 1 | 11 | 52 | 35 | 4 | 11 | 9 | 9 | 14 | 7 | 9 | 9 | 1 |
| T1 | 13-27 | 28-33 | 1 | 10 | 102 | 93 | 4 | 9 | 19 | 19 | 19 | 10 | 37 | 15 | 1 |
| T2 | 11-20 | 21-23 | 1 | 8 | 61 | 53 | 4 | 8 | 9 | 9 | 1 | 22 | 4 | 9 | 1 |
| T3 | 11-26 | 27-41 | 1 | 10 | 166 | 51 | 8 | 11 | 6 | 6 | 11 | 7 | 22 | 16 | 1 |
| **Total** | | | 26 | 272 | 2292 | 989 | 137 | 285 | 221 | 221 | 458 | 168 | 381 | 294 | 16 |

"Company items" excludes the HSCN item. "UFN(EST …)", "UFN" and "SCHEDULE:" count NOTAM Briefing items only (Company NOTAMs separately in §A.7). "Items cut by a page" counts Company and NOTAM items whose lines run across a page footer and the next running header.

### A.3 Running header and footer (every briefing page)

| Line | Form | Count |
|---|---|---|
| Running header (top, full width) | `<CALLSIGN> / <ORIG> - <DEST> / YYYY-MM-DD / <REG> YYYY-Mon-DD HH:MM` (the last time is the package build time, left and right parts are separate items) | 541 pages, 26/26 |
| Running header, VA page | `<CALLSIGN>/<ORIG>-<DEST>/YYYY-MM-DD/<REG> YYYY-Mon-DD HH:MM` (no spaces) | 26 pages |
| Footer (bottom, full width) | `Page n of N <uuid>` (uuid lower case, the same in every document of a package) | 541 pages |
| Footer, VA page | `Page1of1 <uuid>` | 26 pages |

The callsign in the running header is the briefing callsign, which can differ from the release (L22: release and FPL carry the CMB number, the briefing pages the GTI number; field map row 1). A header stripper must therefore match the **shape**, not the release flight number or registration.

**Headers cut into items.** Because both columns flow onto the next page, the footer of page *n* and the running header of page *n + 1* sit **inside** any item that crosses the page: 294 items in 26/26 packages (236 NOTAM items, 58 Company NOTAM items). In addition, 263 items continue from the bottom of the left column to the top of the right column on the same page (212 NOTAM, 51 Company). In the app's raw text (`processPDF()` line assembly) the second kind is worse: 9,132 of 37,024 briefing text lines (25 %, in 26/26 packages) hold **one line from each column joined by three spaces** (example in §A.10), so a left-column item and a right-column item are interleaved line by line. **The raw text cannot be segmented into items without the x positions.** Parser step 5d must read the briefing from positions (split at the page middle), or the app's line assembly must change for these pages (that is a `processPDF()` change, outside this report).

Example, an item crossing a page (L18, Company NOTAM, in reading order):

```
SUBJECT: RJAA-CURFEW
****************************************************************
NRT CURFEW:
Page 1 of 15 <uuid>
<CALLSIGN> / KORD - RJAA / 2026-11-03 / <REG> 2026-Nov-03 HH:MM
B747-400/F CURFEW = 1400-2100Z DAILY
<five registrations> CURFEW = 1500-2100Z DAILY
B767, B777, B748 CURFEW = 1500-2100Z DAILY
****************************************************************
```

### A.4 Airport blocks (NOTAM Briefing and Weather Briefing)

Every airport block opens with the same two lines, a table of three cells:

```
<IATA> - <NAME>        <ROLE> DD HH:MM - DD HH:MM          (indent 87–89)
APT<ICAO> RWYS: <rwy pairs>   <ROLE> DD HH:MM - DD HH:MM    (indent 10–12)
[<rwy pairs continued>]  [<ROLE> DD HH:MM - DD HH:MM]        (indent 87–89 / role cell)
```

| Element | Form and rules | Count (26 packages) |
|---|---|---|
| Blocks | 137 in the NOTAM Briefing, 285 in the Weather Briefing (422) | 26/26 |
| Name cell | `<IATA> - <NAME>`. The name is **clipped** at the cell width by FlightKeys itself (e.g. `ANCHORAGE/TED STEVENS ANCHORAG`) and can run into the role cell with **no space**: `…ANCHORAGDEPARTURE`, `…AT PEASEdest2AltnPlanned`, `…ELMENDORF AFBdest2AltnPlanned`. The role must be matched from the known role list anchored to the window at the end of the line, never split on spaces. | glued role in 25 blocks |
| No IATA code | `- POWIDZ   DEPARTURE …` (L22 EPPW, NOTAM and WX), `- SAPPORO/CHITOSE   IA …` (L16 RJCJ, WX) | 3 blocks, 2 packages |
| `APT` line | `APT` is glued to the ICAO code in 422/422. `RWYS:` follows after one space (420) or is glued (`APTNWWWRWYS: 11/29`, L21). In 1 block the page break falls between `APTRJTT` and the runways (L02, WX). Runway pairs wrap onto the next line(s) at indent 87–89 (24 blocks, 12 packages); a wrapped runway line can carry a role window at its right (`03R/21L   TA 27 02:00 - 27 04:44`, T1). | 422 |
| Role cell | Right-aligned; the window `DD HH:MM - DD HH:MM` is day-of-month and UTC time, no month or year. Roles: `DEPARTURE`, `DESTINATION`, `ALTN 1`, `ALTN`, `IA`, `TA`, `EA`, `dest2`, `dest2Altn`, `dest2AltnPlanned` (lower case as printed). | see below |
| Roles per block | NOTAM: 1 role in 53 blocks, 2 in 76, 3 in 8. WX: 1 in 200, 2 in 77, 3 in 8. The same airport can carry the same role twice with different windows (4 blocks, 2 packages). | |

Role counts (blocks carrying the role; packages):

| Role | NOTAM Briefing | Weather Briefing | Meaning (Company NOTAM "WX/NOTAMs in Briefing Acronyms", 23 live packages; Exec SME-1) |
|---|---|---|---|
| `DEPARTURE` | 26 (26) | 26 (26) | origin |
| `DESTINATION` | 26 (26) | 26 (26) | destination |
| `ALTN 1` | 26 (26) | 26 (26) | first destination alternate (the OFP p1 alternate) |
| `ALTN` | **0** | 101 (26) | further alternates: **weather only, never a NOTAM block** |
| `IA` | 83 (26) | 122 (26) | Intermediate (adequate) airport |
| `TA` | 27 (15) | 27 (15) | Terrain alternate |
| `EA` | 21 (10) | 21 (10) | En-route (ETOPS/ETP) alternate |
| `dest2` | 10 (10) | 10 (10) | Reclear (redispatch) airport |
| `dest2AltnPlanned` | 10 (10) | 10 (10) | Reclear alternate as planned |
| `dest2Altn` | **0** | 9 (9) | Reclear alternate candidates: **weather only** |

**How alternates appear.** The first destination alternate (`ALTN 1`) and the planned reclear alternate (`dest2AltnPlanned`) have a block in **both** briefings in 26/26 and 10/10. Every other alternate — 101 `ALTN` blocks in 26/26 packages and 9 `dest2Altn` blocks — appears **only in the Weather Briefing**; FlightKeys prints **no NOTAMs** for them. IA airports: 122 WX blocks against 83 NOTAM blocks, so some IA airports also have weather only. Block order in both briefings: `DEPARTURE`, `DESTINATION`, `ALTN 1`, the WX-only `ALTN` blocks, then the IA/TA/EA airports (not in route order), then `dest2` / `dest2AltnPlanned` / `dest2Altn`. An airport appears once per briefing (no repeated ICAO in any of the 52 briefings); all its roles are listed in its own block (`ORD … DEPARTURE` + `IA` window).

### A.5 NOTAM item header grammar

Every NOTAM item (airport, FIR and Company) starts with a two-row table:

```
<LOCATIONS> <ID>   <START> - <END>            (row 1: left cell, right cell)
CREATED:<YYYY-Mon-DD HH:MM>   FL: <LOWER> - <UPPER>   (row 2)
[SCHEDULE:<text>]
[SUBJECT: <key>]                              (Company NOTAMs only)
<body lines>
```

| Field | ICAO equivalent | FlightKeys form | Count (items; packages) |
|---|---|---|---|
| Locations | A) | 0–7 location codes before the ID. `IIII` 1,871 (26); `IIII AAA` 807 (18); `AAA IIII` 474 (15; the IATA code **before** the ICAO code, e.g. `ANC PANC A6529/26`, US airports); `IIII AAA AAA` 32 (8; `PAZA ZAP ZAN A0173/26`); `IIII IIII` 51 (15); `IIII IIII IIII` 33 (11; `CZEG CZVR F6077/26`); 7 × `IIII` 11 (5). Company general items carry none (186). | 3,281 NOTAM items |
| ID | (series/number/year) | `<series><nnnn>/<yy>`; series letters A–Z seen (A 1,853; M 291; J 170; G 138; B/C 79; E/Z 70; L 48; …). **No series letter** in 2 (FAA local `BOS KBOS 0491/26`, L12 and L22). Company NOTAMs: `A`, `P` (and `M`, `J`, `F`, `L` for airport company items). The NOTAM ID is the identifier (D43); a location prefix is not part of it. | |
| Start | B) | `YYYY-Mon-DD HH:MM` (UTC) in 100 % of items with a header date | 3,279 |
| End | C) | `YYYY-Mon-DD HH:MM` 2,653 (26) · `UFN(EST YYYY-Mon-DD HH:MM)` 458 (26) · `UFN` 168 (25) · **`PERM` 0** | |
| Created | (issue time) | `CREATED:YYYY-Mon-DD HH:MM` (no space after the colon) | 3,573 / 3,573 incl. Company |
| Levels | F) / G) | `FL: SFC - UNL` 3,202 · `FL: SFC - nnn` 224 · `FL: nnn - UNL` 31 · `FL: nnn - nnn` 116. Values are flight levels in hundreds of feet (`FL: 580 - UNL`), one oddity `FL: SFC - 4` (L22). | 26/26 |
| Schedule | D) | `SCHEDULE:<text>` (no space after the colon), line 3 of the item | 381 items (26) |
| Text | E) | body lines, indent 0–2, ≤ 79 characters per line | |
| Remark | — | `RMK …` / `RMK: …` lines inside the body | 274 lines (15) |

`EST` and `PERM` in this layout:

- `UFN(EST …)` is the only estimated form in the header; the date inside it is the **estimated end** (CLAUDE.md rule 1: `EST` is not a time zone). An `EST` inside the body text occurs in 5 items.
- **`PERM` never appears as an end value** in 3,281 items. The word appears only in body text (24 items, 12 packages), as in `TRIGGER NOTAM - PERM AIRAC AIP AMDT 10/26 WEF 1600 UTC 28 OCT 2026`, whose header end is a date. **Correction to field map v1.1 row 44**, which listed `PERM` in 8 packages as a header form.
- `UFN` (no estimate) 168 items: the end is unknown; with D27 such an item must be shown.

Schedule forms (382 items; the most frequent shapes): `hhmm-hhmm` 82 · `DAILY hhmm-hhmm` 53 · `MON-FRI hhmm-hhmm` 26 · day lists `dd dd-dd …` (e.g. `03-07 10-14 17-21`) ~100 · month-prefixed `NOV dd-dd dd-dd …` / `OCT dd hhmm-hhmm, NOV …` ~45 · weekday lists `TUE hhmm-hhmm, WED …` · `hhmm/hhmm` 10 · `SR-SS`, `Daily:SR-hhmm~DLY`, `H24`, `EVERY MON TUE WED`, `hhmm-hhmm EXC FRI SAT`. In 2 items the `SCHEDULE:` text is a route note (`…ENTER TAIPEI FIR VIA`), i.e. FlightKeys printed body text in the D) cell. A schedule can wrap onto the next line.

**Header row desync (wrapped location cell).** When the location list is longer than 3 codes, the left cell wraps (3 codes per line) and the two cells no longer share lines. 13 items in 7 packages (L03, L06, L13, L16, L17, L23, T3: Chinese and French FIR lists). The 7-code form (L17, OMAA-VHHH):

```
ZBPE ZGZU ZHWH   2026-Oct-28 16:00 - 2026-Nov-11 15:59
ZJSA ZLHW ZPKM A4854/26   FL: SFC - UNL
ZSHA
CREATED:2026-Sep-21 07:47
TRIGGER NOTAM
```

and a 5-code form where the ID stands alone (L23, L06):

```
LFBB LFEE LFMM   2025-Nov-19 09:49 - UFN
F1665/25
LFRR LFFF    FL: 195 - UNL
CREATED:2025-Nov-19 09:49
```

Here the dates sit on the line **above** the ID and `CREATED:` loses its `FL:` partner. A line-based header pattern misses all 13; a reader must take the location cell, ID, dates, `FL:` and `CREATED:` by position.

Structure examples (NOTAM text as printed):

```
KMIA MIA A3211/26   2026-Oct-25 12:59 - 2026-Nov-06 20:00
CREATED:2026-Oct-25 13:01   FL: SFC - UNL
RWY 30 RTHL U/S
```
```
KMIA MIA A1446/26   2026-Apr-14 18:33 - UFN(EST 2026-Dec-26 18:33)
CREATED:2026-Apr-14 18:38   FL: SFC - UNL
```
```
CZWG G3940/26   2026-Nov-02 17:32 - 2026-Nov-14 23:59
CREATED:2026-Nov-02 17:38   FL: 60 - 300
SCHEDULE:MON-FRI 1430-2359
ADVISORY AREA CYA311(M) MOOSE JAW ACT.
```

**ASHTAM.** One package (L15) prints 4 ASHTAMs under FIR `WAAF`/`WIIF` with a one-line header and the ICAO lettered fields kept as separate lines: `WAAF ASHTAM 0677 2026-Nov-03 13:10 - 2026-Nov-04 13:10`, `VAWA0677 WAAF 11031310`, `ASHTAM 0677`, `A)WAAF`, `B)2611031310`, `C)DUKONO 608-01`, `D)…`, `E)ORANGE ALERT`, `F)SFC/FL080 …`, `G)MOV NW 05KT`, `H)NIL`, `I)NIL`, `J)…`. No `CREATED:` line. These are the only `A)`–`J)` lines in the 26 packages; ordinary NOTAMs never print the ICAO letters.

**Multi-part NOTAMs.** `END PART n OF m` inside the body: 6 items, 5 packages (KMIA ODP in L01: part 1 and part 2 are separate items with separate IDs).

**Repeated IDs.** Inside one package the same `<locations> <ID>` occurs more than once in the prototypes (T1/T2) and 0–2 times in the live packages (field map row 44); the duplicates are the same NOTAM printed under two airports or FIRs. D43: never merged by text; the ID decides.

### A.6 Category headings (NOTAM Briefing)

Centred headings (indent ≥ 100) inside an airport or FIR block. Each heading appears at most once per block; items under it until the next heading or block.

| Heading | Blocks (packages) | Heading | Blocks (packages) |
|---|---|---|---|
| `RUNWAY` | 97 (26) | `GENERAL` | 78 (20) |
| `TAXIWAY` | 92 (26) | `RAMP` | 69 (24) |
| `APPROACH AND LANDING` | 98 (26) | `DEPARTURE PROCEDURES` | 32 (21) |
| `AIRPORT` | 59 (23) | `ARRIVAL PROCEDURES` | 17 (12) |
| `OBSTACLE` | 49 (23) | `FACILITIES` | 14 (11) |
| `NAVIGATION` | 120 (25) | `N/A` | 13 (11) |
| `COMMUNICATION` | 61 (23) | `HAZARD` | 11 (10) |
| `AIRSPACE` | 127 (26) | `SERVICE` | 7 (6) |
| `WARNING` | 78 (24) | | |

`GENERAL` is also the heading of the general Company NOTAMs (26/26). The same category set (`RUNWAY`, `TAXIWAY`, `APPROACH AND LANDING`, `DEPARTURE PROCEDURES`, `ARRIVAL PROCEDURES`, `RAMP`, `OBSTACLE`, `AIRPORT`, `NAVIGATION`, `N/A`) is used under the per-airport Company NOTAMs in 1–5 packages each. An airport with no NOTAMs prints `THERE ARE NO ACTIVE NOTAMS FOR AIRPORT IIII WITHIN THE GIVEN` / `NIL` / `TIME PERIOD THAT MATCHES THE FILTERING CRITERIA.` (2 blocks: L15 WIHH, L13 RJFT).

### A.7 Company NOTAMs

Layout: heading `COMPANY NOTAMS` (indent 144), sub-heading `GENERAL`, general items (no location), then items per airport (`IIII X####/YY …`). A line `Contact Dispatch for a preflight briefing.` is printed on the HSCN page and on the first Company NOTAM page (52 lines, 26/26); it belongs to no item.

| Element | Form | Count |
|---|---|---|
| Item | header as §A.5; the ID sits at indent 75–77 when there is no location (the ID cell is right-aligned) and at 0–2 with a location | 298 incl. HSCN |
| End | `UFN` 294 · date 4 | 26/26 |
| `SUBJECT:` | `SUBJECT: <key>` on line 3 (no `SCHEDULE:`), 298/298 | 26/26 |
| Airport key | `SUBJECT: IIII-<TOPIC>`, topic up to 9 characters, cut by the cell: `CURFEW` 16 (10 pkgs), `ETOPS` 20 (7), `C067` 7, `ARFF` 7, `SE CARGO` 5, `RWYS` 5, `SLOTS` 4, `NEWPARK5Y` 4, `FREQ` 4, `OFCALBIZ` 3, `FUEL` 3, `NONTWR`, `GUARD`, `ANCLANDIN`, `RWY 30`, `TANKER`, `TAFCOVERA`, `T SID DEP`, `RWY CLSD`, `RAMP CLSR`, `PREF ALT`, `FOLLOWME`, `FLTOPS`, `FLIGHTOPS`, `ALT`, `ETDALTN`, `APU`, `AMM`, … (1–2 each) | |
| Aircraft key | `<tail>-WB` 22 (21), `<tail>-767DIFF`, `<tail>-PAXSEATS`, `<tail>-SABLEA1`, `<tail>-ADF`, `<tail>-UDOOR`, `<REG> <topic>` | |
| General key | `FlightKeys OFP` 26 (+26 in HSCN), `ADMIN-DEICE` 26, `WX/NOTAMs in Briefing Acronyms` 23 (live only), `IIII- 747 Altas` 16, `B747-FMDW400` 12, `PUBS 767` / `Pubs- 777` / `Pubs- 747 Polar`, `ADMIN-LATT<tail>`, `Chart Alert IIII D MON YY`, `IIII B777 DESCENT/ARRIVAL FUEL` | |

**CURFEW.** 16 items with `SUBJECT: IIII-CURFEW` in 10 packages (T1, T2, T3, L02, L03, L09, L14, L18, L20, L23). The key is the only reliable marker; the item text varies (field map row 46: `<type> CURFEW = HHMM-HHMMZ DAILY`, `RESTRICTED FROM HHMMZ-HHMMZ DAILY PER AFD.`, `IIII/AAA CURFEW: HHMM-HHMMZ DAILY`, `QUIET HOURS ENFORCED HHMM-HHMMZ`, `SUMMER:` / `WINTER:` + `MONDAY-SATURDAY …` / `SUNDAY & GERMAN HOLIDAYS …`). Curfew items cross a page in 2 of the 16 (L18 RJAA, example in §A.3; L02 RKSS), and the ETAR item (L23) is interleaved with a right-column item in the raw text.

Example (general, L01):

```
A0929/26   2026-Nov-03 00:00 - UFN
CREATED:2026-Nov-03 00:14   FL: SFC - UNL
SUBJECT: WX/NOTAMs in Briefing Acronyms
**WX/NOTAMs in Briefing Acronyms**
EA = Enroute Alternate (ETOPS/ETP Alternate)
IA = Intermediate Alternate (Adequate Airport)
…
```

Example (airport, L01):

```
MKJP A0586/26   2026-Aug-27 00:00 - UFN
CREATED:2026-Aug-27 18:59   FL: SFC - UNL
SUBJECT: MKJP-TANKER
**************************************************************
MKJP DISPATCH TANKERING INSTRUCTIONS
ECON TANKER FUEL FOR MIN UPLIFT IN KIN WITHOUT
IMPACTING REQUESTED PAYLOAD
**************************************************************
```

### A.8 FIR / en-route blocks

After the last airport block, in route order, the NOTAM Briefing prints one block per FIR (221 blocks, 26/26), and the Hazard Briefing repeats the same FIR list (221 blocks) with SIGMETs:

```
<NAME> FIR|UIR|FIR/UIR|ARTCC HIGH|ARTCC LOW   (indent 87–89)
FIR<ICAO>                                      (indent 10–12; "FIR" glued to the code)
<category heading> / items                      (NOTAM Briefing)
SIGMET / reports                                (Hazard Briefing)
```

| Element | Form | Count |
|---|---|---|
| Name line | `… FIR` 145 (25), `… ARTCC HIGH` 31 (12), `… ARTCC LOW` 14 (13), `… UIR` 14 (9), `… FIR/UIR` 13 (7), `… FIR 2` 2, `… FIR/HELLAS UIR` 1, `… ARTCC` 1 | 221 |
| Code line | `FIR<ICAO>` | 221 |
| No NOTAMs | `THERE ARE NO ACTIVE NOTAMS FOR FIR IIII WITHIN THE GIVEN TIME` + `NIL` + `PERIOD THAT MATCHES THE FILTERING CRITERIA.` | 43 |
| No SIGMET | `THERE ARE NO ACTIVE SIGMET FOR FIR WITHIN THE GIVEN TIME` (no code) | 66 |

FIR items use the §A.5 header with one or more FIR codes (`CZEG CZVR F6077/26`). PACOTS track messages are printed as FIR NOTAM items (10 packages; field map row 49). There is **no separate route / airway / waypoint section**: every en-route NOTAM sits under a FIR block, so the NavBlue split into route/fir/airway/waypoint/geographic has only `fir` here.

Example (L14):

```
EDMONTON FIR
FIRCZEG
                    NAVIGATION
CZEG CZVR F6077/26   2026-Nov-02 08:00 - 2026-Nov-07 13:00
CREATED:2026-Oct-30 12:54   FL: SFC - UNL
SCHEDULE:DAILY 0800-1300
DUE TO EQPT TESTING, GNSS SIGNAL MAY BE PERIODICALLY INTERRUPTED
WITHIN 440NM RADIUS CENTRE 5425N 11016W (COLD LAKE/GROUP CAPTAIN
R.W. MCNAIR AD (CYOD)) IN NORTHERN ALBERTA AND SASKATCHEWAN.
FLT CREWS TO INFORM ATC OF ANY ADVERSE IMPACT.
```

### A.9 Weather Briefing and Hazard Briefing

Airport blocks as §A.4 (285 blocks). Each has three sub-headings, always in this order and always present (285 each, 26/26): `TAF`, `METAR`, `ATIS` (centred, indent ≥ 175).

| Sub-block | Report start (indent 0–2) | Count | Continuation |
|---|---|---|---|
| `TAF` | `TAF IIII DDHHMMZ DDHH/DDHH …` 237 · `TAF AMD` 37 (14) · `TAF COR` 5 (5) · `* PRIO * TAF` 3 (3: L15 PWAK, L20 CYXY, L22 EPPW; E-WINS, field map row 48) | 282 reports | change groups on their own line at indent 14–26 (`FM…`, `TEMPO`, `BECMG`, `PROB30`); some TAFs are **wrapped at the column width** at indent 43–45 instead, with groups split across lines (42 lines end in a bare `TEMPO` / `BECMG` / `PROBnn` whose time is on the next line; e.g. RJCC, RJAA in L02) |
| `METAR` | `METAR IIII …` 1,312 · `METAR SPECI IIII …` 83 (17) · `METAR COR` 3 (2); newest first, normally 5 per airport | 1,398 | indent 19–26 (`RMK …`, wrapped text) |
| `ATIS` | `AD AAA /OS <text>` | 38 (17) | indent 7 |
| Empty | `THERE ARE NO ACTIVE ATIS|METAR|TAF FOR AIRPORT IIII WITHIN THE GIVEN TIME` + `NIL` + `PERIOD.` | ATIS 247, METAR 5, TAF 6 | — |

Hazard Briefing: FIR blocks (§A.8) with sub-heading `SIGMET` (221) and reports `TWC FPG - TURB` 884 (25), `TWC FPG - CONV` 403 (23), `TWC FPG - ICING` 20, `TWC SIGMET - TURB|CONV` 30, `AIRMET SIERRA|TANGO|ZULU|ICE|IFR|MTN|TURB|STG` 638 (US FIRs), `SIGMET` 3, `CONVECTIVE SIGMET` 2. These are en-route hazard products; none of them is airport weather or E-WINS (field map row 48, negative requirement).

Examples (L14 ORD, L22 EPPW, L14 RKSI):

```
                 TAF
TAF KORD 031736Z 0318/0424 19017G29KT P6SM VCSH SCT025 BKN070 OVC250
                     FM032300 17014G24KT 6SM -SHRA SCT025 OVC050
                     FM040700 18013G22KT 5SM -SHRA BR SCT015 OVC025
                 METAR
METAR KORD 031751Z 19015G25KT 9SM -RA SCT023 BKN070 OVC090 20/16 A2986
                     RMK AO2 PK WND 18031/1657 RAB47 SLP109 P0000 60000 T02000161
```
```
* PRIO * TAF EPPW 101209Z 1013/1113 VRB03KT 5000 -SN BR OVC005
                FM101500 31005KT 0800 FG OVC003
```
```
                 ATIS
        THERE ARE NO ACTIVE ATIS FOR AIRPORT RKSI WITHIN THE GIVEN TIME
NIL
        PERIOD.
```

### A.10 Where line breaks and indentation carry meaning (input for D54)

| # | Where | What the break / indent means | Evidence |
|---|---|---|---|
| 1 | Column split | Left and right columns are separate text streams. In raw text they are joined line by line with three spaces, e.g. `CREATED:2026-Aug-21 14:05   FL: SFC - UNL` is one item, but `SUBJECT: ADMIN-DEICE   KIN - KINGSTON/NORMAN MANLEY INTL DEPARTURE 03 20:40 - 03 21:55` is a Company NOTAM line **plus** an airport header from the other column. | 9,132 joined lines, 26/26 |
| 2 | Header table | Row 1 = locations + ID + dates; row 2 = `CREATED:` + `FL:`. Three spaces separate the cells. With > 3 locations the rows desync (§A.5). | 13 items, 7 pkgs |
| 3 | ID indent | ID at indent 75–77 = Company item with no location; at 0–2 = item with a location. | 186 / 112 |
| 4 | NOTAM body | Body lines are flush left (indent 0–2; 17,000+ lines; only 12 at 87–89, wraps of centred text). There is **no hanging indent**: the next item is recognised by its header, not by indentation. | |
| 5 | NOTAM body line breaks | FlightKeys keeps the **originator's line breaks** (E-field lines) and wraps only lines longer than the column (≤ 79 characters). In 1,275 of 3,281 NOTAM items (39 %) at least one line ends early although the next word would fit, e.g. `MIA IAP MIAMI INTL, MIAMI, FL.` / `RNAV (GPS) Y RWY 26L, AMDT 4...` / `LPV DA 266/HAT 257 ALL CATS.`. Numbered lists, procedure names and coordinates lists depend on these breaks. **Preserve the line breaks inside an item** (D54); joining them changes the text. | 5,037 early breaks |
| 6 | Company NOTAM body | Banners (`****…`, `----…`), centred titles and table-like lines (`ACARS...........YES`) depend on line breaks; one item can hold several curfew lines by type and registration, one per line (field map row 46). | 298 items |
| 7 | TAF / METAR | Report start at indent 0–2; continuation indented (TAF groups 14–26, wrapped TAF 43–45, METAR 19–26, ATIS 7). A new report is recognised by the indent **and** the report keyword. A TAF line break is a change-group boundary in US-style TAFs but an arbitrary wrap in others (42 split groups). | §A.9 |
| 8 | Empty-state box | `THERE ARE NO ACTIVE …` is centred (indent ≈ 80) and wraps; `NIL` sits **between** its two lines in reading order. | 367 |
| 9 | Runway list | Continues at indent 87–89 under the name cell; may carry a role window in the role cell. | 24 blocks |
| 10 | Page and column breaks | Footer + running header inside an item (294 items) and left→right column continuation (263 items) are **not** line breaks of the item and must be removed / joined before D54 preservation applies. | §A.3 |

### A.11 Summary for ruleset v1.13.0 and parser step 5d

1. Read the briefing from **positions** (two columns), not from the raw text; strip running header/footer by shape (§A.3).
2. Documents by content: HSCN, Company + NOTAM, Weather + Hazard, VA (§A.2).
3. Airport block = name/role line + `APT<ICAO>` line + optional role/runway lines; role taken from the closed list anchored to the window; name may be clipped and glued (§A.4).
4. `ALTN` (101) and `dest2Altn` (9) airports have **weather but never NOTAMs** in FlightKeys; `ALTN 1` and `dest2AltnPlanned` have both (§A.4).
5. Item header grammar §A.5: locations (0–7, ICAO and IATA in either order), ID with optional series letter, start, end `date | UFN | UFN(EST date)` (no `PERM`), `CREATED:`, `FL:`, optional `SCHEDULE:`, Company `SUBJECT:`; handle the wrapped-location desync (13 items) and ASHTAM (4).
6. Category headings: closed list of 17 (§A.6). FIR blocks: name + `FIR<ICAO>` (§A.8); no route/airway/waypoint split.
7. Curfew is found by `SUBJECT: IIII-CURFEW` (16 items, 10 packages) (§A.7).
8. Preserve in-item line breaks (§A.10 rows 5–6); remove page/column breaks (row 10).

---

## Part B — Today in beta (live risk)

### B.1 Method

| Step | Detail |
|---|---|
| Build | `index.html` on `main` at 15d2252 (`APP_VERSION` 1.9.9-hf6): the NavBlue parser module `ofp-navblue` v2.0.0 inside the app, NOTAM ruleset v1.12.0. FlightKeys packages go through this path today; there is no FlightKeys parser in the app yet. |
| Path | `test/lib/app-path.js` `importFixture()` (stored pdf.js items → the app's own `processPDF()` → `parseOFP()`), then `getAllAirports()` (the airport cards) and `evalAirport(icao, eta, notams, weather, wxWindow, role, acftType)` for every card, exactly as `test/lib/v0-snapshots.js` `appSnapshot()` does. `index.html` unmodified; harness clock fixed. |
| Packages | The 23 live packages (L01–L23). The prototypes are left out (not live). |
| Truth | From the redacted text of the first release copy: `BLOCK` / `MINF` (OFP p1), crew roster lines `CA|FO|MX|LM|DH|FA|PU|JS <number>`, CAT lines `IIII CAT II|III|II/III - …`, `EXEMPTION NO` + `ALTERNATE AIRPORT REQUIRED` (across a line break), `WHEELS UP NOT BEFORE HHMMZ`, `ETOPS Entry HH.MM`; briefing blocks and items from Part A. Forms as in field map v1.1 rows 9, 10, 24, 26, 29, 30, 39, 41, 43–46. |
| Card display | `evalAirport()` returns `color: 'unknown'` when a card has neither NOTAM nor weather text; the card badge then reads **NO DATA** (grey) — `src/airports.html`, `sl = {…, unknown:'NO DATA'}`. The crew sees an empty card with a grey badge, not a green one. |

### B.2 Airport cards

| Pkg | Cards | Beta cards (role ICAO) | NOTAM items in the package for these airports | Card airports with a WX block in the package | Cards with no NOTAMs (beta) | Cards with no weather (beta) |
|---|---|---|---|---|---|---|
| L01 | 3 | ORIG MKJP, DEST KMIA, DEST ALT KRSW | 58 | 3 | 3 | 3 |
| L02 | 5 | ORIG KORD, DEST RKSI, DEST ALT RKSS, EN ROUTE ALT RJTT, EN ROUTE ALT RJAA | 128 | 5 | 5 | 5 |
| L03 | 5 | ORIG PANC, DEST ZHEC, DEST ALT ZHCC, CFS ALT PACD, CFS ALT RJCC | 45 | 5 | 5 | 5 |
| L04 | 3 | ORIG RCTP, DEST RJGG, DEST ALT RJBB | 45 | 3 | 3 | 3 |
| L05 | 3 | ORIG KCVG, DEST KSEA, DEST ALT KBFI | 65 | 3 | 3 | 3 |
| L06 | 3 | ORIG LEZG, DEST LLBG, DEST ALT OJAI | 26 | 3 | 3 | 3 |
| L07 | 3 | ORIG LLBG, DEST OMDW, DEST ALT OMAA | 25 | 3 | 3 | 3 |
| L08 | 5 | ORIG KMIA, DEST EHBK, DEST ALT EBLG, EN ROUTE ALT CYYR, EN ROUTE ALT CYQX | 51 | 5 | 5 | 5 |
| L09 | 3 | ORIG VHHH, DEST PANC, DEST ALT PAED | 69 | 3 | 3 | 3 |
| L10 | 3 | ORIG KMIA, DEST SBGL, DEST ALT SBGR | 48 | 3 | 3 | 3 |
| L11 | 5 | ORIG KGSP, DEST EPWA, DEST ALT EPLB, EN ROUTE ALT EDDL, EN ROUTE ALT EDDK | 88 | 5 | 5 | 5 |
| L12 | 5 | ORIG EBLG, DEST KORD, DEST ALT KIND, EN ROUTE ALT KPSM, EN ROUTE ALT KBOS | 103 | 5 | 5 | 5 |
| L13 | 5 | ORIG UBBB, DEST RJFK, DEST ALT RJFT, EN ROUTE ALT ZSNB, EN ROUTE ALT ZSHC | 18 | 5 | 5 | 5 |
| L14 | 5 | ORIG KORD, DEST RKSI, DEST ALT RKSS, EN ROUTE ALT RJTT, EN ROUTE ALT RJAA | 140 | 5 | 5 | 5 |
| L15 | 6 | ORIG PHNL, DEST WIHH, DEST ALT WIII, CFS ALT PHLI, CFS ALT PWAK, CFS ALT PGUA | 134 | 6 | 6 | 6 |
| L16 | 3 | ORIG ZHEC, DEST PANC, DEST ALT PAED | 67 | 3 | 3 | 3 |
| L17 | 3 | ORIG OMAA, DEST VHHH, DEST ALT ZGSZ | 52 | 3 | 3 | 3 |
| L18 | 5 | ORIG KORD, DEST RJAA, DEST ALT RJTT, EN ROUTE ALT PAED, EN ROUTE ALT PANC | 177 | 5 | 5 | 5 |
| L19 | 5 | ORIG PANC, DEST KMIA, DEST ALT KRSW, EN ROUTE ALT KHSV, EN ROUTE ALT KATL | 113 | 5 | 5 | 5 |
| L20 | 7 | ORIG KORD, DEST RKSI, DEST ALT RKSS, EN ROUTE ALT RJTY, EN ROUTE ALT RJTT, CFS ALT PASY, CFS ALT RJCC | 152 | 7 | 7 | 7 |
| L21 | 4 | ORIG NZWN, DEST NFFN, DEST ALT NFTF, CFS ALT NZAA | 25 | 4 | 4 | 4 |
| L22 | 5 | DEST KPSM, DEST ALT KBOS, CFS ALT EINN, CFS ALT BIKF, CFS ALT CYYR | 40 | 5 | 5 | 5 |
| L23 | 3 | ORIG KDOV, DEST ETAR, DEST ALT EDDK | 49 | 3 | 3 | 3 |
| **Total** | **97** | | **1,718** | **97** | **97** | **97** |

- **Every card of every live package is empty: 97/97 cards show no NOTAMs and no weather, badge NO DATA, in 23/23 packages.** The packages hold a NOTAM block for all 97 card airports (95 with at least one item, 1,718 items; L15 WIHH and L13 RJFT print "no active NOTAMs") and a weather block for all 97. `airportData` has the 97 airports with `notams: ''`, `weather: ''`. Cause: the NavBlue NOTAM/weather sections do not exist in FlightKeys (Part A; field map rows 43–45). This matches `test/known-gaps.json` (V0 gaps) for the packages it lists.
- **En-route NOTAMs:** the packages hold 792 FIR NOTAM items; beta's `enrouteNotams` is empty (all five groups) in 23/23.
- `EN ROUTE ALT` on the `RAPT`/`RALT` airports (9 redispatch packages) is the NavBlue mapping (`ofp-navblue` v2.0.0, `RALT`/`RAPT` → `EN ROUTE ALT`), not a FlightKeys error.

### B.3 Alternates and release airports without a card

| What | Count | Packages | Detail |
|---|---|---|---|
| Release airport without a card | 1 | L22 | The origin EPPW has no IATA code (`EPPW/ POWIDZ`), so `origIcao` is empty and there is no ORIG card (field map row 5). |
| Release alternates (`PALT`, `RAPT`, `RALT`) without a card | 0 | — | 23 `PALT`, 9 `RAPT`, 9 `RALT`: all have a card. |
| ETOPS / ETP / critical-fuel alternates named in the release, without a card | **6** | **4** | L14 RJCC, PAKN, PASY (777 ETOPS; `ETP1`/`ETP2` read, but no `CFS ALT` card; field map row 41, cause not diagnosed); L09 PASY and L11 BIKF (747 `2EO` scenario with `E.ENT`/`E.EXIT IIII`); L23 LPLA (767 `E.ENT`/`E.EXIT`-only scenario). Each is an `EA` airport in both briefings. |
| `CFS ALT` cards without a weather window | 13 cards | 5 (L03, L15, L20, L21, L22) | `wxWindow: null` on every CFS card (FlightKeys prints `HH:MM-HH:MM` without `Z`; field map row 41). With no weather text the card is NO DATA anyway; once weather is read, the window is needed for the evaluation time. |
| Briefing alternates with weather only (`ALTN`, `dest2Altn`) and no card | 99 | 23 | Further alternates FlightKeys prints in the Weather Briefing only (Part A §A.4). Not release alternates; listed for the Exec, not counted as a beta defect. |

### B.4 Safety-Critical fields (CLAUDE.md rule 6) — per field

| Field | Packages carrying it | Beta right | Beta empty | Beta wrong | Notes |
|---|---|---|---|---|---|
| Block fuel | 23 | **23** | 0 | 0 | `blockFuelRaw` equals `BLOCK` (leading zero dropped, same value). |
| Min fuel | 23 | **23** | 0 | 0 | `minfFuelRaw` equals `MINF`. |
| Crew | 23 (142 lines, 72 pilots) | 0 | **23** | 0 | `crewMembers: []` in 23/23 (comma form, field map row 26). |
| CAT II/III | 19 (99 lines) | 0 | **19** | 0 | `catIiIiiApproaches: null`. Negative cases right: `null` in L01, L05 (restriction line only), L15, L19. |
| DOT exemption alternate | 6 | 5 | 0 | **1** | L08: the line wraps before `REQUIRED.`, so `altRequired: false`. Right in L11, L13, L15, L21, L22; `null` correctly in the other 17. |
| Slot time | 1 (L16) | **1** | 0 | 0 | `NOT BEFORE 1627Z`; `null` correctly in the other 22. |
| ETOPS entry | 7 | 0 | **7** | 0 | `etopsEntry: ''` (FlightKeys `HH.MM`); L03, L14, L15, L20, L21, L22, L23. |
| ETOPS exit | 7 | **7** | 0 | 0 | Read from the nav log `(E.EXT)` row. |
| ETOPS/ETP alternate card | 9 live packages with an ETP/critical-fuel scenario | 5 | **4** (6 airports) | 0 | §B.3. |
| Airport NOTAMs | 97 cards (95 with items) | 0 | **97** | 0 | §B.2. |
| Airport weather | 97 cards | 0 | **97** | 0 | §B.2. Includes L15 PWAK, the E-WINS (`* PRIO *`) airport on a CFS card. |
| Airport curfew | 9 card airports with a `IIII-CURFEW` item, 6 packages | 0 | **9** | 0 | L02 RKSS, RJAA · L03 RJCC · L14 RKSS, RJAA · L18 RJAA · L20 RKSS, RJCC · L23 ETAR. No curfew is shown on any card. |

### B.5 Per package — beta-risk count

Count of safety-critical gaps per package (empty or wrong): cards without NOTAMs + cards without weather + release/ETOPS alternates without a card + crew + CAT II/III + DOT + ETOPS entry + curfew airports.

| Pkg | Cards no NOTAM | Cards no WX | Missing card | Crew | CAT II/III | DOT | ETOPS entry | Curfew | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| L01 | 3 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | **7** |
| L02 | 5 | 5 | 0 | 1 | 1 | 0 | 0 | 2 | **14** |
| L03 | 5 | 5 | 0 | 1 | 1 | 0 | 1 | 1 | **14** |
| L04 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L05 | 3 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | **7** |
| L06 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L07 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L08 | 5 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | **13** |
| L09 | 3 | 3 | 1 | 1 | 1 | 0 | 0 | 0 | **9** |
| L10 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L11 | 5 | 5 | 1 | 1 | 1 | 0 | 0 | 0 | **13** |
| L12 | 5 | 5 | 0 | 1 | 1 | 0 | 0 | 0 | **12** |
| L13 | 5 | 5 | 0 | 1 | 1 | 0 | 0 | 0 | **12** |
| L14 | 5 | 5 | 3 | 1 | 1 | 0 | 1 | 2 | **18** |
| L15 | 6 | 6 | 0 | 1 | 0 | 0 | 1 | 0 | **14** |
| L16 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L17 | 3 | 3 | 0 | 1 | 1 | 0 | 0 | 0 | **8** |
| L18 | 5 | 5 | 0 | 1 | 1 | 0 | 0 | 1 | **13** |
| L19 | 5 | 5 | 0 | 1 | 0 | 0 | 0 | 0 | **11** |
| L20 | 7 | 7 | 0 | 1 | 1 | 0 | 1 | 2 | **19** |
| L21 | 4 | 4 | 0 | 1 | 1 | 0 | 1 | 0 | **11** |
| L22 | 5 | 5 | 1 | 1 | 1 | 0 | 1 | 0 | **14** |
| L23 | 3 | 3 | 1 | 1 | 1 | 0 | 1 | 1 | **11** |
| **Total** | **97** | **97** | **7** | **23** | **19** | **1** | **7** | **9** | **260** |

"Missing card" = the L22 origin plus the 6 ETOPS/ETP alternates of §B.3 (L14 counts 3).

### B.6 Beta-risk totals

- **Airport cards:** 97/97 with no NOTAMs and no weather (NO DATA) in 23/23 live packages; 1,718 airport NOTAM items and 97 weather blocks not shown; 792 en-route NOTAM items not shown.
- **Cards missing:** 1 release airport (L22 origin) and 6 ETOPS/ETP alternates in 4 packages; 99 weather-only briefing alternates have no card (not counted).
- **Safety-Critical fields empty:** crew 23/23 · CAT II/III 19/19 · ETOPS entry 7/7 · curfew 9 airports in 6 packages. **Wrong:** DOT exemption `altRequired` 1/6 (L08).
- **Right today:** block fuel 23/23 · min fuel 23/23 · slot time 1/1 (and 22 correct negatives) · ETOPS exit 7/7 · DOT exemption 5/6.
- **Total safety-critical gaps: 260 across 23/23 packages (7–19 per package).** The NO DATA badge makes the empty cards visible to the crew; the empty crew list, CAT II/III, ETOPS entry and curfew fields, and the missing ETOPS alternate cards are silent (nothing tells the crew a value is missing).

---

## Found outside this report's scope (reported, not acted on)

- `tools/redact` still leaves the `JS 0 <NAME>` jump-seat lines (L11 among others), as already reported in field map v1.1 §6. This report quotes none of them.
- Field map v1.1 row 44 lists `PERM` as a NOTAM end form in 8 packages; no NOTAM header in the 26 packages ends in `PERM` (§A.5). The field map is not edited in this PR.
