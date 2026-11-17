# SPEC-OFP-FlightKeys

**Version:** v0.1.0 (development version, D58) | **Status:** NEW | **Date:** 2026-11-17
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/ofp-flightkeys/ofp-flightkeys-v0.1.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1 (module catalogue: "FlightKeys OFP parser"), §2.2 (module standard), §2.4 (output contract, FK-P)
**Field reference:** `docs/SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1-FieldMap.md` (rows, SME answers); `docs/ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md` (two new extension fields)
**Ledger:** `RPT-OFP-FlightKeys-RevisionLedger-NEW-20261117-v1.0.md` (beside this file)
**Supersedes:** nothing. The ADR-004 FlightKeys profile (`src/import/atlas-fk.js`) is retired only after this parser is gated and integrated (ADR-005 §2.7).

---

## 1. What this module is

The FlightKeys OFP parser reads an Atlas Air / Polar Air Cargo package in the FlightKeys format and returns the **briefing contract** — the same 57 core fields, with the same names, types and meanings, as the locked NavBlue parser (FK-P), plus the Appendix B extensions and `findings[]`.

**v0.1.0 is a development version (D58).** It is not built into `index.html`, not used by the app and not written to the master folder. It reads the **release**: OFP page 1 and the route. Everything else is returned as an explicit empty value with one INFO finding naming the step that reads it. **It must not be integrated:** an explicit empty (e.g. `hasPerishables: false`, `crewMembers: []`) is not a value.

| Scope v0.1.0 (field map v1.1 rows) | Read |
| :--- | :--- |
| 1–4 identity and header | flight ID, designator, aircraft type, wake, weight unit, date |
| 5–8a airports and times | ORIG, DEST, PALT, SALT, RAPT, RALT, TALT; Q token |
| 9–19 fuel | block, min, reserve, taxi, trip, ALT1, REMF, POR MINF, ballast, ZFW INC, ADDL FF ADJ |
| 20–23 weights | ZFW, TOGW, LDGW actual/limit; VZFW/CK alert; SWA |
| 29–31 Remarks items | DOT/Polar exemption, slot / wheels-up, verbal callsign |
| 33, 34 nav log | TOC; feeds ETOPS, ETP and POR (`navLog` stays `[]`, §5.4) |
| 36 alternate routes | title, route, MORA |
| 39–41 ETOPS, POR, ETP/CFS | entry, exit, spec; POR; ETP points; CFS alternates |

| Not read in v0.1.0 | Step | Explicit empty |
| :--- | :--- | :--- |
| `crewMembers` (26), `hasPerishables` (27), `hasTemperatureControl` (28), `catIiIiiApproaches` (24), `ddgItems`/`melItems` (25), `overflightPerms` (35), `oeiData` (32) | 5b-2 | `[]`, `false`, `false`, `null`, `[]`/`''`, `''`, `[]` |
| `enrouteNotams` (49), `natTrack` (42), `airportData[icao].weather/notams/curfew/opsNotes` (43–48) | 5d | `{route:'',fir:'',airway:'',waypoint:'',geographic:''}`, `null`, `''` |
| Extensions `revision`, `ofpRemarks`, `fplEquipment`, `catIiIiiRestrictions`, `securityMessages`, `extraFuel`, `pcf`, `permits`, `airportData[icao].remarks/remarksWeather` | 5b-2 | `null` / `[]` |
| Extensions `companyNotams`, `sections` | 5d | `[]` |

The list is exported as `DEFERRED_FIELDS`; each entry gives exactly one INFO finding, `not read in v0.1.0: read in <step>`.

---

## 2. Module standard (ADR-005 §2.2)

