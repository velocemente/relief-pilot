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

## 2.2 Fuel — *pending (next push)*
## 2.3 Weights — *pending*
## 2.4 Remarks / release — *pending*
## 2.5 Route, ETOPS, nav log, sections — *pending*
## 2.6 Weather, NOTAM, Company NOTAM — *pending*
## 3. Extensions (ADR-005 Appendix B) — *pending*
## 4. SME questions — *pending (SME-1, SME-2 carried from v1.0)*
## 5. Summary and open ❓ — *pending*
