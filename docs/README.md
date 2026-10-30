# docs/

Reference documents for sessions working on PilotBrief. They are copies of the files in the project's Drive build folder, added in F0 so that later sessions can read them from the repository. If a copy and the Drive original disagree, tell the Exec; do not guess.

| File | What it is | Drive original |
|---|---|---|
| `ADR-001-ruleset-modularity.md` | Ruleset modularity and hot-update architecture | `ADR-001-ruleset-modularity.md` |
| `ADR-004-canonical-briefing-model-v1.3.md` | Import platform architecture and decisions D1–D17 | `ADR-004-canonical-briefing-model-v1.3.md` |
| `RPT-OFP-LiveDefectDiagnosis-UPD-20261029-v1.1.md` | DEF-A (NOTAM year) and DEF-B (Company Remarks) diagnosis, test cases TC-110 | same name |
| `SPRINT-OFP-FlightKeysMigration-REF-20261029-v1.0-FieldMap.md` | The 50-row FlightKeys field map (reference for P2a/P2b) | same name |
| `SPRINT-OFP-ImportPlatform-UPD-20261029-v2.3.md` | The sprint plan and every session prompt (authoring, review, QA, release) | Drive build folder (v2.3 is maintained here; Drive holds up to v2.2) |
| `OperatingPractice-IV-1-CodeMap.md` | `index.html` code map (Operating Practice §IV-1 only) | `SOP-PROJ-OperatingPractice-NEW-20260606-v1.0.md`, Volume IV |

Notes on the copies:

- Markdown escaping produced by the Drive export was removed; wording is unchanged.
- The field map has crew names, an employee number and a dispatcher name replaced with the stable fakes from `tools/redact`, because this repository is public.
- The field map §2.7 last sentence was restored from the complete Drive original (dispatcher name redacted).
- Fixtures (OFP packages and golden snapshots) are **not** here. They are in the private repository `velocemente/pilotbrief-fixtures`.
