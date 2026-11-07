# ADR-005 — Modular OFP Platform: format parsers, shared rulesets, import and bookmarks

| Field | Value |
| :---- | :---- |
| **ID** | ADR-005 |
| **Status** | **ACCEPTED** — Exec, 2026-11-07 (v1.0) |
| **Date** | 2026-11-07 |
| **Decision owner** | Exec |
| **Prepared by** | Planning chat (Pilot Brief project) |
| **Extends** | ADR-001 Ruleset Modularity (2 Apr 2026); Ruleset Platform Blueprint 1.0.0 (3 Apr 2026); SOP-PROJ-OperatingPractice v1.0 Vol. III (Ruleset Testing Gate) |
| **Supersedes** | ADR-004 Canonical Briefing Model v1.3, except the decisions carried forward in §6 |
| **Master rulesets** | Drive "00\_General Rulesets" (1UgCy\_FbzwvEQH9f8mPih3L4a010\_UrDf) — module code, SPECs and revision ledgers only |
| **Sprint and build documents** | Drive build folder (14UbFJSe-IKGjdsv0C7qVlsxJO0PWRoGy) — this ADR, sprint plans, prompts, reports |

---

## 1\. Context

1. ADR-001 and the Blueprint decided that interpretation logic (NOTAM, weather, OFP) lives in **standalone, versioned rulesets**, each tested on its own and then built into the app. The master copies are in "00\_General Rulesets": NOTAM ruleset v1.10.1 (+ revision ledger), weather rules, NAT tracks, GNSS NOTAMs, inflight rest, en-route timeline, rules loader, and the OFP ruleset (CODE-OFP-AtlasPolar5yRuleset v1.0/v1.1 with SPEC).  
2. The October sprint instead adopted ADR-004: a new engine inside relief-pilot (`src/import/`: PDF adapter, format detector, canonical briefing model, validation, legacy-shape converter, FlightKeys profile). It superseded the OFP ruleset and archived its v1.2 (D9). The NOTAM fixes of the last two sprints (HF-1, HF-5, HF-6, HF-8) were applied to the copy built into the app (`src/notam.html`); the master NOTAM ruleset was never updated and now differs from the app.  
3. A new OFP format, FlightKeys, has arrived (19 live packages collected). The NavBlue (Navtech) format remains in use and may be used by other customers.  
4. Exec direction (7 Nov): return to the modular platform. NOTAM, weather, ICAO flight plan, registration and similar knowledge are **static** modules shared by every format. Each OFP format has its **own parser**: NavBlue is locked and named "NavBlue"; FlightKeys is a separate parser. Importing the eOFP of either format and **creating bookmarks** is essential.

## 2\. Decision

### 2.1 Module catalogue

**Shared modules (format-independent):**

| Module | File (master in Drive) | Responsibility | Starting point |
| :---- | :---- | :---- | :---- |
| NOTAM ruleset | `notam-rules` v1.11.0 | NOTAM splitting, header and date reading (NavBlue and FlightKeys header styles), schedules, evaluation (`evalNotams`), grouping | Drive v1.10.1 \+ every NOTAM rule built into the app since (HF-1, HF-5 T1–T6, D38, HF-6 D43 and the New-Year window, HF-8 schedules and UFN/EST, D27, D31) |
| Weather ruleset | `wx-rules` | METAR/TAF classification; E-WINS overrides status when issued, both reports shown raw (D46) | Drive `wx-rules.js` \+ app behaviour |
| ICAO flight plan | `icao-fpl` v1.0.0 (new) | The filed ICAO FPL block: flight ID, aircraft type, wake, equipment field 10a (D41), route, EOBT, destination/alternates, DOF, REG, EET, SEL, RMK | Extracted from the NavBlue parser (FPL patterns) |
| Aircraft and registration | `aircraft-profile` v1.0.0 (new) | Type and registration profile (wingspan, MTOW, code, wake), approach category (D44, needs fleet table), callsign index (CS-1: designator → callsign, e.g. GTI \= GIANT) | Extracted from the app (`buildAcftProfile`, callsign derivation) |
| NAT tracks | `natTrackRuleset` | Track message and track/random-route recognition | Drive file |
| GNSS NOTAMs | `gnssNotamRuleset` | As today | Drive file |
| Inflight rest | `inflight-rest-module` | As today | Drive file |
| En-route timeline | `CODE-ENR-TimelineEvents` | As today | Drive file |