| Item | v0.1.0 |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. |
| Dual context | Node / rules-loader: `module.exports = API`. Browser (plain script): the global **`OfpFlightKeys`** (the name the Exec's live-plan harness expects). All declarations inside one factory. |
| Metadata | `RULESET_TYPE 'ofp'`, `OFP_FORMAT 'flightkeys'`, `RULESET_VERSION '0.1.0'`, `SCHEMA_VERSION 2`, `CONTRACT_VERSION '2.1'`, `RULESET_SOURCE`. |
| `validateSchema()` | Yes, §3.3. |
| No app state, no DOM, no UI | Never reads `window`, `document`, storage, the network, the clock (`Date`) or any app global. The shared modules come in through `options` only. TC-160-003 runs it with all of these set to throw. |
| Strict mode | On. |
| Times | UTC. OFP times are Z; no time-zone suffix is converted. |

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
  EXTENSION_FIELDS,      // 13: contract v2.0 list + swa (before sections)
  AIRPORT_EXTENSION_FIELDS, // ['remarks', 'remarksWeather', 'specialQualification']
  DDG_EXTENSION_FIELDS,  // ['type', 'notes']
  DEFERRED_FIELDS,       // field → '5b-2' | '5d' (§1)
};
```

### 3.2 `parseFlightKeys(input, options)`

**input** — `{ text, pages: [{ page, width, height, items: [{ str, x, y, w, h, font, order }] }] }`, exactly what the app's extractor produces (`tools/extract`; the fixtures' `text/` and `items/` files).

| API | Extractor (`items/<id>.items.json`) |
| :--- | :--- |
| `text` | `text/<id>.raw.txt` unchanged (pdf.js 3.11.174, the app's line assembly; one blank line per page break) |
| `pages[i].page` | `pages[i].n` (1-based PDF page) |
| `pages[i].width`, `.height` | as stored |
| `items[j].str, x, y, w, h, font` | as stored (`y` measured from the top of the page) |
| `items[j].order` | `j` — the item's index in its page's `items` array (pdf.js source order) |

`inputFromExtractor(rawText, itemsDoc)` performs exactly this mapping. Text page *k* (the lines before the *k*-th blank line) is PDF page *k*; an image-only page is an empty text page. `pages` missing → WARN `input`, text only; a page count different from the text → WARN.

**options** — `{ icaoFpl, aircraftProfile, parseNatTrack }`, all optional, passed in:

| Option | Used for | Not passed |
| :--- | :--- | :--- |
| `icaoFpl` (`rules/icao-fpl`) | FPL flight ID (cross-check / fallback), aircraft type, wake → `isHeavy`, DOF | WARN; `acftType ''`, `isHeavy false`, date from the OFP header only |
| `aircraftProfile` (`rules/aircraft-profile`) | INFO when the designator is not in the CS-1 index or the type not in the aircraft table | INFO |
| `parseNatTrack` | not called in v0.1.0 (row 42 is read in 5d); INFO when passed | — |

**Returns** `null` when `input.text` is not a non-empty string; otherwise the contract object: the 57 core fields in `CORE_FIELDS` order, then the 13 extensions in `EXTENSION_FIELDS` order. A fresh object every call; no state between calls.

### 3.3 `validateSchema(ruleset?)`

Every §3.1 export present with its type; `RULESET_TYPE 'ofp'`; `OFP_FORMAT 'flightkeys'`; semver; `SCHEMA_VERSION` integer ≥ 2; `CONTRACT_VERSION` 2.x; source non-empty; every `PATTERNS` entry a RegExp; field lists 57 / 13 / 3 / 2, unique, no field both core and extension, `findings` last; every `DEFERRED_FIELDS` key a contract field with step `5b-2` or `5d`; none of `deriveCallsign`, `parseOFP`, `fuelK`, `parseNavBlue`, `_ofpRulesetParse`, `parseIcaoFpl` exported.

---

## 4. Where it reads

1. **The release** is found by content: pages whose first line is the running header `CCC####/DDMON/ORIG-DEST/REG`, second line `OPERATIONAL FLIGHT PLAN …` (`RLS nn`, `REV nn` or `-- NOT RELEASED --`) and last line `FUFI: <uuid> PAGE n/N`. A copy runs from `PAGE 1/N` to `N/N`. Only the **first copy** is read; further copies are compared line by line (identical → INFO, different → WARN). Header, title and footer lines are removed, so page breaks do not cut items.
2. **OFP page 1** (the first copy's page 1) for rows 1–23 and the POR line.
3. **The Remarks block** (`Remarks` … `Flight Release Authorization`) for rows 29–31.
4. **The nav log** (first `AWY WPT MTK` header to the alternate routes), the **alternate routes** and the **Critical Fuel Scenario** for rows 33–41.
5. **The FPL** through `icao-fpl`.

Nothing is read from the High Severity Company NOTAMs, Company NOTAMs, NOTAM / Weather / Hazard briefings, NAT pages or TLR in v0.1.0. Text of the same form printed there is never taken (negative tests in TC-160-014, -016, -018).

---

## 5. Field rules

### 5.1 Identity and header (rows 1–4)

| Field | Rule |
| :--- | :--- |
| `fltNum` | OFP page-1 identity line `CCC####/DD ORIG - DEST DD MON YY REG` → `CCC####/DD` as printed (NavBlue form). Missing → the FPL flight ID (no day) + WARN. Release and FPL differ → release + WARN. **Never** the briefing running header (SME-16: L22 prints `GTI8225` there; the flight is `CMB550`). |
| `designator` (ext.) | The letters of `fltNum` (SME-5: the callsign follows the Flight ID only; the Polar desk does not change it). |
| `acftType`, `isHeavy` | `icaoFpl.aircraftType`; `isHeavy` = wake `H` or `J` (NavBlue rule). |
| `weightUnit` | Type line `MODEL / ENGINE / KG\|LB / IFR …` → `KGS` / `LBS`. Unreadable → `KGS` (NavBlue default) + WARN. |
| `flightDateISO`, `dateStr` (D57) | **Only** (1) the FPL `DOF/` read by `icao-fpl` (a real calendar date), else (2) the OFP header date on the identity line, checked as a real date (`20YY`). Never free text, never the release print time (`RLS nn DDMONYY HH:MM`, a day early in L11). DOF and header both valid but different → DOF + WARN. DOF filed but impossible → WARN, header used if valid. Neither valid → `''` + WARN (D57 handles it in the app). `dateStr` = `DD MON YY`. |

### 5.2 Airports and times (rows 5–8a; SME-1, SME-2; D55)

- Airport line: `KW IIII/[AAA] NAME [Q] LATLON HHMMZ`. The 3-letter code may be absent (`IIII/ NAME`, L22) — this is the correct rule, not the NavBlue template (NB-F1), and it applies to every keyword. An airport without the code → INFO. A time that is not a clock time → `''` + WARN.
- `origIcao`/`offFromOFP` from ORIG, `destIcao`/`etaDest` from DEST; `destEtaOffsetMins` as NavBlue (over midnight).
- Alternates: roles by the NavBlue rule unchanged (PALT/SALT `DEST ALT`, RAPT/RALT `EN ROUTE ALT`, TALT `TKOF ALT`; D55 for SALT/TALT, unseen). **Order = the order of the OFP page-1 lines** (SME-1), not the NavBlue table order (which puts RALT before RAPT). Offsets as NavBlue, including its fallback when a line has no time. The FPL item 18 `RALT/` (ICAO en-route alternates) is not an alternate here.
- `specialQualification` (addendum, SME-2): `true` when the `Q` token stands before the lat/long. With positioned items, the `Q` item must sit on the line's y just left of the lat/long item; if positions and text disagree, positions win + WARN (a truncated name ending in a one-letter word `Q` cannot be told from the token in text alone).
- `airportData`: one entry per page-1 airport `{ weather: '', notams: '', remarks: [], remarksWeather: [], specialQualification }` (weather/notams in 5d).

### 5.3 Fuel and weights (rows 9–23; SME-6, SME-7, SME-8)

- Fuel table, first column (`ORIG-DEST`): `BLOCK`, `MINF`, `FRES`, `TAXI` (fuel and minutes), `TRIP` (minutes), `ALT1`, `REMF`; values in the NavBlue form (string, leading zeros dropped). A missing row → `''`/`null` + WARN.
- `porMinf`: second `MINF` column `(POR)-DEST` (redispatch packages).
- `ballastFuel`: `BALST` first column (number) — FlightKeys spells it `BALST`, NavBlue `BALLAST`.
- `addlFfAdj`: `*ADDL FF ADJ ±n.nn *` as printed (SME-6; the type-line `FF +n.n` is unrelated).
- `zfwIncrFactor`: `ZFW INC/1000 X nnn MINF ADJ` (FlightKeys `INC`; NavBlue `INCR` accepted too).
- `zfwActual/Limit`, `togwActual/Limit`, `ldgwActual/Limit`: `ROW actual [......] Llimit`; `0` + WARN when missing (NavBlue value).
- `hasVzfwCkLimit`: `MTOW LTD BY VZFW/CK LIMITS` inline on the TOGW row without asterisks (FlightKeys) or on its own line with asterisks (NavBlue form).
- `swa` (addendum, SME-8): `SWA (nnnnnn)` → `{ value: <number>, unit: weightUnit }`; `null` when not printed.

### 5.4 Remarks items, nav log and route (rows 29–41)

- `dotExemption` (SC): `… EXEMPTION NO nnnnnX.` with `ALTERNATE AIRPORT REQUIRED` on the same or the next line (wraps in L08) → `{ number: 'Exemption nnnnnX', restrictions: "ALT REQ'D", altRequired: true }`; without it → `altRequired: false` + WARN. NavBlue DOT-SP form kept unchanged (unseen in FlightKeys).
- `slotTime` (SC): the NavBlue chain and value forms unchanged (window, not before, before, earliest, bare, curfew).
- `parsedVerbalCallsign`: the NavBlue `VERBAL CALLSIGN - NAME` remark (none in the 26).
- Nav log: three lines per fix — `AWY WPT …`, `[^MORA] Nnn nn.n …`, `Ennn nn.n … TOT-T …`. TOT-T is `HH.MM` (hours and minutes, not decimal). **`navLog` is returned as `[]`**: that is what the NavBlue parser returns on every NavBlue package (field map row 33, SPEC-OFP-NavBlue §10), and a filled list would change the en-route screen (`src/render-enroute.html` shows elapsed times when it is not empty). The rows feed:
  - `tocOffsetMins`: the first `<AWY> TOC` row.
  - `etopsEntry` (SC): type line `ETOPS Entry HH.MM` → `"HH:MM"` and minutes; differs from the nav-log `(E.ENT)` row → page 1 + WARN; only the nav log has it → nav log + WARN.
  - `etopsExit` (SC): `ETOPS Exit` on the type line if ever printed, else the nav-log `(E.EXT)` row (as NavBlue). `etopsSpec`: `Critical Fuel Scenario ETOPS nn/nnn`.
  - `porWpt`, `porOffsetMins`: OFP page 1 `POR: <WPT>[+nnNM] HH.MM`; a plain fix → its name (NavBlue meaning); a fix plus distance → **`(<WPT>+nnNM) <lat> <lon>`** with the lat/long of the nav-log `(POR) AT …` row (SME-11: show the point and its lat/long, copyable). Page 1 and the nav log differ → page 1 + WARN; the lat/long is never taken from another point.
- `etpPoints` (SC): `(GOIIII) ETPn IIII-IIII <lat> <lon>` → `{ name, lat, lon, elapsedMins }`; `elapsedMins` from the nav-log `(GOIIII) ETPn` row by the NavBlue rule (first row, > 0, < 24 h; else the key is absent + WARN).
- CFS alternates (SC): the ETP airports (return, continue; NavBlue order), then the airports of `E.ENT` and `E.EXIT`-only scenarios (SME-13: alternates for consideration — L09, L11, L23). Each `{ icao, role: 'CFS ALT', ofpEta, ofpOffsetMins: null, currentEta, wxWindow, etpName }` as NavBlue; `wxWindow` from that airport's row in its scenario table, `HH:MM-HH:MM` read as `HHMMZ-HHMMZ` (FlightKeys prints no `Z`); `currentEta` = the window midpoint (NavBlue `wxWindowMidpoint`); `etpName` `ETPn`, `E.ENT` or `E.EXIT`. Airports already in `altData` are skipped (NavBlue).
- `altRoutes`: `Destination Primary Alternate Route`, `Initial Airport Route`, `Initial Alternate Route`; `route` = the route lines (wraps joined, spaces collapsed), without the `IIII/nnnn` and `GCD … TIME …` lines; `mora` from `MORA nnnn` or `''` (no MORA line in T1, L07).

---

## 6. Tests (`test/rules/ofp-flightkeys.test.js`, run by `npm test`)

| ID | What | Result (2026-11-17) |
| :--- | :--- | :--- |
| TC-160-001 | metadata; `validateSchema()`; 15 kinds of broken object rejected | PASS |
| TC-160-002 | manifest entry, version, file, SHA-256 | PASS |
| TC-160-003 | dual context; trapped `window`/`document`/storage/`Date`/app globals untouched; no FPL value without icao-fpl; NAT parser not called | PASS |
| TC-160-004 | not in `index.html`, `build/build.js`, `src/` | PASS |
| TC-160-005 | contract shape on 26 fixtures; every deferred field empty with exactly one INFO | PASS |
| TC-160-006 | input mapping and checks; null for empty text; no state between calls | PASS |
| TC-160-010 | rows 1–8a, SME-1/2/5/16 on 26 fixtures; field-map counts (LB 6, Q 8, RAPT/RALT 10, designators 23/1/1/1) | PASS |
| TC-160-011 | date: DOF / header only / neither → `''` + WARN / impossible → `''` + WARN / leap day; free-text dates never used | PASS |
| TC-160-012 | airport line without a 3-letter code on every keyword; NavBlue misses it; negatives | PASS |
| TC-160-013 | Q token: text, positions, disagreement → positions + WARN | PASS |
| TC-160-014 | fuel and weights synthetic: positive, redispatch columns, NavBlue VZFW form, negative (nothing printed; values outside page 1) | PASS |
| TC-160-015 | rows 9–23 + SWA on 26 fixtures; counts ballast 4, FF ADJ 10, VZFW 9, POR MINF 10, SWA 4 | PASS |
| TC-160-016 | rows 29–31 synthetic: one-line and wrapped exemption, DOT-SP, every slot form; text outside the Remarks never read | PASS |
| TC-160-017 | rows 29–31 on 26 fixtures: exemption 6 (L08 `altRequired` now right), slot 1, callsign 0 | PASS |
| TC-160-018 | route synthetic: fix split by a page break; TOC; ETOPS cross-checks; POR plain and `+nnNM`; ETP; CFS incl. 2EO E.ENT/E.EXIT; alternate routes; non-ETOPS negative; CFS outside the release never read | PASS |
| TC-160-019 | rows 33, 34, 36, 39–41 on 26 fixtures; counts ETOPS 7, POR 10 (3 `+nnNM`), ETP 7, CFS 10 | PASS |
| TC-160-020 | the field map's ✅ rows: module value = NavBlue value on all 26 (26 fields) | PASS |
| TC-160-040 | **FK-P matched pair** (§7) | PASS |
| TC-160-030 / 031 | fixture set complete (26, each with expected values); fixtures missing → FAIL, none skipped (child run) | PASS |

Expected values (`test/rules/data/ofp-flightkeys-expected-v0.1.0.json`) were taken from the release text by a separate, simpler extraction (one pattern per field) and checked against the field map v1.1 counts; they hold no crew data; alternate-route strings are stored as SHA-256 and word count only.

---

## 7. FK-P: the matched pair

FK `UAAA-EHAM 27OCT` prototype (this module) against EOFP `UAAA-EHAM 27OCT` matchedpair (the NavBlue parser), over the core fields this version reads.

- **Equal (25):** `fltNum`, `acftType`, `weightUnit`, `isHeavy`, `dateStr`, `flightDateISO`, `origIcao`, `destIcao`, `offFromOFP`, `taxiMins`, the five ETOPS fields (none), `ballastFuel`, `zfwActual`, `ldgwLimit`, `dotExemption`, `slotTime`, `addlFfAdj`, `etpPoints`, `navLog`, `parsedVerbalCallsign`, `taxiFuelRaw`.
- **Different, because the packages print different content (16)** — the EOFP is release 11, the FlightKeys package an unreleased prototype of the same flight, i.e. a different plan: `etaDest` (1710Z vs 1706Z), `destEtaOffsetMins`, `tripMinutes`, `tocOffsetMins` (different SID), `alt1Fuel`, `destRemf`, `blockFuelRaw`, `minfFuelRaw`, `fresFuelRaw`, `togwActual`, `togwLimit`, `zfwLimit`, `ldgwActual`, `zfwIncrFactor` (244 vs 191), `hasVzfwCkLimit` (printed in the FK plan only), `altRoutes`.
- **The known plan difference — redispatch (4 fields):** the EOFP is a redispatch plan (`RAPT EDDP`, `RALT EDDB`, `DP(POR): KENIN`, second MINF column, Initial Airport / Alternate routes); the FlightKeys plan is not. So `altData` (EOFP: EBBR + EDDB + EDDP; FK: EBBR, same airport and role, time 4 min apart), `porWpt`, `porOffsetMins`, `porMinf` differ. Listed in the test, not hidden.

On the 26 FlightKeys packages, wherever the field map says today's NavBlue parser already reads FlightKeys right, the module gives the NavBlue value exactly (TC-160-020).

---

## 8. Results on the 26 FlightKeys fixtures

Every row in scope ✅ on every package that carries it; no WARN from the module on any package. Changes against today's NavBlue parser on FlightKeys text (field map v1.1): L22 origin read (rows 5–6); ballast 4/4, `ZFW INC` 26/26, `ADDL FF ADJ` 10/10, VZFW/CK 9/9 (rows 16, 18, 19, 23); L08 `altRequired` (row 29); ETOPS entry 7/7 (row 39); CFS windows read, L14's CFS airports and the E.ENT/E.EXIT-only airports of L09, L11, L23 (row 41); alternate routes 26/26 (row 36); POR `+nnNM` with lat/long (row 40); `navLog` no longer a false point from the weather text (row 33).

---

## 9. Known limitations / open items

| Item | Note |
| :--- | :--- |
| Explicit empties | v0.1.0 must not be integrated (§1). |
| Contract 2.1 vs NavBlue 2.0 | The two addendum fields (`swa`, `specialQualification`) are not returned by the locked NavBlue parser. ADR-005 §2.4 says every parser returns every extension; NavBlue is locked (D47). Exec decision needed. |
| `porWpt` with `+nnNM` | Holds the point and its lat/long in one string `(<WPT>+nnNM) <lat> <lon>` (SME-11); the app shows `porWpt` as text and copies it. No new field. Plain-fix PORs keep the NavBlue meaning. |
| Alternates order | OFP page-1 order (SME-1): RAPT before RALT, where NavBlue lists RALT first. |
| `navLog` `[]` | By FK-P (row 33). A real nav log is a contract question for the Exec. |
| DOT-SP restrictions | NavBlue rule unchanged: one continuation line joined unless it starts with `-` or `*`. Unseen in FlightKeys. |
| SALT/TALT, ETOPS Exit on the type line | Unseen in the 26 (D55); rules in place, synthetic tests only. |
| Date fallback | The OFP header date is the identity-line date, not the release print date (which is the dispatch time, a day early in L11). |
| Takeoff alternate flag (SME-18) | Needs the station restriction blocks (5b-2). |

---

## 10. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| **0.1.0** | 2026-11-17 | NEW (development, D58) | First version: contract 2.1 shape; release rows 1–23, 29–31, 33, 34, 36, 39–41; extensions `designator`, `swa`, `airportData[].specialQualification`; deferred fields explicit empties + INFO. |
