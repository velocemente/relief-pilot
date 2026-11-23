# PilotBrief Operating Practice — IV-1. index.html Code Map

Extracted from SOP-PROJ-OperatingPractice-NEW-20260606-v1.0 (Volume IV — Technical Reference, §IV-1).

**Baseline:** v1.9.9 | 12,578 lines

| Lines | Region | Touch for |
|---|---|---|
| 1–39 | `<head>` | Meta tags, manifest link |
| 40–1847 | `<style>` | CSS, design tokens, responsive |
| 1854–2226 | HTML screens | Screen layout, panels, tab structure |
| 2236–3351 | Weather modules | METAR, TAF, SIGMET, PIREP parsing |
| 3352–5832 | NOTAM engine | Classification, scheduling, eval |
| 5833–6159 | NAT Track | Atlantic track parser/renderer (IIFE) |
| 6160–6599 | State & defaults | S object, both default blocks |
| 6600–7072 | PDF pipeline | Import, page render, bookmark pills |
| 7073–7408 | PATTERNS | All OFP regex patterns (§2–§8) |
| 7477–8100 | `_ofpRulesetParse()` | Main OFP parser (600+ lines) |
| 7598–7658 | └ parseCrew | Crew name/role extraction (IIFE) |
| 8332–8463 | Utilities + parseOFP | `fuelK()`, `esc()`, state merge |
| 8528–8616 | `renderNote()` | Master render dispatcher |
| 8617–9077 | `renderPreflightPhase()` | Fuel/weight, MINF ADJ, cascade |
| 9078–9314 | `renderEnroutePhase()` | Timeline, ETP V2, ETOPS, CO RPTs |
| 9315–9826 | Inflight rest | `calcInflightRest()`, gap buffer |
| 9827–10061 | `renderDescentPhase()` | Arrival fuel, MLDW |
| 10230–10240 | `ev()`, `esc()` | Edit wrapper, HTML escape |
| 10442–10611 | Edit system | `openEdit()`, `confirmEdit()` |
| 10612–10920 | Copy/share | `_pbCopy()`, ACARS, clipboard |
| 10921–11490 | Airport system | `buildAirportCards()`, `evalAirport()` |
| 11491–11855 | OEI/DDG + storage | Engine-out, save/load flights |
| 11856–12203 | Import + navigation | PDF drag-drop, `push()`/`pop()` |
| 12213–12500 | Settings + help | Screens |
| 12501–12578 | SW registration | Service worker lifecycle |

**Update this map** when any session adds, moves, or removes functions.

---

*Checked against `index.html` when added to this repository (F0): 12,578 lines, matching the baseline above. Spot checks: `_ofpRulesetParse` at 7477, `PATTERNS` at 7122, `xNW_standalone` at 3787 and `evalNotams` at 5428 (NOTAM engine), `processPDF` at 6899 (PDF pipeline), `esc` at 10237, `_splitNotams` at 11602 (OEI/DDG + storage region). Treat the boundaries as a starting point and confirm by reading the code.*

---

## Step 5e-1 — the module switch (17,661 lines)

`index.html` is the build of `src/` and `rules/` (`node build/build.js`, 26 parts). The table above is the v1.9.9 baseline; since 5e-1 the file is laid out as below. Line numbers are those of the 5e-1 build; confirm by reading the code.

| Lines | Part | Touch for |
|---|---|---|
| 1–1847 | `src/styles.html` | CSS (unchanged; the findings list reuses `.section`, `.callout`) |
| 1848–3357 | `src/screens.html`, `src/weather.html` | Screens, weather |
| 3358–3641 | `rules/aircraft-profile` v1.0.0 | `AircraftProfile` |
| 3642–6351 | `rules/notam-rules` **v1.14.0** (was v1.13.0) | `NotamRules`: D67 obstacle rule, FlightKeys type headings (§5b) |
| 6352–6473 | `src/notam.html` | binds `evalNotams`, `_splitNotams`; GNSS |
| 6474–6885 | `rules/nat-rules` **v1.2.0** (new) | `NatRules`: the NAT parser for NavBlue text and FlightKeys track messages (D77) |
| 6886–7065 | `src/nat.html` | `window.parseNatTrack = NatRules.parseNatTrack`; `renderNatTrack` (unchanged); the v1.1.0 parser is removed (frozen copy `test/oracle/nat-v1.1.0.html`) |
| 7066–7994 | `src/state.html`, `src/storage.html` | `S`, `pdfRawText`, **`pdfPages`**; `resetStateForNewFlight()` clears `S.ofpFindings` and `pdfPages`; save / load |
| 7995–8259 | `src/pdf.html` | `processPDF()` (~8075): text lines **and the positioned items per page** (`pdfPages`, the copy in `tools/extract/extract.js`); `importManual()` (pasted text, no positions) |
| 8260–8681 | `rules/icao-fpl` v1.0.0 (new in the app) | `IcaoFpl`, passed to the FlightKeys parser |
| 8682–11600 | `rules/ofp-flightkeys` **v1.0.1** (step 5e-2 display PR 1, O-116; v1.0.0 frozen in `test/oracle`) | `OfpFlightKeys.parseFlightKeys` |
| 11601–13234 | `rules/ofp-navblue` v2.0.1 | `OfpNavBlue` (locked, D47) |
| 13235–13493 | `src/ofp-parse.html` | `_ofpRulesetParse` (NavBlue adapter, unchanged); **`_ofpDetectFormat`** (O-78), **`_ofpParse`** (router), **`_ofpShownFindings`** (O-88); `parseOFP()` (~13313) stores `S.ofpFindings` |
| 13494–14058 | `src/render-preflight.html` | `renderPreflightPhase()` (~13587): the **OFP findings** list at the top (O-76, O-87) |
| 14059–17661 | the other `src/` fragments | unchanged order: enroute, rest, descent, edit, airports, oei, copy, import, settings, sw-register |

