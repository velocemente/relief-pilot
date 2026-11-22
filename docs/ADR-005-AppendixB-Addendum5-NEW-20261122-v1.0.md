# ADR-005 — Appendix B addendum 5: Volcanic Ash Advisories page; Dispatch contact as printed

| Field | Value |
| :---- | :---- |
| **Extends** | ADR-005 Modular OFP Platform v1.0, Appendix B (contract v2.0); addenda 1 (contract 2.1), 2 (2.2), 3 (2.3) and 4 (2.4) |
| **Status** | Written 2026-11-22 for `ofp-flightkeys` v1.1.0 (step 5f module PR A). The fields follow the Exec answers **O-169, O-172, O-175, O-181, O-183** (22 Nov), with D88, D115, D116 and D131 as amended by O-175 |
| **Contract version** | 2.5. One field is added (`volcanicAsh`), two keys are added to a record (`dispatchContact.company`, `dispatchContact.remark`), and `dispatchContact.text` now carries every Contact Dispatch text printed (O-175, O-183). ADR-005 §2.4: adding a field is a minor version |
| **Source** | SPEC `rules/ofp-flightkeys/SPEC-OFP-FlightKeys-UPD-20261122-v1.1.0.md` §5.18, §5.26, §5.27; the 26 FlightKeys fixtures (26 VA pages, 27 RAIM records, 26 Dispatch contacts) |

## New field

One top-level extension, after `dispatchContact` and before `sections` (`EXTENSION_FIELDS` of `ofp-flightkeys` has 20 entries).

| Field | Content | Explicit empty | Source decision |
| :---- | :------ | :------------- | :-------------- |
| `volcanicAsh` | The Volcanic Ash Advisories page (the briefing document with footer `Page1of1 <uuid>` that prints `VOLCANIC ASH`), extracted, never evaluated (D88): `{ page, state, text, advisories }`. `page`: its PDF page. `state`: `'NONE'` — the closed form `NO VOLCANIC ASH ADVISORIES FOUND FOR THIS FLIGHT`; `'ADVISORY'` — an advisory list (heading `VOLCANIC ASH ADVISORIES`, the `INTERSECTS` column, one list row per `VA ADVISORY` block, every volcano readable); `'UNREADABLE'` — anything else. `text`: the page as printed (lines, indentation kept; running header and footer removed). `advisories[]`: per `VA ADVISORY` block in printed order `{ volcano, vaac, number }` — the volcano name without its volcano number, the VAAC, the advisory number (`2026/370`), each as printed or `null` when not readable; kept also when UNREADABLE; `[]` for NONE. | `null` (no VA page, or the briefing not read) | **O-169** (Exec, 22 Nov): an advisory = the VA page with an actual advisory listed; the "no advisories" page = none; the remark is linked by volcano name (by the advisory-rules engine) |

## Changed field (meaning)

| Field | Contract 2.4 (addendum 4) | Contract 2.5 |
| :---- | :------------------------ | :----------- |
| `dispatchContact` | `{ label, text }`: `label` `'REQUIRED'` / `'IF QUESTIONS'` from the Company NOTAM line; `text` that line | `{ label, text, company, remark }` — **every Contact Dispatch text the package prints, as printed** (O-175, O-183): `company` the Company NOTAM Dispatch contact line(s) (`Contact Dispatch for a preflight briefing.` / `… if you have any questions.`), each printed form once, `null` if none; `remark` every OFP Remarks record that says `Contact Dispatch` (any case, across line breaks), every line, joined by `"\n"`, all variants, `null` if none; `text` both, the Company line(s) first. `label` unchanged in values and rule; it is the **internal** short-form / long-form flag (the OFP Remarks group's open state, O-181), never crew text (no REQUIRED / IF QUESTIONS is shown). Nothing printed → `null` (O-183). Read also without briefing documents (pasted text). |

## Unchanged fields, new rule

`ofpRemarks[]` keeps its shape. Its category `raim` (O-172): a remark whose first line names RAIM; the two PASSED forms one line; any other RAIM remark with its continuation lines (D63/D63a end). On the 26 the records are byte-identical to contract 2.4.

`hasPerishables` (core field, FK-P: meaning unchanged): FlightKeys sets it only when the package prints YES — the NavBlue rule, or `PERISHABLES ONBOARD: YES`; `: NO` and the bare `PERISHABLES ONBOARD` line set nothing (O-129, O-182, Exec 22 Nov). On the 26: 7 packages true → false (L03, L08, L10, L12, L13, L16, L17).

## Placement

`EXTENSION_FIELDS` (20): `revision`, `companyNotams`, `ofpRemarks`, `fplEquipment`, `catIiIiiRestrictions`, `securityMessages`, `extraFuel`, `pcf`, `permits`, `designator`, `swa`, `operatingPilots`, `firNotams`, `firRaw`, `natMessages`, `hazards`, `dispatchContact`, **`volcanicAsh`**, `sections`, `findings`.

## NavBlue (D47, D118)

The locked NavBlue parser (contract 2.0) returns no `volcanicAsh` and no `ofpRemarks` (O-176 b, Exec 22 Nov: ignore NavBlue). The app and the advisory-rules engine treat a missing `volcanicAsh` as `null` and a missing `dispatchContact` as `null`.
