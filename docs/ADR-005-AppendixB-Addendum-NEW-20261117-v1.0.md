# ADR-005 — Appendix B addendum: two extension fields

| Field | Value |
| :---- | :---- |
| **Extends** | ADR-005 Modular OFP Platform v1.0, Appendix B (contract v2.0) |
| **Status** | Exec SME answers 13 Nov (SME-2, SME-8); written 2026-11-17 for `ofp-flightkeys` v0.1.0 |
| **Contract version** | 2.1 — fields added, no meaning changed (ADR-005 §2.4: adding a field is a minor version) |
| **Source** | Field map `SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md`, §2.1 row 5, §2.3 note, §3 "Not in the contract today", §4 SME-2 and SME-8 |

## Fields

| Field | Content | Explicit empty | Source decision |
| :---- | :------ | :------------- | :-------------- |
| `airportData[icao].specialQualification` | `true` when the OFP page-1 airport line carries the `Q` token before the lat/long: a **Special Qualification** airport. The airport card is to show "SPECIAL QUALIFICATION" (display is a later brief). `false` otherwise. Seen on ORIG, DEST, PALT and RALT lines in 8 of the 26 FlightKeys packages. | `false` | **Exec SME answers 13 Nov** — SME-2: "Special Qualification airport; show SPECIAL QUALIFICATION on the airport card." |
| `swa` | Service weight adjustment as printed between DOW and PYLD, `SWA (nnnnnn)` → `{ value: <number>, unit: 'KGS' \| 'LBS' }` (the OFP weight unit). Can appear on any flight; seen in 4 passenger packages. | `null` | **Exec SME answers 13 Nov** — SME-8: "Service weight adjustment; can be on any flight; just note SWA and the value." |

## Placement

- `swa` is a top-level extension, listed after `designator` and before `sections` / `findings` (`EXTENSION_FIELDS` of `ofp-flightkeys`: 13 entries).
- `specialQualification` is an airport extension beside `remarks` and `remarksWeather` (`AIRPORT_EXTENSION_FIELDS`: 3 entries).

## Open (for the Exec)

The NavBlue parser is locked at contract 2.0 (D47) and does not return these two fields. ADR-005 §2.4 says every parser returns every extension, with an explicit empty where the format does not carry the item. Adding the two explicit empties to NavBlue would change that locked module and needs an Exec decision and its own gate; until then the app must treat a missing `swa` / `specialQualification` like the explicit empty.
