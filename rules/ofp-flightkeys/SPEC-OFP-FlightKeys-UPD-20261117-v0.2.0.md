# SPEC-OFP-FlightKeys

**Version:** v0.2.0 (development version, D58) | **Status:** UPD | **Date:** 2026-11-17
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/ofp-flightkeys/ofp-flightkeys-v0.2.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1 (module catalogue: "FlightKeys OFP parser"), §2.2 (module standard), §2.4 (output contract, FK-P)
**Field reference:** `docs/SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md` (rows, SME answers); `docs/ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md` (contract 2.1: `specialQualification`, `swa`); `docs/ADR-005-AppendixB-Addendum2-NEW-20261117-v1.0.md` (contract 2.2: `operatingPilots`, crew-record extensions)
**Ledger:** `RPT-OFP-FlightKeys-RevisionLedger-UPD-20261117-v1.2.md` (beside this file)
**Supersedes:** SPEC v0.1.0 (same folder; history in §10 and the ledger). The ADR-004 FlightKeys profile (`src/import/atlas-fk.js`) is retired only after this parser is gated and integrated (ADR-005 §2.7).

---

## 1. What this module is

The FlightKeys OFP parser reads an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns the **briefing contract**. The contract is the same 57 core fields as the locked NavBlue parser, with the same names, types and meanings (FK-P), plus the Appendix B extensions and `findings[]`.

**v0.2.0 is a development version (D58).** It is not built into `index.html`, not used by the app and not written to the master folder. It reads the whole **release**: everything v0.1.0 read (OFP page 1 and the route), unchanged, plus the release and remarks pages. The briefing package (step 5d) is returned as an explicit empty value with one INFO finding. **It must not be integrated:** an explicit empty (e.g. `airportData[icao].notams: ''`) is not a value.

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

| Not read in v0.2.0 | Step | Explicit empty |
| :--- | :--- | :--- |
| `enrouteNotams` (49), `natTrack` (42), `airportData[icao].weather` / `notams` (43–45, 48) | 5d | `{route:'',fir:'',airway:'',waypoint:'',geographic:''}`, `null`, `''` |
| `airportData[icao].curfew` / `opsNotes` (46, 47) | 5d | **no key** (as NavBlue when nothing is printed; QA F3 — the v0.1.0 SPEC wrongly said `''`) |
| Extensions `companyNotams`, `sections` | 5d | `[]` |
| Extension `fplEquipment` (D41) | open — no brief yet | `null` |

The list is exported as `DEFERRED_FIELDS` (step `5d` or `open`). Each entry gives exactly one INFO finding, `not read in v0.2.0: read in 5d` or `not read in v0.2.0: not in any brief yet (open item)`.

---

## 2. Module standard (ADR-005 §2.2)

