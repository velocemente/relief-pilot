# SPRINT-OFP-ImportPlatform

**Version:** v2.2 | **Status:** UPD | **Date:** 2026-10-29
**Supersedes:** v2.1 (same day: D6a declined; Q marker; HF-3 cellular alert; HF-4 proposed), v2.0, SPRINT-OFP-ImportPlatform v1.0 and SPRINT-OFP-FlightKeysMigration v1.0. The FlightKeys field map in the latter (§2) remains the reference.
**Architecture:** ADR-004 v1.3 (Accepted) · **Diagnosis:** RPT-OFP-LiveDefectDiagnosis v1.1
**Programme order:** ① OFP import platform (this plan) → ② NOTAM engine rewrite → ③ app update

---

## 0. Bottom Line

| | |
|---|---|
| **Goal** | Every OFP style (Navtech, eOFP, FlightKeys, future clients) imports into the same verified data, with the same bookmarks, a self-check that flags anything missing, a changes card when a revision is re-uploaded, and correct handling of BTB/ATB turn-backs. |
| **Safety first** | The two live defects (214 suppressed NOTAMs; Company Remarks dumps) and the iOS "Cellular Data is Turned Off" alert (HF-3) are fixed in **weeks 1–2**, before the rebuild. **FlightKeys is built first** and moves onto the new import in about **week 5**. Navtech and eOFP stay on today's hotfixed parser until their profile passes the golden master. |
| **How the work is done** | In the GitHub repository. Every change is a pull request with automated tests and an independent review. You approve as domain authority from a plain-language summary and a beta check on iPad. |
| **Duration** | ≈ 8 weeks, paced for accuracy. Each stage is gated by tests on all fixture packages. |
| **Budget** | 37 sessions + 6 contingency: **$32.40 – $44.60**. Ceiling to approve: **$45** (+$1.40 – 1.80 if HF-4 approved). GitHub test runs cost nothing at this scale. |

---

## 1. Your Checkpoints

| # | When | What you decide or check | Time |
|---|---|---|---|
| C1 | Now | HF-4 yes/no (§6); IA/TA definition when ready; supply the fixtures in §5 | 5 min |
| C2 | Week 1–2 | Hotfix on beta: RJAA RWY 16L/34R CLSD shows; RJAA Company Remarks short; with cellular data off, move PilotBrief into Slide Over several times — no alert (or at most one from iOS itself); if HF-4 approved, it returns to the open flight → approve for production | 20 min |
| C3 | Week 2–3 | After the code is reorganised: beta behaves exactly as before (no visible change) | 10 min |
| C-FK | Week 5 | **FlightKeys on the new import:** both prototypes plus any live package. NOTAMs, weather, curfews, crew, CAT II/III and MEL populated; self-check findings reviewed → approve for production | 30 min |
| C4 | Week 7 | Parity report: same flight across formats; sample briefings side by side → SME sign-off | 45 min |
| C5 | Week 7 | Revision field, changes card, kept crew entries, older-revision warning, BTB/ATB buttons and new-flight behaviour, **Q** marker on airport cards on beta; confirm the two BTB/ATB assumptions (ADR-004) | 30 min |
| C6 | Week 8 | Production release: cold start in airplane mode, one package of each format | 20 min |

Each pull request carries a short section you can read: **What changes for crews · Evidence · Risk · How to check on iPad.**

---

## 2. Plan

### Stage F0 — Foundation (week 1)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| F0 | Test harness + automated checks + fixture snapshots | Sonnet 4.6 · High | PR: test runner; GitHub Actions workflow; production-snapshot tool; `CLAUDE.md` project rules; PR template. Fixtures repository (per D11) with redaction tool and pdf.js 3.11.174 text. |
| R-F0 | Independent review | Haiku 4.5 | Review report on the PR |

### Stage H — Hotfix (weeks 1–2, after F0)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| HF-1 | DEF-A NOTAM year fixes (R1, R2 only — D8) | Sonnet 4.6 · High | PR + tests TC-110-001…006 |
| HF-2 | DEF-B Company Remarks pairing | Sonnet 4.6 · High | PR + tests TC-110-010…012 |
| HF-3 | No background network activity: remove background refresh; update checks only on request ("Check for update" in Settings) — iOS cellular alert in Slide Over | Sonnet 4.6 · High | PR + tests |
| HF-4 | **Only if approved:** after an iOS reload, return to the open flight, tab and phase | Sonnet 4.6 · High | PR + tests |
| R-HF1, R-HF2, R-HF3 (R-HF4) | Independent reviews | Haiku 4.5 | Review reports |
| REL-HF | Version 1.9.9-hf1 (index.html, sw.js, manifest aligned) | Haiku 4.5 | PR → beta → **C2** → production |

