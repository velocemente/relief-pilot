# ADR-005 — Appendix B addendum 2: operating pilots and crew-record extensions

| Field | Value |
| :---- | :---- |
| **Extends** | ADR-005 Modular OFP Platform v1.0, Appendix B (contract v2.0), and addendum 1 (`ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md`, contract 2.1) |
| **Status** | Written 2026-11-17 for `ofp-flightkeys` v0.2.0. The fields follow the Exec's brief for v0.2.0 (D62) and the SME answers of 13 Nov (SME-3a, SME-9) |
| **Contract version** | 2.2. Fields are added; no meaning changes (ADR-005 §2.4: adding a field is a minor version) |
| **Source** | Field map `SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md` row 26, §4 SME-3a and SME-9; Exec brief v0.2.0 (D62) |

## Fields

| Field | Content | Explicit empty | Source decision |
| :---- | :------ | :------------- | :-------------- |
| `operatingPilots` | The number of operating pilots (2, 3 or 4) read from the crew list: the pilot lines (CA, FO …); DH and JS lines are not counted. It is a field of its own for the crew rest module, which shows no names. The crew can change the number in the app (step 5e). | `null` | **D62** (Exec brief v0.2.0); **SME-3a**: "In the crew rest module no crew names need to be displayed — only whether there are 3 or 4 operating crew." |
| `crewMembers[i].firstName` | The first name as printed after the comma (with a middle initial or a preferred name when printed), for the crew brief. The core record carries only the `initial`. | `''` (e.g. a JS line printed without a comma) | Exec brief v0.2.0 ("every operating crew member with role and currency (for the crew brief)") |
| `crewMembers[i].toLndgExpiry` | The pilot's TO/LNDG currency expiry as printed (`YYYY-MM-DD`), or `"Not Reported"` when the line is blank or not a date | `''` for DH and JS records (no currency line) | **SME-9**: "A system anomaly. If blank, show 'Not Reported'." |

## Placement

- `operatingPilots` is a top-level extension placed after `swa` and before `sections` / `findings`. `EXTENSION_FIELDS` of `ofp-flightkeys` now has 14 entries.
- The crew-record extensions follow the core keys of each record (`role, empNum, lastName, initial, displayName, active, isSen`); `CREW_EXTENSION_FIELDS` has 2 entries. The core record is unchanged.

## Open (for the Exec)

As with addendum 1, the NavBlue parser is locked at contract 2.0 (D47) and does not return these fields. Until there is a decision, the app must treat a missing `operatingPilots` as the explicit empty (and keep counting operating crew from `crewMembers`, as it does today). It must also treat missing crew-record extensions as `''`.
