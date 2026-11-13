# SPRINT-OFP-FlightKeysMigration — Field Map Reference

**Version:** v1.1-REF | **Status:** REF (draft, built section by section) | **Date:** 2026-11-13
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
| 5 | `origIcao`, `offFromOFP` | | OFP p1 `ORIG IIII/AAA NAME [Q] N#####W###### HHMMZ` | 22 | ✅ | 22/22. A **`Q`** token before the coordinates appears on at least one airport line in 8 packages (T1, T2, L03, L09, L10, L13, L16, L17), on ORIG, DEST, PALT or RALT; the template tolerates it. Meaning: **SME-2**. |
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
| 19 | `addlFfAdj` | | OFP p1 `*ADDL FF ADJ +n.nn *` (space before the closing `*`), directly under `REMF` | 10 (8 live) | 🔴 | T1, T3, L03, L08, L10, L12, L13, L16, L17, L18 → parser `null` in 10/10. Companion lines in the MEL/CDL block: `- All fuel flow values increased by n.nn PCT` (T1, T3 under `Dispatcher applied ADHOC penalty:`; L16, L18 under a CDL item). In L16 the two values differ (FF ADJ +4.30, CDL line 3.30 PCT): **SME-6**. |

**Not core, seen in the fuel block (for `extraFuel` / `pcf`, §3):** `CONT` 22, `PCF` 22 (zero in some), `EXTRA` 22, `TOF` 22, `ADD.AL` 11, `ADD.LD` 1 (L05). Meaning of `ADD.AL` / `ADD.LD`: **SME-7**.

### 2.3 Weights (OFP p1)

Weight block: `Weight Actual Limit` · `DOW` · [`SWA (nnnnnn)`] · `PYLD` · `ZFW` · `RAMP` · `TOGW` · `LDGW` · `WEIGHT LIMIT CODES:` legend `S-STRUCT P-PERF L-MTOW BASED ON LDW+TRIP FUEL I-BY DISPATCHER`.

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 20 | `zfwActual/Limit` | | OFP p1 `ZFW nnnnnn ...... Lnnnnnn ZFW INC/1000 X nnn MINF ADJ` (L = limit code) | 22 | ✅ | 22/22 equal; code `S` in all. |
| 21 | `togwActual/Limit` | | OFP p1 `TOGW nnnnnn ...... Lnnnnnn [MTOW LTD BY VZFW/CK LIMITS]` | 22 | ✅ | 22/22 equal; codes `S` and `L`. |
| 22 | `ldgwActual/Limit` | | OFP p1 `LDGW nnnnnn Lnnnnnn [*LDGW IIII nnnnnn*]` | 22 | ✅ | 22/22 equal; codes `S` and `P`. Redispatch packages add the planned landing weight at the redispatch airport on the same row (`*LDGW IIII nnnnnn*`, 9 packages); not read by any core field. |
| 23 | `hasVzfwCkLimit` | | OFP p1, **inline on the TOGW row**, no asterisks: `MTOW LTD BY VZFW/CK LIMITS` | 9 (6 live) | 🔴 | T1, T2, T3, L02, L09, L10, L11, L12, L19. NavBlue pattern needs `*MTOW LTD BY VZFW/CK LIMITS*` → parser `false` in 9/9; the red weight alert is suppressed. Negative check: `false` is correct in the other 13. |

**Not core:** `SWA (nnnnnn)` between DOW and PYLD in the two passenger flights (L05, L15). Meaning: **SME-8**.

### 2.4 Remarks / release (OFP p2–p3) — SC

OFP p2 layout (every package): `Remarks` · dispatcher line `<NAME> DESK: nn [PHONE: …]` · company boilerplate (`This OFP prepared with FlightKeys…`, live only) · free-text remarks in dispatcher order · `RAIM VALIDATION PASSED` · CAT II/III lines · optional fleet note (777: `B777-200F/ GE90-110BL` + `Engine failure takeoff performance…`, L03, L14, L17) · optional exemption line · `MEL/CDL` block · `Flight Release Authorization` · optional `*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***` (L01, L09) · `Signed by PIC` / `Signed by Dispatcher: <NAME>` · `Fit for Duty Affirmation` · crew list (OFP p2 end or p3).