Curfews, CAT II/III authorisations and permits stay inside the OFP parsers (format-specific wording); no further shared modules are needed (Exec, 7 Nov).

**OFP format parsers (one per format, one output contract):**

| Module | File (master in Drive) | Status |
| :---- | :---- | :---- |
| NavBlue OFP parser | `ofp-navblue` v2.0.0 | Today's OFP ruleset (CODE-OFP-AtlasPolar5yRuleset, in the app as `_ofpRulesetParse`), renamed and **locked** (§2.4) |
| FlightKeys OFP parser | `ofp-flightkeys` v1.0.0 (new) | Built against the 19 live packages and the Exec's truth sheets |

**Platform:**

| Module | Responsibility | Starting point |
| :---- | :---- | :---- |
| Import platform | Read the PDF with pdf.js 3.11.174 (text and positioned items), detect the format, route to the matching parser, attach the parser's sections as bookmarks | `src/import/adapter-pdf` and `detector` (retained) |
| Rules loader | Fetch/cache/fallback per the Blueprint | Drive `rules-loader.js`; **deferred** until the modules are in place (bundled baseline only until then) |

Customer ≠ format: a customer uses one or more formats (Atlas Air: NavBlue and FlightKeys during transition). Customer configuration (Blueprint) maps customer → formats and rulesets.

### 2.2 Module standard

Every module, shared or parser:

1. **One standalone file**, dual-context as the OFP ruleset SPEC §3 already defines: runs in Node for tests, and is built into `index.html` unchanged by the build.  
2. **Metadata** per the Blueprint: `RULESET_TYPE`, `RULESET_VERSION` (semver), `SCHEMA_VERSION`, `RULESET_SOURCE`, and a `validateSchema()` (closing NOTAM ledger items ARCH-01/02).  
3. **No app state, no DOM, no UI.** Pure input → output.  
4. **SPEC** (Tier 2 document) and **revision ledger** per module, in the master folder.  
5. **Test battery** per module (unit \+ real-package acceptance), run in CI.  
6. **Gate** per SOP Vol. III-1 (self-test, smoke on real OFPs, documentation, safety check on safety-critical fields), plus an independent Opus QA session, before the module version is integrated.

### 2.3 Master copies and CI

1. **Master:** the gated version of each module, its SPEC and its ledger live in "00\_General Rulesets" (one subfolder per module; older versions to `90_Old Versions`).  
2. **CI copy:** relief-pilot holds a byte-identical copy in `rules/<module>/`, with a manifest listing each module's version and SHA-256. CI fails if a module file does not match its manifest entry.  
3. **Workflow:** a module change is developed and gated (tests in CI on a branch); at the gate, the same file is written to the master folder and its hash recorded; integration into the app is a **separate** PR that only updates `rules/` from the master and rebuilds. Every module in the app can therefore be traced to an identifiable master copy.  
4. Development may run in parallel in the repository, but nothing is integrated whose master copy is not in the folder.

### 2.4 OFP output contract

Every OFP parser returns **the briefing contract**: the fields the app consumes today, plus defined extensions.

- **Core fields (Appendix A):** exactly the return object of today's `_ofpRulesetParse` (57 fields). Field names, types and meanings are unchanged; the screens and rulesets keep working without change.  
- **Extensions (Appendix B):** data the app is to show that the core does not carry. Every parser returns every extension field; a format that does not carry an item returns an **explicit empty value**, never omits the field.  
- **Findings:** each parser returns `findings[]` (INFO/WARN) for anything read as explicitly empty, not read, or unusual.  
- **Sections (bookmarks):** each parser returns `sections[]` (§2.6).  
- **Contract versioning:** the contract has its own version (v2.0 at adoption). Adding a field is a minor version; changing a field's meaning is a major version and needs an Exec decision.

**NavBlue lock (Exec, 7 Nov):** `ofp-navblue` v2.0.0 must produce **identical core fields** on all 30 NavBlue/eOFP packages (golden and V0 snapshots unchanged). It returns the extensions as explicit empties and **stays locked**: no extension work is planned for NavBlue. Any future change needs an Exec decision and its own gate.

**FlightKeys acceptance (FK-P):** for every core field, `ofp-flightkeys` gives the rulesets exactly what NavBlue gives for the same OFP content; extensions as defined in Appendix B; values equal the Exec's checked truth sheets.

### 2.5 NOTAMs across formats

