# SPEC-OFP-FlightKeys

**Version:** v0.2.0 (development version, D58) | **Status:** UPD | **Date:** 2026-11-17
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/ofp-flightkeys/ofp-flightkeys-v0.2.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1 (module catalogue: "FlightKeys OFP parser"), §2.2 (module standard), §2.4 (output contract, FK-P)
**Field reference:** `docs/SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md` (rows, SME answers); `docs/ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md` (contract 2.1: `specialQualification`, `swa`); `docs/ADR-005-AppendixB-Addendum2-NEW-20261117-v1.0.md` (contract 2.2: `operatingPilots`, crew-record extensions)
**Ledger:** `RPT-OFP-FlightKeys-RevisionLedger-UPD-20261117-v1.1.md` (beside this file)
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
| `TO/LNDG Expiry: [YYYY-MM-DD]` (under its pilot) | `toLndgExpiry` = the date when it is a real date; blank → **`"Not Reported"`** (SME-9) + one INFO with the count; not a date → `"Not Reported"` + WARN; no expiry line → `"Not Reported"` + WARN |
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

### 5.11 OFP Remarks and what they feed (Appendix B; D34, D39, D45, D46; SME-7, SME-17, SME-18, SME-18a, SME-21, SME-23)

- **`ofpRemarks[]`:** every line from the dispatcher line to `MEL/CDL`, in order, as `{ text, category, airport, subHeading, page, line }`. Then the MEL-block ADHOC penalty lines (`adhocPenalty`) and the CDC attestation (`cdcAttestation`) follow, in release order. A line that starts no category continues the remark above it when that remark can run over several lines (fuel reasons, route notes, weather, MEL changes, station blocks, the exemption, the fleet note, the boilerplate up to its `questions.` line). Single-line categories never take a continuation.

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

- **Station restrictions → `airportData[icao].remarks[]`** (D34): each item line of the block, `{ text, heading, subHeading, fleet, page, line }`. A block has no end marker; it runs until a RAIM, CAT, exemption, fleet-note or E-WINS line, or the next station heading. Sub-headings are `ARRIVALS`, `DEPARTURES`, a line ending in `:` such as `Restrictions, Limitations and Conditions`, and the fleet sub-headings `NNN Operations …`. A fleet sub-heading with words after it (`747 Operations Prohibited`) is itself a remark. **Fleet rule (SME-18a, as SME-12):** a line under a fleet sub-heading, or under a heading that names a fleet (`VHHH B747 DEPARTURES:`), is attached only when the OFP aircraft type is that fleet (`B744/B748/BLCF` → 747, `B763` → 767, `B77L` → 777). Lines for other fleets are not attached, and one INFO is raised; they stay in `ofpRemarks`. If the type has no known fleet, everything is attached + WARN. An airport the release does not list is not attached (INFO).
- **Takeoff alternate (SME-18):** when an applicable restriction of the **departure** airport says `Takeoff alternate required` and the release lists no `TALT` (`altData` role `TKOF ALT`), a **WARN** finding is raised (field `altData`). The app must flag it to the crew.
- **`airportData[icao].remarksWeather[]`** (D34, D46, SME-23): a `TAF|METAR|SPECI [AMD|COR] IIII …` report in the Remarks, with its continuation lines, gives `{ source, type, text, page, line }` on that airport. `source` is the heading line right above it (e.g. `GOV TAF UPDATED`), else `'OFP Remarks'`. It is **never merged** into `airportData[icao].weather`; under D46 the E-WINS (`* PRIO *`) briefing TAF stays controlling (read in 5d). An airport that is in the release but not on page 1 (L15 PWAK, a CFS alternate) gets an airport entry of the same shape (INFO). A weather remark naming no airport (T3, a WSI area product) is not attached (INFO). The NavBlue-style E-WINS remark (`WSITAF` / TWC, D56) is unseen in FlightKeys and not read (§9).
- **`securityMessages[]`** (D45): `{ text, page, line }` for each security remark (L07 `POS LAUNCH TO DWC APPROVED BY SECURITY`), for the Preflight card.
- **`Released under EWINS Authority`** (L22): kept in `ofpRemarks` (`ewins`); it names no airport and no forecast and sets nothing (SME-17/21; INFO).
- **`extraFuel`** (D39): `{ fuel, minutes, unit, type, tanker, reasons[] }` from the `EXTRA` row (first column, NavBlue number form) and the `extraFuel` remarks. `tanker` is `true` only when a reason says the extra is tanker fuel for this flight (`ECON TANKER FUEL`, `TANKER FUEL`, `TANKERING`, and not `NO TANKER`). `type` is `'TANKER'`, `'PRE-FUELED'`, `'CAPTAIN'` or `''`. A Company NOTAM `IIII-TANKER` is station information and is never used.
- **`pcf`** (SME-7): `{ fuel, minutes, unit, reasons[] }` from the `PCF` row and the `pcf` remarks (PCF, CF, `ADDITIONAL FUEL …`). A non-zero PCF with no reason, or a reason with PCF 0, gives an INFO.
- **`revision`:** `{ kind: 'RLS'|'REV'|'NOT RELEASED', number (as printed, e.g. '01'), time ('03NOV26 15:39'), revision ('1.0' / '-.-'), validUntil ('0055Z 04NOV26'), tlr ('TLR-1'), copies, copiesIdentical }`. If the release number, `Revision: n.0` and `TLR-n` disagree → WARN.

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
- station blocks 5 (SME-18 flag only in L21; the 747 line not attached for its 767); remarks weather 1 (L15 PWAK); CDC attestation 5.

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
| SALT/TALT, temperature control positive | unseen (D55); rules in place, synthetic tests only. |
| v0.1.0 open items | unchanged: `porWpt` `+nnNM` form (SME-11), `navLog` `[]` (FK-P), date fallback. |

---

## 10. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-11-17 | NEW (development, D58) | First version: contract 2.1 shape; release rows 1–23, 29–31, 33, 34, 36, 39–41; extensions `designator`, `swa`, `airportData[].specialQualification`; deferred fields explicit empties + INFO. |
| **0.2.0** | 2026-11-17 | UPD (development, D58) | Release and remarks pages: rows 24–28, 32, 32a, 35; extensions `revision`, `ofpRemarks`, `airportData[].remarks` / `remarksWeather`, `catIiIiiRestrictions`, `securityMessages`, `extraFuel`, `pcf`, `permits`, `operatingPilots` (D62), crew-record `firstName` / `toLndgExpiry`; SME-18 flag; FPL from the release (QA F4); SPEC wording for curfew/opsNotes (QA F3). Contract 2.2. v0.1.0 fields byte-identical. |