| # | Return field | SC | FlightKeys location / form (structure) | Pkgs | Status | Evidence / notes |
|---|---|---|---|---|---|---|
| 24 | `catIiIiiApproaches` | **SC** | OFP p2, bare lines after `RAIM VALIDATION PASSED`, no heading: `IIII CAT II - RWY a/b`, `IIII CAT III - RWY a`, `IIII CAT II/III - RWY a/b/c`. One airport may have separate CAT II and CAT III lines. Lists destination, alternates **and** en-route/ETOPS airports. | 19 (16 live) | 🔴 | Parser `null` in 22/22. 2–11 lines per package. None in L01, L15, L19 (no CAT lines printed). The NavBlue anchor `AUTHORIZED CAT II/III APPROACHES` does not exist. **Restrictions** are on the same page in other forms and must never be read as authorisations: `IIII CAT II/III RWY nnX APPROACH NOT AUTHORIZED FOR B747` (L05, no dash, no authorisation lines at all in that package) and MEL notes `- CAT III Restricted` (L01, T1, T3), `- CAT II / CAT III Restricted` (L04) → `catIiIiiRestrictions[]` (§3), **SME-10**. |
| 25 | `ddgItems`, `melItems` | | OFP p2 `MEL/CDL` heading, then one line per item: `MEL nn-nn-nn[-nn][A] - <title>` / `CDL Cnn-nn-nn - <title>`; long titles wrap onto the next line; notes under the item start with `- ` or `RMK - `. Block ends at `Flight Release Authorization`. | 21 (18 live) | 🔴 | Parser `ddgItems: []`, `melItems: ''` in 22/22 (NavBlue `ATA_CODE` needs the code alone on a line). MEL items in 21 packages (1–13 per package), CDL items in 3 (L01, L16, L18). Empty block in L15. Interleaved non-item lines: `Dispatcher applied ADHOC penalty:` + `- All fuel flow values increased by n.nn PCT` / `- Ballast fuel added = nnnnkg` (T1, T3, L02); performance notes `- Enroute climb penalty nnnnkg` (L11, L16, L18). The same item printed twice in 7 packages (e.g. L13, L16): **SME-4**. Notes and FPL codes → `ddgItems[i].notes[]`, `fplEquipment` (§3). |
| 26 | `crewMembers` | **SC** | End of OFP p2 or OFP p3, under `FIT FOR DUTY/ RELIEF PIC` / `JS VERIFY START-END(Z)` (repeated when the list crosses a page): pilots `ROLE <EMPNO> [*] <LAST>, <FIRST> [<MI>] [<SUFFIX>] [(<PREF>)] .. .. ..` each followed by `TO/LNDG Expiry: [YYYY-MM-DD]`; other crew without dots: `MX\|LM\|DH\|FA\|PU <EMPNO> <NAME …>`, `JS 0 <NAME>`. | 22 | 🔴 | Parser `[]` in 22/22 (comma form, `*` after the number). Pilot roles only `CA` and `FO`: 2 pilots (L01, L04, and L05 with two `CA`), 3 (10 packages), 4 (L02, L12–L15, L18, T1–T3). Other roles: MX 8, LM 5, DH 2, JS 8 (up to 5 lines), FA 9 + PU 2 (L15). `*` after the number in L01, L02, L15: **SME-3**. `TO/LNDG Expiry:` blank for every pilot in 9 packages (L03, L14, L16–L19, T1–T3): **SME-9**. Relief-role labelling for 3–4 pilots must reproduce the NavBlue rule (no FO1/FO2/RO in the text). |
| 27 | `hasPerishables` | | OFP p2 free-text line `PERISHABLES ONBOARD` | 7 (7 live) | 🔴 | L03, L08, L10, L12, L13, L16, L17 → parser `false` in 7/7 (NavBlue needs `… O/B … YES`). Negative check: the Company NOTAM text `*ANYTIME PERISHABLES OR LIVE ANIMALS ARE ON BOARD` (most packages) does not trigger the NavBlue pattern and must not trigger the new one. Closes v1.0 ❓. |
| 28 | `hasTemperatureControl` | | — | 0 | ❓ | No temperature-control remark in any of the 22. Stays open. |
| 29 | `dotExemption` | **SC** | OFP p2, after the CAT lines: `FLIGHT RELEASED UNDER [POLAR ]EXEMPTION NO nnnnnX. ALTERNATE AIRPORT REQUIRED.` + `REFER TO FOM FOR ADDITIONAL INFORMATION.` (wraps over two lines) | 4 (4 live) | 🟡 | L08 (Polar), L11, L13, L15. Number read in 4/4 (`Exemption nnnnnX`, same as NavBlue). **`altRequired` wrong in L08**: the line wraps between `ALTERNATE AIRPORT` and `REQUIRED.`, so the NavBlue one-line pattern returns `altRequired: false`, `restrictions: null`; L11/L13/L15 return `true`, `ALT REQ'D`. The DOT-SP form (`*OPERATING UNDER EXEMPTION DOT-SP…*`) is unseen. Negative check: `null` in the other 18. |
| 30 | `slotTime` | **SC** | OFP p2 free-text remark `WHEELS UP NOT BEFORE HHMMZ DUE TO <reason>` | 1 (1 live) | ✅ | L16 → `NOT BEFORE 1627Z`, same value form as NavBlue. Negative check: `null` in the other 21; no slot found in Company NOTAMs. Window, `BEFORE`, `EARLIEST` and bare `WHEELS UP` forms unseen. Closes v1.0 ❓ for the one form seen. |
| 31 | `parsedVerbalCallsign` | | — | 0 | ⚪ | No `VERBAL CALLSIGN` line in any package, including the two chosen for callsigns (L01 designator BWA; L08 GTI flight dispatched by the `POLAR` desk under the Polar exemption). The callsign must come from the designator (CS-1, `aircraft-profile`). **SME-5**. |
| 32 | `oeiData` | | TLR section (PDF pages in §1.1): page header `REL n/n DDMONYY HHMMZ CCC#### ORIG/DEST DDMONYY`, title `TAKEOFF AND LANDING REPORT …`, `TLR-n SEQ-…`; `RUNWAY INFO` table `RWY LENGTH EFP NOTES` (+ NOTAM IDs per runway); `SPECIAL ENG FAIL TAKEOFF PROCEDURES` table; footer `FUFI<uuid> PAGE n/N` | 19 (19 live) | 🟡 | Present in every live package (closes v1.0 ❓). Parser returns runways + EFP in 19/19, special procedures in 11. **L10**: special procedure for one runway sits at a page end and the parser appends the TLR footer and next page header (`… FUFI<uuid> PAGE 1/4 REL 1/0 …`) to `proc`. |
| 32a | `ddgItems[].tlr` | | TLR `RMKS <ATA>` lines under `/// TAKEOFF DATA ///` (e.g. `RMKS 78-31-01A`, `RMKS 36-12-02-01 ONE VLV INOP`, `RMKS C27-51-02`) | 5 (5 live) | 🔴 | L10, L11, L12, L13, L16. Cross-reference impossible today because `ddgItems` is empty (row 25). `RMKS NADP2 REQUIRED` (L09) and `RMKS WET RUNWAY` / `RMKS NONE` are not ATA codes. |

