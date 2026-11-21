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
| 8682–11600 | `rules/ofp-flightkeys` **v1.0.0** (new in the app) | `OfpFlightKeys.parseFlightKeys` |
| 11601–13234 | `rules/ofp-navblue` v2.0.1 | `OfpNavBlue` (locked, D47) |
| 13235–13493 | `src/ofp-parse.html` | `_ofpRulesetParse` (NavBlue adapter, unchanged); **`_ofpDetectFormat`** (O-78), **`_ofpParse`** (router), **`_ofpShownFindings`** (O-88); `parseOFP()` (~13313) stores `S.ofpFindings` |
| 13494–14058 | `src/render-preflight.html` | `renderPreflightPhase()` (~13587): the **OFP findings** list at the top (O-76, O-87) |
| 14059–17661 | the other `src/` fragments | unchanged order: enroute, rest, descent, edit, airports, oei, copy, import, settings, sw-register |