### Stage F1 — Reorganise the code (weeks 2–3)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| F1 | Split `index.html` into modules + build step that reproduces it **byte-for-byte** | Sonnet 4.6 · High | PR; automated hash check proves an identical build → **C3** |
| R-F1 | Independent review | Haiku 4.5 | |

### Stage P — Import platform (weeks 3–7) — FlightKeys first

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| E1a | Engine: PDF adapter (existing line routine + positions) and format detector | Sonnet 4.6 · High | PR + unit tests |
| E1b | Engine: field registry, canonical NOTAM record, validation, provenance, legacy output | Sonnet 4.6 · High | PR + unit tests |
| P2a | FlightKeys profile: OFP pages, incl. **Q** (Special Qual Airport) flag per airport | Sonnet 4.6 · High | PR; field map rows 1–42 |
| P2b | FlightKeys profile: Company NOTAMs, NOTAM & weather briefings | Sonnet 4.6 · High | PR; field map rows 43–50 |
| P5a | **FlightKeys packages routed through the engine;** Navtech/eOFP unchanged | Haiku 4.5 · Standard | PR → beta → **C-FK** → production |
| P1a | Navtech profile: release, fuel, weights, remarks, CAT II/III, MEL, crew, flags, slot, exemption | Sonnet 4.6 · High | PR; golden master vs production |
| P1b | Navtech profile: nav log, TOC, ETOPS/CFS/ETP, POR, tracks, alternate routes, TLR, overflight | Sonnet 4.6 · High | PR; golden master |
| P1c | Navtech profile: Company NOTAMs, remarks, NOTAM records, weather, FIR | Sonnet 4.6 · High | PR; golden master (only DEF-A/B diffs allowed) |
| B1 | Semantic bookmarks (D7) | Sonnet 4.6 · High | PR |
| RV1 | Revision comparison, `Revision` field, kept crew entries (D12), older-revision rule (D13), BTB/ATB new-flight rule (D15) | Sonnet 4.6 · High | PR |
| RV2 | Header `Revision : NN` (D14) + changes card + BTB/ATB buttons beside FCIR/ASAP + **Q** marker beside airport name on airport cards (D16) | Haiku 4.5 · Standard | PR → **C5** |
| QA-X | Cross-format parity and safety-critical audit | Sonnet 4.6 · High | Report → **C4** |
| R-× | Independent review of each PR above (E1a, E1b, P2a, P2b, P5a, P1a, P1b, P1c, B1, RV1, RV2) | Haiku 4.5 | Review reports |

### Stage P5 — Full switch-over and release (week 8)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| P5 | Navtech/eOFP also routed through the engine; legacy parser dormant for one release | Haiku 4.5 · Standard | PR |
| R-P5 | Independent review | Haiku 4.5 | |
| QA-R | Release gate + RUN-111 record | Haiku 4.5 | Report → **C6** |

**Sequence:** F0 → H (HF-1, HF-2, HF-3 in parallel) → F1 → E1a → E1b → **P2a → P2b → P5a (FlightKeys live on engine)** → P1a → P1b → P1c → B1 ∥ RV1 → RV2 → QA-X → P5 → QA-R.

**Why FlightKeys first (D6):**
- FlightKeys goes live before the platform completes, and today's parser leaves its NOTAMs, weather, crew, CAT II/III and MEL empty.
- Navtech/eOFP already work on the hotfixed parser, so they can wait for their profile and golden master without crew impact.
- Indicative calendar: wk1 F0, HF-1, HF-2, HF-3 · wk2 REL-HF, F1 · wk3 E1a, E1b · wk4 P2a, P2b · **wk5 P5a** · wk6 P1a–c · wk7 B1, RV1, RV2, QA-X · wk8 P5, QA-R.

**Model rule (Operating Practice II-3) retained:** the authoring session never reviews its own work; reviews are separate sessions. Automated tests are the hard gate; human approval is the final gate.

---

## 3. Budget

| Group | Sessions | USD |
|---|---|---|
| Sonnet 4.6 authoring (F0, HF-1, HF-2, HF-3, F1, E1a, E1b, P2a–b, P1a–c, B1, RV1, QA-X) | 15 | 22.30 – 30.00 |
| Haiku 4.5 authoring (REL-HF, P5a, RV2, P5, QA-R) | 5 | 1.60 – 2.60 |
| Haiku 4.5 independent reviews | 17 | 3.40 – 5.10 |
| **Base** | **37** | **27.30 – 37.70** |
| Contingency: 3 rework loops (author + review) | 6 | 5.10 – 6.90 |
| **Total** | **43** | **32.40 – 44.60** |
| **Ceiling to approve** | | **45.00** |
| *Optional HF-4 (+ review)* | *2* | *1.40 – 1.80* |