**Free-text remarks seen (for `ofpRemarks[]`, `airportData[].remarks[]`, `securityMessages[]`, `permits[]`, `extraFuel`, `pcf`, §3):** PCF reasons (`- PCF ADDED FOR DEST WX`, `PCF FOR 45 MIN HOLD IN MIDDLE EAST`, `- CF FUEL FOR WX`, …, 12 packages; L17 writes `CF`; L04 has `- ADDITIONAL FUEL PLANNED FOR POTENTIAL ARRIVAL DELAYS` without the word PCF); tanker (`ECON TANKER FUEL ADDED`, L15); pre-fuel (`AIRCRAFT PRE-FUELED TO nnnnn`, L05); airport restriction blocks `** IIII FLIGHT OPS RESTRICTIONS **` with numbered items (L01) or with `ARRIVALS` / `DEPARTURES` sub-headings (L06); dashed fleet block `IIII B747 DEPARTURES:` (L09); security (`POS LAUNCH TO DWC APPROVED BY SECURITY`, L07); air-defence clearance (`BANGLADESH ADC NO-nnnn`, L17); dispatcher weather (`GOV TAF UPDATED` + a full `TAF AMD`, L15; `WSI FPG` turbulence block, T3); route notes (`ROUTED SOUTH TO AVOID POTENTIAL VA FROM <volcano>`, L03; `*ATLANTIC CROSSING // RANDOM ROUTE // MIRRORS NAT "<track>"*`, L12; `NO VA ACTIVITY AFFECTING FLIGHT`, L14); MEL changes in free text (`MEL ADDED` / ATA / defect / `DISP LC DDHHMMZ`, L12; `ADD MEL nn-nn-nn …` / `NO RESTRICTIONS`, L13); `RAIM VALIDATION FOR ETOPS ALTN IIII PASSED` (L14).

## 2.5 Route, ETOPS, nav log, sections — *pending*
## 2.6 Weather, NOTAM, Company NOTAM — *pending*
## 3. Extensions (ADR-005 Appendix B) — *pending*
## 4. SME questions — *pending (SME-1, SME-2 carried from v1.0)*
## 5. Summary and open ❓ — *pending*
