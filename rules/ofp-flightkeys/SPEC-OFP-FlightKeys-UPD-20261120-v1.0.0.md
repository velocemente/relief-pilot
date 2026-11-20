# SPEC-OFP-FlightKeys

**Version:** v1.0.0 (D58: the first release version; not built into the app until the switch PR, O-74) | **Status:** UPD | **Date:** 2026-11-20 (step 5e-1 PR 1; Exec answers O-74 … O-85)
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/ofp-flightkeys/ofp-flightkeys-v1.0.0.js` (SHA-256 in `rules/manifest.json`); the v0.4.0 file is frozen byte for byte as `test/oracle/ofp-flightkeys-v0.4.0.js` (SHA-256 `c4ccb8c4…afb6f`) for the TC-164 comparison
**Architecture:** ADR-005 §2.1 (module catalogue: "FlightKeys OFP parser"), §2.2 (module standard), §2.4 (output contract, FK-P)
**Field reference:** `docs/SPRINT-OFP-FlightKeysMigration-UPD-20261118-v1.2-FieldMap.md` (rows, SME answers); `docs/ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md` (contract 2.1: `specialQualification`, `swa`); `docs/ADR-005-AppendixB-Addendum2-NEW-20261117-v1.0.md` (contract 2.2: `operatingPilots`, crew-record extensions); `docs/ADR-005-AppendixB-Addendum3-NEW-20261118-v1.0.md` (contract 2.3: `notamItems`, `notamsRaw`, `briefing`, `weatherRaw`); `docs/ADR-005-AppendixB-Addendum4-NEW-20261119-v1.0.md` (contract 2.4: `firNotams`, `firRaw`, `natMessages`, `hazards`, `dispatchContact`); grammar `docs/RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md`
**Ledger:** `RPT-OFP-FlightKeys-RevisionLedger-UPD-20261120-v1.7.md` (beside this file)
**Supersedes:** SPEC v0.4.0 (same folder; history in §10 and the ledger). The ADR-004 FlightKeys profile (`src/import/atlas-fk.js`) is retired only after this parser is gated and integrated (ADR-005 §2.7).

---

## 1. What this module is

**v1.0.0 (step 5e-1 PR 1, 20 Nov; Exec answers O-74 … O-85).** The first release version (D58). It is **not built into `index.html`** and not used by the app until the switch PR (5e-1 PR 2, O-74); its master copy is published to the Drive between the two PRs (CLAUDE.md rule 14). Two changes, everything else byte-identical to v0.4.0 (TC-164-020):

1. **O-68, module side (§5.23):** the filed NAT letter is worked out **before** the NAT call, and the NAT ruleset (`rules/nat-rules-next` v1.2.0, D77) is called as `parseNatTrack(text, orig, dest, { filed, findings })`. The NAT ruleset's findings — `NAT-FILED-NOT-IN-MESSAGE` (D79), `NAT-RANDOM-ROUTE` (D81) and the rest of its closed list — are forwarded into `findings[]` as it gives them, with their `code`.
2. **O-84:** the deferred-field INFO is version-free: `not read: not in any brief yet (open item)` (was `not read in v0.4.0: …`), so a version bump no longer changes a finding.

On the 26 (the app's NAT parser v1.1.0 → the NAT ruleset v1.2.0 at the switch): `natTrack` changes on L08, L11, L12, L22, L23 (the tracks are read; the TMI, direction and filed letter are unchanged); INFO `NAT-RANDOM-ROUTE` on L08, L12, L22, L23; the O-84 text on all 26. No `NAT-FILED-NOT-IN-MESSAGE` on the 26 (L11's filed `W` is in its message). The display of these findings to the crew is PR 2 (O-76).

**v0.4.0 (step 5d-2, 19 Nov; development version, D58: not built into the app, not published).** It reads everything v0.3.0 read, unchanged except the declared scope-0 change (TC-163-001), plus the rest of the briefing package, under the Exec answers **O-33 … O-45** (19 Nov): the airport NOTAM text keeps the printed type headings for NOTAM v1.14.0 (D67, §5.15a); the **Company NOTAMs** (§5.18); **curfews** (§5.19); **ops notes** (§5.20); the **FIR NOTAM blocks** (§5.21); the **Hazard Briefing** (§5.22); the **NAT track messages** and the **PACOTS** sets (§5.23, §5.24). New top-level extensions `firNotams`, `firRaw`, `natMessages`, `hazards` (contract 2.4, addendum 4). Only `fplEquipment` is still deferred.

**Exec answers O-46 … O-49 (19 Nov; applied 20 Nov in the same development version v0.4.0):** the Dispatch contact lines stay in the P0110 text and give the new package field `dispatchContact` (O-46, §5.18); the filed NAT track is read from the OFP page 1 route and the ICAO FPL strip route (O-47, §5.23); curfew lines by aircraft family and variant (O-48, §5.19); a FIR NOTAM printed under more than one FIR block is kept only under the blocks whose FIR is on the OFP (O-49, §5.21). **Exec answer O-50 (20 Nov, same version):** the departure FIR — the first FIR block of the NOTAM Briefing — always counts as on the OFP for that rule (§5.21); O-51 and O-52 stand as built. Everything else is byte-identical to build 1 (PR head `9a76b58`) on all 26 (TC-163-100).

The FlightKeys OFP parser reads an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns the **briefing contract**. The contract is the same 57 core fields as the locked NavBlue parser, with the same names, types and meanings (FK-P), plus the Appendix B extensions and `findings[]`.

**v0.3.0 is a development version (D58 amended).** It is not built into `index.html`, not used by the app and not written to the master folder. It reads everything v0.2.0 read, unchanged (TC-162-001), plus — step 5d, Exec decision **D64** (18 Nov) — the **briefing**: per airport the NOTAM items, the NOTAM section as printed, the weather with the E-WINS, every briefing airport in card order, and `sections[]` (§5.13–§5.17). Curfew, ops notes, Company NOTAMs, en-route NOTAMs and NAT are still explicit empties with one INFO finding. **It must not be integrated:** an explicit empty is not a value.

**Exec answers of 18 Nov (same version, development):** **D65** — `weather` stays in NavBlue's order; new airport extension `weatherRaw` = the Weather Briefing block as printed (TAF → METAR → ATIS) for the RAW view (§5.16). **D66** — `ewinsWindow` is `''` and `ewinsRole` is the airport's own role (§5.16); FK-P does not copy the logged NavBlue faults NB-F6 / NB-F7 (`test/known-gaps.json` G-NB-6, G-NB-7).

**D64 (Exec, 18 Nov).** FlightKeys groups NOTAMs by type for each airport and each FIR. The cards stay organised for humans (the app's own groups, both formats). The RAW presentation preserves the FlightKeys layout. The parser keeps each NOTAM's printed type as its category and returns the raw layout.

| Scope (field map v1.1 rows) | Version | Read |
| :--- | :--- | :--- |
| 1–23, 29–31, 33, 34, 36, 39–41 | v0.1.0 (unchanged) | identity, airports, fuel, weights, DOT exemption, slot, callsign, nav log, alternate routes, ETOPS, POR, ETP/CFS |
| 26 crew (SC) | **v0.2.0** | operating crew with role and TO/LNDG currency; `operatingPilots` (D62) |
| 24 CAT II/III (SC) | **v0.2.0** | authorisations (`catIiIiiApproaches`) and restrictions (`catIiIiiRestrictions[]`) |
| 25 MEL/CDL/DDG, 32a TLR cross-reference | **v0.2.0** | `ddgItems` with `type`, `notes[]`, `tlr`; `melItems`; late additions (SME-19) |
| 27 perishables, 28 temperature control | **v0.2.0** | NavBlue rules (D55), Remarks only; FlightKeys bare line for 27 |
| 32 TLR | **v0.2.0** | `oeiData` by the NavBlue rule, page breaks removed |
| 35 permits | **v0.2.0** | `overflightPerms` (NavBlue form), `permits[]` |
| Appendix B | **v0.2.0** | `revision`, `ofpRemarks[]`, `airportData[icao].remarks[]`, `airportData[icao].remarksWeather[]`, `securityMessages[]`, `extraFuel`, `pcf`, `findings[]` flags |
| 5b-1 QA F4 | **v0.2.0** | the FPL block is read from the release only |
| 43–45, 48 airport weather, NOTAMs, alternates, E-WINS (SC); 37, 38, 50 sections, page furniture | v0.3.0 | `airportData[icao].weather` / `notams` / `ewins*`, an entry per briefing airport in card order (SME-1), `sections[]`; extensions `notamItems[]`, `notamsRaw`, `briefing` (addendum 3) |

| 44 airport NOTAMs with the type headings (D67); 46 curfew (SC); 47 ops notes; 49 FIR NOTAMs; 42 NAT, PACOTS; Company NOTAMs; hazards | **v0.4.0** | `notams` + headings; `companyNotams[]`; `airportData[icao].curfew` / `opsNotes`; `enrouteNotams.fir`; `natTrack`; extensions `firNotams[]`, `firRaw[]`, `natMessages[]`, `hazards[]` (addendum 4); PACOTS `sections[]` |

| Not read in v1.0.0 | Step | Explicit empty |
| :--- | :--- | :--- |
| Extension `fplEquipment` (D41) | open — no brief yet | `null` |

The list is exported as `DEFERRED_FIELDS` (step `5d` or `open`). The entry gives exactly one INFO finding, `not read: not in any brief yet (open item)` (v1.0.0, O-84: version-free; up to v0.4.0 the text named the version). An airport entry carries `curfew` / `opsNotes` only when the package prints one for it (as NavBlue).

---

## 2. Module standard (ADR-005 §2.2)

As v0.1.0: one standalone file, no `require`; dual context (`module.exports`, browser global **`OfpFlightKeys`**); metadata `RULESET_TYPE 'ofp'`, `OFP_FORMAT 'flightkeys'`, `RULESET_VERSION '1.0.0'`, `SCHEMA_VERSION 2`, `CONTRACT_VERSION '2.4'`, `RULESET_SOURCE`; `validateSchema()`; no app state, DOM, UI, storage, network or clock; strict mode; all times UTC.

---

## 3. API

### 3.1 Exports

```javascript
module.exports = {
  RULESET_TYPE, OFP_FORMAT, RULESET_VERSION, SCHEMA_VERSION, CONTRACT_VERSION, RULESET_SOURCE,
  validateSchema,        // (ruleset?) → { valid, errors[] }
  parseFlightKeys,       // (input, options?) → contract object | null
  inputFromExtractor,    // (rawText, itemsDoc) → input
  PATTERNS,              // the FlightKeys regex map (all RegExp)
  CORE_FIELDS,           // 57, NavBlue order
  EXTENSION_FIELDS,      // 18: contract v2.0 list + swa + operatingPilots + firNotams, firRaw,
                         //     natMessages, hazards (addendum 4, v0.4.0) (before sections)
  AIRPORT_EXTENSION_FIELDS, // ['remarks', 'remarksWeather', 'specialQualification',
                         //  'notamItems', 'notamsRaw', 'briefing', 'weatherRaw']   (addendum 3, v0.3.0; D65)
  DDG_EXTENSION_FIELDS,  // ['type', 'notes']
  CREW_EXTENSION_FIELDS, // ['firstName', 'toLndgExpiry']            (new in v0.2.0)
  DEFERRED_FIELDS,       // field → '5d' | 'open' (§1); v0.4.0: fplEquipment only
  CURFEW_TYPES,          // v0.4.0: the O-33 table, curfew-line wording → OFP aircraft types (§5.19)
  CURFEW_NOTES,          // v0.4.0: the notes a curfew string can end with (§5.19; no digits)
};
```

### 3.2 `parseFlightKeys(input, options)`

Input, options and the null rule as v0.1.0 (`{ text, pages }` from the extractor; `{ icaoFpl, aircraftProfile, notamRules, parseNatTrack }`). **v1.0.0 (O-68):** `options.parseNatTrack` is the NAT ruleset's `parseNatTrack` (`rules/nat-rules-next` v1.2.0) and is called for the chosen message with a fourth argument `{ filed, findings }` (§5.23); the probe call that reads the flight's direction has no options. A parser that ignores the options (the app's `src/nat.html` v1.1.0) still works: `assignedId` and the marked track are set by the module as in v0.4.0. **v0.4.0:** `options.parseNatTrack` is called (§5.23). **v0.3.0:** `options.notamRules` — the NOTAM ruleset (`rules/notam-rules`, v1.13.0); the parser calls only its `_splitNotams` and `_fkHeader` (§5.15). The briefing is read from `input.pages`; without positioned items it is not read (one WARN). **Change (QA F4):** `icaoFpl.parseIcaoFpl()` is given the body lines of the first release copy, not the whole package. An FPL quoted anywhere else is never read. No release means no FPL, plus a WARN. On the 26 fixtures the result is unchanged (TC-161-001), because the first `(FPL-` block was already inside the release in every package.

### 3.3 `validateSchema(ruleset?)`

As v0.1.0, with the lists 57 / 18 / 7 / 2 / 2 (v0.3.0: `AIRPORT_EXTENSION_FIELDS` 7; v0.4.0: `EXTENSION_FIELDS` 18) and the `DEFERRED_FIELDS` steps `5d` or `open`.

---

## 4. Where it reads

1. **The release** by content (v0.1.0 §4.1); only the first copy; further copies compared. Each body line keeps its provenance: the PDF page and its 1-based line on that page's text.
2. **OFP page 1:** rows 1–23, the POR, and now `revision` (title line, `Revision: n.n`, `Release Valid Until`), `extraFuel` and `pcf` (fuel rows `EXTRA`, `PCF`).
3. **The Remarks block:** `Remarks` to `MEL/CDL` for the remarks, CAT II/III, perishables, temperature, security, weather, station restrictions and late MEL additions. `MEL/CDL` to `Flight Release Authorization` for the DDG items. The **CDC attestation** follows the authorisation text and runs to `Signed by PIC`. Rows 29–31 are still read from `Remarks` to `Flight Release Authorization` (v0.1.0).
4. **The crew list:** `Fit for Duty Affirmation` to `TIME FUEL`.
5. **The permits block:** `Overflight/Landing Permits` to the nav-log header.
6. **The TLR** (first copy): pages headed `REL n/n DDMONYY HHMMZ CCC#### ORIG/DEST …` with the footer `FUFI<uuid> PAGE n/N`, pages 1..N. The page header, the footer and the repeated `TAKEOFF AND LANDING REPORT … PAGE n` + `TLR-n SEQ-…` lines are removed before reading.
7. **The FPL** through `icao-fpl`, release lines only.

9. **v0.4.0:** the Company NOTAMs (the HSCN page and the Company part of the NOTAM document), the FIR blocks of the NOTAM Briefing and of the Hazard Briefing, from the positioned items; the NAT track message from its own text pages (`NAT-TRACKS`, no footer, one column), as § 7 `_readSections` finds them.

8. **The briefing (v0.3.0)**, from the positioned items only (§5.13): the airport blocks of the NOTAM Briefing and the Weather Briefing; the documents and the NAT, chart and TLR pages for `sections[]`.

The release fields are never read from the briefing pages, NAT or Jeppesen pages. Text of the same form printed there is never taken (negative tests in TC-161-011, -021, -051). The briefing reader reads no release page.

---

## 5. Field rules

§5.1–5.4 of v0.1.0 and §5.5–5.12 of v0.2.0 are unchanged. Every v0.1.0 field is byte-identical on the 26 fixtures (TC-161-001), every v0.2.0 value too (TC-162-001). New in v0.3.0: §5.13–§5.17 (after §5.12).

### 5.5 Crew (row 26, SC; SME-3, SME-3a, SME-9; D62)

| Line form | Result |
| :--- | :--- |
| `CA\|FO\|FO1\|FO2\|SO\|AO\|RO <EMPNO> [*] <LAST>, <FIRST …> .. .. ..` | a pilot: `{ role, empNum, lastName, initial, displayName, active: true, isSen: false, firstName, toLndgExpiry }` |
| `TO/LNDG Expiry: [YYYY-MM-DD]` (under its pilot) | `toLndgExpiry` = the date when it is a real date; blank → **`"Not Reported"`** (SME-9) + one INFO with the count (INFO confirmed by the Exec, 17 Nov); not a date → `"Not Reported"` + WARN; no expiry line → `"Not Reported"` + WARN |
| `DH <EMPNO> <NAME>`, `JS 0 <NAME>` | returned as NavBlue returns DH/JS: `active: false`; `empNum` only when it has 2–7 digits (NavBlue rule, so the JS `0` gives `''`); `toLndgExpiry ''` |
| `MX`, `LM`, `FA`, `PU` lines | **not crew** for the briefing. One INFO with the counts, e.g. `FA 9, MX 2, PU 2` |
| `FIT FOR DUTY/ RELIEF PIC`, `JS VERIFY START-END(Z)` (repeated at a page break) | skipped |

- Names are **as printed** (FlightKeys prints mixed case). `lastName` = the text before the comma, with the suffix, e.g. `<Last> Jr`. A `*` printed after the number stays with the last name (`* <Last>`, SME-3a) and **never** sets `isSen` (SME-3); one INFO gives the count. `firstName` = the text after the comma, without the signature dots, e.g. `<First> <MI>.` or `<First> (<Pref>`. `initial` = its first letter. `displayName` = `lastName initial` (the NavBlue non-senior form). A name with no comma (JS lines) is all `lastName`, with `initial ''`.
- Roles are as printed; no relief role is invented (the NavBlue rule; no FO1/FO2/RO in FlightKeys text).
- **`operatingPilots` (D62):** the number of operating pilot lines, for the crew rest module (no names). `null` + WARN when there are none. A count other than 2, 3 or 4 is returned with a WARN. The app lets the crew change it (step 5e).

### 5.6 CAT II/III (row 24, SC; SME-10)

- **Authorisations** use the NavBlue `AIRPORT_ENTRY` form, bare in the Remarks: `IIII CAT II|III|II/III - RWY a/b` or `- ALL RWY`. They go to `catIiIiiApproaches = { IIII: [{ cat, rwys }] }`, in print order (`ALL RWY` → `rwys: 'ALL RUNWAYS'`, as NavBlue). `null` when there is none.
- **Restrictions are never authorisations.** A CAT line that says `NOT AUTHORIZED`, `PROHIBITED`, `RESTRICTED`/`RESTRICTION` or `NOT APPROVED` is a restriction even when it carries the authorisation dash. So is an MEL note `- CAT III Restricted` / `- CAT II / CAT III Restricted`, or an MEL title `CAT II/III Restriction` when no note under it says so. Each restriction gives `catIiIiiRestrictions[] = { airport, category, runways[], text, source }`, where `airport` is `null` for an MEL restriction (it applies to the aircraft) and `source` is `'OFP Remarks'` or `'MEL <code>'`.
- SME-10 is carried by the data. A US airport appears only as a restriction (L05: no authorisation at all → `null`). An overseas airport may have both: its authorisations stay in `catIiIiiApproaches`, and its restriction is listed beside them.

### 5.7 MEL / CDL / DDG (rows 25, 32a; SME-4, SME-19)

- Items: `MEL|CDL <code> - <title>`. A title that wraps continues on the next line, joined with a space. `ddgItems[i] = { code, desc, tlr, type, notes[] }`, where `code` is as printed (CDL codes start with `C`) and `type` is `'MEL'` or `'CDL'`.
- Notes: every `- …` or `RMK - …` line under the item, in order. Its wrapped lines join the note **with their printed line breaks** (`"\n"` between the lines; nothing added, removed or reflowed), as remarks do (QA F3; Exec display rule, 3 Nov: MEL RMK/notes shown as on the OFP). On the 26 this changes one note in L13 (36-11-08C) and one in L19, 2 lines each; no other field changes. `notes[i] = { text (as printed, with its "- " / "RMK - "), indent }`. **Indentation comes from the positioned items** (the text has none): a note printed further right than its item line is indent 1. If the positions put a note at the item's x, positions win (`indent 0`) and a WARN is raised. With no positions, notes are indent 1.
- `Dispatcher applied ADHOC penalty:` and its `- …` lines are **not** item notes. They are kept in `ofpRemarks` (category `adhocPenalty`).
- **Every printed item is kept, an item printed more than once included** (Exec, 17 Nov, PR #62 review: "this is possible and is not an anomaly; keep all items"). No finding is raised for it. This differs from the NavBlue parser, which lists a repeated item once; the Exec's answer on NavBlue was to ignore it (below, §9). SME-4: the items are this OFP's own, and nothing is carried over from another import.
- **Late additions (SME-19).** An MEL named only in a late-addition remark is added after the block's items: `HHMMZ STR ADD M<code>`, `ADD MEL <code> …`, or `MEL ADDED` with the code on the next line. It is added as `{ type 'MEL', desc: the text after the code or '', notes: [the remark as printed] }`, with an INFO. A remark that names an MEL already in the block adds nothing (negative case). Codes inside RMK notes are never additions.
- `tlr` (row 32a): `'takeoff'`, `'landing'`, `'both'` or `''`, as NavBlue, from the TLR `/// TAKEOFF DATA ///` and `/// LANDING DATA ///` parts. The code is read on the `RMKS` line (the NavBlue rule) **and** on the lines below it up to the next separator (`---`, `RWY`, `APT`, `///`). FlightKeys prints further codes there, e.g. L11 `RMKS 36-11-01` / `36-12-02-01 ONE VLV INOP`.
- `melItems` = `ddgItems.map(code + ' ' + desc).join(' | ')`, at most 600 characters (NavBlue).
- An empty block gives `[]` / `''` and an INFO (L15).

### 5.8 TLR (row 32)

`oeiData` uses the NavBlue `parseTLR()` rule, copied unchanged (its patterns are in `PATTERNS.TLR_*`), on the TLR lines without page furniture (§4.6). On the 26 fixtures the result equals NavBlue in 25 packages. In L10 the NavBlue parser appends the page footer and the next page header to runway 12's special procedure; the module returns only the procedure (field map §6). The TLR number `TLR-n` goes to `revision.tlr`.

### 5.9 Perishables, temperature control (rows 27, 28; D55)

Both are read on the release Remarks only (`Remarks` to `MEL/CDL`):
- `hasPerishables` = the NavBlue `PERISHABLE` pattern, or a line beginning `PERISHABLES ONBOARD` (FlightKeys).
- `hasTemperatureControl` = the NavBlue `TEMPERATURE_CONTROL` pattern (D55).

The Company NOTAM boilerplate `*ANYTIME PERISHABLES OR LIVE ANIMALS ARE ON BOARD` never sets either, inside or outside the release. A cargo declaration `LIVE ANIMALS: NO` / `TEMPERATURE REQUIREMENTS: NO` gives `false`.

### 5.10 Permits (row 35)

- `overflightPerms` (core, NavBlue form): the block from `Overflight/Landing Permits` to the nav-log header, white space collapsed, at most 300 characters; `''` when empty.
- `permits[] = { type: 'OVERFLIGHT'|'LANDING'|'TAKEOFF'|'ADC', country, reference, route, restriction, adc, missing }`, in print order. An entry line starts with a state name (an embedded list, `PERMIT_STATES`, longest first). A following `<REG> [AUTH] ONLY` line is its `restriction`. Any other following line is its `route`. `/////PERMIT MISSING/////` gives `missing: true` + WARN.
- **ADC numbers:** a Remarks line `<STATE> ADC NO-nnnn` is attached as `adc` to that state's permit (L17 BANGLADESH). With no permit for that state it becomes its own `ADC` entry.

### 5.11 OFP Remarks and what they feed (Appendix B; D34, D39, D45, D46, D63; SME-7, SME-17, SME-18, SME-18a, SME-21, SME-23)

- **`ofpRemarks[]`:** one record per **remark**, `{ text, category, airport, subHeading, page, line }`, from the dispatcher line to `MEL/CDL`, in order; then the MEL-block ADHOC penalty block (`adhocPenalty`) and the CDC attestation (`cdcAttestation`), in release order. A block that marks its items follows **D63**; an unmarked block follows **D63a** (§5.12 says which block takes which rule). A record's `text` holds its printed lines joined by `"\n"`; `page` / `line` are those of its first line. Every printed line is in `ofpRemarks` exactly once, in order: splitting every `text` at `"\n"` gives the printed lines. The `category` of a remark is that of its first line.

| Category | Start line (structure) | Packages (of 26) |
|---|---|---|
| `dispatcher` | first line, `… DESK: nn …` | 26 |
| `boilerplate` | `This OFP prepared with FlightKeys…` (3 lines) | 23 |
| `cargoDeclaration` | `DANGEROUS GOODS\|COMAT\|LIVE ANIMALS\|TEMPERATURE REQUIREMENTS: YES\|NO` | 1 |
| `perishables` | `PERISHABLES ONBOARD` | 7 |
| `pcf` | `PCF`, `- CF …`, `ADDITIONAL FUEL …` | 16 |
| `extraFuel` | `TANKER`, `PRE-FUELED`, `FINAL FUEL`, `EXTRA FUEL` | 3 |
| `ballast` | `BALLAST` | 1 |
| `stationRestriction` | `** IIII FLIGHT OPS RESTRICTIONS **`, `IIII/AAA FLIGHT OPERATIONS RESTRICTIONS:`, `IIII [B747 ]DEPARTURES:` (+ a dashed line above it) | 5 |
| `route` | `ROUTED`, `AVOID`, `NAT TRACK`, `RANDOM ROUTE`, `VA ACTIVITY/FROM`, `ATLANTIC CROSSING` | 4 |
| `melChange` | `MEL ADDED`, `ADD M<code>` / `ADD MEL <code>` | 3 |
| `slot` | `WHEELS UP` | 1 |
| `security` | `SECURITY` | 1 |
| `permit` | `<STATE> ADC NO-…` | 1 |
| `weather` | `GOV TAF UPDATED`, `WSI …`, `TWC …`, `TAF/METAR/SPECI [AMD/COR] IIII ddhhmmZ` | 2 |
| `ewins` | `E-WINS` / `EWINS` | 1 |
| `raim`, `catIiIii`, `fleetNote`, `exemption` | `RAIM VALIDATION`, `IIII CAT …`, `B7n7-nnn…/ …`, `EXEMPTION` | 26, 23, 4, 6 |
| `adhocPenalty`, `cdcAttestation` | MEL-block penalty lines; `*** CDC ATTESTATION …` to `Signed by PIC` | 3, 5 |
| `other` | none of the above (e.g. T3 test lines) | 1 |

- **Station restrictions → `airportData[icao].remarks[]`** (D34): each remark of the block (D63, §5.12), `{ text, heading, subHeading, fleet, page, line }`. A block has no end marker; it runs until a RAIM, CAT, exemption, fleet-note or E-WINS line, or the next station heading. Sub-headings are `ARRIVALS`, `DEPARTURES`, a line ending in `:` such as `Restrictions, Limitations and Conditions`, and the fleet sub-headings `NNN Operations …`. A fleet sub-heading with words after it (`747 Operations Prohibited`) is itself a remark. **Fleet rule (SME-18a, as SME-12):** a line under a fleet sub-heading, or under a heading that names a fleet (`VHHH B747 DEPARTURES:`), is attached only when the OFP aircraft type is that fleet (`B744/B748/BLCF` → 747, `B763` → 767, `B77L` → 777). Lines for other fleets are not attached, and one INFO is raised; they stay in `ofpRemarks`. If the type has no known fleet, everything is attached + WARN. An airport the release does not list is not attached (INFO). The INFO counts the printed lines not attached.
- **Takeoff alternate (SME-18):** when an applicable restriction of the **departure** airport says `Takeoff alternate required` and the release lists no `TALT` (`altData` role `TKOF ALT`), a **WARN** finding is raised (field `altData`). The app must flag it to the crew.
- **`airportData[icao].remarksWeather[]`** (D34, D46, SME-23): a `TAF|METAR|SPECI [AMD|COR] IIII …` report in the Remarks, with its continuation lines, gives `{ source, type, text, page, line }` on that airport. `source` is the heading line right above it (e.g. `GOV TAF UPDATED`), else `'OFP Remarks'`. It is **never merged** into `airportData[icao].weather`; under D46 the E-WINS (`* PRIO *`) briefing TAF stays controlling (read in 5d). An airport that is in the release but not on page 1 (L15 PWAK, a CFS alternate) gets an airport entry of the same shape (INFO). A weather remark naming no airport (T3, a WSI area product) is not attached (INFO). The NavBlue-style E-WINS remark (`WSITAF` / TWC, D56) is unseen in FlightKeys and not read (§9).
- **`securityMessages[]`** (D45): `{ text, page, line }` for each security remark (L07 `POS LAUNCH TO DWC APPROVED BY SECURITY`), for the Preflight card.
- **`Released under EWINS Authority`** (L22): kept in `ofpRemarks` (`ewins`); it names no airport and no forecast and sets nothing (SME-17/21; INFO).
- **`extraFuel`** (D39): `{ fuel, minutes, unit, type, tanker, reasons[] }` from the `EXTRA` row (first column, NavBlue number form) and the `extraFuel` remarks. `tanker` is `true` only when a reason says the extra is tanker fuel for this flight (`ECON TANKER FUEL`, `TANKER FUEL`, `TANKERING`, and not `NO TANKER`). `type` is `'TANKER'`, `'PRE-FUELED'`, `'CAPTAIN'` or `''`. A Company NOTAM `IIII-TANKER` is station information and is never used.
- **`pcf`** (SME-7): `{ fuel, minutes, unit, reasons[] }` from the `PCF` row and the `pcf` remarks (PCF, CF, `ADDITIONAL FUEL …`). A non-zero PCF with no reason, or a reason with PCF 0, gives an INFO.
- **`revision`:** `{ kind: 'RLS'|'REV'|'NOT RELEASED', number (as printed, e.g. '01'), time ('03NOV26 15:39'), revision ('1.0' / '-.-'), validUntil ('0055Z 04NOV26'), tlr ('TLR-1'), copies, copiesIdentical }`. If the release number, `Revision: n.0` and `TLR-n` disagree → WARN.

### 5.12 How remarks are grouped: D63 in marked blocks, D63a in unmarked blocks (Exec, 17 Nov)

**Rule (D63).** In airport remarks, and in any remark block that marks its items, a new remark starts **only** at the block's own item marker: a dash, a number or a sub-heading. Any line without a marker continues the remark above it. The joined remark keeps its printed line breaks (`"\n"` between the lines, D54-style: nothing reflowed), and its `page` / `line` are those of its first line.

- **The block's own marker** is the first of `- ` (dash and a space) or `n.` / `n)` (a number of one or two digits and a space) that the block uses after its heading. A line with the other marker kind does not start a remark in that block (e.g. `1.` lines under a dash item continue that item). `-T-` or `10-10` inside a line is no marker: a marker is at the start of the line.
- **A sub-heading always starts a new remark:** the next line opens a remark even without a marker, and it is never joined to the remark above the sub-heading. Sub-headings are those of §5.11 (`ARRIVALS`, `DEPARTURES`, a line ending in `:`, `NNN Operations …`). A fleet sub-heading with words after it (`747 Operations Prohibited`) is itself a remark.
- **The first line after the heading** opens a remark, with or without a marker. In a block with no dash or number (L06), each sub-heading section is therefore one remark.
- The heading, a sub-heading and a dashed rule line are `ofpRemarks` records of their own and never part of a remark.
- **Page breaks** do not end a remark: the release pages are read without their running header, title and footer (§4), so a remark that ends at the bottom of a page and a line that opens the next page follow the same rule.
- **Blank lines in a marked block** (**Exec, 18 Nov, O-11: D63 stands as written**). Only the block's marker (dash, number or sub-heading) starts a new remark. A printed blank line (a gap in the positions, §5.12 D63a) inside a marked item does **not** end it: the item's lines stay one remark, joined with their printed line breaks (`"\n"`) for display. The blank line adds no text, so splitting the remark at `"\n"` still gives exactly the printed lines. On the 26: L06 LEZG `DEPARTURES` is one remark across 2 blank lines (correct, Exec). Test: TC-161-103.
- The station block still ends where §5.11 says (RAIM, CAT, exemption, fleet-note, E-WINS line, next station heading).
- **ADHOC penalty block** (MEL/CDL block): `Dispatcher applied ADHOC penalty:` is a record of its own; each `- ` line starts a record; an unmarked line continues the item above it.
- **Not changed by D63:** MEL/CDL items are an item list, not a remark list (§5.7). A wrapped title is joined with a space as before (it feeds `melItems`, the NavBlue form); a wrapped note keeps its printed line breaks (QA F3, §5.7).

**Block layouts and their markers** (field map v1.1 §2.4, "Station / airport restrictions": *"headed blocks with no end marker (they run until the CAT II/III lines): `** IIII FLIGHT OPS RESTRICTIONS **` + numbered items (L01), + dash items (L21, NFFN), + `Restrictions, Limitations and Conditions:` and `1)` items (L22, **new**); `**IIII/AAA FLIGHT OPS RESTRICTION **` + `ARRIVALS` / `DEPARTURES` sub-headings (L06); `IIII/AAA FLIGHT OPERATIONS RESTRICTIONS:` + fleet sub-headings `747 Operations Prohibited` / `767 Operations` + numbered items (L21, NZWN, **new**); dashed block `IIII B747 DEPARTURES:` (L09)."* and §3 `airportData[icao].remarks[]`: *"sub-headings by flow (`ARRIVALS` / `DEPARTURES`, L06) or by fleet (`747 Operations Prohibited` / `767 Operations`, L21); items numbered `1.` / `1)` or dashed. The block has no explicit end (it runs until the CAT II/III lines)."*):

| Package | Block (heading) | Markers | Printed item lines → remarks |
|---|---|---|---|
| L01 | `** MKJP FLIGHT OPS RESTRICTIONS **` | number `1.` | 1 → 1 |
| L06 | `**LEZG/ZAZ FLIGHT OPS RESTRICTION **` | sub-headings `ARRIVALS` / `DEPARTURES` only (no dash or number; the caution opens with `***`) | 10 → 3: the 3-line caution; `ARRIVALS` 1; `DEPARTURES` 6 lines as one |
| L09 | dashed line + `VHHH B747 DEPARTURES:` | dash | 2 → 1 (`- REFER TO FLEET CAPTAIN BULLETIN - CHANGE NOTICE -` + its second line) |
| L21 | `NZWN/WLG FLIGHT OPERATIONS RESTRICTIONS:` | fleet sub-headings + number `1.` | 6 → 6 (the 747 one not attached for the 767, SME-18a) |
| L21 | `** NFFN FLIGHT OPS RESTRICTIONS **` | dash | 4 → 3: `- CIRCLING FOR RWY 20 IS AUTHORIZED PROVIDED THE FOLLOWING` + `MINIMA ARE OBSERVED: DAY ONLY.` is one remark |
| L22 | `** EPPW FLIGHT OPS RESTRICTIONS **` | sub-heading `Restrictions, Limitations and Conditions:` + number `1)` | 1 → 1 |
| T1, T3, L02 | `Dispatcher applied ADHOC penalty:` (MEL/CDL block) | dash | 1 → 1 each |

**Rule D63a (Exec, 17 Nov; open item O-9).** In a remark block that does **not** mark its items, a remark runs until a blank line, a sub-heading, or the start of a recognised item. Its lines are joined with their printed line breaks; no text is added, removed or reflowed. Marked blocks keep D63 unchanged.

- **Recognised item** = a line that starts an `ofpRemarks` category by its start form (the §5.11 table): the dispatcher line, the boilerplate, `cargoDeclaration`, `perishables`, `security`, an ADC (`permit`), `slot`, `weather` (`GOV TAF UPDATED`, `WSI`/`TWC` products, a `TAF`/`METAR`/`SPECI` report), `melChange`, `pcf`, `extraFuel`, `ballast`, `route`, `RAIM VALIDATION`, a CAT II/III line, a station heading, the fleet note `B7n7-nnn…/ …`, the `E-WINS` line, the `EXEMPTION` line; in the CDC block, the `*** CDC ATTESTATION` heading.
- **Fixed-length recognised items never take a continuation** (**Exec, 17 Nov, O-10 (1): confirmed**). The one-line items are the dispatcher line, `RAIM VALIDATION`, a CAT II/III line, a cargo declaration, `PERISHABLES ONBOARD`, the security line, an ADC and the E-WINS line; each stays one line. The boilerplate ends at its `questions.` line. An unmarked line after one of these starts a new remark (category `other`) and is never joined into the item; T3's 3 test lines after the dispatcher line, for example, are a remark of their own. Test: TC-161-202.
- **Blank line** (QA F1, 18 Nov): a line with no printed text inside a page. The app's reader never writes an empty line inside a page (`src/pdf.html` `processPDF()` writes a line only if it has text; `tools/extract` is the same copy), so a blank line is read **from the positioned items only**: a vertical gap between two consecutive lines of the same page of **at least 1.6 × the median line pitch of the first release copy** (`BLANK_LINE_PITCHES`). The module rebuilds the page's lines from its items exactly as `processPDF()` does (source order, a line = items within 2 pt of its first item's y, top to bottom, empty lines dropped) and uses them only when they match the text page line for line. *Threshold, from the 26 FlightKeys packages:* the release median pitch is 13.20 pt in all 26; one printed line is 0.90–1.10 × the median, a blank line 1.99–2.04 ×, two blank lines 3.00–3.23 ×, and nothing lies between 1.10 and 1.99. The release median is used, not the block's: in 6 of the 26 (L05, L07, L10, L12, L16, L19) the Remarks block has more blank lines than single steps, and its own median is a blank-line step. A spaces-only text line is not a blank line (the app cannot produce one). If the items are missing or do not match the text on a page, no blank line is seen there and one WARN (`ofpRemarks`) names the PDF page(s): remarks are then joined as the rest of the rule says, never split by a guess. **A page break is not a blank line** (**Exec, 17 Nov, O-10 (2): confirmed**, the same as D63). The release pages are read without their running header, title and footer (§4), so a remark continues across a page break and keeps the page and line of its first line. Test: TC-161-203.
- **Sub-heading:** `ARRIVALS`, `DEPARTURES`, or a line ending in `:` that starts no category. It is a record of its own (category `other`, `subHeading` = its text), and the next line opens a new remark under it. The section ends at the next recognised item or blank line.
- A remark that starts after a blank line or a sub-heading, with no start form, is category `other`. It is never counted as a fuel reason.
- **The same grouping feeds every list built from these remarks**, so none is reflowed any more: `pcf.reasons`, `extraFuel.reasons`, `securityMessages`, `airportData[icao].remarksWeather[].text` and the note of a late-addition MEL (SME-19) keep the printed line breaks (`"\n"`) where they used a space.

**Which rule applies, per block**

| Block | Marks its items? | Rule | Remark starts at |
|---|---|---|---|
| Station restriction blocks (L01, L06, L09, L21, L22) | yes (dash, number, sub-heading) | **D63** | the block's own marker, or the line after a sub-heading |
| ADHOC penalty block (MEL/CDL block; L02, T1, T3) | yes (dash) | **D63** | a `- ` line |
| General Remarks run (dispatcher line to `MEL/CDL`, outside station blocks) | no | **D63a** | a recognised item, a blank line (a gap in the positions), a sub-heading, or the end of a fixed-form item |
| CDC attestation (after the release authorization; L01, L09, L12, L16, L22) | no | **D63a** | the `*** CDC ATTESTATION` heading, a blank line (a gap in the positions) or a sub-heading |
| MEL/CDL items and their notes | (item list, §5.7) | unchanged | `MEL`/`CDL` line; notes at `- ` / `RMK - ` (a note's wrap keeps its line breaks, QA F3) |

**Blank lines on the 26 (QA F1).** 131 printed blank lines in the unmarked blocks; every one ends a remark (TC-161-303), so the output of the 26 is the same as before this change. In a marked block a blank line does not start a remark (D63; **Exec, 18 Nov, O-11: confirmed**): one station item, L06 LEZG `DEPARTURES`, is printed across two blank lines and stays one remark (TC-161-103, TC-161-303).

**Changed by D63a on the 26:** 46 remarks in 24 packages (made of 159 printed lines). T1 and T2 are unchanged. Per package: L01 2, L02 1, L03 2, L04 1, L05 1, L06 1, L07 1, L08 2, L09 2, L10 1, L11 2, L12 3, L13 4, L14 2, L15 3, L16 2, L17 2, L18 1, L19 1, L20 2, L21 2, L22 3, L23 2, T3 3. By kind:
- the boilerplate: 23;
- the exemption (2 lines): 6;
- the CDC attestation (6 lines): 5;
- the fleet note (3 lines): 4;
- the MEL change: 2 (L12 4 lines, L13 2);
- the weather: 2 (L15 TAF, 4 lines; T3 WSI product, 17 lines);
- a wrapped PCF reason: 2 (L13, T3);
- the T3 test lines: 1;
- a wrapped extra-fuel reason: 1 (L23).

Lists that keep their line breaks now: `pcf.reasons` (L13, T3), `extraFuel.reasons` (L23), `remarksWeather` (L15 PWAK). No finding changes on any package; the v0.1.0 fields are byte-identical (TC-161-001).

**Changed by D63 on the 26:** 4 remarks in 3 packages, made of 13 printed lines that were 13 records: L06 2 (the caution, `DEPARTURES`), L09 1, L21 1 (NFFN). Airport remarks 10 → 3 (L06), 2 → 1 (L09), 9 → 8 (L21); `ofpRemarks` records 21 → 14, 19 → 18, 21 → 20. Every other package and every other field is unchanged (TC-161-100).

---

### 5.13 Briefing reader (step 5d; grammar §A.1–§A.3, §A.10 row 10; rows 37, 50)

The briefing documents are read from the **positioned items only** (`input.pages`), never from the text: in the text, one line from each column is joined with three spaces (grammar §A.3), so items cannot be cut from it. TC-162-004 blanks the text of every briefing page and the output does not change.

| Step | Rule | Threshold (measured on the 567 briefing pages of the 26 packages) |
| :--- | :--- | :--- |
| Bands | running header y < 27.5; footer y > 571.6; body between | header row y = 19.88 on every page; body rows 35.03–563.88; footer row 579.40 |
| Columns | left: item x < page width / 2 (420.9 pt); right: the rest | left items start at x 30.35–404.75; right items at x ≥ 430.03 (no item starts in the gap) |
| Lines | items within 2 pt of the same y form one line, sorted by x; indentation and gaps kept as spaces on the 4.8 pt Courier grid, counted from the column edge (left 30.35, right 430.03) | — |
| Reading order | running header, left column top to bottom, right column top to bottom, footer (§A.1) | — |
| Furniture | removed by position **and** shape: running header `<CALLSIGN> / <ORIG> - <DEST> / YYYY-MM-DD / <REG> YYYY-Mon-DD HH:MM` (shape only, never the release flight number: L22 prints the GTI number in the briefing), footer `Page n of N <uuid>` / VA `Page1of1 <uuid>`. A band row that does not have the shape is **kept as text** with a WARN (fail-safe). | — |
| Documents | runs of pages whose footer counts `Page 1 of N` … `Page N of N` with one uuid (§A.2), named by content: first line `HIGH SEVERITY COMPANY NOTAMS` → HSCN; `COMPANY NOTAMS` → Company + NOTAM Briefing; the VA footer and `VOLCANIC ASH` → VA; an airport block and a `TAF`/`METAR`/`ATIS` heading → Weather + Hazard Briefing | 4 documents in 26/26 |
| Continuation | a column or page break inside an item is not a line break of the item: with the furniture removed, the right column continues the left one and the next page's left column continues the right one; header rows split by a page (40 items) are read whole | — |

Centred headings are lines at indent ≥ 21 characters (≥ 100 pt, §A.6); report and item text sits at indent 0–2.

### 5.14 Airport blocks (§A.4; SME-1)

An airport block is a name/role line `[<IATA>] - <NAME>  <ROLE> DD HH:MM - DD HH:MM`, then the `APT<ICAO>` line (`APT` glued to the code; `RWYS:` after a space or glued), then any wrapped runway / role lines. The role is taken from the closed list (`dest2AltnPlanned`, `dest2Altn`, `dest2`, `DESTINATION`, `DEPARTURE`, `ALTN 1`, `ALTN`, `IA`, `TA`, `EA`), anchored to the window at the end of the line. It is never found by splitting on spaces, so a clipped name glued to its role (`…ANCHORAGDEPARTURE`, `…AT PEASEdest2AltnPlanned`) and a name ending in a role word are read right. A block has no IATA code in 3 cases (L22 EPPW, L16 RJCJ). Every role window is kept, with the briefings that print it, in `airportData[icao].briefing.roles` (addendum 3). A line that looks like a name line but has no `APT` line after it is not a block. A FIR block (name line + `FIR<ICAO>`, §A.8) ends the airport part of a document.

### 5.15 Airport NOTAMs (rows 44, 45; §A.5, §A.6; D43, D54, D64; FK-P)

Per airport, the body of its NOTAM Briefing block is read in order:

1. A **type heading** (one of the 17 of §A.6, centred) sets the category of the items under it and is **removed from the item text** (D64).
2. An **empty-state box** (`THERE ARE NO ACTIVE NOTAMS FOR AIRPORT …` / `NIL` / closing line) gives no item; its printed text stays in `notamsRaw`; INFO `ICAO: the NOTAM Briefing prints no active NOTAMs`.
3. The text under one heading is cut into items by the **NOTAM ruleset** (`options.notamRules._splitNotams`, then `_fkHeader` for the ID), so the NOTAM grammar exists once (ADR-005 §2.5). The parser itself never cuts at a NOTAM header. Without the NOTAM ruleset the text is still read (`notams`), but `notamItems` is `[]` and one WARN is raised.

Outputs (addendum 3):
- `notams` — the item texts, in printed order, joined by `\n`: the form NOTAM v1.13.0 splits (FK-P). `_splitNotams(notams)` gives back exactly the items. Line breaks and indentation inside an item are kept (D54).
- `notamItems[]` — `{ id, category, source }` per item, in the same order.
- `notamsRaw` — the section as printed (D64): headings, items, empty-state text.

Every printed item is kept. L15 PHNL prints 23 IDs twice under `GENERAL`: the same header row, different body wrapping. Both items are kept, never merged by text (D43); the NOTAM ruleset's own D43 rule (same location(s) and ID) decides at evaluation.

**Weather-only airports** (`ALTN`, `dest2Altn` and some `IA`; §A.4) get `notams ''`, `notamItems []`, `notamsRaw ''` and the INFO `ICAO: no NOTAM block in the FlightKeys briefing`.

Company NOTAMs (the part of the document before the first airport block) and FIR NOTAMs (after the first FIR block) are never airport NOTAMs (v0.4.0: §5.18, §5.21).

### 5.15a v0.4.0 — the type headings to the NOTAM rules (scope 0; D67)

`notams` keeps the printed type heading lines (centred, as printed) before the items under them, in printed order, as NOTAM v1.14.0 expects (its §5b: a heading is never item content; it is the category of the items after it; the `OBSTACLE` heading makes an item an obstacle NOTAM). Without the heading lines the text is v0.3.0's byte for byte (TC-163-001). An airport with an empty-state box only keeps `notams ''`. `notamItems` and `notamsRaw` are unchanged: record *i* of `notamItems` is item piece *i* of v1.14.0's `_splitNotams(notams)` (heading pieces are not items), or piece *i* of `_splitNotams` of the text without the heading lines.

Proof (TC-163-002): on all 26, NOTAM v1.14.0 at no window and at each role window midpoint (724 evaluations, 135 airports, 2,292 items, 635 headings) shows / hides every item as with v0.3.0's text, except the **24 OBSTACLE-category items** of the 5c-2 change list v1.2 (FK, by the heading, group B) — and every one of those differs. NOTAM v1.13.0 (built into the app until 5e) must not be given this text: a trailing `OBSTACLE` heading hides items there (O-12). The parser's own splitter call (`options.notamRules`, v1.13.0 in the tests) works on the text under one heading and is unchanged.


### 5.16 Airport weather and E-WINS (rows 43, 48; §A.9; D46, D55, D56, D65, D66; SME-15, SME-17, SME-21, SME-23)

Per airport, the body of its Weather Briefing block has the sub-headings `TAF`, `METAR` and `ATIS`. A **report** starts at indent 0–2 with its keyword: `TAF` / `* PRIO * TAF` under TAF, `METAR` under METAR, `AD <AAA> /OS` under ATIS. Every other line continues the report above it (wrapped TAF groups as printed: 42 lines end in a bare `TEMPO` / `BECMG` / `PROBnn`). An empty-state box gives no report. A line with no report above it is kept as a report of its own (fail-safe) with a WARN (none on the 26).

`weather` is in **NavBlue's form**: the reports as printed, joined by `\n`, **METAR first** (newest first, as printed), **then ATIS, then TAF last**. The TAF goes last because the app reads the TAF from the first `TAF` to the end of the text (`extractEtaWindow`), as in NavBlue's METAR-then-TAF text (FK-P). **D65 (Exec, 18 Nov): kept so.**

**`weatherRaw` (D65, addendum 3):** "TAF – METAR – ATIS — it should match the FlightKeys format." It is the airport's Weather Briefing block **as printed**, for the RAW view (step 5e):
- the sub-headings `TAF`, `METAR`, `ATIS` and every report in printed order;
- line breaks and indentation, wrapped TAF groups and the printed empty-state text kept;
- page and column breaks and the running header and footer removed (D54);
- the `* PRIO * ` prefix removed from its report's first line (D55); nothing else changed.

The block's own lines (name/role, `APT<ICAO>`, runways) are not part of it, as for `notamsRaw`. **No evaluation reads `weatherRaw`.** It is `''` for an airport with no Weather Briefing block, and it is the last key of the entry.

**E-WINS.** The `* PRIO *` TAF is the E-WINS forecast (D55 for row 48, SME-17, SME-21). It is found in 3 packages: L15 PWAK, L20 CYXY, L22 EPPW. Its fields (D66, Exec 18 Nov):
- `ewinsWeather` — the forecast as printed, with the prefix removed (it is not displayed, SME-21).
- `ewinsWindow` — **`''`**. No window is built from the forecast's validity. The app's `evalAirport()` (`src/airports.html` line 297: `var effectiveWin = isEwins ? (_ewRef.ewinsWindow || wxWindowOverride) : wxWindowOverride;`) then reads the E-WINS forecast in the airport's **normal window** — ETA ± 60, or its role / CFS window — as for any TAF (TC-162-034, with the app's own `extractEtaWindow` through the harness).
- `ewinsRole` — **the airport's actual role**: its briefing role codes (§5.14) in printed order (name/role line, then `APT` line, then wrapped lines), each once, joined by `/`.

  | Package | Airport | Roles printed | `ewinsRole` |
  | :--- | :--- | :--- | :--- |
  | L15 | PWAK | EA | `EA` |
  | L20 | CYXY | TA, IA | `TA/IA` |
  | L22 | EPPW | DEPARTURE, IA | `DEPARTURE/IA` (the departure) |

  The codes are FlightKeys' own (grammar §A.4; Company NOTAM "WX/NOTAMs in Briefing Acronyms"):

  | Code | Meaning |
  | :--- | :--- |
  | `DEPARTURE` | origin |
  | `DESTINATION` | destination |
  | `ALTN 1` | first destination alternate |
  | `ALTN` | further alternates (weather only) |
  | `IA` | intermediate (adequate) airport |
  | `TA` | terrain alternate |
  | `EA` | en-route (ETOPS/ETP) alternate |
  | `dest2` | reclear (redispatch) airport |
  | `dest2Altn` | reclear alternate candidate |
  | `dest2AltnPlanned` | reclear alternate as planned |

  The app stores the value only.

**FK-P does not copy a logged NavBlue fault.** NavBlue's `extractEwins()` (locked, D47) has two:
- **NB-F6:** it builds `HH00Z-HH00Z` from `DDHH/DDHH`, dropping the days. A forecast valid 24 h or more gets equal hours (on the same forecasts: `0400Z-0400Z`, `0500Z-0500Z`, `1300Z-1300Z`; NavBlue fixture `NB_KWRI-EPRZ_08APR26` EPPW `1200Z-1200Z`).
- **NB-F7:** it takes the role from the free-text line, with `ALT` by default.

Both are logged as open gaps G-NB-6 (lines 1320–1321) and G-NB-7 (lines 1316–1318) in `test/known-gaps.json`. NavBlue is not changed.

The TAF stays in `weather` too, prefix removed (D46: E-WINS sets the status; both reports kept for RAW). At L15 PWAK the Weather Briefing prints the PRIO TAF (0400Z) and, under it, the later `TAF AMD` (1520Z), which the Remarks also quote. The PRIO TAF is controlling (SME-23) and is `ewinsWeather`; both briefing TAFs stay in `weather`; the Remarks copy stays in `remarksWeather` (D34).

**Negatives:**
- A TAF without `* PRIO *` is not E-WINS.
- The L22 release line `Released under EWINS Authority` names no airport and sets nothing (v0.2.0 finding kept).
- The Hazard Briefing (FIR blocks: `TWC FPG`, `TWC SIGMET`, `AIRMET`, `SIGMET`, `CONVECTIVE SIGMET`) is never airport weather or E-WINS (row 48).

### 5.17 Airports, card order, sections (rows 37, 38, 43–45; SME-1; ADR-005 §2.6)

Every airport with a block in either briefing has an `airportData` entry (285 on the 26, incl. the 101 weather-only `ALTN` airports). Entries are created with the v0.2.0 shape plus the addendum-3 keys.

The v0.2.0 entries keep their keys and values (the explicit empties `weather` / `notams` are filled). An OFP page-1 airport with no block in either briefing keeps its entry, with `briefing: null` and a WARN (none on the 26).

**Card order** = key order (addendum 3):
1. the OFP page-1 airports, in line order;
2. the other airports with a role other than `IA` / `TA` / `EA`, in briefing order (the Weather Briefing's block order, which lists every briefing airport);
3. the `IA` / `TA` / `EA`-only airports, in briefing order.

**Sections** (`sections[]`, ADR-005 §2.6) take the form `{ id, title, startPage, endPage, anchor }`: absolute PDF pages, in page order; the anchor is text printed on the start page.

| id | title | From | Anchor |
| :--- | :--- | :--- | :--- |
| `hscn` | High Severity Company NOTAMs | HSCN document | `HIGH SEVERITY COMPANY NOTAMS` |
| `ofp` | OFP | the first release copy only (§2.6.3; the copies are reported under `release`) | `OPERATIONAL FLIGHT PLAN` |
| `companyNotams` | Company NOTAMs | Company + NOTAM document, first page to the page of the first airport block | `COMPANY NOTAMS` |
| `notamBriefing` | NOTAM Briefing | the page of the first airport block to the document end | `APT<ICAO>` of that block |
| `weatherBriefing` | Weather Briefing | Weather + Hazard document, first airport block to the first FIR block | `APT<ICAO>` |
| `hazardBriefing` | Hazard Briefing | the first FIR block to the document end | that FIR block's name line |
| `nat` | NAT Tracks | text pages headed `NAT-TRACKS` | `NAT-TRACKS` |
| `va` | Volcanic Ash Advisories | VA document | `VOLCANIC ASH` |
| `charts` | Charts | text pages headed `Chart Alert` / `+ JEPPESEN` (Jeppesen attachments) | the heading of the first page |
| `tlr` | Takeoff/Landing Report | the first TLR copy, found as `_tlrLines` finds it | `TAKEOFF AND LANDING REPORT` |

Where one document holds two sections, they share the page where the second starts. The names and order are confirmed by the Exec in the app (ADR-005 §2.6.5; O-20).

---

### 5.18 Company NOTAMs (§A.7; scope 1; O-40; D43, D54)

Read from the positioned items: the High Severity page (heading `HIGH SEVERITY COMPANY NOTAMS`) and the Company part of the NOTAM document (heading `COMPANY NOTAMS`, sub-heading `GENERAL`, up to the first airport block). The headings are no item text. Items are cut by the NOTAM ruleset (`_splitNotams`, `_fkHeader`), as airport items.

**O-46 (Exec, 19 Nov) — Dispatch contact.** Both lines stay in the P0110 text exactly as printed: **`Contact Dispatch for a preflight briefing.`** (T1–T3, L01–L19: 44 lines, the HSCN and the Company copy of the P0110-type item; T1 / T2 print it in P0100) and **`Contact Dispatch for a preflight briefing if you have any questions.`** (L20–L23: 8 lines). Both are printed inside the item, before its closing banner; the item's `source` positions cover the line. The package-level field **`dispatchContact`** (addendum 4) = `{ label, text }`: `label` **`'REQUIRED'`** for the short form, **`'IF QUESTIONS'`** for the long form; both printed → `'REQUIRED'`; neither → `null`. `text` = the line of the label, as printed. A form is one whole printed line (trimmed) of a Company NOTAM (HSCN or Company); other wording (`… CONTACT DISPATCH.`) is not a form. One INFO names the label, the line and the items it was read from. On the 26: REQUIRED 22, IF QUESTIONS 4 (L20–L23), null 0 (TC-163-111).

`companyNotams[]`, one record per printed item, the HSCN item first, then the Company items in printed order: `{ id, location, subject, start, end, severity, origin, text, source }` — `location` the header's location, else `'GENERAL'` (`PUBS-` is no location); `subject` the `SUBJECT:` key; `start` / `end` as printed (`'UFN'`, `'UFN(EST …)'`); `severity` `'high'` (HSCN) or `'normal'`; `origin` `'HSCN'` or `'COMPANY'` (the source flag of O-40); `text` the item as printed, header rows included, line breaks and indentation kept (D54); `source` the printed positions as in `notamItems`. The P0110 pair (HSCN and Company) is two records, never merged (D43). On the 26: **298 = 26 HSCN + 272**, per package = grammar §A.2, texts = the independent reading with the Contact line kept (TC-163-011).

### 5.19 Curfews (row 46; scope 2; O-33 … O-37; SME-12, SME-22, SME-22a; rule 6)

Only an item whose subject is **`IIII-CURFEW`** gives a curfew (O-37), into `airportData[IIII].curfew` in NavBlue's form: one line per curfew line, `\n`-separated; several items of one airport appended in printed order. No airport entry is created (INFO; the item stays in `companyNotams[]`). Curfew-like wording under another key gives no curfew and one INFO naming the item (on the 26: T1 EHAM-INTAM, T1 EHAM-ARRL CRF, L03 ZHCC-RWY CLSD, L06 / L07 LLBG-RWY 30, L23 ETAR-RAMP CLSR).

The lines kept, from the item's text after `SUBJECT:` (banners and other lines dropped, as NavBlue):
1. **Windows**: a line with `HHMM[Z]-HHMM` followed by `Z` or `UTC`, trimmed.
2. **O-35:** a local-time bracket (`(… LCL)`, `(… LOCAL)`) is removed from the line — UTC only. `companyNotams[]` keeps the full text. NavBlue keeps the bracket and the app then reads its times as a UTC window: **NavBlue fault NB-F8** (`test/known-gaps.json` G-NB-8), not fixed (D47).
3. **O-36:** a departure-only / arrival qualifier line with no digits (`DEPARTURE(S)|DEPARTING|ARRIVAL(S)|ARRIVING` with `ONLY|NOT APPLICABLE`) is kept.
4. A season sub-heading line (`SUMMER:` / `WINTER:`) is kept when a window under it is kept.

**O-33, O-48 aircraft type (closed table, `CURFEW_TYPES`; a planned FK-P exception — NavBlue applies every line):** a line `<list> CURFEW = …` whose list is aircraft types is a type line; one whose list is registrations is a registration line (**never matched**). A list token is a type token when it is a family or variant name of the table, or `B7nn…`; so `B77L` is never read as a registration. The table maps the OFP type (ICAO designator, FPL field 9) to its family and its variant names:

| OFP type | Family | Variant names |
| :--- | :--- | :--- |
| `B762` / `B763` / `B764` | `B767` | the designator |
| `B744` | `B747` | `B744`, `B747-400/F` |
| `BLCF` | `B747` | `BLCF`, `B747-400/F` (Exec: BLCF matches `B747-400/F`) |
| `B748` | `B747` | `B748` |
| `B772` / `B773` / `B77L` / `B77W` / `B77F` | `B777` | the designator |

**O-48 (Exec, 19 Nov):** a **family** name in the item (`B747`, `B767`, `B777`) applies to every variant of that family; a **variant** name (`B763`, `B748`, `B747-400/F` …) only to that variant. Example: `B767, B777, B748` → all 767s, all 777s, the 747-8 only. A type line matches when one of its tokens names the OFP type. If a type line matches: the general lines + that line (several matching lines are all kept); the other type lines and the registration lines are left out. If none matches — a variant mismatch (`B744` vs `B748`) or a type not in the table — every line + the note `NOTE: NO CURFEW LINE FOR THIS AIRCRAFT TYPE - ALL LINES SHOWN` + WARN (unchanged). The build-1 entries `B747-400F` and `B777F` were not ICAO designators (FPL field 9 never carries them) and are not in the table.

**O-34 effectivity (SME-22a):** lines with a season (`SUMMER` / `WINTER`, in the line or under a season sub-heading). Each season's months must be stated (`<MONTH> TO <MONTH>`). Readable, with the flight date: in the **changeover month** — the month in which a stated season ends (EHAM: March, October) — every season window + `NOTE: SEASON CHANGES THIS MONTH - BOTH WINDOWS SHOWN`; otherwise only the season in force, no note. Not readable (no months, or no flight date): every window + `NOTE: EFFECTIVE DATES NOT STATED - ALL WINDOWS SHOWN` + WARN. No weekday split (weekday / holiday lines are kept as printed). The notes carry no digits (the app reads every `HHMM-HHMM` in the string as a window).

On the 26: 16 CURFEW items in 10 packages, each read; OFP types B744 12, B763 5, B77L 4, B748 4, BLCF 1, all in the table; no curfew string changes with O-48 (TC-163-131); RJAA by type (L02, L18 B744 → the 1400Z line; L14 B77L → the 1500Z line); T1 EHAM (27 Oct) both windows + changeover note; L23 ETAR all four windows + dates note + the one curfew WARN of the 26; T2 ZUCK departure-only lines kept.

### 5.20 Ops notes (row 47; scope 3; O-38, O-39; SME-18)

One `opsNotes { header, body }` per airport that has an `airportData` entry (no entry is created, INFO — L13 UAAA): `header` `'IIII COMPANY NOTAMS'`; `body` every Company item located at the airport, in printed order, each as its `SUBJECT:` line + its text lines as printed, except the airport's CURFEW item(s) and the **repeats** (O-38). A repeat: every content word (letters / digits) of the item — the SUBJECT words and a first title line naming the airport excluded — is in that airport's OFP Remarks (`airportData[icao].remarks[]` text / heading / sub-heading and the `ofpRemarks[]` records of that airport). A repeat stays in `companyNotams[]` and gets an INFO. On the 26: 3 repeats (L06 LEZG-FLTOPS2, L09 VHHH-T SID DEP, L21 NZWN-FLIGHTOPS); 66 airports with ops notes.

### 5.21 FIR NOTAMs (row 49; §A.8; scope 4; O-40, O-41; D54, D64)

The FIR blocks of the NOTAM Briefing (name line + `FIR<ICAO>` line, after the airport blocks), in route order. Each block body is read as an airport block (§5.15): headings are the category and never item text; the empty-state box gives no item.
- `firNotams[]` (addendum 4) — one record per printed block: `{ name, code, empty, items: [{ id, category, origin, text, source }] }`; `origin` `'NOTAM'`, or `'COMPANY'` for a Company item keyed to this FIR (O-40: a `GENERAL` item whose SUBJECT key `IIII-` is the code of a FIR block of the package; RCAA-GUARD in L04 and L09, VGFR-VGFRADC in L17). No block for the key → company only + INFO. Repeats: O-49 below.
- `firRaw[]` (addendum 4; D64) — one record per printed block: `{ name, code, raw }`, the block exactly as printed (headings, items, empty-state box), page and column breaks removed. No Company item.
- `enrouteNotams.fir` — the non-empty blocks, in route order, separated by a blank line: the block name `NAME (CODE)`, then its items as printed (no type heading); a Company item after a `[COMPANY NOTAM]` line. Empty blocks are left out + INFO naming them. `route`, `airway`, `waypoint`, `geographic` are `''` + one INFO (FlightKeys prints en-route NOTAMs per FIR only, §A.8). FIR items never enter an airport's NOTAMs.

**O-49 (Exec, 19 Nov) — FIR repeats.** A FIR NOTAM printed under more than one FIR block — the **same NOTAM ID and the same item text** (D43: a different ID is never the same NOTAM; L17 prints two different NOTAMs with one ID, A3413/26, both kept) — is kept only under the blocks whose FIR is **on the OFP** or is the **departure FIR** (O-50 below). Its other copies are left out of `firNotams[]` and `enrouteNotams.fir`. If none of its FIRs is on the OFP, every copy is left out (Exec decision). A NOTAM printed under one block only — twice in one block included (T1 LHCC, L12 EGTT) — is unchanged. A Company item (O-40) is never a repeat. One INFO (`enrouteNotams`) lists every copy left out (`ID under NAME (CODE)`, marked when every copy is left out). `firRaw` stays exactly as printed (D64). `empty` keeps its meaning (the block prints the empty-state box); a block whose items are all left out is left out of `enrouteNotams.fir` + INFO (none on the 26). If no FIR of the OFP can be read (no navigation-log FIR line and no FPL `EET/`), nothing is left out + WARN — whatever the departure FIR (O-52, Exec 20 Nov: as built). The INFO also names the departure FIR (`FIR not on the OFP and not the departure FIR IIII`).

**Source of "FIR on the OFP"** (the brief: FIR crossings in the OFP or the ICAO FPL): the union of (1) the FIR lines of the release navigation log, `(IIII) <position or AT fix> <time> <FIR name>` (first release copy), and (2) the FIRs of ICAO FPL field 18 `EET/` (`IIIIhhmm`). On the 26 the EET list is inside the navigation-log list in 26/26, so (1) decides. The navigation log does not print the departure FIR in 12 packages (T1, T2, L01, L04, L06, L07, L09, L12, L13, L16, L21, L22): see O-50.

**O-50 (Exec, 20 Nov) — the departure FIR.** For the O-49 rule the **departure FIR — the first FIR block of the NOTAM Briefing — always counts as on the OFP**, whether or not the navigation log prints a line for it. A repeat is therefore kept under the departure FIR as well as under every FIR of the OFP; a repeat printed only under the departure FIR and FIRs not on the OFP keeps its departure copy; a copy under a FIR that is neither on the OFP nor the departure FIR is still left out (also the second block). Measured on the 26 (TC-163-141): copies left out 6 → **1**; T2 keeps its 4 copies under ZPKM and L16 its 1 copy under ZHWH (both the first block); L03's 1 removed copy (A4854/26 under ZGZU, Guangzhou — its departure FIR is PAZA) is unchanged, so L03 is the only package that differs from build 1 in `firNotams[]` / `enrouteNotams.fir` (T2 and L16 = build 1 again). Nothing else changes: `firRaw`, every other field and every finding except the O-49 INFO (gone for T2 and L16; the text of L03's names the departure FIR) are byte-identical to the previous head (`50e13b0`) on all 26.

On the 26: **221 blocks, 989 items printed** (= grammar §A.2 and the independent reading), **43 empty**, 4 items with no heading (the L15 ASHTAMs), 3 Company items with their FIR. FIR NOTAMs printed under more than one FIR block: **24 in 10 packages, 53 printed copies**; **6 copies left out in 3 packages** (T2 4 under ZPKM, L03 1 under ZGZU, L16 1 under ZHWH; each NOTAM still shown under an OFP FIR); **0 NOTAMs left out under every block** (TC-163-141). `firRaw` = build 1 in 26/26.

### 5.22 Hazards (scope 6; O-45)

`hazards[]` (addendum 4) — one record per FIR block of the Hazard Briefing (after the Weather Briefing's airport blocks): `{ name, code, text, empty }`; `text` the block exactly as printed (the `SIGMET` sub-heading, the products, the empty-state box), not split, not evaluated, repeats not merged; `empty` when the block prints no product. Never airport weather, `weatherRaw` or E-WINS. On the 26: **221 blocks, 66 empty, 1,980 products** (grammar §A.9 forms: `TWC FPG` 1,307, `TWC SIGMET` 30, `AIRMET …` 638, `SIGMET` 3, `CONVECTIVE SIGMET` 2); the same FIR list as the NOTAM Briefing in 26/26. Display (RAW only, collapsed by FIR unless expanded): step 5e.

### 5.23 NAT (row 42; scope 5; O-42, O-43; SME-14 as amended, SME-20)

The NAT track pages (`NAT-TRACKS`, text) are read as one stream, the page heading removed. A **part** runs from `(NAT-n/N TRACKS …` to `END OF PART … PARTS)`; a **message** is parts 1 … N with the same N and validity line. `natMessages[]` (addendum 4) = every message, in printed order: `{ tmi, direction, valid, parts, complete, pages, text, selected }` — `direction` `'EAST'` / `'WEST'` from the tracks' `EAST LVLS` / `WEST LVLS` (null + WARN if not readable); `complete` all parts printed (else WARN); `text` the message as printed across its pages.

**The message returned** (`natTrack`, through the injected NAT parser `options.parseNatTrack` — the app's `src/nat.html`, called with the message text, origin and destination): the flight's direction first (the NAT parser's `flightDir`), then the **higher TMI**; an unreadable TMI counts lowest + WARN. Equal TMI is a finding (WARN) only if the same direction and validity. Only the opposite direction printed → that message is returned + a **crew-alert WARN** (`CREW ALERT: …`). **O-43, O-47 (Exec, 19 Nov):** `natTrack.assignedId` = the filed track (`NATx`) read from the **OFP page 1 route** (release page 1, first copy: from the line `IIII/Fnnn …` to the line before `Coldest Fuel Temp`) **and** the **ICAO FPL strip route** (field 15, through icao-fpl); remarks, Company NOTAM and FIR NOTAM text are never read for it. Both name one letter → that letter; only one names it → that one; they differ (or a route names two letters) → the FPL strip's letter (the plan filed with ATC) + a crew-alert WARN (O-51). The `natTrack` INFO names the source(s): `filed track W (OFP page 1 route and ICAO FPL route)`, `… (OFP page 1 route)`, `… (ICAO FPL route)`, or `none (random route: …)`. No NAT parser → `natTrack null` + INFO `NAT parser not supplied` (as NavBlue), `natMessages[]` still read. The NAT parser decides whether the route is an Atlantic crossing (null otherwise).

On the 26: 5 packages, 6 messages, all complete; L12 (westbound) returns **307**, 308 in `natMessages[]`; L08 (eastbound, westbound message only) and L22 (westbound, eastbound message only) return their one message with the crew alert; filed track per NAT package (TC-163-121):

| Package | Filed track | OFP page 1 route | ICAO FPL route | NAT text elsewhere (never read) |
| :--- | :---: | :---: | :---: | :--- |
| L08 | none | — | — | — |
| L11 | `W` | `NATW` | `NATW` | FIR NOTAM text names `NATX` |
| L12 | none | — | — | — |
| L22 | none | — | — | FIR NOTAM text names `NATX` |
| L23 | none | — | — | FIR NOTAM text names `NATX`; the remarks name NAT tracks |

**v1.0.0 — the NAT call with `{ filed, findings }` (O-68, module side; D78, D79, D81).** The filed letter above is worked out **before** the NAT call (the D74 crew-alert WARN for differing routes is added first, unchanged). The call for the chosen message is `parseNatTrack(text, origIcao, destIcao, { filed, findings })`: `filed` = the letter, or `null` for a random route; `findings` = a fresh array the NAT ruleset pushes `{ level, field: 'natTrack', code, message }` to. Its entries are appended to `findings[]` unchanged (with `code`), after the D74 WARN and before the `natTrack` INFO. So:

- filed letter **not printed** in the chosen message → WARN `NAT-FILED-NOT-IN-MESSAGE` `FILED NAT x NOT IN TRACK MESSAGE TMI nnn (DIR) – CHECK OCEANIC CLEARANCE` (D79, no full stop); `assignedId` = the letter, no track marked; no search of the other direction;
- **no filed letter** → INFO `NAT-RANDOM-ROUTE` `NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI nnn)` (D81);
- the other codes of the NAT ruleset's closed list (`FINDING_CODES`: `NAT-NO-TRACKS`, `NAT-TRACK-UNREADABLE`, `NAT-WAYPOINT-UNREAD`, `NAT-TRACK-DUPLICATE`, `NAT-MULTI-MESSAGE` WARN; `NAT-FILED-IGNORED`, `NAT-VALIDITY-UNREADABLE`, `NAT-REMARKS-DIRECTION` INFO) arrive the same way; none fire on the 26.

The probe call (the flight's direction) passes no options, so a finding is never given twice. With the NAT ruleset v1.2.0 the module's own `assignedId` / `assigned` lines change nothing; they keep v0.4.0's result with a parser that ignores the options. On the 26: L11 filed `W`, marked, no NAT finding; L08, L12, L22, L23 one `NAT-RANDOM-ROUTE` INFO each. **Findings shape:** the parser's own findings stay `{ level, field, message }`; a forwarded NAT finding is `{ level, field, code, message }` (TC-164-013).

**Limit (v0.4.0 with the app's NAT parser v1.1.0):** v1.1.0 does not read the FlightKeys track lines (`blocks: []`, `rawFallback ''`): `natTrack` carried the TMI, the direction and `assignedId` only. With the NAT ruleset v1.2.0 (D77, at the switch) the tracks are read (TC-173-041).

### 5.24 PACOTS (O-44; D42)

A FIR NOTAM item whose text says `PACOTS TRACKS` anywhere (a headline wrapped over two lines included) is a PACOTS track message. One `sections[]` entry per **set** — the PACOTS items printed one after the other in one FIR block with the same validity end (one day's tracks): `{ id: 'pacots', title: 'PACOTS Tracks', startPage, endPage, anchor }`, the anchor the set's first NOTAM ID. `natTrack` stays null; no track object. On the 26: 38 items, 13 sets, 10 packages. All 38 are eastbound tracks; only L09 and L16 fly eastbound (the label for the others: O-44 addition, main chat).

---

## 6. Tests (run by `npm test`)

| ID | What | Result (2026-11-20) |
| :--- | :--- | :--- |
| TC-160-001 … 040 | the v0.1.0 battery (`test/rules/ofp-flightkeys.test.js`), scoped to the v0.1.0 fields; version / contract / airport keys / deferred-list asserts updated for v0.3.0 | 20/20 PASS |
| TC-161-001 | **v0.1.0 fields byte-identical**: SHA-256 per field vs the recorded v0.1.0 output (`test/rules/data/ofp-flightkeys-v0.1.0-baseline.json`) on 26 fixtures; v0.1.0 findings kept in order; one airport entry added (L15 PWAK) | PASS |
| TC-161-002 | QA F4: the FPL from the release only | PASS |
| TC-161-010 / 011 | crew on 26 (values against the **private** `expected/ofp-flightkeys-v0.2.0/crew.json` in the fixtures repo; public: roles, counts, flags, operating pilots per package) / synthetic positive and negative; QA F2: a full crew block, heading included, planted on a briefing page before the release is never read (with and without a release crew list) | PASS |
| TC-161-020 / 021 | CAT II/III on 26 / synthetic (restriction never an authorisation; US restriction only; authorised airport with a restriction; MEL restrictions; outside the release never read; QA F2: a Remarks block with CAT lines, heading included, on a briefing page before the release is never read) | PASS |
| TC-161-030 / 031 | MEL/CDL/DDG on 26 / synthetic (wraps, notes keep their line breaks (QA F3), indentation from positions, ADHOC, repeated items kept, late additions positive and negative, TLR codes below RMKS) | PASS |
| TC-161-032 / 032a | TLR on 26 (= NavBlue except L10) / synthetic page break | PASS |
| TC-161-040 | **FK-P matched pair** (§7) | PASS |
| TC-161-050 / 051 | remarks and everything they feed, on 26 / synthetic with a negative per rule | PASS |
| TC-161-100 | **D63 on 26:** L21 NFFN circling + minima = one remark, L06 LEZG, L09 VHHH (positive); L21 NZWN five numbered items stay five, NFFN items 1 and 2 stay apart (negative); airport remarks and `ofpRemarks` records per package; joins only in station blocks | PASS |
| TC-161-101 | **D63 synthetic:** unmarked line joins; two adjacent marked items stay two; another marker kind continues; a sub-heading always starts a new item (flow and fleet); a remark across a page break joins, and one that ends at the page end stays apart from the marked item opening the next page; SME-18 on a wrapped item; the SME-18a INFO counts lines | PASS |
| TC-161-102 | **D63 on the ADHOC block:** a wrap joins its dash item | PASS |
| TC-161-103 | **O-11 (Exec, 18 Nov):** in a station block, a sub-heading item and a dash item each printed across two blank lines (gaps in the positions) stay ONE remark each, line breaks kept; the next dash marker after a blank line still starts a new remark; every printed line kept once; control: the same lines in the unmarked run split at the blank lines (D63a) | PASS |
| TC-161-200 | **D63a on 26:** the 2-line exemption (6 packages), the 3-line fleet note (4), the CDC attestation (5), the boilerplate (23), L12 MEL change, L15 TAF = ONE remark each; records per package; two adjacent recognised items stay two (L13 PCF, L20 cargo); a one-line item never joined; reasons keep their line breaks | PASS |
| TC-161-202 | **O-10 (1):** every one-line recognised item kind (dispatcher, RAIM, CAT, cargo, perishables, security, ADC, E-WINS) stays one line and the next unmarked line is a new remark; the boilerplate ends at `questions.`; T3 test lines a remark of their own; control: PCF does take its continuation | PASS |
| TC-161-203 | **O-10 (2):** a remark continues across a page break (exemption, PCF reason) and keeps its first page; the same lines split by a blank line (a gap in the positions) are two remarks | PASS |
| TC-161-300 | **QA F1:** the tests' copy of the app reader rebuilds the text of all 26 fixtures from their items byte for byte (the synthetic input is built with it) | PASS |
| TC-161-301 | **QA F1 cases, on a copy of the real items:** L15 PHNL-WIHH and L17 OMAA-VHHH, the `RAIM` line after a printed blank line replaced by an unrelated line (positions unchanged) → a remark of its own, PWAK `remarksWeather` and `pcf.reasons` unchanged; the same item moved up one pitch (no blank line) → it continues the remark above; the real RAIM line moved up → still its own item | PASS |
| TC-161-302 | **QA F1 synthetic:** a gap ends a PCF reason, a TAF and the CDC attestation; normal spacing joins; a gap at a page break (below the last line, above the next page's first) does not split; threshold by shifting one item (1.5 pitches joins, 1.7 splits); text only or items that do not match the text → no blank line seen + WARN; a spaces-only line is not a blank line | PASS |
| TC-161-303 | **QA F1 on 26:** the joined remarks equal the printed lines in order (Remarks run, CDC block, ADHOC lines); every printed blank line in an unmarked block (131) ends a remark; no WARN; the one marked-block item across blank lines (L06 LEZG) listed | PASS |
| TC-161-304 | **QA F3 on 26:** every MEL/CDL note equals its printed lines, line breaks kept; multi-line notes L13 36-11-08C and L19 (2 lines each) | PASS |
| TC-161-201 | **D63a synthetic** (input built as the app delivers it: positioned items, a blank line = a gap): two remarks separated by a blank line stay two; a sub-heading always starts a new remark; a recognised item ends a remark; a one-line item takes no continuation; the boilerplate ends at `questions.`; a paragraph across a page break; CDC split by a blank line; marked blocks keep D63; every line kept | PASS |
| TC-161-090 | fixtures missing → FAIL, none skipped (child run) | PASS |
| *TC-161 in v0.3.0* | changed only where it assumed the briefing unread: OPTS passes the NOTAM ruleset; TC-161-001 accepts the entries added for briefing airports; TC-161-050 checks remarks weather never enters `weather` | 27/27 PASS |
| **TC-162-001** | **v0.2.0 byte-identical** (`test/rules/data/ofp-flightkeys-v0.2.0-baseline.json`, recorded with v0.2.0 SHA-256 `13cb8544…3df39` before any change): top-level key order; SHA-256 of 68 fields × 26; every v0.2.0 airport value (297) except `weather` / `notams` (were `''`); the v0.2.0 findings (201) in order; the v0.2.0 entries in their v0.2.0 order. One entry changes place: L15 PWAK (card order) | PASS |
| TC-162-002 | the reader thresholds hold on all 567 briefing pages; no briefing WARN on the 26 | PASS |
| TC-162-003 | documents by content on 26: HSCN, Company + NOTAM, Weather + Hazard, VA = field map §1.1 and grammar §A.2 page ranges | PASS |
| TC-162-004 | positions only: the text of every briefing page blanked (L02, L15, L22, T1) → `airportData` and the briefing sections unchanged | PASS |
| TC-162-005 | reader synthetic: furniture removed by shape (another flight number in the running header); column and page continuation; header rows split by a page; a non-furniture band row kept + WARN; no positions → WARN | PASS |
| TC-162-010 / 011 | airport blocks on 26 (counts = grammar §A.2 per package, blocks = an independent reading, roles §A.4 with the O-13 correction, windows, ALTN / dest2Altn never a NOTAM block, no IATA in L22 EPPW / L16 RJCJ) / synthetic (glued role, no IATA, glued `RWYS:`, runway line with a role, role-only line, same role twice; negative: no `APT` line) | PASS |
| TC-162-020 | **NOTAM items on 26:** 2,292 items, each once, under the right airport, with the right category, = the independent reading and grammar §A.2 per package; `_splitNotams(notams)` = `notamItems`; one item one ID; by source position the spans hold the item's lines and nothing else, no two items overlap; L15 PHNL 23 IDs printed twice, both kept | PASS |
| TC-162-021 | **D64 raw layout** on all 285 briefing airports: headings in printed order (635), every item once, whole, under its heading; empty-state text; nothing else | PASS |
| TC-162-022 | **5c QA F2:** no heading in any item; a heading left at the end of an item: 16 headings change nothing, `OBSTACLE` would hide items (O-12) | PASS |
| TC-162-023 | **evaluation check:** NOTAM v1.13.0 over each airport at each role window: 2,292/2,292 items with a readable window; every result is one unchanged item; per-package table (§8) | PASS |
| TC-162-024 | NOTAM synthetic: category, heading removed, line breaks kept, empty state, weather-only INFO, no Company / FIR item at an airport; no NOTAM ruleset → WARN, text unchanged | PASS |
| TC-162-030 | **weather on 26:** counts per airport = the independent reading; totals = grammar §A.9; reports as printed; METAR → ATIS → TAF; no hazard product; prefix never shown | PASS |
| TC-162-031 | **E-WINS (D66):** L15 PWAK, L20 CYXY, L22 EPPW and no other; `ewinsWindow` `''` (fails if a validity window comes back); `ewinsRole` = the airport's briefing roles (`EA`, `TA/IA`, `DEPARTURE/IA`; EPPW = the release origin); NavBlue on the same forecast still gives the NB-F6 / NB-F7 values; G-NB-6 / G-NB-7 logged open; SME-23; negatives | PASS |
| TC-162-032 | weather synthetic: indent + keyword, ATIS continuation starting `AD`, empty state, hazard, PRIO positive and negative | PASS |
| TC-162-040 / 041 | card order on 6 packages in full and the rule on 26 / an entry for every briefing airport (285; 101 ALTN) and no other | PASS |
| TC-162-050 | sections on 26 = field map §1.1 (with the O-16 correction); each anchor on its start page in text and items; page order | PASS |
| TC-162-033 | **weatherRaw (D65)** on all 285 airports: the block as printed (an independent reading), sub-headings TAF → METAR → ATIS, all 1,718 reports once, whole, in printed order, line breaks kept; `* PRIO *` removed from the 3 PRIO TAFs; no furniture, no Hazard text | PASS |
| TC-162-034 | **D66 in the app:** line 297 checked in `src/airports.html`; the app's `extractEtaWindow` (harness) reads the E-WINS forecast of the 3 airports in the airport's normal window in 384/384 evaluations (no window, each role window; ETA every 30 min); control: the NB-F6 window would select other TAF groups in 315 | PASS |
| TC-162-060 | **v0.3.0 at e96ed88 byte-identical** (`test/rules/data/ofp-flightkeys-v0.3.0-e96ed88-baseline.json`, recorded before D65 / D66): 1,820 field values, 2,283 airport values and the findings; changed only the 6 D66 values (`ewinsWindow`, `ewinsRole` at 3 airports); `weatherRaw` added as the last key | PASS |
| TC-162-090 | fixtures missing → FAIL, none skipped (child run) | PASS |
| **TC-163-001** | **v0.3.0 byte-identical** (`test/rules/data/ofp-flightkeys-v0.3.0-baseline.json`, recorded with the merged v0.3.0 before any change): top-level key order (the 4 new fields before `sections`); 1,727 field values; 2,574 airport values (`notams` compared without the heading lines); entries and card order; changed only as declared — `companyNotams` 26, `enrouteNotams` 26, `natTrack` 5, `sections` 10 (PACOTS); `curfew` / `opsNotes` added after `weatherRaw` | PASS |
| TC-163-001b | findings: the v0.3.0 findings in order once the v0.4.0 readers' findings are taken out and the 5 removed deferred INFOs put back; no WARN outside the known kinds | PASS |
| **TC-163-002** | **scope 0 (D67):** headings in `notams` = those of `notamsRaw`, in order (635); v1.14.0 cuts them out (items = `notamItems`, 2,292); at no window and each role window (724 evaluations) the same shown / hidden as v0.3.0's text, except exactly the 24 OBSTACLE-category items of the change list v1.2 | PASS |
| TC-163-010 / 011 | Company NOTAMs synthetic (fields, `GENERAL`, severity, origin, line breaks, Contact line kept in the text (O-46), the pair kept, no ruleset → WARN) / on 26: 298 = 26 + 272 = grammar §A.2 per package = the independent reading (texts); pinned values | PASS |
| **TC-163-020 / 021** | **curfews (SC, rule 6)** synthetic, positive and negative for every rule: O-33 (B744, B77L, B748 → their line only; B752 (not in the table) → all + note + WARN; registrations never; O-48: TC-163-130), O-34 (January / July → one season, no note; October / March → both + note; undated → all + note + WARN), O-35 (LCL dropped; NavBlue keeps it: NB-F8 / G-NB-8), O-36 (qualifiers kept, other lines dropped), O-37 (INTAM key → no curfew + INFO), no entry → none created, two items appended; the app's `parseCurfewWindows` reads exactly the UTC windows; notes carry no digits / on 26: 16 items in 10 packages, strings pinned, RJAA by type, T1 EHAM changeover, L23 ETAR undated, the 5 curfew-like items | PASS |
| TC-163-030 / 031 | FIR NOTAMs synthetic (categories, no heading in text, block name, empty block omitted + INFO, firRaw, O-40 FIR-keyed item, no block → INFO, PUBS- no location) / on 26: 221 blocks, 989 items (= grammar §A.2 and the independent reading), 43 empty, 4 with no heading (L15), 3 Company items; firRaw: every item once under its heading, no Company item; repeats as printed 24; O-49: TC-163-141 | PASS |
| TC-163-040a / b | hazards synthetic / on 26: 221 blocks (= the NOTAM Briefing's FIR list), 66 empty, 1,980 products; never in weather, weatherRaw or E-WINS | PASS |
| **TC-163-050 / 051** | **NAT** synthetic (direction first, then TMI; unreadable TMI; equal TMI; one direction → crew alert; incomplete; filed track from the route only — remarks / Company text never; no NAT parser) / on 26: 5 packages, 6 complete messages; L12 307 (308 kept); L08 / L22 alert; L11 `W` | PASS |
| TC-163-060a / b | PACOTS synthetic (wrapped headline, sets by validity end, `PACOTS` alone not) / on 26: 38 items, 13 sets, 10 packages; natTrack null | PASS |
| TC-163-070 / 070b | ops notes synthetic (O-38 repeat suppressed; one extra word → kept; no Remarks → kept; curfew item out; no entry created) / on 26: 66 airports, repeats L06 LEZG, L09 VHHH, L21 NZWN; L13 UAAA no entry | PASS |
| TC-163-090 | fixtures missing → FAIL, none skipped (child run) | PASS |
| **TC-163-100** | **build 1 byte-identical** (`test/rules/data/ofp-flightkeys-v0.4.0-build1-baseline.json`, recorded with the build-1 module SHA-256 `8b206c3a…6d7e`, PR head `9a76b58`): keys in order (`dispatchContact` added before `sections`); 1,896 field values; 2,656 airport values (all); the 298 Company records once the Contact line is taken out (their positions widened to the line in 17); FIR blocks = build 1 minus the copies the O-49 INFO lists (O-50: L03 only); 384 findings in order (the NAT filed-track INFO reworded, the O-46 / O-49 INFOs added). Changed only: `companyNotams` 22, `firNotams` / `enrouteNotams` L03 (O-50: T2 and L16 = build 1), `dispatchContact` 26 | PASS |
| **TC-163-110 / 111** | **O-46** synthetic: short → REQUIRED, long → IF QUESTIONS, both → REQUIRED, neither → null, one copy only → REQUIRED; the lines stay in the text; look-alike lines never a form; no ruleset → null / on 26: REQUIRED 22, IF QUESTIONS 4 (L20–L23), null 0; 44 short + 8 long lines, each once in the P0110-type pair; = expected/ | PASS |
| **TC-163-120 / 121** | **O-47** synthetic: page 1 route only, FPL route only, both, differ (FPL letter + crew alert); NEGATIVE remarks, Company and FIR NOTAM text naming a track; a page 1 route with no end line not read / on 26: per NAT package the filed track and its source(s) from an independent reading of both routes; L11 `W` from both; NOTAM text naming `NATX` never read | PASS |
| **TC-163-130 / 131** | **O-48 (SC, rule 6)** synthetic: the table; family names (all 767s, all 777s, all 747s); variant names (`B748`, `B747-400/F` ← B744 and BLCF); NEGATIVE variant mismatch (B744 vs `B748`, B763 vs `B762`, B748 vs `B747-400/F`, B77W vs `B77L`); `B77L` never a registration; unlisted types (B752, A332, MD11) → all + note + WARN / on 26: every OFP type in the table; no curfew string changed | PASS |
| **TC-163-140 / 141** | **O-49 / O-50** synthetic: repeat kept under the OFP FIR and left out under a non-OFP FIR; every copy left out when no FIR is on the OFP; same ID with other text kept (D43); twice in one block kept; firRaw unchanged; the INFO list; EET as a source; no OFP FIR read → all kept + WARN; Company item never a repeat / on 26: the rule applied independently (navigation-log FIR lines and EET from the text, items from firRaw) = the copies left out (O-50: the first FIR block counts as on the OFP): 24 repeats in 10 packages, 53 copies, 1 left out (L03 1; T2 4 and L16 1 kept under the departure FIR), 0 under every block; firRaw = build 1 | PASS |
| **TC-163-142** | **O-50** synthetic: positive — a repeat under the departure FIR with no navigation-log line is kept, also when printed only under the departure FIR and a non-OFP FIR; negative — a repeat under a non-OFP, non-departure FIR (second block, last block) is still left out, every copy out when none is on the OFP or the departure FIR; the INFO names the departure FIR; EET as the only source; only the departure FIR on the OFP; no OFP FIR read → all kept + WARN (O-52); firRaw unchanged; twice in one block kept | PASS |
| *TC-160 / 161 / 162 in v0.4.0* | changed only where they named the version, the extension list (18, 19 with `dispatchContact`), the deferred list (`fplEquipment` only) or v0.3.0's heading-free NOTAM text (read through a helper that drops the heading lines); TC-162-050 leaves out the PACOTS sections; TC-161-050 leaves out the 5d-2 WARNs | 69/69 PASS |

| **TC-164-001** | **v1.0.0 identity** (`test/rules/ofp-flightkeys-v100.test.js`): type, format, version 1.0.0, schema 2, contract 2.4; manifest entry, file and SHA-256; v0.4.0 no longer in `rules/`, frozen in `test/oracle/` (SHA-256 `c4ccb8c4…`); the NAT, NOTAM and NavBlue manifest entries unchanged; NEGATIVE a changed byte fails the manifest check | PASS |
| TC-164-002 | not built in (O-74; TC-160-004 still holds): `index.html`, `build/build.js`, `src/` do not name it; APP_VERSION, CACHE_NAME, `manifest.json` stay 1.9.9-hf6 (O-75) | PASS |
| TC-164-003 | `validateSchema()` valid; NEGATIVE broken objects (version `1.0`, missing export, contract, extension list, deferred field) rejected | PASS |
| **TC-164-010** | **O-68**: the call for the chosen message gets exactly `{ filed, findings }`; the letter is known at the call; the probe has no options; a spy finding is forwarded once, as given, after the D74 WARN and before the `natTrack` INFO; random route → `filed: null`; NEGATIVE no NAT pages → no call; the app's v1.1.0 (ignores options) still gives the letter and the marked track | PASS |
| **TC-164-011** | **D79 (SC, rule 6)** synthetic: letter absent from the message (FPL route, page 1 route, eastbound) → exactly one WARN `NAT-FILED-NOT-IN-MESSAGE` with the D79 text, nothing marked; NEGATIVE letter printed (A, B) → no WARN, that track marked, no NAT finding | PASS |
| TC-164-012 | **D81** synthetic: no letter → INFO `NAT-RANDOM-ROUTE`, nothing marked, no WARN; remarks naming a track change nothing; NEGATIVE a filed letter (printed or not), no NAT pages, no NAT parser → none | PASS |
| TC-164-013 | findings shape: own `{ level, field, message }`; forwarded `{ level, field, code, message }` with field `natTrack` and the code's level from the NAT ruleset's closed list; NEGATIVE malformed records are caught | PASS |
| TC-164-014 | **D74 kept**: routes differ → the crew-alert WARN once, the FPL letter marked; NEGATIVE routes agree → none; both D74 and D79 → D74 first | PASS |
| TC-164-015 | `notamRules` not supplied → the existing WARNs kept (O-18 is PR 2); NEGATIVE supplied → none | PASS |
| TC-164-016 | **O-80** text only → WARN `read from text only`, release data still read; NEGATIVE positions → none | PASS |
| TC-164-017 | **O-84** the deferred INFO is `not read: not in any brief yet (open item)`; NEGATIVE no finding names a version; v0.4.0 named it | PASS |
| **TC-164-020** | **all 26 vs v0.4.0** (the frozen copy): with the app's NAT v1.1.0 (the app today) only `natTrack` on L08, L11, L12, L22, L23; findings = v0.4.0's in order with the O-84 text (26) + one INFO `NAT-RANDOM-ROUTE` on L08, L12, L22, L23; with NAT v1.2.0 (3 arguments) `natTrack` equal on all 26, the same findings changes; every other field equal | PASS |
| TC-164-021 | pinned values on all 26 (fixtures `expected/ofp-flightkeys-v1.0.0/nat.json`): `natTrack` hash, filed letter and marked track, forwarded NAT findings; shape; 0 `NAT-FILED-NOT-IN-MESSAGE`; L11 `W` marked, no NAT finding | PASS |
| TC-164-090 | fixtures missing → FAIL, never skip | PASS |
| *TC-160 / 162 / 163 in v1.0.0 (O-84)* | TC-160-001 / 002 pin 1.0.0 and the v1.0.0 file; TC-160-005, TC-162-001, TC-163-001b and TC-163-100 compare the deferred INFO version-free | 97/97 PASS |

Expected values (`test/rules/data/ofp-flightkeys-expected-v0.2.0.json`) were taken from the release text by a separate, simpler extraction (one pattern per field) and checked against the field map v1.1 counts. They hold no crew data, and free text (MEL titles, Remarks, the permits block) only as SHA-256.

---

## 7. FK-P: the matched pair

FK `UAAA-EHAM 27OCT` prototype (this module) against EOFP `UAAA-EHAM 27OCT` matchedpair (the NavBlue parser), over the v0.2.0 core fields:

- **Equal:** `hasTemperatureControl`. **Crew:** the same four pilots, and every NavBlue key (`role, empNum, lastName, initial, displayName, active, isSen`) is equal person by person; the two plans print them in another order. **CAT II/III:** equal for all four airports both packages list (UAAA, EHAM, EBBR, LTAC). **DDG:** the same four codes and the same `tlr` values.
- **Different because the packages print different content** (EOFP release 11 vs an unreleased FlightKeys prototype; checked in both texts): `hasPerishables` (only the EOFP prints `PERISHABLES O/B - YES`); `catIiIiiApproaches` (other airports: EOFP EDDB/EDDP, its redispatch airports; FK EBLG/EDDK/ELLX); `ddgItems`/`melItems` (titles worded differently, other order; a repeated item would also differ, since NavBlue lists it once and FlightKeys keeps every copy by Exec decision); `overflightPerms` (different permit lists; the FK prototype has two permits MISSING); `oeiData` (no TLR in the FK prototype); `crewMembers` (order only).

On the 26 FlightKeys packages, `oeiData` equals NavBlue in 25 (the L10 difference is §5.8), and perishables/temperature equal NavBlue's whole-text rule in 19. The other 7 are the bare `PERISHABLES ONBOARD` line NavBlue misses (field map row 27).

---

## 8. Results on the 26 FlightKeys fixtures

Every row in scope is ✅ on every package that carries it, with the field-map counts:
- crew: pilots 2 in 4 packages, 3 in 12, 4 in 10; DH in 3; JS in 10; blank expiry in 9; `*` in 3.
- CAT: authorisations in 22, restrictions in 5. MEL: items in 25 (CDL in 3), an item printed twice in 9 (every copy kept), late addition only in L23. TLR cross-reference in 5.
- perishables 7, temperature 0. Permits: overflight 8, landing 5, takeoff 2. Security 1, tanker 1, PCF reason in 16 of 17.
- station blocks 5 (SME-18 flag only in L21; the 747 line not attached for its 767); airport remarks after D63: L01 1, L06 3, L09 1, L21 8 (NZWN 5, NFFN 3), L22 1; remarks weather 1 (L15 PWAK); CDC attestation 5.

The module raises no WARN on the 26 except two kinds, both intended: the L21 takeoff-alternate flag (SME-18) and the two T1 `PERMIT MISSING` permits.

Truth sheets: the 8 Exec sheets (drafts, not yet checked against the paper OFP) gave **3 differences** at first: L07 1, L08 1, L12 1; the other five 0. None was a misread of the PDF. The Exec decided all three on 17 Nov: L07 is kept as it is (the security line on the Preflight card only), and the L08 and L12 items are now kept twice, as the sheets and the PDF show. **0 open differences remain.** The private report is in the fixtures repo, `expected/ofp-flightkeys-v0.2.0/TRUTH-SHEETS-REPORT.md`.

---

### 8.1 v0.3.0 — the briefing against the grammar doc (per package)

| Pkg | NOTAM blocks (doc) | WX blocks (doc) | Airport NOTAM items (doc) | Briefing airports | Items shown at a role window (NOTAM v1.13.0) |
|---|---|---|---|---|---|
| L01 | 3 (3) | 7 (7) | 58 (58) | 7 | 56 |
| L02 | 7 (7) | 14 (14) | 171 (171) | 14 | 152 |
| L03 | 6 (6) | 10 (10) | 64 (64) | 10 | 63 |
| L04 | 3 (3) | 7 (7) | 45 (45) | 7 | 39 |
| L05 | 4 (4) | 9 (9) | 73 (73) | 9 | 71 |
| L06 | 3 (3) | 8 (8) | 26 (26) | 8 | 23 |
| L07 | 3 (3) | 7 (7) | 25 (25) | 7 | 17 |
| L08 | 5 (5) | 14 (14) | 51 (51) | 14 | 50 |
| L09 | 6 (6) | 9 (9) | 89 (89) | 9 | 87 |
| L10 | 4 (4) | 9 (9) | 55 (55) | 9 | 51 |
| L11 | 6 (6) | 14 (14) | 89 (89) | 14 | 83 |
| L12 | 5 (5) | 12 (12) | 103 (103) | 12 | 98 |
| L13 | 7 (7) | 13 (13) | 33 (33) | 13 | 33 |
| L14 | 11 (11) | 18 (18) | 187 (187) | 18 | 171 |
| L15 | 6 (6) | 13 (13) | 134 (134) | 13 | 102 |
| L16 | 3 (3) | 9 (9) | 67 (67) | 9 | 67 |
| L17 | 5 (5) | 11 (11) | 92 (92) | 11 | 73 |
| L18 | 6 (6) | 12 (12) | 184 (184) | 12 | 173 |
| L19 | 5 (5) | 12 (12) | 113 (113) | 12 | 111 |
| L20 | 9 (9) | 18 (18) | 182 (182) | 18 | 171 |
| L21 | 4 (4) | 8 (8) | 25 (25) | 8 | 21 |
| L22 | 6 (6) | 12 (12) | 45 (45) | 12 | 42 |
| L23 | 4 (4) | 11 (11) | 52 (52) | 11 | 48 |
| T1 | 4 (4) | 9 (9) | 102 (102) | 9 | 94 |
| T2 | 4 (4) | 8 (8) | 61 (61) | 8 | 56 |
| T3 | 8 (8) | 11 (11) | 166 (166) | 11 | 148 |
| **Total** | **137 (137)** | **285 (285)** | **2,292 (2,292)** | **285** | |

- **Readable windows:** every item has one (2,292/2,292). "Shown at a role window" counts the items NOTAM v1.13.0 keeps at at least one of the airport's role windows (midpoint, ORIG for `DEPARTURE`, aircraft profile of the release); the others are out of their window or schedule at every window, or filtered by the content rules.
- **Weather (§A.9):** TAF 282 (237 + 37 AMD + 5 COR + 3 PRIO), METAR 1,398 (1,312 + 83 SPECI + 3 COR) and ATIS 38 — equal to the doc. Empty states: ATIS 247, METAR 5, TAF 6 — equal.
- **Roles (§A.4):** equal to grammar v1.1 (TA 28, three-role blocks 9; O-13, corrected in the document). E-WINS: 3 airports (row 48), `ewinsWindow` `''`, `ewinsRole` the airport's roles (D66).
- **weatherRaw (D65):** 285 airports, every report once in printed order (TC-162-033).
- **Sections:** equal to the field map v1.2 §1.1 on 26 (L16 / L18 pages corrected in the document, O-16).
- **Findings:** no WARN from the briefing on the 26.

### 8.2 v0.4.0 — counts against the scoping pass (step 5d-2)

| Item | Scoping | v0.4.0 | Match |
| :--- | ---: | ---: | :---: |
| Company NOTAMs (HSCN + Company) | 298 (26 + 272) | 298 (26 + 272) | yes |
| CURFEW items / packages | 16 / 10 | 16 / 10 | yes |
| FIR blocks / items / empty | 221 / 989 / 43 | 221 / 989 / 43 | yes |
| FIR NOTAMs under more than one FIR block | 36 in 12 packages | 24 in 10 (same ID and text; 53 copies) | no — errata E-1 (§8.3) |
| ASHTAMs with no heading | 4 (L15) | 4 (L15) | yes |
| NAT packages / messages | 5 / 6 | 5 / 6 | yes |
| PACOTS items / sets / packages | 38 / 13 / 10 | 38 / 13 / 10 | yes |
| Hazard blocks / empty / products | 221 / 66 / 1,980 | 221 / 66 / 1,980 | yes |
| Distinct hazard products | 1,558 | 1,558 by product `ID:` line; 1,573 by product text | method — errata E-2 (§8.3) |

### 8.4 v1.0.0 — against v0.4.0 (step 5e-1 PR 1, TC-164-020)

| Item | Scoping (brief, O-85) | Build | Match |
| :--- | :--- | :--- | :---: |
| Packages compared | 26 | 26 | yes |
| `natTrack` changed (vs v0.4.0 + the app's NAT v1.1.0) | 5: L08, L11, L12, L22, L23 | 5: L08, L11, L12, L22, L23 | yes |
| `natTrack` changed (vs v0.4.0 + NAT v1.2.0, 3 arguments) | — | 0 | — |
| INFO `NAT-RANDOM-ROUTE` added | 4: L08, L12, L22, L23 | 4: L08, L12, L22, L23 | yes |
| WARN `NAT-FILED-NOT-IN-MESSAGE` | 0 | 0 | yes |
| Deferred INFO text (O-84) | 26 | 26 | yes |
| Any other field or finding | 0 | 0 | yes |

### 8.3 Grammar errata (O-49, Exec 19 Nov: the measured counts with their method)

For the grammar report `docs/RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md` (§A.8, §A.9) and the scoping pass. Measured on the 26 with module v0.4.0 (`test/rules/ofp-flightkeys-v040.test.js` TC-163-031, TC-163-040b, TC-163-141).

| # | Count | Method | Measured | Scoping |
| :--- | :--- | :--- | :--- | :--- |
| E-1a | FIR NOTAMs printed under more than one FIR block | the FIR blocks of the NOTAM Briefing (`firRaw`, items cut by the NOTAM ruleset); a repeat = the same NOTAM ID **and** the same item text in ≥ 2 blocks | **24 NOTAMs in 10 packages** (T1 1, T2 4, L03 1, L06 3, L13 7, L14 1, L16 1, L17 1, L18 1, L22 4); **53 printed copies** | 36 in 12 packages (method not stated; not reproduced by any of E-1a … E-1d) |
| E-1b | the same, by location(s) + ID | key = the header location(s) + ID | 24 in 10 (= E-1a) | |
| E-1c | the same, by ID only | key = the ID | 25 in 10: + L17 A3413/26, two different NOTAMs (other location, dates and text) with one ID — not a repeat (D43) | |
| E-1d | any ID printed more than once in the FIR blocks | key = the ID, one block counts | 28 in 11: E-1c + 3 NOTAMs printed twice in one block (T1 2 under LHCC, L12 1 under EGTT) | |
| E-1e | copies left out by O-49 / O-50 | E-1a, FIR neither on the OFP nor the departure FIR (§5.21) | **1** in 1 package (L03 1); 0 NOTAMs left out under every block. (O-49 alone: 6 in 3 packages, T2 4, L03 1, L16 1; the departure FIR, O-50, keeps T2 4 and L16 1) | — |
| E-2a | distinct hazard products | per package, a product = from a §A.9 product head (`TWC FPG - `, `TWC SIGMET - `, `AIRMET `, `SIGMET `, `CONVECTIVE SIGMET `) to the next head or block end, distinct by its `ID:` line | **1,558** (= the scoping figure: this is its method) | 1,558 |
| E-2b | the same, distinct by the whole product text | as E-2a, distinct by text | 1,573: 15 `TWC FPG` products are printed under two FIR blocks with one `ID:` and a different text (a line more or less at the block end) | — |
| E-2c | hazard products as printed | every product head | 1,980 (`TWC FPG` 1,307, `AIRMET …` 638, `TWC SIGMET` 30, `SIGMET` 3, `CONVECTIVE SIGMET` 2) | 1,980 |

`hazards[]` is not changed by these counts: it stays as printed, repeats not merged (O-45).

---

## 9. Known limitations / open items

| Item | Note |
| :--- | :--- |
| Integration | v1.0.0 is not built in (O-74): the switch PR (5e-1 PR 2) builds it in with NOTAM v1.14.0 and the NAT ruleset v1.2.0, passes `options.notamRules` (O-18) and shows the findings (O-76). `notams` carries the type headings for NOTAM v1.14.0: it must not be given to NOTAM v1.13.0 (O-12). Without `notamRules` the module keeps its WARN (TC-164-015). |
| O-68 NAT findings to the crew | **Module side done in v1.0.0:** `{ filed, findings }` passed, NAT findings in `findings[]` (§5.23). The crew display is PR 2 (O-76). |
| O-80 pasted text | **As built:** without `input.pages` the release is read from the text with the WARN `positioned items (input.pages) not supplied; read from text only`; the briefing is not read (TC-164-016). No module change. |
| O-84 version in a finding | **Closed (Exec, 20 Nov):** the deferred INFO is version-free (§1). |
| O-85 package label | **Closed (Exec, 20 Nov):** the brief's "L10" means L08; the declared `natTrack` changes are L08, L11, L12, L22, L23. |
| O-46 Dispatch contact | **Closed (Exec, 19 Nov):** both lines stay in the P0110 text; `dispatchContact` REQUIRED / IF QUESTIONS (§5.18). |
| O-47 filed NAT track | **Closed (Exec, 19 Nov):** read from the OFP page 1 route and the ICAO FPL route (§5.23). The NAT ruleset revision (FlightKeys track lines) is a separate package. |
| O-48 curfew types | **Closed (Exec, 19 Nov):** family / variant matching, table with B762/B763/B764, B744, BLCF, B748, B772/B773/B77L/B77W/B77F (§5.19). |
| O-49 FIR repeats, scoping counts | **Closed (Exec, 19 Nov):** repeats only under FIRs on the OFP (§5.21); counts and methods as grammar errata (§8.3). |
| O-50 departure FIR | **Closed (Exec, 20 Nov):** the departure FIR (the first FIR block of the NOTAM Briefing) always counts as on the OFP, with or without a navigation-log line (§5.21). On the 26: T2 keeps 4 copies (ZPKM), L16 1 (ZHWH); L03's 1 removed copy is not under its departure FIR and stays removed. |
| O-51 routes disagree | **Closed (Exec, 20 Nov): as built** — the FPL letter marked + a crew-alert WARN (§5.23; not seen on the 26). |
| O-52 no OFP FIR read | **Closed (Exec, 20 Nov): as built** — nothing is left out + WARN (§5.21; not seen on the 26). The departure FIR does not change this: it adds no FIR to "read". |
| **O-12** trailing type heading (5c QA F2) | A type heading left at the end of an item changes nothing for 16 headings; `OBSTACLE` would hide the item in NOTAM v1.13.0 (994 items, 1,710 evaluations). **Exec, 18 Nov:** no parser change here; the Exec's rule (D67) goes into NOTAM v1.14.0 (step 5c-2). The parser keeps removing the type heading from the item text and keeps it as the category; headings never go into `notams`. |
| **O-13** grammar §A.4 roles | **Closed (Exec, 18 Nov):** grammar corrected to v1.1 (`docs/RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md`): T2 ZUCK's role on its wrapped runway line, TA 28, 9 three-role blocks, no block with the same role twice. |
| **O-14** E-WINS window | **Closed (Exec D66, 18 Nov):** `ewinsWindow` `''`; the app uses the airport's normal window (line 297). NavBlue's fault logged as NB-F6 / G-NB-6. |
| **O-15** `ewinsRole` | **Closed (Exec D66, 18 Nov):** the airport's own role codes in printed order (§5.16); L22 EPPW `DEPARTURE/IA`. NavBlue's fault logged as NB-F7 / G-NB-7. |
| **O-16** field map §1.1 | **Closed (Exec, 18 Nov):** field map corrected to v1.2 (`docs/SPRINT-OFP-FlightKeysMigration-UPD-20261118-v1.2-FieldMap.md`): L16 TLR PDF 36–38, L18 47–50. |
| **O-17** repeated IDs | **Closed (Exec, 18 Nov):** field map v1.2 row 44 and grammar v1.1 §A.5 carry the measured counts per package (T1 38, T2 40, L15 24, L13 7, L22 4, L06 3, six packages 1, thirteen 0); L15 PHNL 23 IDs printed twice, both kept. |
| **O-18** NOTAM ruleset as an option | **Exec, 18 Nov: for step 5e** (integration): the app passes `options.notamRules`. Nothing to do here. |
| **O-19** weather order | **Closed (Exec D65, 18 Nov):** `weather` stays METAR → ATIS → TAF (the app's reader); `weatherRaw` gives the FlightKeys order TAF → METAR → ATIS for RAW. |
| **O-20** sections list | **Exec, 18 Nov: for step 6** (bookmarks): names and order at the Exec's visual check (ADR-005 §2.6.5). Nothing to do here. |
| Contract 2.2 vs NavBlue 2.0 | `operatingPilots` and the crew-record extensions (addendum 2), like `swa` / `specialQualification` (addendum 1), are not returned by the locked NavBlue parser (D47). **Exec, 17 Nov: ignore NavBlue.** The contract 2.2 fields are FlightKeys only, and NavBlue stays locked as it is. |
| Security line | **Exec, 17 Nov: keep it on the Preflight card only.** L07's `POS LAUNCH TO DWC …` goes to `securityMessages[]` (D45), never to an airport card (TC-161-050). |
| Repeated MEL items | **Exec, 17 Nov: possible, not an anomaly; keep all items** (§5.7). |
| Names as printed | FlightKeys prints mixed case; NavBlue prints capitals. No case is changed (**Exec, 17 Nov: OK**). |
| Company NOTAM repeats of a station restriction | **Done in v0.4.0 (O-38):** a Company item whose content words are all in the airport's OFP Remarks is not in `opsNotes` (§5.20). |
| NavBlue-style E-WINS remark (`WSITAF` / TWC, D56) | unseen in FlightKeys; not read in the Remarks. The FlightKeys E-WINS is the `* PRIO *` TAF (§5.16, v0.3.0). |
| `fplEquipment` (D41) | not in the v0.2.0 brief: `null` with an INFO (step `open`). **Exec, 17 Nov: a later issue.** |
| Truth sheets | drafts (the "Exec checked" column is empty). **Exec, 17 Nov: OK** as the comparison basis for now. |
| Wrapped remarks (QA F1) | **Exec D63, 17 Nov:** one remark per item in a marked block (§5.12). Applied. |
| `ofpRemarks` outside a marked block (O-9) | **Exec D63a, 17 Nov:** paragraph grouping (§5.12). Applied. **O-10 confirmed (Exec, 17 Nov):** fixed-length items never take a continuation; a page break is not a blank line (TC-161-202, 203). |
| D63a blank line (QA re-review F1, 18 Nov) | Read from the positioned items (§5.12). Without matching items no blank line is seen: the remarks join as before and a WARN names the page(s). |
| Blank line inside a marked block (O-11) | **Exec, 18 Nov: D63 stands as written.** Only the marker starts a new remark; a blank line inside a marked item stays part of it, line breaks kept. L06 LEZG `DEPARTURES` = one remark (correct). §5.12, TC-161-103. |
| Blank TO/LNDG expiry | **Exec, 17 Nov: stays an INFO** (QA F4; §5.5). |
| Quoted remark text | **Exec, 17 Nov:** non-crew remark text may be quoted in the public SPEC and tests after `tools/redact` (QA F2). Every quoted remark was run through `tools/redact`: no change needed. |
| SALT/TALT, temperature control positive | unseen (D55); rules in place, synthetic tests only. |
| v0.1.0 open items | unchanged: `porWpt` `+nnNM` form (SME-11), `navLog` `[]` (FK-P), date fallback. |

---

## 10. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-11-17 | NEW (development, D58) | First version: contract 2.1 shape; release rows 1–23, 29–31, 33, 34, 36, 39–41; extensions `designator`, `swa`, `airportData[].specialQualification`; deferred fields explicit empties + INFO. |
| **0.2.0** | 2026-11-17 | UPD (development, D58) | Release and remarks pages: rows 24–28, 32, 32a, 35; extensions `revision`, `ofpRemarks`, `airportData[].remarks` / `remarksWeather`, `catIiIiiRestrictions`, `securityMessages`, `extraFuel`, `pcf`, `permits`, `operatingPilots` (D62), crew-record `firstName` / `toLndgExpiry`; SME-18 flag; FPL from the release (QA F4); SPEC wording for curfew/opsNotes (QA F3). Contract 2.2. v0.1.0 fields byte-identical. QA F1 → **D63**: one remark per item in a marked block (§5.12; airport remarks and `ofpRemarks`; 4 remarks changed in L06, L09, L21). O-9 → **D63a**: paragraph grouping in unmarked blocks (46 remarks in 24 packages; reason lists keep their line breaks). QA re-review F1 (18 Nov): the D63a blank line is read from the positioned items (a same-page gap ≥ 1.6 × the release median pitch; never across a page break), no output change on the 26; F3: MEL/CDL notes keep their printed line breaks (L13, L19). O-11 (Exec, 18 Nov): D63 confirmed for blank lines inside a marked item (one remark; TC-161-103); module unchanged. |
| **0.3.0** | 2026-11-18 | UPD (development, D58 amended) | Step 5d, D64: the briefing reader from the positioned items only (§5.13); airport blocks with every role window (`briefing`, SME-1); airport NOTAMs — items cut by the NOTAM ruleset under each printed type heading, `notams` in the v1.13.0 form, `notamItems[]` (ID, category, source positions), `notamsRaw` (the printed layout); weather in NavBlue's form; E-WINS from the `* PRIO *` TAF as NavBlue sets it; an entry for every briefing airport in card order; `sections[]`. Contract 2.3 (addendum 3). New option `notamRules`. v0.2.0 output byte-identical (TC-162-001; one entry moves, L15 PWAK). Exec answers (18 Nov): **D65** `weatherRaw` (the Weather Briefing block as printed; `weather` unchanged); **D66** `ewinsWindow` `''`, `ewinsRole` = the airport's role (NavBlue faults NB-F6 / NB-F7 logged, not copied); field map v1.2 and grammar v1.1 corrected (O-13, O-16, O-17); every other value byte-identical to e96ed88 (TC-162-060). |
| **0.4.0** | 2026-11-19 | UPD (development, D58) | Step 5d-2, Exec answers O-33 … O-45: `notams` keeps the type headings for NOTAM v1.14.0 (D67); `companyNotams[]` (298); curfews (CURFEW key, closed type table, season effectivity, UTC only; NB-F8 logged); `opsNotes` (O-38 repeats out); FIR NOTAMs — `enrouteNotams.fir`, `firNotams[]`, `firRaw[]` (D64); `hazards[]`; NAT — `natMessages[]`, `natTrack` through the NAT parser (direction first, then TMI; crew alert); PACOTS sections. Contract 2.4 (addendum 4). Everything else byte-identical to v0.3.0 (TC-163-001). |
| **0.4.0** (amended) | 2026-11-20 | UPD (development, D58) | Exec answers O-46 … O-49 (19 Nov) and O-50 … O-52 (20 Nov), same development version: Dispatch contact lines kept in the P0110 text + `dispatchContact` (O-46; addendum 4, 19 extensions); filed NAT track from the OFP page 1 route and the ICAO FPL route (O-47); curfew family / variant table (O-48); FIR repeats kept only under FIRs on the OFP and the departure FIR (the first FIR block, always on the OFP), the other copies left out with an INFO (O-49, O-50; O-51 and O-52 as built); grammar errata E-1, E-2 (§8.3). Everything else byte-identical to build 1 (TC-163-100). |
| **1.0.0** | 2026-11-20 | UPD (release version, D58; not built in, O-74) | Step 5e-1 PR 1, Exec answers O-74 … O-85: the filed NAT letter is worked out before the NAT call; the NAT ruleset is called with `{ filed, findings }` and its findings forwarded into `findings[]` with their code (O-68, module side; D79, D81); the deferred INFO is version-free (O-84). Everything else byte-identical to v0.4.0 on all 26 (TC-164-020). |
