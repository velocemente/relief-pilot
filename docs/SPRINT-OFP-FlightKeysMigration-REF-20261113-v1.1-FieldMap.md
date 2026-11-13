# SPRINT-OFP-FlightKeysMigration — Field Map Reference

**Version:** v1.1-REF | **Status:** REF | **Date:** 2026-11-13 (Exec answers to the SME questions recorded in §4 the same day)
**Supersedes:** `SPRINT-OFP-FlightKeysMigration-REF-20261029-v1.0-FieldMap.md` (v1.0 stays in `docs/` for history).
**What this file is:** the FlightKeys field map re-done on the **19 live packages** plus the 3 FlightKeys prototypes (fixtures branch `claude/fk-live-19`, fixtures PR #11). It covers every v1.0 row (1–50) and every ADR-005 Appendix B extension, and lists the questions only an SME can settle.
**What it is not:** a parser. Nothing in the app changes. Statuses describe what today's NavBlue parser (`ofp-navblue` v2.0.0, run as `_ofpRulesetParse`) returns on FlightKeys text, i.e. what `ofp-flightkeys` must fix or carry over.

> **Public repository.** All examples below are **structure only**. Crew names, employee numbers, dispatcher names and phone numbers are never shown; where a line holds them it is written with placeholders (`<NAME>`, `<EMPNO>`). The extracted texts were passed through `tools/redact` before analysis. Fixture IDs (route, date, label) are used to say *where* a form was seen; they contain no personal data.

---

## 1. Evidence Base

### 1.1 Packages

22 FlightKeys packages: the 3 prototypes (T1–T3, already in v1.0 or added after it) and the 19 live packages (L01–L19). Labels are used in every table below.

**Sections** are the parts of each PDF as found by content (not by the embedded outline): `HSCN` High Severity Company NOTAMs · `OFP` release (footer `FUFI: <uuid> PAGE n/N`) · `CN+NOTAM` Company NOTAMs then NOTAM Briefing (one document, footer `Page n of N <uuid>`) · `WX+HAZ` Weather Briefing then Hazard Briefing (one document) · `NAT` NAT track message · `VA` Volcanic Ash Advisories · `Jepp` Jeppesen chart alert and airport briefing · `TLR` Takeoff and Landing Report (footer `FUFI<uuid> PAGE n/N`) · `blank` pages with no text (images).

| Label | Fixture | PDF pp | Sections (PDF pages) | Type / unit | RLS |
|---|---|---|---|---|---|
| T1 | `FK_UAAA-EHAM_27OCT26_prototype` | 34 | HSCN 1 · OFP 2–12 · CN+NOTAM 13–27 · WX+HAZ 28–33 · VA 34 | B747-400F / KG | not released |
| T2 | `FK_ZUCK-UAAA_27OCT26_prototype` | 24 | HSCN 1 · OFP 2–10 · CN+NOTAM 11–20 · WX+HAZ 21–23 · VA 24 | B747-400F / KG | not released |
| T3 | `FK_KLAX-RKSI_31OCT26_rda-etp_prototype` | 42 | HSCN 1 · OFP 2–10 · NOTAM 11–26 · WX+HAZ 27–41 · VA 42 | B747-400F / KG | not released |
| L01 | `FK_MKJP-KMIA_03NOV26_caribbean-callsign_live` | 23 | HSCN 1 · OFP 2–7 · CN+NOTAM 8–14 · WX+HAZ 15–18 · VA 19 · TLR 20–23 | B767-300 / LB | 01 |
| L02 | `FK_KORD-RKSI_05NOV26_crew-ballast-rda_live` | 75 | HSCN 1 · OFP 2–11 · OFP 12–21 · OFP 22–31 · CN+NOTAM 32–48 · WX+HAZ 49–68 · VA 69 · TLR 70–75 | B747-400F / KG | 01 (×3 copies) |
| L03 | `FK_PANC-ZHEC_04NOV26_etops-ddg_live` | 43 | HSCN 1 · OFP 2–12 · CN+NOTAM 13–23 · WX+HAZ 24–39 · VA 40 · TLR 41–43 | B777F / KG | 01 |
| L04 | `FK_RCTP-RJGG_03NOV26_lcf-lbs_live` | 21 | HSCN 1 · OFP 2–7 · CN+NOTAM 8–14 · WX+HAZ 15–17 · VA 18 · TLR 19–21 | B747-400LCF / LB | 01 |
| L05 | `FK_KCVG-KSEA_04NOV26_pax-catiii_live` | 24 | HSCN 1 · OFP 2–6 · CN+NOTAM 7–13 · WX+HAZ 14–19 · VA 20 · TLR 21–24 | B747-400 / KG | 01 |
| L06 | `FK_LEZG-LLBG_04NOV26_remarks-subcards_live` | 25 | HSCN 1 · OFP 2–9 · CN+NOTAM 10–17 · WX+HAZ 18–21 · VA 22 · TLR 23–25 | B747-8F / KG | 01 |
| L07 | `FK_LLBG-OMDW_04NOV26_poslaunch-permits_live` | 24 | HSCN 1 · OFP 2–10 · CN+NOTAM 11–18 · WX+HAZ 19–20 · VA 21 · TLR 22–24 | B747-8F / KG | 01 |
| L08 | `FK_KMIA-EHBK_03NOV26_polar-callsign_live` | 35 | HSCN 1 · OFP 2–9 · CN+NOTAM 10–17 · WX+HAZ 18–28 · NAT 29–30 · VA 31 · TLR 32–35 | B747-8F / KG | 02 |
| L09 | `FK_VHHH-PANC_02NOV26_mtow-equipcode_live` | 41 | HSCN 1 · OFP 2–12 · CN+NOTAM 13–23 · WX+HAZ 24–34 · VA 35 · Jepp 36–37 · TLR 38–41 | B747-400F / KG | 04 |
| L10 | `FK_KMIA-SBGL_03NOV26_perishables-ddg_live` | 31 | HSCN 1 · OFP 2–11 · CN+NOTAM 12–19 · WX+HAZ 20–26 · VA 27 · TLR 28–31 | B747-400F / KG | 01 |
| L11 | `FK_KGSP-EPWA_03NOV26_nat-track-ddg_live` | 34 | HSCN 1 · OFP 2–11 · CN+NOTAM 12–23 · WX+HAZ 24–28 · NAT 29–30 · VA 31 · TLR 32–34 | B747-400F / KG | 01 |
| L12 | `FK_EBLG-KORD_03NOV26_nat-random_live` | 32 | HSCN 1 · OFP 2–9 · CN+NOTAM 10–18 · WX+HAZ 19–24 · NAT 25–27 · VA 28 · TLR 29–32 | B747-400F / KG | 02 |
| L13 | `FK_UBBB-RJFK_03NOV26_bcf-multicrew_live` | 43 | HSCN 1 · OFP 2–16 · CN+NOTAM 17–29 · WX+HAZ 30–37 · VA 38 · Jepp 39–40 · TLR 41–43 | B747-400 / KG | 04 |
| L14 | `FK_KORD-RKSI_03NOV26_etops-rda-dateline_live` | 52 | HSCN 1 · OFP 2–12 · CN+NOTAM 13–30 · WX+HAZ 31–47 · VA 48 · TLR 49–52 | B777F / KG | 01 |
| L15 | `FK_PHNL-WIHH_03NOV26_pax-etops-tanker_live` | 35 | HSCN 1 · OFP 2–9 · CN+NOTAM 10–21 · WX+HAZ 22–30 · VA 31 · TLR 32–35 | B767-300ERW / LB | 01 |
| L16 | `FK_ZHEC-PANC_02NOV26_wheelsup-penalty_live` | 36 | HSCN 1 · OFP 2–11 · CN+NOTAM 12–20 · WX+HAZ 21–30 · VA 31 · blank 32–33 · TLR 34–36 | B747-8F / KG | 02 |
| L17 | `FK_OMAA-VHHH_03NOV26_etihad-permits_live` | 38 | HSCN 1 · OFP 2–12 · CN+NOTAM 13–30 · WX+HAZ 31–34 · VA 35 · TLR 36–38 | B777F / KG | 01 |
| L18 | `FK_KORD-RJAA_03NOV26_intl-redispatch_live` | 47 | HSCN 1 · OFP 2–10 · CN+NOTAM 11–25 · WX+HAZ 26–39 · VA 40 · blank 41–43 · TLR 44–47 | B747-400F / KG | 01 |
| L19 | `FK_PANC-KMIA_03NOV26_dom-redispatch-mel_live` | 33 | HSCN 1 · OFP 2–8 · CN+NOTAM 9–20 · WX+HAZ 21–28 · VA 29 · TLR 30–33 | B747-400F / KG | 01 |

Counts: TLR in **19/22** (every live package; none of the prototypes). NAT track message in 3 (L08, L11, L12). Jeppesen attachments in 2 (L09, L13). Release printed more than once in 1 (L02: three identical copies, byte-for-byte equal text). Image-only pages in 2 (L16, L18). Weight unit LB in 3 (L01, L04, L15).

### 1.2 Method

| Step | Detail |
|---|---|
| Text | `text/<id>.raw.txt` from the fixtures branch (pdf.js 3.11.174, the app's line assembly, `tools/extract`), then `tools/redact` into a scratch folder. PDF page = position of the page break in the text. |
| Parser run | `test/harness` → `_ofpRulesetParse(raw)` (NavBlue parser v2.0.0, unmodified) on all 22 packages. "Parser" in the tables means this run. |
| Location | Located by hand in the text, then checked by pattern search across all 22 packages. "OFP p*n*" = FlightKeys OFP page *n* (the `PAGE n/N` footer); PDF pages per package are in §1.1. |
| Comparison | NavBlue forms taken from `ofp-navblue` v2.0.0 (`PATTERNS`, `ALT_PATTERNS`, `CFS_PATTERNS`) and the NavBlue golden snapshots. |

**Pkgs** column: number of the 22 packages that carry the item (live count in brackets when it differs, e.g. `9 (8 live)`).

### 1.3 Legend

**✅ SAME** parser returns the right value unchanged · **🟡 ADAPT** located; value partly right or a pattern change is needed · **🔴 SILENT** returns empty/wrong with no error · **⚪ ABSENT** the FlightKeys package does not carry it · **❓ UNSEEN** no package among the 22 exercises it · **SC** = Safety-Critical field (Operating Practice III-1; CLAUDE.md rule 6).

---

## 2. Field Map — Core contract (ADR-005 Appendix A)

### 2.1 Flight identity & header (OFP p1)

OFP p1 layout (every package): running header `CCC####/DDMON/ORIG-DEST/REG` · `OPERATIONAL FLIGHT PLAN RLS nn DDMONYY HH:MM` (prototypes: `-- NOT RELEASED --`) · identity line · `COST INDEX nnn Revision: n.n` · type line · `PROGS … Release Valid Until HHMMZ DDMONYY` · airport lines · route string · fuel and weight blocks.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 1 | `fltNum` | | OFP p1 identity line `CCC####/DD ORIG - DEST DD MON YY REG`. Also FPL `(FPL-CCC####-IS`. | 22 | ✅ | Parser `CCC####/DD` in 22/22, equal to the identity line. Designators: GTI 20, BWA 1 (L01), ETD 1 (L17). `/DD` is the schedule day; in 5 packages (L04, L08, L09, L11, L16) the flight date is the next day — same convention as NavBlue. The running header `CCC####/DDMON/…` does not false-match (no word boundary after `DD`). |
| 2 | `acftType`, `isHeavy` | | OFP p4 (`TIME FUEL` page), ICAO FPL item 9 `-TYPE/W-…` | 22 | ✅ | B744 12, B748 4, B77L 3, B763 2, BLCF 1; wake `H` in 22/22; parser equal in 22/22. |
| 3 | `weightUnit` | | OFP p1 type line `MODEL / ENGINE / KG\|LB / IFR / FF +n.n [ETOPS Entry HH.MM]` | 22 | ✅ | KG 19 → `KGS`; **LB 3 (L01, L04, L15) → `LBS`**. Closes v1.0 ❓LB. |
| 4 | `dateStr`, `flightDateISO` | | FPL item 18 `DOF/YYMMDD` (OFP p4) | 22 | ✅ | 22/22 equal to `DOF` and to the identity-line date. |
| 5 | `origIcao`, `offFromOFP` | | OFP p1 `ORIG IIII/AAA NAME [Q] N#####W###### HHMMZ` | 22 | ✅ | 22/22. A **`Q`** token before the coordinates appears on at least one airport line in 8 packages (T1, T2, L03, L09, L10, L13, L16, L17), on ORIG, DEST, PALT or RALT; the template tolerates it. **Exec (SME-2): `Q` = Special Qualification airport**, to be shown on the airport card as "SPECIAL QUALIFICATION". Not read today (🔴 for that meaning; not a core field — candidate addition to Appendix B). |
| 6 | `destIcao`, `etaDest`, `destEtaOffsetMins` | | OFP p1 `DEST IIII/AAA NAME [Q] LATLON HHMMZ` | 22 | ✅ | 22/22. |
| 7 | `altData[]` (PALT) | | OFP p1 `PALT IIII/AAA NAME [Q] LATLON HHMMZ`; FPL item 16 second token | 22 | ✅ | 22/22, role `DEST ALT`. |
| 8 | `altData[]` (RAPT/RALT) | | OFP p1 `RAPT …` and `RALT …` lines, directly under PALT | 9 (8 live) | ✅ | T3, L02, L08, L11, L12, L13, L14, L18, L19 — exactly the redispatch packages (POR present, row 40). Parser role `EN ROUTE ALT` in 9/9. The briefing labels the same airports `dest2` / `dest2AltnPlanned` (row 43). |
| 8a | `altData[]` (SALT/TALT) | | — | 0 | ❓ | No second destination alternate or takeoff alternate in any of the 22 releases. Stays open. |

**Not core, seen on OFP p1 (for the extensions, §3):** release number and time (`RLS nn DDMONYY HH:MM`), `Revision: n.n` (`-.-` when not released), `Release Valid Until`, `COST INDEX`, `FF +n.n` (fuel-flow bias), `ETOPS Entry HH.MM` (row 39), `Coldest Fuel Temp`, `FMC Reserves`, `ADIS`, `POR: WPT[+nnNM] HH.MM` (row 40).

---

### 2.2 Fuel (OFP p1) — SC

Fuel block (every package): heading `ORIG-DEST` and `ALT1/2 IIII/`, then `FUEL TIME GDIS` and one row per item `NAME nnnnnn HH.MM [GDIS]`. **Redispatch packages** (9: T3, L02, L08, L11, L12, L13, L14, L18, L19) print three columns: `ORIG-DEST (POR)-DEST ORIG-RAPT`, `ALT1/2 PALT/ PALT/ RALT`. Rows seen: `TRIP CONT ALT1 FRES [ADD.AL] [ADD.LD] PCF [BALST] MINF EXTRA TOF TAXI BLOCK REMF`, then `*ADDL FF ADJ ±n.nn *` when a fuel-flow adjustment applies.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 9 | `blockFuelRaw` | **SC** | OFP p1 `BLOCK nnnnnn HH.MM` | 22 | ✅ | Parser equal to the text in 22/22. |
| 10 | `minfFuelRaw` | **SC** | OFP p1 `MINF nnnnnn HH.MM ....` (first column) | 22 | ✅ | 22/22. |
| 11 | `fresFuelRaw` | | OFP p1 `FRES nnnnnn HH.MM` | 22 | ✅ | 22/22 (time 00.30; 00.45 on the domestic L05). |
| 12 | `taxiFuelRaw`, `taxiMins` | | OFP p1 `TAXI nnnnnn HH.MM` | 22 | ✅ | 22/22 (fuel and minutes). |
| 13 | `tripMinutes` | | OFP p1 `TRIP nnnnnn HH.MM GDIS` (first column) | 22 | ✅ | 22/22. |
| 14 | `alt1Fuel` | | OFP p1 `ALT1 nnnnnn HH.MM GDIS` | 22 | ✅ | 22/22. |
| 15 | `destRemf` | | OFP p1 `REMF nnnnnn HH.MM ....` (first column) | 22 | ✅ | 22/22. |
| 16 | `ballastFuel` | | OFP p1 `BALST nnnnnn 00.00` (all columns in redispatch tables). Remarks companion: `Dispatcher applied ADHOC penalty:` / `- Ballast fuel added = nnnnkg` (L02), free text `ADDED BALLAST FOR W&B` (L02). | 4 (4 live) | 🔴 | L02, L04, L12, L18. NavBlue pattern expects `BALLAST nnnn`; FlightKeys writes `BALST` → parser `null` in 4/4. Closes v1.0 ❓. |
| 17 | `porMinf` | | OFP p1 `MINF` row, **second column** (`(POR)-DEST`) | 9 (8 live) | ✅ | Parser equal to the second column in 9/9 (same layout as NavBlue two-column MINF). Closes v1.0 ❓. |
| 18 | `zfwIncrFactor` | | OFP p1 ZFW row: `ZFW nnnnnn ...... Snnnnnn ZFW INC/1000 X nnn MINF ADJ` | 22 | 🔴 | `INC` not `INCR` → parser `null` in 22/22; MINF-ADJ cascade lost. Unchanged from v1.0. |
| 19 | `addlFfAdj` | | OFP p1 `*ADDL FF ADJ +n.nn *` (space before the closing `*`), directly under `REMF` | 10 (8 live) | 🔴 | T1, T3, L03, L08, L10, L12, L13, L16, L17, L18 → parser `null` in 10/10. Companion lines in the MEL/CDL block: `- All fuel flow values increased by n.nn PCT` (T1, T3 under `Dispatcher applied ADHOC penalty:`; L16, L18 under a CDL item). In L16 the two values differ (FF ADJ +4.30, CDL line 3.30 PCT): **SME-6**, open — Exec to review the flight. |

**Not core, seen in the fuel block (for `extraFuel` / `pcf`, §3):** `CONT` 22, `PCF` 22 (zero in some), `EXTRA` 22, `TOF` 22, `ADD.AL` 11, `ADD.LD` 1 (L05). `ADD.AL` / `ADD.LD`, `CF` and PCF follow the NavBlue rules (**Exec, SME-7**).

### 2.3 Weights (OFP p1)

Weight block: `Weight Actual Limit` · `DOW` · [`SWA (nnnnnn)`] · `PYLD` · `ZFW` · `RAMP` · `TOGW` · `LDGW` · `WEIGHT LIMIT CODES:` legend `S-STRUCT P-PERF L-MTOW BASED ON LDW+TRIP FUEL I-BY DISPATCHER`.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 20 | `zfwActual/Limit` | | OFP p1 `ZFW nnnnnn ...... Lnnnnnn ZFW INC/1000 X nnn MINF ADJ` (L = limit code) | 22 | ✅ | 22/22 equal; code `S` in all. |
| 21 | `togwActual/Limit` | | OFP p1 `TOGW nnnnnn ...... Lnnnnnn [MTOW LTD BY VZFW/CK LIMITS]` | 22 | ✅ | 22/22 equal; codes `S` and `L`. |
| 22 | `ldgwActual/Limit` | | OFP p1 `LDGW nnnnnn Lnnnnnn [*LDGW IIII nnnnnn*]` | 22 | ✅ | 22/22 equal; codes `S` and `P`. Redispatch packages add the planned landing weight at the redispatch airport on the same row (`*LDGW IIII nnnnnn*`, 9 packages); not read by any core field. |
| 23 | `hasVzfwCkLimit` | | OFP p1, **inline on the TOGW row**, no asterisks: `MTOW LTD BY VZFW/CK LIMITS` | 9 (6 live) | 🔴 | T1, T2, T3, L02, L09, L10, L11, L12, L19. NavBlue pattern needs `*MTOW LTD BY VZFW/CK LIMITS*` → parser `false` in 9/9; the red weight alert is suppressed. Negative check: `false` is correct in the other 13. |

**Not core:** `SWA (nnnnnn)` between DOW and PYLD (L05, L15). **Exec (SME-8):** service weight adjustment; can appear on any flight; note `SWA` and its value (candidate addition to Appendix B).

### 2.4 Remarks / release (OFP p2–p3) — SC

OFP p2 layout (every package): `Remarks` · dispatcher line `<NAME> DESK: nn [PHONE: …]` · company boilerplate (`This OFP prepared with FlightKeys…`, live only) · free-text remarks in dispatcher order · `RAIM VALIDATION PASSED` · CAT II/III lines · optional fleet note (777: `B777-200F/ GE90-110BL` + `Engine failure takeoff performance…`, L03, L14, L17) · optional exemption line · `MEL/CDL` block · `Flight Release Authorization` · optional `*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***` (L01, L09) · `Signed by PIC` / `Signed by Dispatcher: <NAME>` · `Fit for Duty Affirmation` · crew list (OFP p2 end or p3).

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 24 | `catIiIiiApproaches` | **SC** | OFP p2, bare lines after `RAIM VALIDATION PASSED`, no heading: `IIII CAT II - RWY a/b`, `IIII CAT III - RWY a`, `IIII CAT II/III - RWY a/b/c`. One airport may have separate CAT II and CAT III lines. Lists destination, alternates **and** en-route/ETOPS airports. | 19 (16 live) | 🔴 | Parser `null` in 22/22. 2–11 lines per package. None in L01, L15, L19 (no CAT lines printed). The NavBlue anchor `AUTHORIZED CAT II/III APPROACHES` does not exist. **Restrictions** are on the same page in other forms and must never be read as authorisations: `IIII CAT II/III RWY nnX APPROACH NOT AUTHORIZED FOR B747` (L05, no dash, no authorisation lines at all in that package) and MEL notes `- CAT III Restricted` (L01, T1, T3), `- CAT II / CAT III Restricted` (L04) → `catIiIiiRestrictions[]` (§3). **Exec (SME-10):** airports outside the US carry an authorisation (often for several runways); US airports appear only when a particular CAT II/III is **not** authorised; an overseas airport may also have a restriction among its authorised approaches. |
| 25 | `ddgItems`, `melItems` | | OFP p2 `MEL/CDL` heading, then one line per item: `MEL nn-nn-nn[-nn][A] - <title>` / `CDL Cnn-nn-nn - <title>`; long titles wrap onto the next line; notes under the item start with `- ` or `RMK - `. Block ends at `Flight Release Authorization`. | 21 (18 live) | 🔴 | Parser `ddgItems: []`, `melItems: ''` in 22/22 (NavBlue `ATA_CODE` needs the code alone on a line). MEL items in 21 packages (1–13 per package), CDL items in 3 (L01, L16, L18). Empty block in L15. Interleaved non-item lines: `Dispatcher applied ADHOC penalty:` + `- All fuel flow values increased by n.nn PCT` / `- Ballast fuel added = nnnnkg` (T1, T3, L02); performance notes `- Enroute climb penalty nnnnkg` (L11, L16, L18). The same item printed twice in 7 packages (e.g. L13, L16). **Exec (SME-4):** MELs belong to the aircraft and change from flight to flight; each OFP is read as a unique instance with nothing carried over from other imports — read the items as this OFP prints them. Notes and FPL codes → `ddgItems[i].notes[]`, `fplEquipment` (§3). |
| 26 | `crewMembers` | **SC** | End of OFP p2 or OFP p3, under `FIT FOR DUTY/ RELIEF PIC` / `JS VERIFY START-END(Z)` (repeated when the list crosses a page): pilots `ROLE <EMPNO> [*] <LAST>, <FIRST> [<MI>] [<SUFFIX>] [(<PREF>)] .. .. ..` each followed by `TO/LNDG Expiry: [YYYY-MM-DD]`; other crew without dots: `MX\|LM\|DH\|FA\|PU <EMPNO> <NAME …>`, `JS 0 <NAME>`. | 22 | 🔴 | Parser `[]` in 22/22 (comma form, `*` after the number). Pilot roles only `CA` and `FO`: 2 pilots (L01, L04, and L05 with two `CA`), 3 (10 packages), 4 (L02, L12–L15, L18, T1–T3). Other roles: MX 8, LM 5, DH 2, JS 8 (up to 5 lines), FA 9 + PU 2 (L15). `*` after the number in L01, L02, L15: **not** the seniority marker (Exec, SME-3) — it must not set `isSen`; its meaning is not given. `TO/LNDG Expiry:` blank for every pilot in 9 packages (L03, L14, L16–L19, T1–T3): a system anomaly; show "Not Reported" (Exec, SME-9; display text for a later brief). Relief-role labelling for 3–4 pilots must reproduce the NavBlue rule (no FO1/FO2/RO in the text). |
| 27 | `hasPerishables` | | OFP p2 free-text line `PERISHABLES ONBOARD` | 7 (7 live) | 🔴 | L03, L08, L10, L12, L13, L16, L17 → parser `false` in 7/7 (NavBlue needs `… O/B … YES`). Negative check: the Company NOTAM text `*ANYTIME PERISHABLES OR LIVE ANIMALS ARE ON BOARD` (most packages) does not trigger the NavBlue pattern and must not trigger the new one. Closes v1.0 ❓. |
| 28 | `hasTemperatureControl` | | — | 0 | ❓ | No temperature-control remark in any of the 22. Stays open. |
| 29 | `dotExemption` | **SC** | OFP p2, after the CAT lines: `FLIGHT RELEASED UNDER [POLAR ]EXEMPTION NO nnnnnX. ALTERNATE AIRPORT REQUIRED.` + `REFER TO FOM FOR ADDITIONAL INFORMATION.` (wraps over two lines) | 4 (4 live) | 🟡 | L08 (Polar), L11, L13, L15. Number read in 4/4 (`Exemption nnnnnX`, same as NavBlue). **`altRequired` wrong in L08**: the line wraps between `ALTERNATE AIRPORT` and `REQUIRED.`, so the NavBlue one-line pattern returns `altRequired: false`, `restrictions: null`; L11/L13/L15 return `true`, `ALT REQ'D`. The DOT-SP form (`*OPERATING UNDER EXEMPTION DOT-SP…*`) is unseen. Negative check: `null` in the other 18. |
| 30 | `slotTime` | **SC** | OFP p2 free-text remark `WHEELS UP NOT BEFORE HHMMZ DUE TO <reason>` | 1 (1 live) | ✅ | L16 → `NOT BEFORE 1627Z`, same value form as NavBlue. Negative check: `null` in the other 21; no slot found in Company NOTAMs. Window, `BEFORE`, `EARLIEST` and bare `WHEELS UP` forms unseen. Closes v1.0 ❓ for the one form seen. |
| 31 | `parsedVerbalCallsign` | | — | 0 | ⚪ | No `VERBAL CALLSIGN` line in any package, including the two chosen for callsigns (L01 designator BWA; L08 GTI flight dispatched by the `POLAR` desk under the Polar exemption). **Exec (SME-5):** the callsign is tied **only** to the Flight ID (designator → callsign, CS-1, `aircraft-profile`); the dispatch desk is tied to a certificate (the Polar desk dispatches only flights on the Polar AOC) and never changes the callsign. |
| 32 | `oeiData` | | TLR section (PDF pages in §1.1): page header `REL n/n DDMONYY HHMMZ CCC#### ORIG/DEST DDMONYY`, title `TAKEOFF AND LANDING REPORT …`, `TLR-n SEQ-…`; `RUNWAY INFO` table `RWY LENGTH EFP NOTES` (+ NOTAM IDs per runway); `SPECIAL ENG FAIL TAKEOFF PROCEDURES` table; footer `FUFI<uuid> PAGE n/N` | 19 (19 live) | 🟡 | Present in every live package (closes v1.0 ❓). Parser returns runways + EFP in 19/19, special procedures in 11. **L10**: special procedure for one runway sits at a page end and the parser appends the TLR footer and next page header (`… FUFI<uuid> PAGE 1/4 REL 1/0 …`) to `proc`. |
| 32a | `ddgItems[].tlr` | | TLR `RMKS <ATA>` lines under `/// TAKEOFF DATA ///` (e.g. `RMKS 78-31-01A`, `RMKS 36-12-02-01 ONE VLV INOP`, `RMKS C27-51-02`) | 5 (5 live) | 🔴 | L10, L11, L12, L13, L16. Cross-reference impossible today because `ddgItems` is empty (row 25). `RMKS NADP2 REQUIRED` (L09) and `RMKS WET RUNWAY` / `RMKS NONE` are not ATA codes. |

**Free-text remarks seen (for `ofpRemarks[]`, `airportData[].remarks[]`, `securityMessages[]`, `permits[]`, `extraFuel`, `pcf`, §3):** PCF reasons (`- PCF ADDED FOR DEST WX`, `PCF FOR 45 MIN HOLD IN MIDDLE EAST`, `- CF FUEL FOR WX`, …, 12 packages; L17 writes `CF`; L04 has `- ADDITIONAL FUEL PLANNED FOR POTENTIAL ARRIVAL DELAYS` without the word PCF); tanker (`ECON TANKER FUEL ADDED`, L15); pre-fuel (`AIRCRAFT PRE-FUELED TO nnnnn`, L05); airport restriction blocks `** IIII FLIGHT OPS RESTRICTIONS **` with numbered items (L01) or with `ARRIVALS` / `DEPARTURES` sub-headings (L06); dashed fleet block `IIII B747 DEPARTURES:` (L09); security (`POS LAUNCH TO DWC APPROVED BY SECURITY`, L07); air-defence clearance (`BANGLADESH ADC NO-nnnn`, L17); dispatcher weather (`GOV TAF UPDATED` + a full `TAF AMD`, L15; `WSI FPG` turbulence block, T3); route notes (`ROUTED SOUTH TO AVOID POTENTIAL VA FROM <volcano>`, L03; `*ATLANTIC CROSSING // RANDOM ROUTE // MIRRORS NAT "<track>"*`, L12; `NO VA ACTIVITY AFFECTING FLIGHT`, L14); MEL changes in free text (`MEL ADDED` / ATA / defect / `DISP LC DDHHMMZ`, L12; `ADD MEL nn-nn-nn …` / `NO RESTRICTIONS`, L13); `RAIM VALIDATION FOR ETOPS ALTN IIII PASSED` (L14).

### 2.5 Route, ETOPS, nav log, sections

OFP p4 (`TIME FUEL` page): OUT/OFF/ON/IN boxes, RVSM record, ICAO FPL (`(FPL-…`), then `Overflight/Landing Permits`. OFP p5 onward: nav log. Last OFP page: alternate routes, then (ETP/ETOPS flights) `Critical Fuel Scenario`.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 33 | `navLog[]` | | OFP p5+, two header lines `AWY WPT MTK NM GS TAS LEG-T ETA MTRS ISA WC REMF` / `MORA TTK MH IAS .M TOT-T ATA FL TEMP WIND AREM`; three lines per fix: `AWY WPT [name] [freq]`, `Nnn nn.n MTK NM GS TAS LEG-T … REMF`, `Ennn nn.n TTK MH IAS .M TOT-T FL TEMP WIND`. Pseudo-fixes `TOC`, `TOD`, `TOP OF STEP CLB/DSC`, `(E.ENT)`, `(E.EXT)`, `(POR) AT …`; FIR rows `(FIR) Nnn nn.n Wnnn nn.n HH.MM <FIR NAME>`; MORA prefix `^nnn` on some rows. | 22 | 🔴 | Parser returns **one false point from the weather/hazard text** (`TAF`, `METAR`, `TWC`, `SIGMET`, `ATIS`, `NIL`, `FROM`, `TEMPO`, `FIR`; elapsed 0) in 19 packages and `[]` in 3 (L04, L07, L11). The NavBlue nav-log pattern (`WPT … H+MM`) matches no fix row. Note: on the 30 NavBlue packages the same field is `[]` in every golden snapshot, so the FK-P target for this field is `[]`, not a nav log. |
| 34 | `tocOffsetMins` | | Nav-log row `<AWY> TOC` (or `<SID> TOC`), TOT-T on the third line | 22 | ✅ | Parser equal to the nav-log TOT-T in 22/22 (13–24 min). Closes v1.0 🟡. A vertical-profile string `TOC:DnnnFnnnTHHMM BOC:… TOD:…` also appears in L06, L08, L11, L12 (not read). |
| 35 | `overflightPerms` | | OFP p4 heading `Overflight/Landing Permits` (22/22), then groups `--- OVERFLIGHT PERMITS` / `--- LANDING PERMIT` / `--- TAKEOFF PERMIT`; entries `<COUNTRY> <permit reference>`, optional route string on the next line(s), optional registration restriction `<REG> AUTH ONLY` / `<REG> ONLY` (L07); `<COUNTRY> /////PERMIT MISSING/////` (T1). Block ends at the nav-log header. | 13 (11 live) | 🔴 | Parser `''` in 22/22: the NavBlue terminator `AWY WPT` (one space) does not match `AWY   WPT`. Groups: overflight 7, landing 5, takeoff 2 (L07 has two). Heading present but no group in 9 packages (expected empty). → `permits[]` (§3). |
| 36 | `altRoutes[]` | | Last OFP page: `Destination Primary Alternate Route` (22/22); redispatch packages add `Initial Airport Route` and `Initial Alternate Route` (9). Each block: route string · `IIII/HHMM` · `GCD nn GDIS nn FUEL nnnn TIME HH.MM` · `MORA nnnn`. | 22 | 🔴 | Parser `[]` in 22/22 (NavBlue block is underline-bounded). Titles are the same as NavBlue. `MORA` line present in 20/22 (absent in T1 and L07), so v1.0's "no MORA line" was prototype-specific. |
| 37 | `ofpSections[]` / bookmarks | | Footers by part: release `FUFI: <uuid> PAGE n/N`; HSCN `Page 1 of 1 <uuid>`; Company NOTAM + NOTAM Briefing one numbering `Page n of N <uuid>`; Weather + Hazard Briefing a new numbering; VA `Page1of1 <uuid>` (no spaces); TLR `FUFI<uuid> PAGE n/N` (no colon) with header `REL n/n …`; NAT pages headed `NAT-TRACKS`, no footer; Jeppesen pages headed `Chart Alert` / `+ JEPPESEN`, no footer. | 22 | 🔴 | Section map for every package in §1.1. No NavBlue `PAGE n OF N` footer anywhere. The release can repeat (L02 ×3, identical). Bookmarks must come from content (D7). → `sections[]` (§3). |
| 38 | `ofpFormat` / `ofpSource` | | — | 22 | 🟡 | Unchanged from v1.0. The import detector's FlightKeys anchor (`Page n of N <uuid>`) is on briefing pages in 22/22 (not re-run in this session). |
| 39 | `etopsEntry/Exit/Spec`, `…Mins` | **SC** | Entry: OFP p1 type line `… / FF +n.n ETOPS Entry HH.MM` and nav-log `(E.ENT)` row. Exit: nav-log `(E.EXT)` row (TOT-T). Spec: `Critical Fuel Scenario ETOPS 60/nnn`. | 3 (3 live) | 🔴 entry · ✅ exit · ✅ spec | L03, L14, L15 (twins B77L/B763). **Entry**: FlightKeys writes `HH.MM` (dot), NavBlue pattern needs `HH:MM` → `etopsEntry ''`, `etopsEntryMins null` in 3/3. **Exit**: parser reads the nav-log `(E.EXT)` TOT-T → `HH:MM` in 3/3 (checked against the text for L03). **Spec**: `60/120` or `60/180` in 3/3. Negative check: all empty in the other 19, including the 747 2EO scenarios (row 41). Closes the v1.0 **blocker** ❓. |
| 40 | `porWpt`, `porOffsetMins` | | OFP p1 `POR: <WPT>[+nnNM] HH.MM` (after `ADIS`); nav-log `<AWY> (POR) AT <WPT>[+nnNM]` | 9 (8 live) | 🟡 | Same 9 redispatch packages as row 8. `porOffsetMins` equal to the OFP p1 time in 9/9. `porWpt` is a plain fix in 6 and **fix + distance** in 3 (`<WPT>+119NM`, `<WPT>+300NM`, `<WPT>+60NM`: L08, L12, L13). The nav-log row `(POR) AT <WPT>+nnNM` carries the point's lat/long (`Nnn nn.n` / `Wnnn nn.n`) in 9/9. **Exec (SME-11):** new format; display `<WPT>+nnNM` and the lat/long, lat/long copyable. Closes v1.0 ❓. |
| 41 | `etpPoints[]`, CFS `altData` | **SC** | Last OFP page `Critical Fuel Scenario [ETOPS 60/nnn]` · scenario `DEPRESS/1EO` (twins) or `2EO` (747) · `(GOIIII) ETPn IIII-IIII Nnn nn.n Wnnn nn.n` and `(GOIIII) E.ENT IIII …`, `E.EXIT IIII …` · table `GCD TIME A/I REMF PAD MINF WX WINDOW` · rows `IIII nnn HH:MM n-nnnPC nnnnn nnnnn nnnnnn HH:MM-HH:MM` · `RMK MIN INCL APU / 5PC WIND` · `Last Adequate: IIII` / `First Adequate: IIII` | 6 (5 live) | 🟡 | CFS block in T3, L03, L09, L11, L14, L15. **ETP points** (with nav-log elapsed) in 4/4 packages that have `ETPn` lines (T3, L03, L14, L15). **CFS ALT** entries in 3 of those 4 (none in L14; cause not diagnosed here). **`wxWindow` `null` everywhere**: FlightKeys window is `HH:MM-HH:MM` without `Z`, and the table has no `MORA`/`MTK` columns. The E.ENT/E.EXIT-only scenarios (L09, L11: `2EO`, one airport, no ETP) give no CFS airport; **Exec (SME-13):** these are correct, fairly rare, and their airports are alternates for consideration — so they must appear. `Last/First Adequate` (L03, L14, L15) not read. Closes the v1.0 **blocker** ❓. |
| 42 | `natTrack` | | Separate `NAT-TRACKS` pages after the Weather Briefing (no footer): full track message(s) `(NAT-n/N TRACKS FLS …` / validity `MON DD/HHMMZ TO MON DD/HHMMZ` / track lines / `REMARKS.` / `TMI IS nnn.`. Route string in OFP p1 / FPL: `NATx` (L11) or random lat/long (L08, L12). | 3 (3 live) | 🔴 | L08, L11, L12. Parser returns `trackType NAT`, a direction and a TMI, but `blocks: []` and `assignedId: null` in 3/3 (L11 is filed on track `W`). L12 carries **two** messages (TMI 308 night eastbound and TMI 307 day westbound); the parser takes 308. **Exec (SME-14):** the TMI number controls; same TMI in both = anomaly; different TMIs → the track validity period decides which is current. For L12 the oceanic entry is about 1836Z (OFF 1700Z + 01.36), inside TMI 307's validity (NOV 03/1130Z–1900Z) and before TMI 308's (NOV 04/0100Z–0800Z). PACOTS tracks appear inside the NOTAM Briefing (L02, row 49), not as NAT-TRACKS pages. Closes v1.0 ❓. |

### 2.6 Weather, NOTAM, Company NOTAM (briefing package) — SC

Briefing pages (all parts after the release except TLR, NAT, Jeppesen) carry a running header `CCC#### / ORIG - DEST / YYYY-MM-DD / REG YYYY-Mon-DD HH:MM` and a footer `Page n of N <uuid>`. Text is **two columns**; pdf.js joins the two columns of one line with three spaces, so items of the left and right columns interleave line by line. Every airport block (NOTAM and weather) opens with `AAA - <NAME>   <ROLE> DD HH:MM - DD HH:MM` and `APTIIII RWYS: <rwy pairs>` (in all 22 the `APT` label is glued to the ICAO code); further role windows for the same airport follow on the next lines. Roles seen (count of packages): `IA` 22, `ALTN` 22, `DESTINATION` 18, `ALTN 1` 18, `DEPARTURE` 16, `TA` 14, `EA` 6, `dest2` / `dest2AltnPlanned` (lower case) in the redispatch packages. A Company NOTAM `SUBJECT: WX/NOTAMs in Briefing Acronyms` (19 live packages) defines `EA` = Enroute Alternate (ETOPS/ETP Alternate), `IA` = Intermediate Alternate (Adequate Airport), `TA` = Terrain Alternate, `DEST2` = Reclear Airport, `DEST2 ALTN` = Reclear Alternate Airport.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 43 | `airportData[icao].weather` | **SC** | Weather Briefing (`WX+HAZ`, §1.1): per airport block as above, then sub-blocks `METAR` (newest first; `METAR SPECI …`), `TAF` (`TAF [AMD] IIII …` with `FM`/`TEMPO`/`BECMG` lines), `ATIS` (`AD AAA /OS …` text, or `THERE ARE NO ACTIVE ATIS FOR AIRPORT IIII WITHIN THE GIVEN TIME PERIOD.` / `NIL`). Hazard Briefing follows in the same numbering: `TWC FPG - TURB\|CONV`, SIGMET/AIRMET with `Valid:` / `Area:` / `Level:` / `Intensity:` / `Movement:`. | 22 | 🔴 | 0 characters for every release airport through the app import path (`test/known-gaps.json`, all 22 packages, every airport); `_ofpRulesetParse` returns `airportData: {}` in 22/22. 6–17 airports per Weather Briefing, more than the release lists (IA/TA/EA airports). **Exec (SME-1):** all role windows apply to weather evaluation; airport cards follow the order of the OFP p1 airport lines (ORIG, DEST, …); airports in none of those categories (IA/TA/EA-only, `ALTN`) are listed after the last OFP p1 airport. |
| 44 | `airportData[icao].notams` | **SC** | NOTAM Briefing (after the Company NOTAMs, same `Page n of N` numbering): airport block as above, then category headings `RUNWAY`, `TAXIWAY`, `APPROACH AND LANDING`, `AIRPORT`, `OBSTACLE`, `NAVIGATION`, `COMMUNICATION`, `AIRSPACE`, `WARNING`; items `IIII [AAA] X####/YY   YYYY-Mon-DD HH:MM - YYYY-Mon-DD HH:MM\|UFN\|UFN(EST YYYY-Mon-DD HH:MM)\|PERM` · `CREATED:YYYY-Mon-DD HH:MM   FL: <lower> - <upper>` · [`SCHEDULE:<…>`] · body · [`RMK: …`]. | 22 | 🔴 | 0 characters for every airport (as row 43). 36–213 NOTAM items per package. The 3-letter code between ICAO and NOTAM number appears in 15 packages (both forms can be in one package). `UFN(EST …)` in 22/22, `PERM` in 7, `SCHEDULE:` in 22/22. Repeated NOTAM IDs: 33–36 in the prototypes T1/T2, 0–1 in the live packages. Header grammar belongs to the NOTAM ruleset (ADR-005 §2.5); IDs are never merged (D43). |
| 45 | `airportData` for alternates | **SC** | Same blocks; alternates, redispatch and IA/TA/EA airports each have their own block | 22 | 🔴 | No `airportData` entry at all for any airport in 22/22. |
| 46 | `airportData[icao].curfew` | **SC** | Company NOTAMs (first part of the NOTAM document): airport items `IIII X####/YY   YYYY-Mon-DD HH:MM - UFN` · `CREATED:…` · `SUBJECT: IIII-CURFEW` · free text (e.g. `<type> CURFEW = HHMM-HHMMZ DAILY`), two-column and often split over a page break | 8 (5 live) | 🔴 | T1, T2, T3, L02, L03, L09, L14, L18; 1–3 curfew items per package; no curfew value read (parser has no `airportData`). **Correction (13 Nov):** an earlier draft said curfew times also appear in other Company NOTAMs; they do not — the extra `CURFEW =` lines belong to the same `IIII-CURFEW` item and only looked separate because of the two-column layout. One item can hold **several curfew lines by aircraft type and by registration** (RJAA item in L02, L14, L18: one line for the 747-400 family, one for a list of five registrations, one for B767/B777/B748, with different start times). No package has two disagreeing curfew sources. **SME-12** (reworded). |
| 47 | `airportData[icao].opsNotes` | | Company NOTAMs per airport, `SUBJECT: IIII-<TOPIC>`: topics seen `ETOPS`, `CURFEW`, `C067`, `RWYS`, `SE CARGO`, `ARFF`, `SLOTS`, `FREQ`, `FUEL`, `GUARD`, `TANKER`, `PREF ALT`, `NONTWR`, `T SID DEP`, `RWY CLSD`, … Station remarks in the OFP Remarks are a second source (row 24 note; L01, L06, L09). | 22 | 🔴 | No value read in 22/22. A `SUBJECT: IIII-SLOTS` item exists in 3 packages (T3, L02, L14) — slot information that is **not** a wheels-up time (row 30). → `companyNotams[]` and `airportData[].remarks[]` (§3). |
| 48 | `airportData[icao].ewins*` | | — | 0 | ❓ | No `E-WINS` / `EWINS` text in any of the 22. Stays open. |
| 49 | `enrouteNotams.{route,fir,airway,waypoint,geographic}` | | NOTAM Briefing after the airports: heading `FIR`, then per FIR `IIII <NAME> FIR\|UIR\|OCA\|ARTCC` with the same item grammar and categories (`AIRSPACE`, `WARNING`, `NAVIGATION`, …). PACOTS track messages printed inside this part (9 packages with Pacific routes). | 22 | 🔴 | All five counts 0 in 22/22. |
| 50 | Page-header stripping | | Running header and footer above; also `FUFI: …` (release), `FUFI<uuid> PAGE n/N` + `REL n/n …` (TLR), `Page1of1 <uuid>` (VA). | 22 | 🔴 | Headers and footers sit **inside** Company NOTAM and NOTAM items when an item crosses a page (e.g. a curfew item in L18 continues on the next page after the footer and the running header). They must be removed before any segmentation. |

**Company NOTAMs, general part (no airport):** heading `GENERAL`; items `X####/YY   YYYY-Mon-DD HH:MM - UFN` · `CREATED:…` · `SUBJECT: <topic>` (e.g. `FlightKeys OFP`, `ADMIN-DEICE`, `WX/NOTAMs in Briefing Acronyms`, `PUBS- <fleet>`, `<tail>-WB`, `<REG> <topic>`, `Chart Alert <IIII> <date>`). High Severity Company NOTAMs (PDF p1, 22/22): heading `HIGH SEVERITY COMPANY NOTAMS`, items `P####/YY …`. → `companyNotams[]` (§3).

## 3. Extensions (ADR-005 Appendix B, contract v2.0)

Today's parser returns none of these (the contract v2.0 extensions are not implemented in `ofp-navblue`, which returns them as explicit empties by design). The status here therefore says whether FlightKeys **carries** the item: **🟡 LOCATED** (to be read by `ofp-flightkeys`) · **⚪ ABSENT** · **❓ UNSEEN**.

| Extension | FlightKeys location / form (structure) | Pkgs | Status | Notes |
|---|---|---|---|---|
| `revision` | OFP p1 `OPERATIONAL FLIGHT PLAN RLS nn DDMONYY HH:MM` (also on every OFP page header) and `COST INDEX nnn Revision: n.n`; `Release Valid Until HHMMZ DDMONYY`; TLR `TLR-n SEQ-…` and page header `REL n/n …` | 22 (19 released) | 🟡 | RLS 01 in 14, 02 in 3 (L08, L12, L16), 04 in 2 (L09, L13); prototypes `-- NOT RELEASED --` with `Revision: -.-`. `Revision: n.0` equals the RLS number in 19/19; `TLR-n` equals the RLS number in 19/19. **Repeated release**: L02 prints the whole release three times (PDF p2–11, 12–21, 22–31), text identical. |
| `companyNotams[]` | High Severity Company NOTAMs (PDF p1, `P####/YY`), then Company NOTAMs (`COMPANY NOTAMS` → `GENERAL` part, then airport parts). Item: `[IIII ]X####/YY   <start> - <end\|UFN>` · `CREATED:… FL: …` · `SUBJECT: <topic>` · text. Two-column. | 22 | 🟡 | Airport items carry the airport both before the ID and in the subject (`SUBJECT: IIII-<TOPIC>`); general items have none. Items cross page breaks (row 50). Topic list in row 47. |
| `ofpRemarks[]` | OFP p2 between the dispatcher line and `MEL/CDL`, in order | 22 | 🟡 | 6–32 lines per package (dispatcher line to `MEL/CDL`). The dispatcher line (`<NAME> DESK: nn [PHONE: …]`; `DESK: POLAR` in L08) and the fixed FlightKeys boilerplate are part of the block; whether to show them is a presentation decision. |
| `airportData[icao].remarks[]` | Inside the OFP Remarks: `** IIII FLIGHT OPS RESTRICTIONS **` + numbered lines (L01); `**IIII/AAA FLIGHT OPS RESTRICTION **` with sub-headings `ARRIVALS` / `DEPARTURES` (L06); a dashed block `IIII B747 DEPARTURES:` (L09). Also Company NOTAM airport items (row 47). | 3 in Remarks (3 live) | 🟡 | Sub-headings exist only in L06; the block has no explicit end (it runs until the CAT II/III lines). |
| `airportData[icao].remarksWeather[]` | Dispatcher weather in the OFP Remarks: `GOV TAF UPDATED` + full `TAF AMD IIII …` (L15, for an ETOPS alternate); `WSI FPG FOR AREA NEAR …` + WSI turbulence product (T3). E-WINS: none. | 2 (1 live) | 🟡 | Never merged into briefing weather (D34, D46). E-WINS unseen (row 48). |
| `ddgItems[i].type` | Line prefix `MEL ` or `CDL ` (CDL codes start with `C`) | 21 | 🟡 | CDL in 3 packages (L01, L16, L18). |
| `ddgItems[i].notes[]` | Lines under an item beginning `- ` or `RMK - `, until the next `MEL`/`CDL` line or the block end | 11 | 🟡 | Examples of note kinds: `- ETOPS MDT 180`, `- CAT III Restricted`, `- RCP Restricted`, `- "Xn" removed from ICAO FPL, field 10A.`, `- Enroute climb penalty nnnnkg`, `- All fuel flow values increased by n.nn PCT`, `RMK - The airplane must also be dispatched using DDG item nn-nn-nn.`. **Indentation is not in the extracted text**: notes start at a larger x (e.g. 69.9 vs 58.7 for the item line, L03) and can only be recovered from the positioned items. `Dispatcher applied ADHOC penalty:` lines are not item notes. |
| `fplEquipment` | FPL item 10a/10b: `-TYPE/W-<10a>/<10b>` (OFP p4); removed codes from MEL notes `- "Xn" removed from ICAO FPL, field 10A.` | 22 (removals in 2) | 🟡 | Removals in L03 (`M1`, `M3`) and L09 (`J5`, `J7`, `M1`, `M3`); in both the filed 10a already lacks the removed codes. Reading belongs to `icao-fpl` (ADR-005 §2.1). |
| `catIiIiiRestrictions[]` | `IIII CAT II/III RWY nnX APPROACH NOT AUTHORIZED FOR B747` (OFP p2, no dash); MEL notes `- CAT III Restricted`, `- CAT II / CAT III Restricted`; MEL item `MEL 22-AA-01 - CAT II/III Restriction` (L04) | 5 (4 live) | 🟡 | L05 (airport line); L01, L04, T1, T3 (MEL). **SME-10**. |
| `securityMessages[]` | OFP p2 free text `POS LAUNCH TO <AAA> APPROVED BY SECURITY` | 1 (1 live) | 🟡 | L07 only. No other security wording in the 22. |
| `extraFuel` | OFP p1 `EXTRA nnnnnn HH.MM`; tanker reason only as free text `ECON TANKER FUEL ADDED` (L15); other reasons e.g. `AIRCRAFT PRE-FUELED TO nnnnn` (L05) | 22 (tanker 1) | 🟡 | EXTRA 9–14709 (units of the package). Tanker flag true only for L15 (EXTRA 4427). A Company NOTAM `SUBJECT: IIII-TANKER` (L01) is station information, not this flight's tanker. |
| `pcf` | OFP p1 `PCF nnnnnn HH.MM`; reasons in the OFP Remarks (`[- ]PCF …`, `ADDED PCF …`, `- CF FUEL FOR WX`, `- ADDITIONAL FUEL PLANNED FOR …`) | 22 (non-zero 14) | 🟡 | Non-zero PCF in 14; a reason line in 13 of them (none in L01). |
| `permits[]` | Row 35: groups `--- OVERFLIGHT PERMITS` / `--- LANDING PERMIT` / `--- TAKEOFF PERMIT`, entries `<COUNTRY> <ref>` + route + `<REG> [AUTH] ONLY`; `/////PERMIT MISSING/////`. Air-defence clearance in Remarks: `BANGLADESH ADC NO-nnnn` (L17). | 13 (11 live) + ADC 1 | 🟡 | Registration restriction in L07; missing permit in T1. Permit references contain `/`, `-`, spaces and dates; keep the entry text whole. |
| `designator` | Flight number prefix (row 1) | 22 | 🟡 | GTI 20, BWA 1, ETD 1. L08 is a GTI flight dispatched by the `POLAR` desk under the Polar exemption: **SME-5**. |
| `sections[]` | §1.1 section map; titles `HIGH SEVERITY COMPANY NOTAMS`, `OPERATIONAL FLIGHT PLAN`, `COMPANY NOTAMS`, NOTAM airport/FIR blocks, Weather and Hazard briefing blocks, `NAT-TRACKS`, `VOLCANIC ASH ADVISORIES` (or `NO VOLCANIC ASH ADVISORIES FOUND FOR THIS FLIGHT`), `Chart Alert` / `+ JEPPESEN`, `TAKEOFF AND LANDING REPORT` | 22 | 🟡 | NOTAM and Weather briefings have no title line of their own in the extracted text; their start is the first airport block after the Company NOTAMs / after the NOTAM part. Image-only pages (L16, L18) have no text to anchor. |
| `findings[]` | — | — | — | Candidates seen: repeated release (L02), `PERMIT MISSING` (T1), blank `TO/LNDG Expiry:` (9), MX/LM/FA/PU/DH/JS crew lines (§2.4 row 26), empty `MEL/CDL` block (L15). |

---

## 4. SME questions and Exec answers (13 Nov 2026)

| # | Question (package, PDF page) | Exec answer | Effect on this map |
|---|---|---|---|
| SME-1 | Briefing role windows: `ALTN` vs `ALTN 1`; which window when one airport has several roles; cards for IA/TA/EA-only airports; `dest2` = RAPT/RALT? (Acronyms L02 p32; roles L02 p34–51, T3 p16–18) | All windows apply for weather evaluation. IA/TA/EA, if they are not DEST/DEST2/ALT/ALT2 etc., are displayed last. Airport cards are listed ORIG, DEST, etc. as on the first page of the OFP; all others follow the last airport of the OFP first page. | Row 43. Card order = OFP p1 airport-line order, then all briefing-only airports. |
| SME-2 | `Q` token on ORIG/DEST/PALT/RALT lines (OFP p1 = PDF p2 of T1, T2, L03, L09, L10, L13, L16, L17) | "Special Qualification" airport; show "SPECIAL QUALIFICATION" on the airport card. | Row 5. New item, not in the contract today: candidate for Appendix B. |
| SME-3 | `*` after a pilot's employee number (L01 p3, L02 p3, L15 p3) — seniority marker? | No, it is not. | Row 26: must not set `isSen`. Meaning still unknown (**SME-3a**, below). |
| SME-4 | Same MEL item printed twice (L08, L09, L10, L12, L13, L14, L16, p3) | An airplane may have an MEL on multiple flights; MELs are tied to each airplane and are dynamic. Each OFP is a unique instance with no artifacts from other OFP imports. | Row 25: read the items as this OFP prints them; nothing from earlier imports. |
| SME-5 | Callsign for a GTI flight dispatched by the Polar desk under the Polar exemption (L08 p3); BWA (L01 p2) | The callsign is ONLY tied to the Flight ID. The dispatch desk is solely tied to a certificate (the Polar desk only dispatches flights on the Polar AOC). | Rows 31, `designator`: callsign from the flight number's designator only. |
| SME-6 | `*ADDL FF ADJ +4.30 *` vs CDL note `All fuel flow values increased by 3.30 PCT` (L16 p2, p3) | Exec to review the flight. | **Open.** Facts for the review: L16 (B747-8F, CDL C27-51-02 Flap Track (Canoe) Fairing) has `- Enroute climb penalty 7779kg` and `- All fuel flow values increased by 3.30 PCT` under the CDL item, `*ADDL FF ADJ +4.30 *` under REMF, and `FF +3.5` on the type line. 4.30 = 3.30 + 1.00; an unexplained `+1.00` (no companion line) appears on its own in L08, L10, L12, L13, and `+0.50` in L03, L17. Where a companion line exists, it equals the FF ADJ in L18 (0.30) and T1/T3 (1.00). |
| SME-7 | `ADD.AL` / `ADD.LD`; `CF` vs PCF; PCF without a reason (L02 p2, L05 p2, L17 p3, L01 p2) | Same rules as NavBlue. | Row 19 note, `pcf`. |
| SME-8 | `SWA (nnnnnn)` (L05 p2, L15 p2) | Service weight adjustment; can be on any flight; just note SWA and the value. | §2.3 note. Candidate for Appendix B. |
| SME-9 | Blank `TO/LNDG Expiry:` (crew list of L03, L14, L16–L19, T1–T3) | A system anomaly. If blank, show "Not Reported". | Row 26. Display text to be carried into the crew brief. |
| SME-10 | CAT II/III restrictions vs authorisations (L05 p3; L01, L04, T1, T3 p3) | Airports outside the US have an authorisation, often for multiple runways. Airports within the US only display if a particular CAT II/III is not authorised. An overseas airport may have a restriction among its authorised approaches. | Row 24, `catIiIiiRestrictions[]`. |
| SME-11 | POR as `<WPT>+nnNM` (L08, L12, L13; OFP p1 and nav log) | New format. Display `(<WPT>+nnNM)` and the LAT/LONG; allow the lat/long to be copied. | Row 40. The lat/long is on the nav-log `(POR) AT …` row (9/9). The earlier draft wrongly said the nav log had no row for that point. |
| SME-12 | Curfew sources that disagree (L18 p11–12; L02 p32–33; L14 p13–14) | "You will have to show me this scenario." | **Re-checked: no such scenario exists in the 22 packages** — the earlier question was based on a misread of the two-column layout (row 46). **Reworded, open:** one `IIII-CURFEW` item (RJAA in L02, L14, L18) lists curfews per type (747-400 family; B767/B777/B748) and per registration (five tails), with different start times. Proposed reading: a registration line applies first, otherwise the line for the aircraft type. Confirm. |
| SME-13 | 747 `2EO` scenarios with E.ENT/E.EXIT only; Last/First Adequate (L09 p12, L11 p11; L03 p12, L14 p12, L15 p9) | Correct and fairly rare. These are alternate airports for consideration. | Row 41: these airports must appear as CFS alternates. |
| SME-14 | Two NAT track messages in one package (L12 p25–27) | The TMI number is controlling. Same TMI in both = anomaly. Different TMIs → the track validity period determines which is the most current. | Row 42. **Confirm for L12:** TMI 307 (valid NOV 03/1130Z–1900Z) covers the oceanic entry (~1836Z); TMI 308 is higher but valid NOV 04/0100Z–0800Z, after the crossing. Our reading: 307 applies to this flight. |
| SME-3a | (new) If `*` is not seniority, what does it mark? | — | Open. |

---

## 5. Summary

### 5.1 Core rows (52 entries: rows 1–50 plus 8a, 32a)

| Status | Count | Rows |
|---|---|---|
| ✅ SAME | 21 | 1–8, 9–15, 17, 20–22, 30, 34 |
| 🔴 SILENT | 22 | 16, 18, 19, 23, 24, 25, 26, 27, 32a, 33, 35, 36, 37, 39 (entry), 42, 43, 44, 45, 46, 47, 49, 50 |
| 🟡 ADAPT | 5 | 29, 32, 38, 40, 41 |
| ⚪ ABSENT | 1 | 31 |
| ❓ UNSEEN | 3 | 8a SALT/TALT, 28 temperature control, 48 E-WINS |

**Safety-Critical fields:** block/min fuel ✅ · slot time ✅ (one form seen) · ETOPS exit and spec ✅, **ETOPS entry 🔴** · ETP/CFS 🟡 (no weather windows) · DOT/Polar exemption 🟡 (`altRequired` wrong when the line wraps) · **CAT II/III 🔴** · **crew 🔴** · **airport NOTAM / weather / curfew 🔴**.

### 5.2 v1.0 ❓ items

| v1.0 ❓ | Now | Row |
|---|---|---|
| ETOPS (blocker) | closed: 3 packages; entry 🔴, exit ✅, spec ✅ | 39 |
| CFS/ETP (blocker) | closed: 6 packages; 🟡 | 41 |
| POR/RDA | closed: 9 packages; MINF ✅, POR 🟡 | 17, 40 |
| NAT | closed: 3 packages; 🔴 | 42 |
| Slot / wheels-up | closed for `WHEELS UP NOT BEFORE` (1 package); other forms unseen | 30 |
| DOT exemption | closed for the `EXEMPTION NO` form (4 packages); DOT-SP form unseen | 29 |
| Perishables | closed: 7 packages; 🔴 | 27 |
| Temperature control | **open** | 28 |
| Ballast | closed: 4 packages; 🔴 | 16 |
| Verbal callsign | closed as ⚪ (not printed; SME-5) | 31 |
| E-WINS | **open** | 48 |
| SALT/RALT/TALT | RALT (and RAPT) closed ✅; **SALT/TALT open** | 8, 8a |
| LB unit | closed: 3 packages ✅ | 3 |
| TLR | closed: 19 packages; 🟡 | 32 |

**Open ❓ after this map:** SALT/TALT (8a), temperature control (28), E-WINS (48).

**Open SME items:** SME-6 (Exec reviewing L16), SME-12 (reworded: curfew line by type vs registration), SME-14 (confirm L12 → TMI 307), SME-3a (meaning of `*`).

### 5.3 Corrections to v1.0

- Row 33: the "1 point" nav log is a false match in the weather text; NavBlue's own output for this field is `[]` on every NavBlue package.
- Row 34 (TOC): correct in 22/22 → ✅.
- Row 36: the `MORA` line exists in live packages (20/22).
- Row 44: repeated NOTAM IDs were a prototype effect.
- Row 43 / SME-1: EA/IA/TA/DEST2 are defined in a Company NOTAM of every live package.

---

## 6. Found outside this map's scope (reported, not acted on)

- **`tools/redact` leaves some names in place.** Jump-seat lines in the form `JS 0 <NAME>` (several live packages) and the dispatcher line at the top of the Remarks in the three prototypes (where no `Signed by Dispatcher:` line repeats the name) are not replaced. This document contains none of them; the tool needs its own fix and a check of anything already published from redacted text.
- **TLR page breaks** leak into a special engine-failure procedure (row 32, L10). Relevant to the TLR reader in either parser.