- **Hotfix track** (HF-1, HF-2, HF-3, REL-HF and their reviews): $4.30 – 5.60.
- **Change from v2.1:** H0 dropped (D6a declined); HF-3 added; Q marker folded into P2a/RV2.

---

## 4. Acceptance — Phase ① Complete When

1. **Formats:** every fixture is recognised correctly; truncated or mixed PDFs are refused with the warning.
2. **Golden master:** the new import matches today's production output on all 30 Navtech/eOFP packages, except the documented DEF-A/DEF-B corrections.
3. **FlightKeys:** all 50 fields resolved or flagged as absent with a reason; none silently empty.
4. **Matched pair** (UAAA–EHAM 27 OCT, Navtech vs FlightKeys): same airports, crew, CAT II/III airports and MEL items, judged structurally. The two plans differ: the Navtech release was a redispatch plan (RAPT EDDP, RALT EDDB).
5. **Self-checks:** TOF+TAXI=BLOCK, ZFW+TOF=TOGW, TOGW+TAXI=RAMP, TOGW−TRIP=LDGW on every fixture. Every release airport has NOTAMs and weather or an explicit nil.
6. **Defects:** TC-110-001…012 pass.
7. **Bookmarks:** same set and order on every format; each bookmark lands on the right page.
8. **Revisions and turn-backs:**
   - Re-uploading a later revision overwrites OFP data and keeps notes, FCIR/ASAP, parking gate, ATIS and crew-updated times.
   - An older revision asks for confirmation first.
   - The changes card lists every change New | Previous and hides once switched off.
   - The header shows `Revision : NN` left of the share button.
   - After BTB/ATB, the next upload of the same flight number, departure and destination opens as a new flight, leaving the original intact.
9. **Screens:** no change beyond the revision field, the changes card, the BTB/ATB buttons, the Q marker, the D2 warning text, and a "Check for update" action in Settings (HF-3).
10. **No unrequested network activity:** with cellular data off, opening PilotBrief or moving it into Slide Over triggers no network request from PilotBrief's own code.
11. **Release Gate (Operating Practice III-2): GO.**

---

## 5. Fixtures Still Needed (from Exec)

| # | Package | Why |
|---|---|---|
| 1 | Live **released** FlightKeys package with TLR | TLR layout, real `Revision:` value, populated TO/LNDG expiry |
| 2 | FlightKeys ETOPS/CFS flight (e.g. ANC–Asia) | ETOPS entry/exit and ETPs are safety-critical; no FlightKeys example yet |
| 3 | FlightKeys NAT or PAC track flight | Track hand-off |
| 4 | FlightKeys redispatch (RDA) flight | POR and redispatch alternates |
| 5 | **Two revisions of the same flight** (Navtech, and later FlightKeys) | Tests the revision comparison and changes card |
| 6 | Any FlightKeys package with WHEELS UP slot, DOT exemption, perishables, 777F | Remaining unverified fields |

Also: `Jepp Import/12 OCT 26 LGG ORD.pdf` is a Navtech company PDF, not an eOFP. Move it to `NavBlue` to avoid confusion.

---

## 6. Decisions

| ID | Decision | Status |
|---|---|---|
| D6 | Block FlightKeys uploads | **Declined** — FlightKeys built first instead |
| D6a | Interim FlightKeys notice | **Declined** — Exec is the only tester until P5a |
| D16 | **Q** = Special Qual Airport; show "Q" beside the airport name on each airport card whose ORIG/DEST/alternate line carries it | **Accepted** |
| D17 | HF-4: after an iOS reload, return to the open flight, tab and phase | **Open** |
| — | Meaning of IA / TA windows in FlightKeys briefings | **Open** — Exec to define before P2b |
| D9 | Archive the undeployed September ruleset v1.2 | **Done** — moved to `90_Old Versions` |
| D11 | Private fixtures repository; names may be redacted before upload | **Accepted** |
| D12 | Keep on re-upload: notes, FCIR/ASAP, parking gate, ATIS, crew-updated times | **Accepted** |
| D13 | Older revision → warn and confirm | **Accepted** |
| D14 | `Revision : NN` right-aligned, left of share button | **Accepted** |
| D15 | BTB/ATB buttons when FCIR/ASAP is on; next upload of same flight number + departure + destination = new flight | **Accepted** — two assumptions to confirm at C5 (ADR-004) |

---

## 7. Session Briefs

Each brief is self-contained. Paste it into a new Claude Code session attached to `velocemente/relief-pilot` with write access. After F0, project rules also live in `CLAUDE.md` in the repo; briefs repeat the safety-critical ones.

**Standard footer for every authoring brief (included in each block):**

```
PULL REQUEST must include:
- "What changes for crews" (plain language, 3–5 lines, no code terms)
- "Evidence" (test results; fixture names; before/after values)
- "Risk" (what could go wrong; how it was tested)
- "How to check on iPad" (≤ 5 steps on beta)
Never merge your own PR. Never edit files outside the stated scope.
```