## Step 5e-2 display PR 1

Same 26 parts. FlightKeys parser v1.0.1 is built in (O-116; v1.0.0 frozen in `test/oracle`). The new code lives here:

| Part | Function | What |
|---|---|---|
| `src/ofp-parse.html` | `_ofpPilotCount`, `_crewChips`, `_ofpDispatchContact`, `_ofpNatMessages`; `parseOFP()` | D62 pilot count; rest chips with the printed roles, no names (O-124); D72 Dispatch contact label; D85 NAT messages parsed once; D57 date rule; D89 refusal returns `false` |
| `src/pdf.html` | `processPDF()`, `importManual()` | D89: stay on the import screen after a refusal |
| `src/storage.html` | `putFlights()`, `_crewAnon()`, `loadFlight()` | O-107 failed-save toast; D62 names removed from saved flights |
| `src/edit.html` | `_d57Today`, `_d57Read`, `_d57Set`; `openEdit('date')`, `confirmEdit()` | D57 date pop-up |
| `src/render-preflight.html` | `renderNote()` header date slot; `renderPreflightPhase()` Departure subcard | D57 "Operating date needed"; D72 Dispatch row |
| `src/render-enroute.html` | `_natCardTrack()` | D85 NAT card object: every published direction, its own TMI, chosen first (F-2); "Tracks not readable" only with an OFP Alerts line (F-3, F-6) |
| `src/ofp-parse.html` | `_ofpAlertFindings()` | OFP Alerts input: parser findings + the card's own NAT parses (F-3) |
| `src/nat.html` | `renderNatTrack()` | five declared edits (D85, O-122, F-2, F-3; TC-174-003) |
| `src/airports.html` | `_d67bRows`, `_d67bRuleText` (below `evalAirport`) | D67b / O-105 card rows |
| `src/state.html` | `_tlNotBeforeEntered()` | O-121: no time dated before a crew-entered date |
| `src/rest.html` | `_crewCountSync()` | O-124: the pilot count follows the crew's chip edits |

## Step 5e-2 display PR 2

Same 26 parts. FlightKeys RAW views, hazards, FIR labels, FIR-keyed Company items, the O-110 items, O-118 / F-5. The new code lives here:

| Part | Function | What |
|---|---|---|
| `src/state.html` | `_rawViews` | the open flight's RAW views (never saved); cleared by `resetStateForNewFlight()` with the new FlightKeys state keys |
| `src/pdf.html` | `_pdfReadText()` | the `processPDF()` text-and-items loop (the `tools/extract` copy), also used for the stored PDF |
| `src/ofp-parse.html` | `_ofpRawViews`, `_ofpRawIndex`; `parseOFP()` | O-104 / O-107 RAW views and their index (`S.rawIndex`, no text); FlightKeys `S.ofpFormat`, `securityMessages`, `permits`, `catIiIiiRestrictions`, `ofpRemarks` (O-127: PCF, extra fuel, route, ADHOC penalty); `airportData[icao].remarks` / `remarksWeather` |
| `src/storage.html` | `_saveStrip`, `_savesStrip`; `saveFlight()`, `loadFlight()`; `_ofpRederive`, `_rawMissing`, `_rerenderOpen` | O-118 / F-5: no OFP text or crew name in a save, every save stripped at start (`src/copy.html` INIT); the OFP text and RAW views re-derived from the stored PDF |
| `src/edit.html` | `_opsNoteBody`, `renderAptOpsNotes()`, `_rawBody`, `renderRawGroup`, `renderAptRaw` | airport remarks and CAT II/III restrictions in Company Remarks; TANKER rule; the card's RAW NOTAMs / RAW Weather / Remarks Weather groups |
| `src/airports.html` | `buildAirportCards()`, `evalAirport()` (`_wxSource`) | the card's RAW groups; remarks weather as a second weather source (not under E-WINS) |
| `src/render-enroute.html` | `renderEnrouteRaw()`; `renderEnroutePhase()` Route NOTAMs | "FIR XXXX NOTAMs", then its own "Company NOTAMs" group (O-131), "FIR XXXX Hazards", "Other briefing airports" |
| `src/render-preflight.html` | `renderPreflightPhase()` Departure subcard | D45 Security row; O-127 "OFP Remarks" group |
| `src/render-descent.html` | `_ddgNotesHtml`; `renderNotesSection()`, `renderDescentPhase()`, `renderDescentAirportSummary()` | MEL / DDG notes; permits with ADC; CAT II/III restriction rows |

