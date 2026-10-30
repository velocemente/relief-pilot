# ADR-004 — Canonical Briefing Model & Format-Independent Import

| Field | Value |
|---|---|
| **ID** | ADR-004 |
| **Version** | v1.3 |
| **Status** | **Accepted** — Exec, 2026-10-29 (D1) |
| **Supersedes** | Per-format hand-written parser (`_ofpRulesetParse`); SPRINT-OFP-FlightKeysMigration v1.0 §3 |
| **Extends** | ADR-001: a format profile is the per-customer OFP ruleset ADR-001 anticipated |
| **Related** | RPT-OFP-LiveDefectDiagnosis v1.1 · SPRINT-OFP-ImportPlatform v2.2 · ADR-003 (ARINC 840A) |
| **v1.2 change** | Exec decisions D6, D9, D11–D15 (2026-10-29); BTB/ATB new-flight rule; FlightKeys built first |
| **v1.3 change** | D6a declined; D16 Q (Special Qual Airport) marker; D17 resume-after-reload proposed; offline principle made explicit (no unrequested network activity) |

---

## In plain terms

- **What changes:** PilotBrief learns *what* each OFP item is — block fuel, a CAT II/III authorisation, a NOTAM — separately from *where* a given OFP layout prints it.
- **New formats:** a new format (FlightKeys, a future client, an XML feed) becomes a small layout description, not a new parser.
- **Self-checking:** every import checks itself — fuel and weight arithmetic, required items present, every airport has NOTAMs and weather. A bad or partial import is flagged instead of looking clean.
- **Navigation:** crews get the same bookmarks on every format.
- **Revisions:** re-uploading a revised package overwrites the flight's OFP data, keeps the crew's own entries, and shows exactly what changed.
- **Turn-backs:** after a BTB/ATB, the re-issued package for the same flight opens as a new flight.
- **The screens crews use today do not change**, apart from four additions: the revision number in the header, the changes card after a re-upload, BTB / ATB buttons beside the FCIR/ASAP toggle, and a **Q** beside Special Qual airports on the airport cards.
- **Offline means offline:** PilotBrief makes no network attempt unless the crew asks for one, or it is installing or missing a required file.

---

## Context

1. **New formats cost a near-rewrite.** FlightKeys left 17 fields silently empty; the parser knows positions in one layout, not meanings.
2. **Failures are silent.** DEF-A (214 suppressed NOTAMs), DEF-B (Company Remarks dumps) and the FlightKeys empty airport cards all imported "successfully".
3. **Several media are in service:** Navtech company PDF, iOS-printed eOFP and FlightKeys. ARINC 633 XML and ARINC 840A inbound context are on the horizon.
4. **Navigation depends on the PDF author.** The eOFP has no outline; the FlightKeys outline labels the flight plan `pdf-dev-ofp`.
5. **Revised packages are frequent** (Navtech revision numbers of 3–30 in the corpus). Today a re-upload silently replaces the flight with no record of what changed.
6. **Constraint:** the crew UI/UX is fixed.

---

## Decision

### Five layers — only layer 3 varies by format

```
 1 Input Adapter ─▶ 2 Format Detector ─▶ 3 Format Profile ─▶ 4 Canonical Briefing Model ─▶ 5 Outputs
   (per medium)        (scoring)            (per format)        + validation + provenance      legacy S · bookmarks
                                                                                              + revision comparison
                                                                                              change card · QA evidence
```

**1. Input Adapters (per medium)**
- The app already groups pdf.js text items into lines by page coordinates (2-pt tolerance, left-to-right). The PdfAdapter formalises that routine **unchanged**, so the flat text stays byte-identical for the legacy parser.
- It also keeps each item's page and position. Positions are used for provenance and for splitting genuine side-by-side columns, such as the FlightKeys weather briefing.
- Output: `Doc {meta:{producer, pageCount, outline}, pages:[{n, lines:[{text, y, spans:[{x, str}]}]}]}`.
- Future adapters: ARINC 633 XML, plain text, ARINC 840A inbound (read-only per the existing safety constraint).

**2. Format Detector**
- Each profile declares weighted signatures. The detector scores every profile.
- Below threshold, or two profiles too close, means **reject**. Nothing is half-parsed.

**3. Format Profiles (the only per-format code)**
- `strip` — running headers and footers to remove.
- `sections` — canonical section names with anchors: release, remarks, MEL, crew, nav log, CFS, tracks, alternate routes, TLR, Company NOTAMs, NOTAM briefing, weather briefing, FIR.
- `fields` — ordered fallback locators per field.
- `records` — repeating items: crew, MEL item, CAT approach, NOTAM, weather report, waypoint, ETP, alternate route, TLR runway, Company NOTAM.