---

### F0 — Foundation

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot (+ fixtures repo per D11)
CONTEXT
PilotBrief is a single-file offline PWA (index.html, sw.js, manifest.json) used by
airline crews. Today there are no automated tests; changes were applied by hand.
This session creates the safety net. Do NOT change app behaviour.
RULES
- OFP times are UTC. NOTAM "EST" means estimated end, not a time zone.
- App code is untouched in this PR except adding test/CI files.
TASK
1. tools/extract: Node script using pdf.js 3.11.174 (npm pdfjs-dist@3.11.174) that
   reproduces index.html's text assembly EXACTLY (copy the getTextContent loop from the
   PDF import function: 2-pt y grouping, x sort, gap spacing) → <name>.raw.txt, plus
   <name>.items.json (per-page items with str, x, y, width, height, font, outline).
2. tools/redact: replace crew names and employee numbers with stable fake values
   (same input → same output) in raw/items; report what was replaced.
3. Fixtures repo (PRIVATE — D11): commit the 32 training packages' raw/items with a
   manifest (name, format, producer, pages, scenario tags). Redaction is optional (Exec
   may redact names before upload); the tool must exist for anything shared.
4. test/harness: load index.html's main inline script in a Node vm with stubbed
   browser objects; expose _ofpRulesetParse, _splitNotams, evalNotams, xNW_standalone.
5. test/golden: run _ofpRulesetParse on every fixture → JSON snapshot; compare
   mode fails on any diff and prints a readable field-level diff.
6. .github/workflows/test.yml on every PR: node --check of extracted inline scripts;
   unit tests; golden compare (fixtures repo checked out with a read token).
7. CLAUDE.md (project rules: UTC, esc() on rendered strings, no UI change without
   approval, PR template rules); .github/pull_request_template.md (footer sections).
8. docs/: add ADR-001, ADR-004 v1.3, RPT-OFP-LiveDefectDiagnosis v1.1,
   SPRINT-OFP-FlightKeysMigration v1.0 (field map), this sprint plan, and the
   Operating Practice code map (IV-1) — later sessions read them from here.
ACCEPTANCE
- CI green on unchanged index.html; snapshots committed for all 32 fixtures.
- A deliberate one-character change in a PATTERNS regex makes CI fail with a readable diff.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### HF-1 — NOTAM Year Fixes (DEF-A)

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: hf/def-a-notam-year
CONTEXT
Valid NOTAMs are judged "not in effect" at ETA because their validity year is misread.
Measured on 30 packages (pdf.js text): 214 of 3,424 NOTAMs, 118 operationally relevant.
Full analysis: docs/RPT-OFP-LiveDefectDiagnosis v1.1 (add to repo if absent).
SCOPE (Exec decision D8): fix ONLY R1 and R2. No other NOTAM behaviour changes.
R1 In xNW_standalone, inlineRe's trailing-year group (?:\s+(\d{4}))? crosses the
   newline and reads the daily schedule ("1410-2030") as year 1410.
   Fix: (?:[ \t]+(20\d{2})\b)?
R2 Start year is taken from the end/flight year. Fix: when the NOTAM number carries
   /YY, start year = latest year Y in [2000+YY, endYear] such that start(Y) <= end;
   PERM uses the same rule with end = +infinity. No /YY → unchanged.
RULES: READ AND QUOTE xNW_standalone, _parseDateToken, _resolveInlineDateRange first.
   UTC only. No UI change.
TESTS (add to test/): TC-110-001..006 from the diagnosis report §4, plus negatives:
   "- XXXX A0100/26 05JAN0000-30JAN2359" on 2026-01-10 → start 2026-01-05; no-ID → unchanged.
ACCEPTANCE: CI green. Golden snapshot diffs limited to NOTAM activity of R1/R2 items
   (list them); ops-relevant suppressed count 118 → 0.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### HF-2 — Company Remarks Pairing (DEF-B)

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: hf/def-b-remarks
CONTEXT
On 9 of 30 packages, large parts of the OFP appear under an airport's Company Remarks.
extractAptOpsNotes() slices between EVERY consecutive pair of dashed delimiter lines,
so the gap between two remarks blocks (CAT II/III, MEL, release, crew, fuel, repeated
Flight Plan copies) is filed under the first release airport named in its first 3 lines.
FIX
1. Read only each Flight Plan copy's Remarks section: from ^Remarks$ to the first of
   ^RAIM VALIDATION | ^AUTHORIZED CAT | ^MEL/CDL | ^_{10,}.
