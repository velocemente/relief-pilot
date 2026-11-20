# SPEC-NAT-Ruleset

**Version:** v1.2.0 | **Status:** NEW (built into the app at step 5e-1, D77) | **Date:** 2026-11-20
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/nat-rules/nat-rules-v1.2.0.js` (manifest key `nat-rules`, SHA-256 in `rules/manifest.json`; `rules/nat-rules-next/`, key `nat-rules-next` until step 5e-1, O-79)
**Architecture:** ADR-005 §2.1, §2.2; Appendix B addendum 4 (`natTrack`, `natMessages[]`)
**Ledger:** `RPT-NAT-RevisionLedger-NEW-20261120-v1.0.md` (beside this file)
**Supersedes:** v1.1.0 (`src/nat.html`, built into `index.html`) at step 5e. The Drive master "nat-rules" (v1.0.0, in the Exec's folder "00_General Rulesets") is replaced at 5e; nothing is published to Drive now (O-63).

---

## 1. What this module is

The NAT track parser for both OFP formats. It returns the `natTrack` object the app already uses (NavBlue shape), or `null` when the flight is not an Atlantic crossing (NAM ↔ EUR by ICAO prefix, O-66; ELLX-KHSV stays `null`).

| Input | Source | Behaviour |
| :--- | :--- | :--- |
| NavBlue / eOFP | the whole OFP text (`parseNatTrack(t, orig, dest)`) | **v1.1.0, verbatim** (`src/nat.html` lines 59–184), with one edit: O-65 (§3). The filed track is still read from the CO ROUTE line, as in v1.1.0 (D47: the NavBlue output may not change otherwise). |
| FlightKeys | one NAT track message (`natMessages[].text`, chosen by `ofp-flightkeys`: the flight's direction first, then the higher TMI, D74) | `_parseMessage()` (§2). |

The renderer (`renderNatTrack`) is not in this module; the existing Track Message card stays (display at 5e, O-67).

## 2. FlightKeys message (O-57 … O-67)

Call: `parseNatTrack(text, origIcao, destIcao, options)`; `options.filed` (one letter A–Z) and `options.findings` (an array) are optional. A text with a line starting `(NAT-n/N TRACKS` is a FlightKeys message; anything else is NavBlue / eOFP text and `options` is ignored.

| Item | Rule |
| :--- | :--- |
| Track | a line `<letter> <route>` followed by `EAST LVLS …` and `WEST LVLS …`; a wrapped route line (up to 2) is joined. `TRACK x` lines of the PBCS list are in the remarks and never a track. |
| Waypoints (O-62) | fix (3–5 letters) as printed; `48/50` → `48N050W`; `5630/20` → `5630N02000W`. A token that is neither is kept as printed + WARN. |
| Levels (O-65) | the printed levels of the track's direction; every 10 → `FL340–400`, with a gap → `FL360 380 400`. |
| Direction | the side whose levels are not `NIL`; neither or both → the track is not read + WARN. A direction with no track has no block; the flight's direction block is first. |
| `valid` (O-62) | `NOV 04/0100Z TO NOV 04/0800Z` → `11/04-0100–11/04-0800` (UTC, as NavBlue). **Never checked against any time, never a WARN (O-60).** Unreadable → `''` + INFO. |
| `tmi` | `TMI IS nnn` in the message, else `null`. |
| `mach`, `rawFallback` | `''`, `''`. The PBCS list and `NAR` / `EUR RTS` lines are not fields. |
| Remarks (D54) | everything after `REMARKS`, line breaks kept, the closing `-` removed; `eastComments` / `westComments` by the message's direction, the other `''`. |
| Filed track (O-57, O-58) | **only** `options.filed`, passed in by `ofp-flightkeys` (OFP page 1 route + ICAO FPL route; they differ → the FPL letter + the module's crew WARN, D74). The parser never reads a route, remarks, Company or FIR NOTAM text, `NATO`, `NATS`. |
| Letter printed in the message | `assignedId` = the letter; that track `assigned: true`. |
| Letter not printed (O-59) | the message as selected, `assignedId` = the letter, no track marked, WARN `FILED NAT <x> NOT IN TRACK MESSAGE TMI <nnn> (<EAST/WEST>) – CHECK OCEANIC CLEARANCE`. No fallback, no other-direction search. |
| No letter (O-61) | the chosen message, `assignedId` `null`, no track marked, INFO. No coordinate matching. |
| No raw fallback | every message returns a track object or a named finding. |

## 3. NavBlue output change (O-65)

The only permitted change: on a gapped level list the track's `fl` is the list as posted (`FL350 360 370 390`), not the range of its first and last level (`FL350–390`). A list with every level (`340 350 … 400`) is still `FL340–400`; a printed range (`FL340/400`) is unchanged. Everything else is byte-identical (TC-173-010).

## 4. Findings

Each is `{ level, field: 'natTrack', code, message }`, pushed to `options.findings` when given.

| Code | Level | When |
| :--- | :--- | :--- |
| `NAT-FILED-NOT-IN-MESSAGE` | WARN | O-59 |
| `NAT-NO-TRACKS` | WARN | the message has no readable track |
| `NAT-TRACK-UNREADABLE` | WARN | no levels line, fewer than two waypoints, direction not readable |
| `NAT-WAYPOINT-UNREAD` | WARN | a token that is not a fix or a coordinate (kept as printed) |
| `NAT-TRACK-DUPLICATE` | WARN | a letter twice in one message |
| `NAT-MULTI-MESSAGE` | WARN | the input holds more than one message; the first is read |
| `NAT-RANDOM-ROUTE` | INFO | O-61 |
| `NAT-FILED-IGNORED` | INFO | `options.filed` is not one letter |
| `NAT-VALIDITY-UNREADABLE` | INFO | the validity line is not read |
| `NAT-REMARKS-DIRECTION` | INFO | the message's direction is not readable; remarks under the flight's direction |

## 5. Results (TC-173, `test/rules/nat-rules.test.js`)

On the 26 FlightKeys packages: 5 packages with NAT pages, 6 messages, **42 tracks**, **36** short coordinates (`9999/99` form) converted; L11 `W` filed; L12 TMI 307 returned; L08 / L22 one direction; random routes L08, L12, L22, L23; PBCS list lines in 3 of 6 messages never tracks; no validity WARN. On the 30 NavBlue / eOFP fixtures: 126 Atlantic tracks printed (31 gapped lists), 113 in the output (ELLX-KHSV, 13 tracks, stays `null`), **26 changed `fl` lines**, nothing else changed. `ofp-flightkeys` v0.4.0 (file unchanged) with v1.2.0 injected: 21 of 26 packages byte-identical, the 5 NAT packages differ in `natTrack` only.

## 6. Integration (step 5e-1)

Built into `index.html` by the switch PR (D77, O-79): just above `src/nat.html`, which binds `window.parseNatTrack = NatRules.parseNatTrack`; the v1.1.0 parser is removed from `src/nat.html` (frozen copy `test/oracle/nat-v1.1.0.html`); the renderer is unchanged. `ofp-flightkeys` v1.0.0 passes `{ filed, findings }` (O-68). Tests TC-174-003, TC-174-004, TC-174-020 … 022.

### Before the switch: open for 5e

`ofp-flightkeys` v0.4.0 calls the parser with three arguments and sets the filed letter after the call. To get the O-59 WARN and the INFO into its findings, a later version passes `{ filed, findings }`; that is the integration step (O-68).