Parsers **locate** NOTAM text (per airport, en-route, company) and pass it unchanged. The **NOTAM ruleset** owns the NOTAM grammar: it reads both header styles (NavBlue "- PANC A6531/26 03NOV1800-04NOV0200"; FlightKeys "PANC A6531/26 2026-Nov-03 18:00 \- 2026-Nov-04 02:00", "UFN(EST …)"), applies the same date rules and fail-safe to both (D27, D31, T1–T6, D38, D43, HF-8), and evaluates them. NOTAM knowledge therefore exists once, in one module.

### 2.6 Import and bookmarks

1. Packages downloaded from the company source carry a native PDF outline; packages imported from the eOFP app do not. Bookmarks are therefore **always built from content**, never from the embedded outline (carries forward ADR-004 D7).  
2. Each parser recognises its format's sections and returns `sections[]`: `{ id, title, startPage, endPage, anchor }` — e.g. OFP (release), Company NOTAMs / High Severity Company NOTAMs, NOTAM Briefing (per airport), Weather Briefing (per airport), NAT Tracks, PACOTS NOTAMs (D42), Hazard Briefing, Takeoff/Landing Report, SigWx Charts, Flight Attachments; for NavBlue, its equivalent sections.  
3. A release printed more than once in one package is recognised; bookmarks point to the first copy and the parser reports whether the copies are identical.  
4. Bookmark titles and order are one list shared by both formats, so the crew sees the same bookmark bar whatever the format.  
5. The list is accepted in principle (Exec, 7 Nov); its final names and order are confirmed by the **Exec's visual check in the app** at the import-platform gate.

### 2.7 Retirement

After `ofp-flightkeys` passes its gate and is integrated, the ADR-004 engine parts not retained are removed: canonical briefing model, `validate`, `toLegacyShape`, and the FlightKeys profile `atlas-fk.js`. Their tests are replaced by the module batteries. The PDF adapter and format detector stay, as the import platform. Knowledge already proven in `atlas-fk.js` (Exec, 7 Nov: the OFP portion reads correctly except DDGs, remarks and CAT II/III) may be carried into `ofp-flightkeys`, re-tested against the contract and truth sheets.

## 3\. Consequences

**Positive**

- One copy of each piece of knowledge (NOTAM, weather, ICAO FPL, aircraft) shared by every format; the NavBlue/app divergence ends.  
- A new customer format means one new parser module; nothing else changes.  
- Every engine in the app traces to an identifiable master copy in Drive.  
- NavBlue, which other customers may use, is protected by a lock.

**Negative / mitigations**

- Extraction work before FlightKeys reaches the app. Mitigation: NOTAM first (most safety value), then NavBlue lock, shared modules, import/bookmarks, FlightKeys — each gated.  
- Two copies (Drive master, repo) can drift. Mitigation: hash manifest checked in CI.  
- Behaviour change while extracting. Mitigation: every extraction must leave the app's output unchanged (golden, V0 NOTAM-at-ETA and app-path snapshots), proven before merge.

## 4\. Alternatives considered

| Option | Rejected because |
| :---- | :---- |
| Keep ADR-004 engine, re-sync Drive afterwards (Option A) | Keeps knowledge inside the compiled package; does not restore modular rulesets; Exec chose B |
| One "universal" OFP parser with format branches | Mixes formats; changing one format risks the other; contradicts the NavBlue lock |
| Parsers normalise NOTAMs into records themselves | Duplicates NOTAM knowledge per format; NOTAM grammar belongs to the NOTAM ruleset |

## 5\. Order of work (detailed in the sprint plan)

1. This ADR (accepted).  
2. NOTAM ruleset v1.11.0 as a standalone module (app output unchanged).  
3. NavBlue OFP parser v2.0.0 locked as its own module.  
4. Shared modules extracted: ICAO FPL, aircraft/registration/callsign.  
5. Import platform and content-built bookmarks for both formats.  
6. FlightKeys OFP parser, trained on the 19 live packages and truth sheets.  
7. FlightKeys integrated into beta; ADR-004 parts retired. Rules loader and customer configuration follow.

## 6\. Carried forward from ADR-004 / plan v3.3

D7 (PilotBrief bookmarks always used), D14 (revisions), D15 (BTB/ATB), D23 (acknowledged safety warnings), D27, D31, D34, D38–D46, CS-1, FK-P, and the test infrastructure (fixtures repo, golden and V0 snapshots, CI with same-name fixtures branches).

## 7\. Exec review (7 Nov 2026\)