## Step 5f display (the integration PR)

27 parts (18,865 lines). `rules/ofp-flightkeys` **v1.1.0** (contract 2.5; ~8823–11889) replaces v1.0.1 (frozen in `test/oracle`); `rules/advisory-rules` **v1.0.0** (~11890–12219, global `AdvisoryRules`) is built in between the two format parsers, so `rules/ofp-navblue` (~12220) stays just above `src/ofp-parse.html` (~13854, D47 / D118). No `*-next` key. The new code lives here:

| Part | Function | What |
|---|---|---|
| `src/ofp-parse.html` | `_ofpAdvisories`; `parseOFP()` | the advisory rules on the format parser's result, after it (O-173 A); their WARNs after the parser's findings on OFP Alerts (O-177 / O-178, D92 / D125); `S.ofpRemarksOpen` (O-179, a flag) |
| `src/ofp-parse.html` | `_ofpRemarkTexts` | the printed Dispatch contact text(s) (O-175, O-183) and the RAIM attention records (O-171, D115) of the OFP Remarks group — held in `_ofpTexts`, never saved (D107) |
| `src/ofp-parse.html` | `_ofpVolcanicOpen`, `_ofpRawIndex`, `_ofpRawViews` | O-180: `open` / `companyOpen` flags on `S.rawIndex.fir[]`, `open` on `S.rawIndex.haz[]` (codes and flags only) |
| `src/state.html` | `_ofpTexts`; `resetStateForNewFlight()` | the unsaved texts; `S.ofpRemarksOpen` cleared on a new flight |
| `src/storage.html` | `_ofpRederive`, `_rawMissing`, `_ofpTextsFlagged` | the texts re-derived from the stored PDF when a flight is opened; O-184: none to rebuild from (no stored PDF, pasted text) → `_ofpTexts = { missing: true }` when a flag is saved |
| `src/ofp-parse.html` | `parseOFP()` | O-184: `S.dispatchPrinted`, `S.raimAttention` (flags only, set when true; no text, D107) |
| `src/render-preflight.html` | `renderOfpRemarksGroup()` | the Dispatch contact row as printed (no REQUIRED / IF QUESTIONS, O-175); RAIM records after the O-127 records; open by O-181 or O-179; O-184: a flagged row that cannot be rebuilt shows the existing RAW-missing line in its place |
| `src/render-enroute.html` | `renderEnrouteRaw()` | FIR NOTAMs / Company NOTAMs / FIR Hazards groups open by the O-180 flags |

## DEF-013 integration (Dispatch contact, ofp-flightkeys v1.1.1)

`rules/ofp-flightkeys` **v1.1.1** (contract 2.5) replaces v1.1.0 (frozen in `test/oracle/ofp-flightkeys-v1.1.0.js`); the `ofp-flightkeys-next` key and folder are gone. Same 27 parts and build order. The module gives `dispatchContact = { category: 'REQUIRED' | 'SUGGESTION', remark }` or `null`; the app no longer reads `.label` / `.text`. Where it lives:

| Part | Function | What |
|---|---|---|
| `src/ofp-parse.html` | `_ofpDispatchContact` | `S.dispatchContact = { category }` or `null` (the category only is saved) |
| `src/ofp-parse.html` | `_ofpRemarkTexts` | `{ dispatch, dispatchCategory, raim }`: the remark exactly as the module gives it, held in `_ofpTexts`, never saved (D107) |
| `src/render-preflight.html` | `renderOfpRemarksGroup()` | the row "Dispatch contact \| remark" (no `dispatchContact` → no row); "Review OFP Remarks" when the stored PDF cannot be read and a Dispatch contact was flagged; the group opens on category REQUIRED (D123) or a Security message, SUGGESTION does not |
| `src/storage.html` | `_dispatchFlagged`, `_ofpRederive` | a save of 1.10.0 (`{ label }`, old shape) counts as flagged and is re-read from its stored PDF on open; the old shape is never read |