2. Dashed delimiters are (open, close) pairs; never read the gap between pairs.
3. Body excludes the closing delimiter line.
Do NOT port the Drive v1.2 600-character cap (superseded, D9).
RULES: READ AND QUOTE extractAptOpsNotes() before editing. No UI change.
TESTS: TC-110-010..012 (diagnosis report §4); synthetic: CAT line after a closing
   delimiter → no remarks for that airport.
ACCEPTANCE: CI green. Golden diffs limited to opsNotes of the 9 listed packages
   (dumps removed) and the trailing-dash cleanup on the 15 genuine remarks (list them).
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### HF-3 — No Background Network Activity (iOS cellular alert)

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: hf/no-background-network
CONTEXT
With cellular data off, iOS shows "Cellular Data is Turned Off — Turn on cellular data
or use Wi-Fi to access data" when PilotBrief is moved into Slide Over. Evidence: the
alert appears once per Slide Over and the app sometimes returns to the Flights list,
i.e. iOS reloads the Home Screen web app. PilotBrief has no resize/visibility handlers;
the network attempts come from the reload:
 (a) sw.js cache-first handler: on a cache HIT for same-origin assets it re-fetches in
     the background, guarded only by navigator.onLine (true with cellular data off or
     Wi-Fi without internet);
 (b) iOS's own service-worker update check on navigation (browser behaviour).
PRINCIPLE: zero network attempts from PilotBrief's code unless the crew asks, or the
app is installing / a required file is missing.
TASK
1. sw.js: remove the background revalidation on cache hit. Cache hit → return cached,
   nothing else. Cache miss → network as today (install/first use only).
2. Navigation: unchanged (cache-only index.html), confirm no network on cache hit.
3. Updates: add "Check for update" to the existing Settings screen (existing row style)
   calling registration.update(); show the existing toast with the result. Add no
   automatic update check and no connectivity probe from app code.
4. Register with { updateViaCache: 'all' } to reduce browser-initiated sw.js fetches;
   document in the PR that iOS may still perform its own check on reload (outside app
   control) and how often.
5. Bump CACHE_NAME with the hotfix release (REL-HF), not here.
RULES: READ AND QUOTE the sw.js fetch handler and the registration block first.
   Never investigate "Script error." / "Job rejected for non app-bound domain".
TESTS: unit test of the fetch handler with a mocked cache/fetch: cache hit → fetch
   never called; cache miss → fetch called once. Manual (PR "How to check"): cellular
   data off, Wi-Fi off; open PilotBrief; move into Slide Over 5×; record alerts.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### HF-4 — Return to the Open Flight After an iOS Reload (only if D17 approved)

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: hf/resume-view
CONTEXT
iOS sometimes reloads the Home Screen web app (e.g. moving into Slide Over). The app
then starts at the Flights list; flight data is safe in storage but the crew loses
their place.
TASK
1. On navigation between screens/tabs/phases, store {flightId, screen, tab, phase,
   scrollY} in localStorage (try/catch; small; no flight data duplicated).
2. On start-up, if a stored view exists and its flight still exists, re-open it via the
   existing loadFlight() path and restore screen/tab/phase/scroll. Otherwise current
   behaviour.
3. Clear the stored view when the crew returns to the Flights list deliberately or
   deletes the flight. Never auto-open a flight the crew closed.
RULES: READ AND QUOTE loadFlight(), push()/pop() and setPhase() first. No UI change.
TESTS: simulated reload restores the same flight/phase; deleted flight → Flights list.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### R-× — Independent Review (reuse for every PR)

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot PR: #<number>
You did NOT write this PR. Review only; do not push commits.
CHECK
1. CI status green; read the test output, not just the badge.
2. Diff stays inside the PR's stated scope; list any file or function touched outside it.
3. Golden-snapshot diffs: every one is explained in the PR "Evidence" section.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND negative test.
5. UTC handling; esc() on any newly rendered string; no new UI unless the brief says so.
6. "What changes for crews" is accurate and understandable by a non-engineer.
OUTPUT: PR review comment with verdict APPROVE-FOR-EXEC or CHANGES-REQUESTED and a
   numbered findings list (severity S0–S4, file:line, evidence).
