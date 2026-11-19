# ADR-005 — Appendix B addendum 3: airport NOTAM items, raw NOTAM and weather layout, briefing record

| Field | Value |
| :---- | :---- |
| **Extends** | ADR-005 Modular OFP Platform v1.0, Appendix B (contract v2.0); addendum 1 (contract 2.1) and addendum 2 (contract 2.2) |
| **Status** | Written 2026-11-18 for `ofp-flightkeys` v0.3.0. The fields follow the Exec's brief for v0.3.0 (step 5d), Exec decisions **D64** and **D65** (18 Nov) and SME-1 |
| **Contract version** | 2.3. Fields are added; no meaning changes (ADR-005 §2.4: adding a field is a minor version) |
| **Source** | Grammar report `RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md` §A.4–§A.6, §A.10; field map v1.2 (`docs/SPRINT-OFP-FlightKeysMigration-UPD-20261118-v1.2-FieldMap.md`) rows 43–45, §4 SME-1; Exec brief v0.3.0 (scope 2, 3a, 3b); D54, D64 |

## Fields

All four are airport extensions (`airportData[icao]`), beside `remarks`, `remarksWeather` and `specialQualification`.

| Field | Content | Explicit empty | Source decision |
| :---- | :------ | :------------- | :-------------- |
| `notamItems[]` | One record per NOTAM item of the airport's NOTAM Briefing block, in printed order: `{ id, category, source }`. `id`: the NOTAM ID read by the NOTAM ruleset (`_fkHeader`), e.g. `A1234/26`; `null` if the text does not start with an item header (WARN). `category`: the printed type heading the item sits under (`RUNWAY`, `TAXIWAY` … the 17 headings of §A.6), `''` if there is none. `source`: `[{ page, column: 'L' \| 'R', y: [top, bottom] }]`, one span per PDF page and column the item is printed in (absolute PDF page; y in points from the top of the page). Record *i* is piece *i* of `_splitNotams(airportData[icao].notams)`. | `[]` (no NOTAM block, an empty-state box, or the NOTAM ruleset not supplied) | Exec brief v0.3.0 scope 3a; **D64**: the parser keeps each NOTAM's printed type as its category |
| `notamsRaw` | The airport's NOTAM section exactly as printed, for the RAW presentation: the type headings in printed order with their centring, each item under its heading, line breaks and indentation kept; page and column breaks and the running header and footer removed (D54). The empty-state box (`THERE ARE NO ACTIVE NOTAMS …`) is kept as printed. Nothing added, nothing reordered. The airport block's own lines (name/role, `APT<ICAO>`, runways) are not part of it. | `''` (no NOTAM block) | **D64** (18 Nov): "the RAW presentation preserves the FlightKeys layout"; D54 |
| `weatherRaw` | The airport's Weather Briefing block exactly as printed, for the RAW view: TAF, then METAR, then ATIS, in printed order, with the sub-headings, line breaks and indentation, wrapped TAF groups and the printed empty-state text; page and column breaks and the running header and footer removed (D54); the `* PRIO * ` prefix removed from its report's first line (D55), nothing else changed. The block's own lines (name/role, `APT<ICAO>`, runways) are not part of it. No evaluation reads it (`weather` keeps NavBlue's order for the app's reader). | `''` (no Weather Briefing block) | **D65** (Exec, 18 Nov): "TAF – METAR – ATIS — it should match the FlightKeys format." |
| `briefing` | The airport as the briefing prints it: `{ iata, name, roles: [{ role, start, end, in }], notamBlock, weatherBlock }`. `iata` `''` when none is printed; `name` as printed (FlightKeys clips it at the cell width). `roles`: every role window of the block (`DEPARTURE`, `DESTINATION`, `ALTN 1`, `ALTN`, `IA`, `TA`, `EA`, `dest2`, `dest2Altn`, `dest2AltnPlanned`), `start` / `end` as printed, `DD HH:MM` (UTC day of month and time), `in`: the briefings that print it (`'WX'`, `'NOTAM'`). | `null` (an airport with no block in either briefing) | **SME-1**: "all windows apply for weather evaluation"; card order |

## Card order

The order of the `airportData` keys is the card order (SME-1): the OFP page-1 airports in line order; then the other airports — release alternates and briefing airports with a role other than `IA` / `TA` / `EA` — in briefing order; then the airports whose roles are only `IA` / `TA` / `EA`, in briefing order. No field is added for it.

## Placement

`AIRPORT_EXTENSION_FIELDS` of `ofp-flightkeys` has 7 entries: `remarks`, `remarksWeather`, `specialQualification`, `notamItems`, `notamsRaw`, `briefing`, `weatherRaw` (the last key of each entry). The core airport keys (`weather`, `notams`, and `ewinsWeather` / `ewinsRole` / `ewinsWindow` at an E-WINS airport) keep their meaning (FK-P), with one Exec decision for FlightKeys (D66, 18 Nov): `ewinsWindow` is `''` (the app then uses the airport's normal window) and `ewinsRole` is the airport's own briefing role codes; FK-P does not copy NavBlue's logged faults NB-F6 / NB-F7 (`test/known-gaps.json` G-NB-6, G-NB-7).

## Open (for the Exec)

As with addenda 1 and 2, the NavBlue parser is locked at contract 2.0 (D47) and does not return these fields. Under the Exec decision of 17 Nov ("ignore NavBlue" for FlightKeys-only extensions), the app must treat a missing `notamItems` / `notamsRaw` / `briefing` / `weatherRaw` as the explicit empty.