As v0.1.0: one standalone file, no `require`; dual context (`module.exports`, browser global **`OfpFlightKeys`**); metadata `RULESET_TYPE 'ofp'`, `OFP_FORMAT 'flightkeys'`, `RULESET_VERSION '0.2.0'`, `SCHEMA_VERSION 2`, `CONTRACT_VERSION '2.2'`, `RULESET_SOURCE`; `validateSchema()`; no app state, DOM, UI, storage, network or clock; strict mode; all times UTC.

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
  EXTENSION_FIELDS,      // 14: contract v2.0 list + swa + operatingPilots (before sections)
  AIRPORT_EXTENSION_FIELDS, // ['remarks', 'remarksWeather', 'specialQualification']
  DDG_EXTENSION_FIELDS,  // ['type', 'notes']
  CREW_EXTENSION_FIELDS, // ['firstName', 'toLndgExpiry']            (new in v0.2.0)
  DEFERRED_FIELDS,       // field → '5d' | 'open' (§1)
};
```

### 3.2 `parseFlightKeys(input, options)`

Input, options and the null rule as v0.1.0 (`{ text, pages }` from the extractor; `{ icaoFpl, aircraftProfile, parseNatTrack }`). **Change (QA F4):** `icaoFpl.parseIcaoFpl()` is given the body lines of the first release copy, not the whole package. An FPL quoted anywhere else is never read. No release means no FPL, plus a WARN. On the 26 fixtures the result is unchanged (TC-161-001), because the first `(FPL-` block was already inside the release in every package.

### 3.3 `validateSchema(ruleset?)`

As v0.1.0, with the lists 57 / 14 / 3 / 2 / 2 (`CREW_EXTENSION_FIELDS` added) and the `DEFERRED_FIELDS` steps `5d` or `open`.

---

## 4. Where it reads

1. **The release** by content (v0.1.0 §4.1); only the first copy; further copies compared. Each body line keeps its provenance: the PDF page and its 1-based line on that page's text.
2. **OFP page 1:** rows 1–23, the POR, and now `revision` (title line, `Revision: n.n`, `Release Valid Until`), `extraFuel` and `pcf` (fuel rows `EXTRA`, `PCF`).
3. **The Remarks block:** `Remarks` to `MEL/CDL` for the remarks, CAT II/III, perishables, temperature, security, weather, station restrictions and late MEL additions. `MEL/CDL` to `Flight Release Authorization` for the DDG items. The **CDC attestation** follows the authorisation text and runs to `Signed by PIC`. Rows 29–31 are still read from `Remarks` to `Flight Release Authorization` (v0.1.0).
4. **The crew list:** `Fit for Duty Affirmation` to `TIME FUEL`.
5. **The permits block:** `Overflight/Landing Permits` to the nav-log header.
6. **The TLR** (first copy): pages headed `REL n/n DDMONYY HHMMZ CCC#### ORIG/DEST …` with the footer `FUFI<uuid> PAGE n/N`, pages 1..N. The page header, the footer and the repeated `TAKEOFF AND LANDING REPORT … PAGE n` + `TLR-n SEQ-…` lines are removed before reading.
7. **The FPL** through `icao-fpl`, release lines only.

Nothing is read from the High Severity Company NOTAMs, Company NOTAMs, NOTAM / Weather / Hazard briefings, NAT or Jeppesen pages. Text of the same form printed there is never taken (negative tests in TC-161-011, -021, -051).

---

## 5. Field rules

§5.1–5.4 of v0.1.0 are unchanged. Every v0.1.0 field is byte-identical on the 26 fixtures (TC-161-001).

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
- Notes: every `- …` or `RMK - …` line under the item, in order. Its wrapped lines join the note. `notes[i] = { text (as printed, with its "- " / "RMK - "), indent }`. **Indentation comes from the positioned items** (the text has none): a note printed further right than its item line is indent 1. If the positions put a note at the item's x, positions win (`indent 0`) and a WARN is raised. With no positions, notes are indent 1.
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
- The station block still ends where §5.11 says (RAIM, CAT, exemption, fleet-note, E-WINS line, next station heading).
- **ADHOC penalty block** (MEL/CDL block): `Dispatcher applied ADHOC penalty:` is a record of its own; each `- ` line starts a record; an unmarked line continues the item above it.
- **Not changed by D63:** MEL/CDL titles and notes are joined as before (§5.7); they are an item list, not a remark list.

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
- **Blank line:** a line with no printed text inside a page. **A page break is not a blank line** (**Exec, 17 Nov, O-10 (2): confirmed**, the same as D63). The release pages are read without their running header, title and footer (§4), so a remark continues across a page break and keeps the page and line of its first line. Test: TC-161-203.
- **Sub-heading:** `ARRIVALS`, `DEPARTURES`, or a line ending in `:` that starts no category. It is a record of its own (category `other`, `subHeading` = its text), and the next line opens a new remark under it. The section ends at the next recognised item or blank line.
- A remark that starts after a blank line or a sub-heading, with no start form, is category `other`. It is never counted as a fuel reason.
- **The same grouping feeds every list built from these remarks**, so none is reflowed any more: `pcf.reasons`, `extraFuel.reasons`, `securityMessages`, `airportData[icao].remarksWeather[].text` and the note of a late-addition MEL (SME-19) keep the printed line breaks (`"\n"`) where they used a space.

**Which rule applies, per block**

| Block | Marks its items? | Rule | Remark starts at |
|---|---|---|---|
| Station restriction blocks (L01, L06, L09, L21, L22) | yes (dash, number, sub-heading) | **D63** | the block's own marker, or the line after a sub-heading |
| ADHOC penalty block (MEL/CDL block; L02, T1, T3) | yes (dash) | **D63** | a `- ` line |
| General Remarks run (dispatcher line to `MEL/CDL`, outside station blocks) | no | **D63a** | a recognised item, a blank line, a sub-heading, or the end of a fixed-form item |
| CDC attestation (after the release authorization; L01, L09, L12, L16, L22) | no | **D63a** | the `*** CDC ATTESTATION` heading, a blank line or a sub-heading |
| MEL/CDL items and their notes | (item list, §5.7) | unchanged | `MEL`/`CDL` line; notes at `- ` / `RMK - ` |

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

## 6. Tests (run by `npm test`)

| ID | What | Result (2026-11-17) |
| :--- | :--- | :--- |
| TC-160-001 … 040 | the v0.1.0 battery (`test/rules/ofp-flightkeys.test.js`), scoped to the v0.1.0 fields; version / contract / deferred-list asserts updated | 20/20 PASS |
| TC-161-001 | **v0.1.0 fields byte-identical**: SHA-256 per field vs the recorded v0.1.0 output (`test/rules/data/ofp-flightkeys-v0.1.0-baseline.json`) on 26 fixtures; v0.1.0 findings kept in order; one airport entry added (L15 PWAK) | PASS |
| TC-161-002 | QA F4: the FPL from the release only | PASS |
| TC-161-010 / 011 | crew on 26 (values against the **private** `expected/ofp-flightkeys-v0.2.0/crew.json` in the fixtures repo; public: roles, counts, flags, operating pilots per package) / synthetic positive and negative | PASS |
| TC-161-020 / 021 | CAT II/III on 26 / synthetic (restriction never an authorisation; US restriction only; authorised airport with a restriction; MEL restrictions; outside the release never read) | PASS |
| TC-161-030 / 031 | MEL/CDL/DDG on 26 / synthetic (wraps, notes, indentation from positions, ADHOC, repeated items kept, late additions positive and negative, TLR codes below RMKS) | PASS |
| TC-161-032 / 032a | TLR on 26 (= NavBlue except L10) / synthetic page break | PASS |
| TC-161-040 | **FK-P matched pair** (§7) | PASS |
| TC-161-050 / 051 | remarks and everything they feed, on 26 / synthetic with a negative per rule | PASS |
| TC-161-100 | **D63 on 26:** L21 NFFN circling + minima = one remark, L06 LEZG, L09 VHHH (positive); L21 NZWN five numbered items stay five, NFFN items 1 and 2 stay apart (negative); airport remarks and `ofpRemarks` records per package; joins only in station blocks | PASS |
| TC-161-101 | **D63 synthetic:** unmarked line joins; two adjacent marked items stay two; another marker kind continues; a sub-heading always starts a new item (flow and fleet); a remark across a page break joins, and one that ends at the page end stays apart from the marked item opening the next page; SME-18 on a wrapped item; the SME-18a INFO counts lines | PASS |
| TC-161-102 | **D63 on the ADHOC block:** a wrap joins its dash item | PASS |
| TC-161-200 | **D63a on 26:** the 2-line exemption (6 packages), the 3-line fleet note (4), the CDC attestation (5), the boilerplate (23), L12 MEL change, L15 TAF = ONE remark each; records per package; two adjacent recognised items stay two (L13 PCF, L20 cargo); a one-line item never joined; reasons keep their line breaks | PASS |
| TC-161-202 | **O-10 (1):** every one-line recognised item kind (dispatcher, RAIM, CAT, cargo, perishables, security, ADC, E-WINS) stays one line and the next unmarked line is a new remark; the boilerplate ends at `questions.`; T3 test lines a remark of their own; control: PCF does take its continuation | PASS |
| TC-161-203 | **O-10 (2):** a remark continues across a page break (exemption, PCF reason) and keeps its first page; the same lines split by a blank line are two remarks | PASS |
| TC-161-201 | **D63a synthetic:** two remarks separated by a blank line stay two; a sub-heading always starts a new remark; a recognised item ends a remark; a one-line item takes no continuation; the boilerplate ends at `questions.`; a paragraph across a page break; CDC split by a blank line; marked blocks keep D63; every line kept | PASS |
| TC-161-090 | fixtures missing → FAIL, none skipped (child run) | PASS |

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

## 9. Known limitations / open items

| Item | Note |
| :--- | :--- |
| Explicit empties | v0.2.0 must not be integrated (§1). |
| Contract 2.2 vs NavBlue 2.0 | `operatingPilots` and the crew-record extensions (addendum 2), like `swa` / `specialQualification` (addendum 1), are not returned by the locked NavBlue parser (D47). **Exec, 17 Nov: ignore NavBlue.** The contract 2.2 fields are FlightKeys only, and NavBlue stays locked as it is. |
| Security line | **Exec, 17 Nov: keep it on the Preflight card only.** L07's `POS LAUNCH TO DWC …` goes to `securityMessages[]` (D45), never to an airport card (TC-161-050). |
| Repeated MEL items | **Exec, 17 Nov: possible, not an anomaly; keep all items** (§5.7). |
| Names as printed | FlightKeys prints mixed case; NavBlue prints capitals. No case is changed (**Exec, 17 Nov: OK**). |
| Company NOTAM repeats of a station restriction | "not noted twice" (SME-18) needs the Company NOTAMs: step 5d. |
| NavBlue-style E-WINS remark (`WSITAF` / TWC, D56) | unseen in FlightKeys; not read in the Remarks. The FlightKeys E-WINS is the `* PRIO *` TAF (5d). |
| `fplEquipment` (D41) | not in the v0.2.0 brief: `null` with an INFO (step `open`). **Exec, 17 Nov: a later issue.** |
| Truth sheets | drafts (the "Exec checked" column is empty). **Exec, 17 Nov: OK** as the comparison basis for now. |
| Wrapped remarks (QA F1) | **Exec D63, 17 Nov:** one remark per item in a marked block (§5.12). Applied. |
| `ofpRemarks` outside a marked block (O-9) | **Exec D63a, 17 Nov:** paragraph grouping (§5.12). Applied. **O-10 confirmed (Exec, 17 Nov):** fixed-length items never take a continuation; a page break is not a blank line (TC-161-202, 203). |
| Blank TO/LNDG expiry | **Exec, 17 Nov: stays an INFO** (QA F4; §5.5). |
| Quoted remark text | **Exec, 17 Nov:** non-crew remark text may be quoted in the public SPEC and tests after `tools/redact` (QA F2). Every quoted remark was run through `tools/redact`: no change needed. |
| SALT/TALT, temperature control positive | unseen (D55); rules in place, synthetic tests only. |
| v0.1.0 open items | unchanged: `porWpt` `+nnNM` form (SME-11), `navLog` `[]` (FK-P), date fallback. |

---

## 10. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-11-17 | NEW (development, D58) | First version: contract 2.1 shape; release rows 1–23, 29–31, 33, 34, 36, 39–41; extensions `designator`, `swa`, `airportData[].specialQualification`; deferred fields explicit empties + INFO. |
| **0.2.0** | 2026-11-17 | UPD (development, D58) | Release and remarks pages: rows 24–28, 32, 32a, 35; extensions `revision`, `ofpRemarks`, `airportData[].remarks` / `remarksWeather`, `catIiIiiRestrictions`, `securityMessages`, `extraFuel`, `pcf`, `permits`, `operatingPilots` (D62), crew-record `firstName` / `toLndgExpiry`; SME-18 flag; FPL from the release (QA F4); SPEC wording for curfew/opsNotes (QA F3). Contract 2.2. v0.1.0 fields byte-identical. QA F1 → **D63**: one remark per item in a marked block (§5.12; airport remarks and `ofpRemarks`; 4 remarks changed in L06, L09, L21). O-9 → **D63a**: paragraph grouping in unmarked blocks (46 remarks in 24 packages; reason lists keep their line breaks). |