```

---

### REL-HF — Hotfix Release

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot BRANCH: rel/1.9.9-hf1
TASK: after HF-1, HF-2, HF-3 (and HF-4, if approved) are merged: set APP_VERSION '1.9.9-hf1', sw.js
  CACHE_NAME 'pb-v1.9.9-hf1', manifest.json version '1.9.9-hf1'. Add release notes
  (plain language). CI green.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### F1 — Reorganise the Code (no behaviour change)

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: f1/modularise
CONTEXT
index.html (~12,600 lines) holds all CSS, HTML and JS. Split it into source modules so
future changes are small, reviewable and testable. The delivered app must not change.
TASK
1. src/: one file per region (styles, screens, weather, notam, nat, state, pdf, ofp-parse,
   render-preflight, render-enroute, rest, render-descent, edit, copy, airports, oei,
   storage, import, settings, sw-register). Use the region map in docs/ (Operating
   Practice IV-1) as a starting point; confirm boundaries by reading the code.
2. build/build.js: concatenates src/ in a declared order into dist/index.html.
3. CI: build, then sha256(dist/index.html) must equal sha256(index.html) on main.
   Then index.html becomes a build output (committed, generated).
4. Golden master and all tests run against the built file.
ACCEPTANCE: identical hash; CI green; no logic edits of any kind (a reviewer will diff).
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### E1a — Engine: PDF Adapter + Format Detector

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/e1a
CONTEXT: ADR-004 v1.3 (docs/). Build layers 1–2 as src/import/ modules. Not yet wired
  into the app.
TASK
1. adapter-pdf: from pdf.js items → Doc {meta, pages[{n, lines[{text, y, spans[{x,str}]}]}]}.
   The line text MUST equal the app's existing assembly byte-for-byte (prove on all
   fixtures). Additionally split genuine side-by-side columns (x-gap > 40 % of page
   width) into separate runs, exposed separately from the legacy text.
2. detector: profiles declare weighted signatures; return {profileId, confidence} or
   reject (below threshold, or two profiles within 0.2).
   Signatures: Navtech "ATLAS AIR BRIEF PAGE n OF n"; FlightKeys "FUFI: <uuid> PAGE n/m"
   + "OPERATIONAL FLIGHT PLAN".
TESTS: unit tests; all 32 fixtures classified (30 Navtech/eOFP, 2 FlightKeys);
  synthetic mixed and truncated documents rejected.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### E1b — Engine: Field Registry, Validation, Provenance, Legacy Output

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/e1b
CONTEXT: ADR-004 v1.3 layers 4–5. Format-free: no OFP-layout patterns in this PR.
TASK
1. registry: one entry per field the app consumes today (the full _ofpRulesetParse
   return; read the function to enumerate it): type, unit, safety class (SC/OP/INFO),
   required condition, validators, legacy key, legacy empty value.
2. NOTAM record + resolveValidity (same rules as HF-1) producing absolute UTC; flag
   unresolvable windows (no evaluation behaviour — D8).
3. validation: field checks; cross-checks TOF+TAXI=BLOCK, ZFW+TOF=TOGW, TOGW+TAXI=RAMP,
   TOGW−TRIP=LDGW, MINF<=TOF; completeness (CA present; each release airport has
   NOTAM and weather or explicit nil; SC fields when their section exists).
4. provenance {page, line, quote<=80} on every value and record.
5. toLegacyShape(): returns exactly the legacy object shape and empties.
TESTS: cross-checks pass on GTI7134 (BLOCK 78500, TOF 77300, TAXI 1200, ZFW 260345,
  TOGW 337645, RAMP 338845, TRIP 62099, LDGW 275546) and FlightKeys ZUCK–UAAA (78200,
  76850, 1350, 270718, 347568, 348918, 50584, 296984); a 1-unit change → WARN.
  toLegacyShape(empty) key set equals the legacy key set.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### P1a / P1b / P1c — Navtech Profile

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/p1<a|b|c>
CONTEXT: ADR-004 v1.3. Profile 'atlas-5y' covers Navtech company PDFs and iOS-printed
  eOFPs (identical text). The engine and the 'atlas-fk' profile already exist and are
  live for FlightKeys — do not change them except through a reviewed engine fix. The
  current parser in src/ofp-parse is the behavioural oracle — port its patterns, do
  not reinvent them.
SCOPE
  P1a: identity, ORIG/DEST/alternate lines, fuel, weights, ZFW INCR, ADDL FF ADJ, VZFW,
       perishables, temperature control, verbal callsign, slot chain (6 priorities in
       order), DOT/EXEMPTION, CAT II/III, MEL/CDL + DDG, crew (role labels, SEN,
       compound surnames exactly as today).
  P1b: nav log, TOC, ETOPS entry/exit/spec, CFS block, ETP lines, CFS alternates
       (WX window, ETP name), POR, NAT/PAC track hand-off text, alternate routes,
       overflight, TLR (runway info, special EFP, MEL cross-reference).
  P1c: Company NOTAMs, remarks (HF-2 pairing rule), NOTAM records (HF-1 year rule),
       airport weather/NOTAM text in today's shape, FIR/en-route NOTAMs, repeated
       Flight Plan copies handled as today.
RULES: every changed anchor documented with before/after quote. ETOPS/ETP/POR values
  must trace to a quoted fixture line. UTC only.
ACCEPTANCE: golden master — toLegacyShape(engine) equals production output on all 30
  Navtech/eOFP fixtures for every in-scope field; the only allowed diffs are those
  already approved in HF-1/HF-2.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### P2a / P2b — FlightKeys Profile

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/p2<a|b>
CONTEXT: ADR-004 v1.3; field map in docs/SPRINT-OFP-FlightKeysMigration v1.0 §2
  (50 fields). Profile 'atlas-fk' — built BEFORE the Navtech profile because FlightKeys
  is live (D6). The current parser is NOT an oracle for FlightKeys; the OFP text and the
  field map are. Fixtures: FK_ZUCK-UAAA, FK_UAAA-EHAM, plus any
  FlightKeys packages added under §5; matched pair JEPP_ALA-AMS_27OCT (Navtech, same
  flight; note it was a redispatch plan — compare structure, not numbers).
SCOPE
  P2a: rows 1–42. Known forms: unit KG; "ZFW INC/1000"; "*ADDL FF ADJ +1.00 *";
       VZFW text without asterisks; CAT lines bare in Remarks; MEL one line
       "MEL 33-45-01 - desc" (exclude "Dispatcher applied ADHOC penalty"); crew
       "LAST, FIRST" cut at ".." or "("; FIR rows "(ZLHW) AT OMBON 00.43 …";
       "TOP OF STEP CLB/DSC"; alternate route "GCD … GDIS … FUEL … TIME …";
       footers "FUFI: <uuid> PAGE n/m"; Revision "-.-" on unreleased plans; the "Q"
       token on ORIG/DEST/alternate lines = Special Qual Airport (D16) → per-airport flag.
       IA/TA window meaning: await Exec definition before P2b uses them.
  P2b: rows 43–50. Company NOTAMs (two copies; SUBJECT <ICAO>-<TAG>: CURFEW and
       ARRL CRF → curfew; other airport tags → remarks; fleet tags → none). NOTAM
       briefing: APT header, RWYS, role windows (DEPARTURE, DESTINATION, IA, TA),
       categories, items with ISO validity (UTC; no year guessing); dedupe by NOTAM
       ID. Weather briefing: METAR/TAF/ATIS per airport, two-column pages. FIR blocks.
RULES: fields with no FlightKeys fixture yet return the legacy empty value AND a
  'fixture pending' validation finding — never a guess.
MANDATORY CHECKS: ZUCK curfew shows departure curfew 0100Z–1300Z; EHAM shows
  A2476/26 RWY 04/22 CLSD; every release airport incl. UCFM and EBBR has NOTAMs and
  weather or explicit nil; fleet NOTAM "FALSE MAIN DECK WARNINGS" filed under no
  airport; cross-checks pass on both FlightKeys fixtures.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### P5a — FlightKeys on the New Import

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot BRANCH: p/p5a
CONTEXT: ADR-004 v1.3. Engine (E1a, E1b) and 'atlas-fk' profile (P2a, P2b) are merged.
  FlightKeys is live; Navtech/eOFP must remain on the existing parser for now.
TASK: in parseOFP(): run the engine's detector. If the profile is 'atlas-fk' → engine
  path (model → validation → legacy output merged into S exactly as today; validation
  FAIL on a safety-critical field → existing warning path with the D2 text; bookmarks
  unchanged until B1). Any other result → today's parser, unchanged.
ACCEPTANCE: CI green; Navtech/eOFP golden snapshots unchanged; both FlightKeys fixtures
  import with NOTAMs, weather, curfews, crew, CAT II/III and MEL populated on beta.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### B1 — Semantic Bookmarks

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/b1
CONTEXT: ADR-004 v1.3 §5; Exec decision D7: PilotBrief bookmarks ALWAYS replace the
  PDF's own outline. The existing bookmark pills render them — read their data
  contract from the getOutline path; do not change the pill component.
TASK: buildBookmarks(model) → ordered list in the ADR taxonomy, with page numbers
  from provenance (absolute PDF pages, never footer numbers); per-airport NOTAM,
  weather and Company NOTAM entries in role order; 'curfew' / 'runway closed' flags.
ACCEPTANCE: each bookmark's page contains its anchor text (test on all fixtures);
  the matched pair yields the same label set.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### RV1 — Revisions, Kept Crew Entries, Turn-Backs

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot BRANCH: p/rv1
CONTEXT: ADR-004 v1.3 "Import outcome, correction, revisions and turn-backs"
  (Exec specification D2, D12–D15).
TASK
1. Field 'revision' in the registry, from the OFP header ("Revision:11",
   "Revision: 5"; FlightKeys "-.-" when unreleased → shown as received).
2. Same flight = flight number + flight date + departure + destination.
3. On re-upload of the same flight: overwrite all OFP-derived data. KEEP: notes,
   FCIR/ASAP state and its event record, parking gate, ATIS entries, and every time the
   crew has edited (OUT, OFF, IN, ETAs, other edited times). Where the new OFP also
   changed a crew-edited time, keep the crew value and record the OFP's new value for
   the changes card.
4. Older revision (new < stored, numeric compare when both numeric): return a
   'confirm required' result; overwrite only after confirmation.
5. compareRevisions(previous, new) → grouped changes [{group, label, new, previous}]:
   Times · Fuel & Weights · Route & Alternates · CAT II/III · MEL/CDL · Crew ·
   Slot/Curfew · Company NOTAMs · NOTAMs (added/removed by NOTAM ID). Compare canonical
   values and natural keys (NOTAM ID, ATA code, employee number, CAT airport+category)
   — never raw text. Store {changes, fromRevision, toRevision, viewed:false}.
6. Turn-back: flight flag 'turnBack' = 'BTB' | 'ATB' (set by RV2 buttons). When set,
   the next upload matching flight number + departure + destination creates a NEW
   flight record; the original flight and its FCIR/ASAP record are untouched. Pending
   Exec confirmation at C5: also log a time-stamped BTB/ATB entry in the FCIR/ASAP
   record; link the new flight to the original.
TESTS: two revisions of one flight (fixtures §5 item 5); synthetic: MEL added, block
  fuel changed, NOTAM removed → exactly those three changes; crew-edited OUT survives a
  re-upload; FCIR events survive; older revision → confirm; BTB set → new flight
  created, original intact.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### RV2 — Revision Header, Changes Card, BTB/ATB Buttons, Q Marker

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot BRANCH: p/rv2
CONTEXT: Exec specification. UI is otherwise frozen; reuse existing components only.
TASK
1. Header (D14): on the OUT / IN row (class time-row), "Revision : <n>" right-aligned,
   immediately left of the share button. Same font as the row.
2. Changes card: existing .subcard / .subcard-header / .subcard-body styles. Title
   "Revision <from> → <to> changes". Two columns per row: New (left), Previous
   (right), grouped as RV1 returns; where a crew-edited time was kept, show
   "(your entry kept)". A switch "Hide once viewed" sets viewed:true and removes the
   card; state saved with the flight.
3. Older-revision confirmation (D13): existing confirm dialog style; text
   "This package is Revision <new>, older than the stored Revision <old>. Replace?"
4. Q marker (D16): on each airport card whose airport carries the Special Qual flag,
   show "Q" beside the airport name, existing badge/label style.
5. BTB / ATB (D15): when the FCIR/ASAP toggle is on, show two buttons "BTB" and "ATB"
   beside it, existing button style. Pressing one sets the RV1 turn-back flag and
   shows a toast "Next upload of this flight will open as a new flight."
6. esc() on every rendered value.
TESTS: renders with RV1 test data; hidden after the switch; persists across reload;
  BTB/ATB only visible with FCIR/ASAP on; Q shown for ZUCK, UAAA, UCFM (FK fixtures),
  not for airports without the token.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### QA-X — Cross-Format Parity Audit

```
MODEL: Sonnet 4.6 · High REPO: velocemente/relief-pilot (read-only report)
TASK
1. Golden master green on all Navtech/eOFP fixtures.
2. Matched pair (Navtech ALA–AMS vs FlightKeys UAAA–EHAM): structural comparison per
   §4.4; list every difference and say whether it is a plan difference or an import gap.