**4. Canonical Briefing Model (format-free)**
- **Field registry.** One entry per field with type, unit, safety class (SC / OP / INFO), required condition, validators and its mapping to today's app field.
- **Canonical NOTAM record.** Effectivity is resolved once, at import, into absolute UTC using the issue-year rule (DEF-A); FlightKeys ISO dates map directly. Unresolvable windows carry a flag. **What the evaluator does with that flag is decided in the NOTAM engine rewrite (D8).**
- **Validation.** Produces `{status OK | WARN | FAIL, findings[]}` from three kinds of check:
  - *Field checks:* type, range, format.
  - *Cross-checks,* verified on both Navtech and FlightKeys:
    - TOF + TAXI = BLOCK
    - ZFW + TOF = TOGW
    - TOGW + TAXI = RAMP
    - TOGW − TRIP = LDGW
    - MINF ≤ TOF
  - *Completeness:*
    - CA is present.
    - Every release airport has NOTAMs and weather, or an explicit nil.
    - Safety-critical fields are present whenever their section exists.
- **Provenance.** Every value carries page, line and a short quote.

**5. Outputs**
- **`toLegacyShape()`** — the exact object the app consumes today; screens unchanged.
- **Semantic bookmarks (D7: always replace the PDF outline).** Generated from provenance in a fixed order:
  - Flight Plan, Fuel & Weights, Remarks, MEL/CDL, Crew
  - Nav Log, ETOPS/ETPs, NAT/PAC Tracks, Alternate Routes, TLR (per runway)
  - Company NOTAMs (per airport, curfew flagged)
  - NOTAMs (per airport: origin → destination → alternates → en-route), Weather (per airport)
  - FIR NOTAMs

  They feed the existing bookmark pills.
- **Revision comparison** — see below.
- **QA evidence** — a JSON snapshot per fixture; this is the regression baseline.

### Import outcome, correction, revisions and turn-backs (D2, D12–D14, Exec specification)

**Same flight.** Flight number + flight date + departure + destination. This extends the app's existing flight-number + date rule.

| Situation | Behaviour |
|---|---|
| Detector rejects, or a safety-critical field fails | Existing warning path: *"OFP not recognised / incomplete — brief from the paper OFP."* The crew can (a) re-upload the package, or (b) enter the missing value through the existing edit popover. A manual value is stored and shown as **crew-entered**, never as OFP data. |
| **Re-upload of the same flight** (revision) | The new package **overwrites all OFP-derived data**. Crew corrections are not part of this flow; a crew-entered substitute for an OFP field is replaced by the new package's value. |
| **Kept on re-upload (D12)** | Notes · FCIR/ASAP state and its event record · parking gate · ATIS entries · **any time the crew has updated** (OUT, OFF, IN, ETAs and other edited times). Where the new OFP also changed a time the crew had edited, the crew value stays in use and the changes card shows the OFP's new value beside it. |
| **Older revision uploaded (D13)** | If the new package's revision number is lower than the stored one, the crew is warned and must confirm before anything is overwritten. |
| Changes card | A dismissible subcard lists every changed item in **two columns: New (left) · Previous (right)**, grouped: Times · Fuel & Weights · Route & Alternates · CAT II/III · MEL/CDL · Crew · Slot/Curfew · Company NOTAMs · NOTAMs (added/removed by NOTAM ID). A switch hides it once viewed; the "viewed" state is saved with the flight. |
| Header (D14) | `Revision : 11` right-aligned on the OUT / IN row, immediately left of the share button, from the OFP header `Revision:` field. |
| **BTB / ATB (Exec specification)** | When the FCIR/ASAP toggle is on, **BTB** and **ATB** buttons appear beside it. Pressing one marks the flight as a turn-back. The next upload with the same flight number, departure and destination then opens as a **new flight**, not a revision. The original flight and its FCIR/ASAP record are left untouched. |

**Comparison method:**
- Field-by-field on canonical values.
- Record-by-record by natural key: NOTAM ID, MEL ATA code, crew employee number, CAT airport + category.
- Never text-diffed, so reformatting or page reflow never shows as a change.

**Assumptions to confirm at checkpoint C5:**
- Pressing BTB/ATB also adds a time-stamped BTB or ATB entry to the FCIR/ASAP event record.
- The new flight shows a link back to the original.

### Engineering workflow (Exec approval, 2026-10-29)

- **Source of truth is the GitHub repository**, not Drive copies.
  - Code lives as separate modules: import engine, profiles, NOTAM, weather, UI.
  - A build step bundles them into the single offline `index.html`; the delivered app shape is unchanged.
- **Every change is a pull request.**
  - Automated tests run on every PR: syntax, unit tests, and the golden-master comparison across all fixtures.
  - An independent review session (never the authoring session) checks the diff.
  - Martin approves as domain authority, from a plain-language summary and a beta check on iPad.