| \# | Question | Answer |
| :---- | :---- | :---- |
| 1 | Shared modules missing? | No |
| 2 | Appendix B complete? | Yes, so far |
| 3 | NavBlue extensions later, or locked? | Locked — it works very well |
| 4 | Bookmark names and order? | Correct in principle; must be seen in the app by a human (§2.6.5) |
| — | FlightKeys OFP portion | Reads correctly today except DDGs, remarks and CAT II/III authorisations/restrictions (Exec observation; the parser's acceptance remains the truth sheets and the contract) |

---

## Appendix A — Core contract fields (today's `_ofpRulesetParse` return)

| Group | Fields |
| :---- | :---- |
| Identity | fltNum, acftType, weightUnit, isHeavy, dateStr, flightDateISO, parsedVerbalCallsign, rawOFP |
| Airports and times | origIcao, destIcao, offFromOFP, etaDest, destEtaOffsetMins, tripMinutes, taxiMins, tocOffsetMins, altData, altRoutes |
| ETOPS / redispatch | etopsEntry, etopsSpec, etopsEntryMins, etopsExit, etopsExitMins, etpPoints, porWpt, porOffsetMins, porMinf |
| Fuel | blockFuelRaw, minfFuelRaw, fresFuelRaw, alt1Fuel, destRemf, taxiFuelRaw, ballastFuel, addlFfAdj, zfwIncrFactor |
| Weights | togwActual, togwLimit, zfwActual, zfwLimit, ldgwActual, ldgwLimit, hasVzfwCkLimit |
| Crew | crewMembers (role, emp number, name parts, display name, active, isSen) |
| Special conditions | hasPerishables, hasTemperatureControl, dotExemption (number, restrictions, altRequired), slotTime |
| Approaches | catIiIiiApproaches |
| MEL/DDG | ddgItems (code, desc, tlr), melItems |
| Route and permits | navLog, overflightPerms, natTrack |
| Performance | oeiData (TLR) |
| Briefing | airportData {icao: weather, notams, curfew, opsNotes, ewins\*}, enrouteNotams {route, fir, airway, waypoint, geographic} |

## Appendix B — Extensions (contract v2.0)

| Field | Content | Source decision |
| :---- | :---- | :---- |
| `revision` | Revision number, release number and time; copies of the same release in the package and whether identical | D14; repeated release |
| `companyNotams[]` | Every company NOTAM: id, airport (or none), subject, window, text, provenance (page, line) | Exec 7 Nov ("all company remarks") |
| `ofpRemarks[]` | Every line of the OFP Remarks, in order, with provenance; airport-specific blocks also attached to the airport | Exec 7 Nov; D34 |
| `airportData[icao].remarks[]` | Airport-specific remarks with their sub-heading (e.g. ARRIVALS, DEPARTURES) so the app can place them on the right sub-card | D34 |
| `airportData[icao].remarksWeather[]` | Weather given in the remarks (dispatcher TAF, WSI, E-WINS) with its source; never merged into briefing weather | D34, D46 |
| `ddgItems[i].type`, `ddgItems[i].notes[]` | MEL or CDL; every procedure and RMK line under the item, in order, with its indentation | Exec Q3; "DDGs now have notes" |
| `fplEquipment` | Filed ICAO FPL field 10a, and the codes the MEL notes say were removed | D41 |
| `catIiIiiRestrictions[]` | Restriction lines (e.g. "CAT II/III RWY 36C APPROACH NOT AUTHORIZED FOR B747"): airport, category, runways, text — never an authorisation | FK-P / safety |
| `securityMessages[]` | e.g. "POS LAUNCH TO DWC APPROVED BY SECURITY" — for the Preflight card | D45 |
| `extraFuel` | EXTRA amount and time, tanker flag (only when the OFP says the extra is tanker fuel for this flight), reason | D39 |
| `pcf` | Contingency fuel added and its reasons | Exec (PCF remarks) |
| `permits[]` | Overflight, landing, takeoff permits and air-defence clearances, in order, with any registration restriction ("N860GT AUTH ONLY") | Q5 |
| `designator` | Three-letter operator designator from the flight number (callsign resolved by the aircraft/callsign module, CS-1) | CS-1 |
| `sections[]` | Bookmarks: id, title, start/end page, anchor | §2.6 |
| `findings[]` | INFO/WARN items, e.g. counts of MX/LM/FA crew lines (not shown), explicit empties | §2.4 |