3. Safety-critical audit per format: positive, negative and fallback evidence for slot
   time, DOT exemption alternate, CAT II/III, ETOPS entry/exit, block/min fuel, crew,
   airport NOTAM/weather/curfew.
4. Every fixture: self-check findings listed; zero silent empties.
5. Write "SME review pack": 3 flights, side-by-side key fields per format, for Exec C4.
OUTPUT: docs/RPT-QA-RUN111-CrossFormat.md with GO / NO-GO.
```

---

### P5 — Full Switch-Over

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot BRANCH: p/p5
TASK: Navtech/eOFP now also use the engine ('atlas-5y'), as FlightKeys has since P5a:
  detect → profile → model → validation → legacy output merged into S exactly as today;
  reject or SC FAIL → existing warning path (D2 text); bookmarks from B1; revision and
  turn-back handling from RV1/RV2. Keep the legacy parser in the bundle, unused, for one
  release.
  Version bump aligned in index.html, sw.js, manifest.json.
ACCEPTANCE: CI green; one package per format imports on beta.
PULL REQUEST must include: What changes for crews · Evidence · Risk · How to check on iPad.
Never merge your own PR. Never edit files outside the stated scope.
```

---

### QA-R — Release Gate

```
MODEL: Haiku 4.5 · Standard REPO: velocemente/relief-pilot (read-only report)
TASK: complete the Release Gate (Operating Practice III-2) from CI results and review
  reports; record RUN-111; list Exec items for C6 (cold start, airplane mode, one
  package per format). OUTPUT: docs/RPT-QA-RUN111-ReleaseGate.md with GO / NO-GO.
```