- **Retired:** the sentinel grep checklist, manual `str_replace` integration sessions and Drive file-version copies. Tests and version control replace them.
- **The `var`-only rule is retired after modularisation;** the build handles module scoping.
- **Fixtures contain crew names and employee numbers.** They live in a **private** fixtures repository (D11); names may also be redacted before upload.

---

## Migration — strangler, not big-bang

| Stage | Action | Gate |
|---|---|---|
| F0 | Test harness, CI, golden-master snapshots of **current** production on all fixtures | CI green on unchanged code |
| H | Hotfixes DEF-A, DEF-B and HF-3 (no background network activity) — PRs against current `index.html` | Tests + review + Exec beta check |
| F1 | Split `index.html` into modules; build reproduces it byte-for-byte | Built file hash = current file hash |
| P1 | Engine layers 1, 2, 4, 5 | Unit tests; cross-checks on real numbers |
| P2 | **`atlas-fk` profile first** — FlightKeys is going live (D6) | All 50 FlightKeys fields resolved or validated-absent |
| P5a | **FlightKeys packages routed through the engine;** Navtech/eOFP stay on the hotfixed legacy parser | Exec FlightKeys check on beta |
| P3 | `atlas-5y` profile (Navtech + eOFP) | Golden master: identical to production except pre-classified DEF-A/DEF-B fixes |
| P4 | Bookmarks; revision comparison; header field, changes card, BTB/ATB | Fixture tests; Exec iPad review |
| P5 | All formats through the engine; legacy parser kept dormant one release | Release Gate |
| — | NOTAM engine rewrite (next phase) consumes canonical NOTAM records | Separate sprint |

---

## Consequences

**Positive**
- New formats and clients become profiles.
- Silent failures become visible findings.
- Year-guessing leaves NOTAM evaluation.
- Bookmarks are consistent on every format.
- Revisions are traceable.
- Automated tests replace manual gates.
- Provenance strengthens the audit trail (patent: parse-once-to-shared-state).

**Negative / mitigations**
- *About 8 weeks for the full platform.* Hotfixes ship in weeks 1–2. FlightKeys moves onto the new import in about week 5. Until then FlightKeys packages go through today's parser, which leaves NOTAMs, weather, crew, CAT II/III and MEL empty; accepted because Exec is the only tester until then (D6a).
- *Porting a stable parser carries risk.* Golden master on 30 fixtures; legacy parser dormant for one release.
- *Modularising a 12,500-line file is a one-off risk.* The byte-identical build is proven by hash before any logic changes.
- *Fixture privacy.* Private fixtures repository plus a redaction tool.

---

## Decision Register

| ID | Decision | Status |
|---|---|---|
| D1 | Accept ADR-004 | **Accepted** |
| D2 | Warning + correction (re-upload or crew-entered value) + revision overwrite with changes card | **Accepted** |
| D6 | Block FlightKeys uploads in the hotfix | **Declined** — FlightKeys goes live before the platform completes. FlightKeys is built first instead (stage P2/P5a). |
| D6a | Interim FlightKeys notice until P5a | **Declined** — Exec is the only tester until P5a |
| D7 | Always use PilotBrief bookmarks | **Accepted** |
| D8 | Unresolved NOTAM validity behaviour | **Deferred to NOTAM engine rewrite.** Hotfix fixes R1/R2 only. |
| D9 | Archive undeployed Drive OFP ruleset v1.2 | **Done** 2026-10-29 — moved to `90_Old Versions` |
| D10 | Repository + automated tests as the development workflow | **Accepted** |
| D11 | Fixtures in a private repository; names may be redacted before upload | **Accepted** |
| D12 | Kept on re-upload: notes, FCIR/ASAP, parking gate, ATIS, crew-updated times | **Accepted** |
| D13 | Older revision → warn and require confirmation | **Accepted** |
| D14 | `Revision : NN` right-aligned, left of the share button | **Accepted** |
| D15 | BTB/ATB buttons with FCIR; post-turn-back upload opens as a new flight | **Accepted** (Exec specification; two assumptions to confirm at C5) |
| D16 | `Q` on ORIG/DEST/alternate lines = Special Qual Airport; parsed per airport (registry field) and shown as "Q" beside the airport name on the airport card | **Accepted** |
| D17 | After an iOS reload, return to the open flight, tab and phase (HF-4) | **Open** |
| D18 | Production release method: Exec copies the approved beta files (index.html, sw.js, manifest.json) to `velocemente/PilotBrief` by GitHub web upload; Claude has no write access to production | **Accepted — A** (29 Oct) |
| — | Meaning of FlightKeys IA / TA windows | **Open** — Exec to define before P2b |
