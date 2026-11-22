# docs/

Reference documents for sessions working on PilotBrief. They are copies of the files in the project's Drive build folder, added in F0 so that later sessions can read them from the repository. If a copy and the Drive original disagree, tell the Exec; do not guess.

| File | What it is | Drive original |
|---|---|---|
| `ADR-001-ruleset-modularity.md` | Ruleset modularity and hot-update architecture | `ADR-001-ruleset-modularity.md` |
| `ADR-004-canonical-briefing-model-v1.3.md` | Import platform architecture and decisions D1–D17 | `ADR-004-canonical-briefing-model-v1.3.md` |
| `ADR-005-AppendixB-Addendum-NEW-20261117-v1.0.md` | Appendix B addendum: two extension fields (`specialQualification`, `swa`), Exec SME answers 13 Nov; contract 2.1 | written in the repository (FlightKeys parser v0.1.0); no Drive original yet |
| `ADR-005-AppendixB-Addendum2-NEW-20261117-v1.0.md` | Appendix B addendum 2: `operatingPilots` (D62) and the crew-record extensions `firstName`, `toLndgExpiry` (SME-9); contract 2.2 | written in the repository (FlightKeys parser v0.2.0); no Drive original yet |
| `ADR-005-AppendixB-Addendum3-NEW-20261118-v1.0.md` | Appendix B addendum 3: airport extensions `notamItems`, `notamsRaw` (D64) and `briefing` (SME-1), card order; contract 2.3 | written in the repository (FlightKeys parser v0.3.0); no Drive original yet |
| `ADR-005-AppendixB-Addendum4-NEW-20261119-v1.0.md` | Appendix B addendum 4: top-level extensions `firNotams`, `firRaw` (D64, O-41), `natMessages` (O-43), `hazards` (O-45), and the FlightKeys values of `enrouteNotams.fir`, `natTrack`, `curfew`, `opsNotes`, `companyNotams`; contract 2.4 | written in the repository (FlightKeys parser v0.4.0); no Drive original yet |
| `ADR-005-AppendixB-Addendum5-NEW-20261122-v1.0.md` | Appendix B addendum 5: top-level extension `volcanicAsh` (O-169), `dispatchContact.source` and the Contact Dispatch remark as printed (O-175), the `raim` rule of `ofpRemarks` (O-172); contract 2.5 | written in the repository (FlightKeys parser v1.1.0, step 5f module PR A); no Drive original yet |
| `RPT-NOTAM-ObstacleRule-ChangeList-UPD-20261119-v1.2.md` | NOTAM ruleset v1.14.0 change list for the Exec (D67 / D67a / D67b obstacle rule): groups B shown → hidden, C hidden → shown, U undecided, G card group set, deferred en-route, over every NOTAM of the NavBlue and FlightKeys fixtures; the departure-card list for 5e; O-28 audit and beta exposure (v1.11.2) | written in the repository (NOTAM ruleset v1.14.0); no Drive original yet |
| `RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md` | FlightKeys NOTAM / Weather Briefing grammar on the 26 FlightKeys fixtures (input for NOTAM ruleset v1.13.0, parser step 5d, D54) and today's beta live risk on the 23 live packages. v1.1 (18 Nov): §A.4 roles and §A.5 repeated IDs corrected to the v0.3.0 measurements; supersedes v1.0 (`…-NEW-20261114-v1.0.md`, renamed) | v1.0 same name in Drive; v1.1 written in the repository |
| `RPT-OFP-LiveDefectDiagnosis-UPD-20261029-v1.1.md` | DEF-A (NOTAM year) and DEF-B (Company Remarks) diagnosis, test cases TC-110 | same name |
| `SPRINT-OFP-FlightKeysMigration-REF-20261029-v1.0-FieldMap.md` | The 50-row FlightKeys field map (reference for P2a/P2b) | same name |
| `SPRINT-OFP-FlightKeysMigration-UPD-20261118-v1.2-FieldMap.md` | The field map re-done on the 23 live FlightKeys packages + 3 prototypes (26): rows 1–50, Appendix B extensions, SME questions (supersedes v1.0). v1.2 (18 Nov): §1.1 L16 / L18 pages and row 44 repeated NOTAM IDs corrected to the v0.3.0 measurements; supersedes v1.1 (`…-REF-20261113-v1.1-FieldMap.md`, renamed) | written in the repository (session 5a-2, v1.2 in step 5d); no Drive original yet |
| `SPRINT-OFP-ImportPlatform-UPD-20261030-v2.4.md` | The sprint plan and every session prompt (authoring, review, QA, release) | Drive build folder (copy placed by the Exec) |
| `OperatingPractice-IV-1-CodeMap.md` | `index.html` code map (Operating Practice §IV-1 only) | `SOP-PROJ-OperatingPractice-NEW-20260606-v1.0.md`, Volume IV |

Notes on the copies:

- Markdown escaping produced by the Drive export was removed; wording is unchanged.
- The field map has crew names, an employee number and a dispatcher name replaced with the stable fakes from `tools/redact`, because this repository is public.
- The field map §2.7 last sentence was restored from the complete Drive original (dispatcher name redacted).
- Fixtures (OFP packages and golden snapshots) are **not** here. They are in the private repository `velocemente/pilotbrief-fixtures`.
