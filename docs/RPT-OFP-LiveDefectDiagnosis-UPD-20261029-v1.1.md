# RPT-OFP-LiveDefectDiagnosis

**Version:** v1.1 | **Status:** UPD | **Date:** 2026-10-29
**Supersedes:** v1.0 (same day). All figures are now re-measured on genuine pdf.js 3.11.174 text, using the app's own line-assembly routine.
**Session type:** Diagnosis only. No canonical file was changed.
**Baseline diagnosed:** `velocemente/relief-pilot` @ `a84efae` (v1.9.9, 5 Jun 2026) — the deployed beta code
**Corpus:** 32 packages from `OFP Training`:
- 26 Navtech company PDFs;
- 4 iOS-printed eOFPs;
- 2 FlightKeys prototypes.

---

## 1. Summary

| ID (assign at triage) | What crews see | Cause | Measured on the corpus | Severity |
|---|---|---|---|---|
| **DEF-A** | Long-term NOTAMs missing from airport cards, apparently at random | The app misreads the year on certain NOTAM validity dates, so valid NOTAMs are judged "not in effect" at ETA | **214 of 3,424 NOTAMs (6.3 %)** in **23 of 30** packages; **118** concern runways, ILS, approaches, lighting or closures | **S0** |
| **DEF-B** | Huge blocks of the OFP appear under an airport's Company Remarks on some flights | The remarks extractor reads the space *between* two remarks blocks as if it were a remarks block | **9 of 30** packages, 9–18 K characters each, on departure **and** alternate airports | **S1** |

Both faults are deterministic. They look random because the triggers depend on dates and on how each OFP is laid out (§2.3, §3.3).

---

## 2. DEF-A — Valid NOTAMs judged "not in effect"

### 2.1 What the OFP provides

Navtech NOTAM header line: `- RJAA A0509/26 06APR1500-28APR2000 [YYYY] [EST]`

- The start date never carries a year.
- Long-term NOTAMs carry an end year (2027 or 2028).
- The issue year is in the NOTAM number (`/26`).

### 2.2 The two faults

| Fault | NOTAMs | What goes wrong | Examples suppressed today |
|---|---|---|---|
| **R1 — daily schedule read as a year** | 72 | When a NOTAM has a daily schedule line under its header (e.g. `1410-2030`), the app reads `1410` as the year. The NOTAM appears to have expired 600 years ago. | RJAA A0486/26 **RWY 16L/34R CLSD DUE TO MAINT** |
| **R2 — start year taken from the flight, not the NOTAM** | 142 (87 dated, 55 PERM) | NOTAMs issued last year, or earlier, are dated as if they start this year. If the start month is later than the flight month, the NOTAM appears not yet in effect. | PAED V0716/25 **PAR RWY 16 NOT AUTHORIZED**; KORD A8813/25 **ILS RWY 09C IM U/S**; EDDF A6663/25 **RWY guard lights off during CAT II/III**; EIDW B1124/23 **ILS GP RWY 16 RDH 50 FT** |

### 2.3 Why it looks random

- R1 only hits NOTAMs that have a daily schedule line; these are mostly maintenance closures.
- R2 only hits NOTAMs issued in an earlier year **and** starting later in the calendar than the flight month.
- So the same NOTAM disappears in some months and shows in others.

### 2.4 Proven fix (scratch copy; repository untouched)

1. **R1:** an end year must be on the same line and look like a year (20xx).
2. **R2:** the start year comes from the NOTAM's issue year. Take the latest year from issue year to end year that keeps the start before the end. PERM follows the same rule.

**Result on the corpus:** operationally relevant NOTAMs wrongly suppressed go from 118 to **0**. Seven NOTAMs remain without a sensible window: 5 have malformed source dates and 2 have genuinely expired. Both the current code and the fix treat these as in effect.

**Scope (per Exec decision D8):** the hotfix corrects only these two faults. No other NOTAM behaviour changes until the NOTAM engine rewrite.

---

## 3. DEF-B — OFP sections dumped into Company Remarks

### 3.1 What goes wrong

