# NOTAM ruleset v1.13.0 — D61 changes vs v1.12.0

Exec decision D61 (16 Nov): a NOTAM whose own date range is impossible or cannot be read is
ALWAYS displayed — no window and no schedule may hide it — and carries the flag
"DATE NOT READABLE – CHECK NOTAM". In the module: a NOTAM with a NOTAM header (FlightKeys
item header, or NavBlue `- ICAO … A1234/YY`) and no window (the T6 path) skips every schedule
check and its item gets `dateUnreadable: true` and the flag at the start of `text` and
`rowLabel` (ledger P-25, SPEC §8).

Package, NOTAM location, NOTAM ID only. No NOTAM text, no crew data.

## How this list was made

- **Per NOTAM, v1.12.0 vs v1.13.0:** `rules/notam-rules/notam-rules-v1.12.0.js` from `main`
  (SHA-256 `0d615a13…2557`) and the v1.13.0 file of this branch, on the whole NOTAM text of each
  of the 30 NavBlue/eOFP fixtures. Every NOTAM was evaluated alone at 120 points (ORIG and DEST;
  ETA 0000, 0059, 0500, 1000, 1159, 1200, 1640, 2300, 2359Z and none; departure unknown, 0000Z,
  1140Z; with and without the flight date): 7,704 NOTAMs, 924,480 calls. Split, window and EST
  flag: identical for all 7,704. Full `evalNotams()` result: **different for 14 NOTAMs, and all
  14 are D61 NOTAMs**. No NOTAM differs that is not flagged, and no flagged NOTAM is unchanged.
- **CI, every PR:** TC-171-030 checks the same thing against digests recorded from v1.12.0
  (`test/rules/data/notam-v1.12.0-navblue.json`). The 14 NOTAMs below are left out of the
  `evalNotams()` sweep, and every one of them is asserted shown and flagged at all 120 points.
  The 21 fixtures with no D61 NOTAM keep their original v1.12.0 digests.
- **FlightKeys fixtures (26 packages):** no item is flagged. Every item has a readable window,
  and the split still gives exactly the 7,158 items (TC-171-020, TC-171-021).

## The 14 NavBlue/eOFP NOTAMs now flagged (8 NOTAM IDs)

| # | Package | NOTAM location | NOTAM ID | Before (v1.12.0) | Now (v1.13.0) | On a release-airport card |
| --: | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | KMIA | A3337/25 | no window, shown at all 120 points | shown at all 120, flagged | — (not in the stored airport text) |
| 2 | `EOFP_KMIA-EHAM_06SEP26_pkgA_rev7` | KMIA | A3340/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 3 | `NB_ELLX-KHSV_08MAR26_baseline_rev16` | LPPO | A6120/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 4 | `NB_KCHS-LIBG_12MAR26_lcf_rev16` | LIRR | W5239/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 5 | `NB_KMIA-EHAM_12MAR26_etp_rev8` | KMIA | A3337/25 | no window, shown at all 120 | shown at all 120, flagged | KMIA (ORIG): slot 7, no row of its own |
| 6 | `NB_KMIA-EHAM_12MAR26_etp_rev8` | KMIA | A3340/25 | no window, shown at all 120 | shown at all 120, flagged | KMIA (ORIG): slot 7, no row of its own |
| 7 | `NB_KMIA-EHAM_12MAR26_etp_rev8` | LPPO | A6120/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 8 | `NB_KORD-RJAA_05APR26_tempcontrol_rev8` | KZMP | A0144/22 | no window, shown at all 120 | shown at all 120, flagged | — |
| 9 | `NB_KORD-RKSI_08APR26_catii_rev14` | KZMP | A0144/22 | no window, shown at all 120 | shown at all 120, flagged | — |
| 10 | `NB_KORD-RKSI_31MAY26_altroute_rev10` | KZMP | A0144/22 | no window, shown at all 120 | shown at all 120, flagged | — |
| 11 | `NB_LTFM-EBLG_11MAR26_thy_rev10` | LTBB | A5825/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 12 | `NB_LTFM-EBLG_11MAR26_thy_rev10` | LTBB | A5826/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 13 | `NB_LTFM-EBLG_11MAR26_thy_rev10` | LTBB | A5829/25 | no window, shown at all 120 | shown at all 120, flagged | — |
| 14 | `NB_PANC-KORD_10APR26_maxldgw_rev6` | KZMP | A0144/22 | no window, shown at all 120 | shown at all 120, flagged | — |

**Why they have no window.** All 14 print the start year after the start time, for example
`ddMMMhhmm yyyy-ddMMMhhmm yyyy`, `ddMMMhhmm yyyy-PERM`, or that form after an FAA `(nn/nnn)`
number. The NavBlue date reader has never read this form. Since HF-5 these NOTAMs take the T6
path (no window, so in effect), and none has a readable schedule. **No shown/hidden result
changes.** The only change is the flag and `dateUnreadable: true`.

Two more NOTAMs on the T6 path (`RODN M2326/25`, `LIBD B0056/24`) are dropped by the content
filters (obstacle / aircraft), in v1.12.0 and v1.13.0 alike. They are unchanged and not flagged.
D61 removes the window and the schedule as reasons to hide a NOTAM; it does not remove the
content filters (SPEC §11).

## Snapshot gates

| Gate | Result |
| :-- | :-- |
| Golden (`_ofpRulesetParse`), 33 fixtures | unchanged |
| V0 NOTAM-at-ETA (`snapshots-notam`), 33 fixtures | unchanged: the same NOTAM IDs shown at every release airport |
| App path (`snapshots-app`), 33 fixtures | 1 fixture, 2 fields: `NB_KMIA-EHAM_12MAR26_etp_rev8` `status[0]` (KMIA, ORIG), `issues[18].text` and `issues[19].text` = KMIA A3340/25 and A3337/25 (rows 5 and 6 above). The text now starts with `DATE NOT READABLE – CHECK NOTAM — `; nothing else in the text changes. Snapshot updated on the fixtures branch `claude/notam-v1.13.0`. |
| HF-5 oracle | 7,538 oracle NOTAMs: 0 hidden, 0 not found |

**On the iPad, for these fixtures: nothing visible changes.** The two KMIA NOTAMs fall in the
catch-all slot 7. The airport card draws rows only for runway, taxiway, general, SID and STAR
NOTAMs (`src/edit.html`, unchanged), so these two have no row of their own, with or without the
flag. When a flagged NOTAM does fall in one of those groups, the flag shows on its own row
(TC-171-104).
