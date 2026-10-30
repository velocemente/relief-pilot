# PilotBrief — project rules for Claude sessions

PilotBrief is a single-file offline PWA (`index.html`, `sw.js`, `manifest.json`) used by airline crews to brief an Atlas Air / Polar Air Cargo OFP. Crews rely on it in flight. Safety first, then correctness, then everything else.

The decision makers are the Exec (domain authority and approver). You never merge your own PR.

## Where things are

- `docs/` — read these before changing behaviour: `ADR-004` (architecture and decisions D1–D17), `SPRINT-OFP-ImportPlatform` (the plan and every session brief), `RPT-OFP-LiveDefectDiagnosis` (DEF-A / DEF-B), `SPRINT-OFP-FlightKeysMigration…FieldMap` (FlightKeys field map), `ADR-001`, and `OperatingPractice-IV-1-CodeMap` (where things are in `index.html`).
- `src/` — the app source, split into 20 modules by code region: `styles`, `screens`, `weather`, `notam`, `nat`, `state`, `storage`, `pdf`, `ofp-parse`, `render-preflight`, `render-enroute`, `rest`, `render-descent`, `edit`, `airports`, `oei`, `copy`, `import`, `settings`, `sw-register`. Each is an HTML fragment; `build/build.js` concatenates them in that order into `index.html`.
- `build/build.js` — run `node build/build.js` to assemble `src/` into `dist/index.html`. The committed `index.html` is the build output; CI verifies they match.
- `tools/extract` — rebuilds the text and positions from an OFP PDF exactly as the app does. `tools/redact` — replaces crew names / employee numbers with stable fakes.
- `test/` — `check-syntax.js`, `unit/`, `harness/` (loads `index.html` in a Node vm), `golden/` (snapshot compare).
- Fixtures (real OFP packages and golden snapshots) are in the **private** repo `velocemente/pilotbrief-fixtures`. They contain crew names and employee numbers. Never copy fixture text, names or numbers into this repo, a PR, an issue or a comment.

## Rules that never bend

1. **Times are UTC.** OFP and NOTAM times are UTC/Z. Never convert a time-zone suffix. In NOTAMs, `EST` means *estimated end*, not a time zone.
2. **`esc()` on every string rendered into HTML.** Any value that came from an OFP, a NOTAM, a crew entry or storage and reaches `innerHTML` goes through `esc()`.
3. **No UI change without approval.** Crews' screens are fixed. A brief that does not list a visual change means there is none: no new element, text, colour, spacing. Reuse existing components when a brief allows UI.
4. **Do not change behaviour outside the brief's scope.** One session, one concern. If you find something else, report it; do not fix it in the same PR.
5. **Read before you write.** Read and quote the code you are about to change. Do not rely on memory of how it works.
6. **Safety-critical fields** (slot time, DOT exemption alternate, CAT II/III, ETOPS entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change needs a positive *and* a negative test.
7. **No unrequested network activity** from the app's own code (installing, or a required file missing, excepted).
8. **Never investigate** the console messages `Script error.` and `Job rejected for non app-bound domain`; they are expected outside Safari.
9. **Version alignment.** `APP_VERSION` in `index.html`, `CACHE_NAME` in `sw.js` and `version` in `manifest.json` must match. Only release PRs change them.
10. **Never skip, disable or quarantine a test to get green.** Never edit a golden snapshot to make a diff disappear (see below).
11. **Never edit `index.html` directly — it is a generated file.** All changes go into the relevant `src/` module. After editing, run `node build/build.js` and commit both the `src/` change and the rebuilt `index.html` in the same PR.

## Tests

```bash
npm ci                                   # pdfjs-dist is pinned to exactly 3.11.174
node build/build.js                      # assemble src/ → dist/index.html
node test/check-syntax.js                # node --check of every inline script, sw.js, manifest.json
npm test                                 # unit tests
node test/golden/run.js compare --fixtures <path-to-pilotbrief-fixtures>
node tools/extract/verify.js <path-to-pilotbrief-fixtures>
```

CI (`.github/workflows/test.yml`) runs all of these on every PR; it reads the fixtures repo with the read-only secret `FIXTURES_TOKEN`. CI fails if the sha256 of `dist/index.html` (built from `src/`) does not match the committed `index.html`.

**Golden snapshots.** `compare` runs `_ofpRulesetParse` on every fixture and fails on any difference, printing `field: old -> new` (old = committed snapshot, new = your `index.html`). Every difference must be intended and explained in the PR's *Evidence* section. If it is intended, regenerate with `node test/golden/run.js update --fixtures <path>`, review the snapshot diff in the fixtures repo, and say in the PR which fixtures changed and why. Snapshots live in the fixtures repo, so a PR that changes them has a companion change there; the reviewer must be told. **The companion fixtures branch must use the SAME name as the app branch**; CI tests against it. Merge the fixtures PR first, then the app PR straight after.

**Extractor.** `tools/extract/extract.js` contains a copy of the `getTextContent` loop from `processPDF()` in `src/pdf.html`. If you change that loop in the app, change the copy and run `verify.js`; the extracted text must stay byte-for-byte equal to the fixtures' `text/`.

**Harness.** `test/harness` loads the main inline script of `index.html` unmodified in a vm with stubbed browser objects and a fixed clock. It exposes `_ofpRulesetParse`, `_splitNotams`, `evalNotams`, `xNW_standalone`. If a function you need is not exposed, add it to the `EXPOSED` list there; do not edit `index.html` for testing.

## Pull requests

- Branch from `main`; one concern per PR; do not push to `main`.
- Use the PR template (`.github/pull_request_template.md`). A PR must contain these four sections, in plain language a non-engineer can follow:
  - **What changes for crews** — 3–5 lines, no code terms. Write "Nothing visible" when true.
  - **Evidence** — test results, fixture names, before/after values, each golden diff explained.
  - **Risk** — what could go wrong and how it was tested.
  - **How to check on iPad** — at most 5 steps on the beta app.
- Never merge your own PR. Never edit files outside the stated scope of the brief.
- An independent session reviews each PR; the authoring session never reviews its own work.
- Do not put crew names, employee numbers or fixture text in a PR.

## Style

Match the surrounding code: naming, comment density, idiom. The app is plain browser JavaScript in one file; do not introduce a framework or a new runtime dependency. Test tooling is Node only.