- Station remarks in the OFP Remarks section sit between dashed lines (`-----`).
- The app takes the text between **every consecutive pair** of dashed lines. That includes the stretch after one remarks block ends and before the next begins: CAT II/III list, MEL, release, crew, fuel pages, and the package's repeated Flight Plan copies.
- If that stretch starts with a line naming a release airport, usually a CAT II/III line such as `RJAA CAT II/III - RWY 16R`, the whole stretch is filed as that airport's Company Remarks.

### 3.2 Packages affected (pdf.js text, production code)

| Package | Airport (role) | Characters dumped |
|---|---|---|
| NB_CHS-TAR (LCF) | EIDW (alternate) | 18,273 |
| NB_ORD-ICN GTI8993 | RJAA (alternate) | 16,613 |
| NB_SYD-HKG RDA | YSSY (origin) | 16,082 |
| NB_MIA-AMS ETP | CYYT (ETOPS alternate) | 15,912 |
| JEPP_LGG-ORD 12 OCT | EBLG (origin) | 13,286 |
| NB_TK Callsign | LTFM (origin) | 11,812 |
| NB_UAM-OSN DOD | RKSI (alternate) | 11,105 |
| NB_PdfPackage_B (RJAA–PANC eOFP) | RJAA (origin) | 9,403 |
| NB_GTI7134 RJAA | RJAA (origin) | 9,382 |

### 3.3 Why it looks random

All three conditions must hold:
1. The Remarks section contains at least two dashed blocks, or the package repeats the Flight Plan.
2. A line naming a release airport comes right after a closing dashed line.
3. That airport has no genuine remarks block earlier.

### 3.4 Drive ruleset v1.2 (September)

- That version contained a patch that capped remarks at 600 characters.
- It was never deployed.
- It hid the symptom but would also have cut off genuine long remarks.
- **Archived** as superseded on 2026-10-29 (Exec decision D9), in `90_Old Versions`.

### 3.5 Proven fix (scratch copy)

1. Read only each Flight Plan copy's `Remarks` section, from the `Remarks` heading to the RAIM / CAT II/III / MEL lines.
2. Treat dashed lines as **opening and closing pairs**; never read the gap between pairs.

**Result on the corpus:**
- Dumps go from 9 to **0**.
- All 15 genuine Navtech station remarks are kept, now without the stray trailing dashed line.
- 4 FlightKeys items the current code wrongly reads from Company NOTAMs are no longer misfiled; the FlightKeys profile handles them properly.

---

## 4. Test Cases Carried Forward

| TC | Package | Check |
|---|---|---|
| TC-110-001 | NB_GTI7134_RJAA | RJAA A0486/26 RWY 16L/34R CLSD in effect on its scheduled days |
| TC-110-002 | NB_DNA-ANC_ETOPS | PAED V0716/25 runs 2025-09-08 → 2026-10-31; PAR RWY 16 not authorised is in effect |
| TC-110-003 | JEPP_LGG-ORD_12OCT | KORD A8813/25 and A8811/25 (ILS IM U/S) start 2025-12-30 and are in effect |
| TC-110-004 | NB_CHS-TAR_LCF | EDDF A6663/25 and EIDW B1124/23 (PERM) in effect |
| TC-110-005 | all Navtech/eOFP | No NOTAM dated before year 2000; no start after end |
| TC-110-006 | all Navtech/eOFP | Count of NOTAMs judged "not in effect" changes only for R1/R2 cases |
| TC-110-010 | the 9 packages in §3.2 | No Company Remarks over 1,000 characters; none contains `Flight Release Authorization`, `MEL/CDL` or `ATLAS AIR BRIEF PAGE` |
| TC-110-011 | NB_HKG-ANC ×3 | VHHH "B747 DEPARTURES" remark kept |
| TC-110-012 | NB_CMB_Callsign_NAT | KWRI, EPRZ, EPPW remarks kept |

---

## 5. Method

- **PDF text:** pdf.js 3.11.174 (the app's version), run from Mozilla's source at that release tag. The app's own line-assembly routine was replicated exactly: 2-point line grouping, left-to-right ordering, gap-based spacing.
- **Parser under test:** the production main script from the repository, run unmodified in a sandbox with stubbed browser objects.
- **Earlier v1.0 figures:** these came from a different PDF extractor and differed slightly (DEF-A 229 / DEF-B 11). The conclusions are unchanged.
