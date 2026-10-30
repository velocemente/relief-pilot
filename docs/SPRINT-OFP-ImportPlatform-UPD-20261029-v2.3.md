# SPRINT-OFP-ImportPlatform

**Version:** v2.3 | **Status:** UPD | **Date:** 2026-10-29
**Supersedes:** v2.2 (same day: repository guard in every prompt; review and QA prompts inline; HF-4 approved; progress recorded), v2.1, v2.0, SPRINT-OFP-ImportPlatform v1.0 and SPRINT-OFP-FlightKeysMigration v1.0. The FlightKeys field map in the latter (§2) remains the reference.
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
| **Budget** | 40 sessions + 6 contingency: **$33.90 – $46.60**. Ceiling: **$47** (HF-4 approved). GitHub test runs cost nothing at this scale. |
| **Two repositories** | **`velocemente/relief-pilot`** = development and beta. **All** sessions work here. **`velocemente/PilotBrief`** = production; read-only for Claude, updated only by the production release step (§2, REL-PROD). |

---

## 1. Progress

| Item | Status |
|---|---|
| Beta synced to production v1.9.9 | **Done** — PR #1 merged 29 Oct |
| F0 Foundation (+ review) | **Done** — PR #2 merged 29 Oct; review APPROVE-FOR-EXEC |
| Fixtures library | **Done** — `pilotbrief-fixtures`: 32 packages, text, positions, snapshots |
| HF-1 NOTAM year | **PR #3 open** — awaiting review (prompt in §7) |
| HF-2, HF-3, HF-4 | Not started |

---

## 1a. Your Checkpoints

| # | When | What you decide or check | Time |
|---|---|---|---|
| C1 | Now | IA/TA definition when ready; supply the fixtures in §5; D18 (production release method, §6) | 5 min |
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
| F0 ✅ | Test harness + automated checks + fixture snapshots — **done, PR #2** | Sonnet 4.6 · High | PR: test runner; GitHub Actions workflow; production-snapshot tool; `CLAUDE.md` project rules; PR template. Fixtures repository (per D11) with redaction tool and pdf.js 3.11.174 text. |
| R-F0 ✅ | Independent review — **done** | — | Review comment on PR #2 |

### Stage H — Hotfix (weeks 1–2, after F0)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| HF-1 | DEF-A NOTAM year fixes (R1, R2 only — D8) — **PR #3 open** | Sonnet 4.6 · High | PR + tests TC-110-001…006 |
| HF-2 | DEF-B Company Remarks pairing | Sonnet 4.6 · High | PR + tests TC-110-010…012 |
| HF-3 | No background network activity: remove background refresh; update checks only on request ("Check for update" in Settings) — iOS cellular alert in Slide Over | Sonnet 4.6 · High | PR + tests |
| HF-4 | After an iOS reload, return to the open flight, tab and phase (**approved**, D17) | Sonnet 4.6 · High | PR + tests |
| R-HF1 … R-HF4 | Independent review of each hotfix PR | Haiku 4.5 | Review comment on each PR |
| REL-HF | Version 1.9.9-hf1 (index.html, sw.js, manifest aligned) | Haiku 4.5 | PR → beta |
| QA-HF | Hotfix release gate on beta | Haiku 4.5 | Report → **C2** |
| REL-PROD-HF | Copy the approved beta files to production `PilotBrief` (method per D18) | Exec (or Haiku if D18 = B) | Production updated |

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
| R-× | Independent review of every PR (F1, E1a, E1b, P2a, P2b, P5a, P1a, P1b, P1c, B1, RV1, RV2, P5) — prompt inline after each brief in §7 | Haiku 4.5 | Review comment on each PR |

### Stage P5 — Full switch-over and release (week 8)

| ID | Session | Model · Effort | Output |
|---|---|---|---|
| P5 | Navtech/eOFP also routed through the engine; legacy parser dormant for one release | Haiku 4.5 · Standard | PR |
| R-P5 | Independent review | Haiku 4.5 | |
| QA-R | Release gate + RUN-111 record | Haiku 4.5 | Report → **C6** |
| REL-PROD | Copy the approved beta release to production `PilotBrief` (method per D18) | Exec (or Haiku if D18 = B) | Production updated |

**Sequence:** F0 ✅ → H (HF-1, HF-2, HF-3, HF-4 in parallel) → REL-HF → QA-HF → REL-PROD-HF → F1 → E1a → E1b → **P2a → P2b → P5a (FlightKeys live on engine)** → P1a → P1b → P1c → B1 ∥ RV1 → RV2 → QA-X → P5 → QA-R → REL-PROD.

**Why FlightKeys first (D6):**
- FlightKeys goes live before the platform completes, and today's parser leaves its NOTAMs, weather, crew, CAT II/III and MEL empty.
- Navtech/eOFP already work on the hotfixed parser, so they can wait for their profile and golden master without crew impact.
- Indicative calendar: wk1 F0, HF-1…HF-4 · wk2 REL-HF, F1 · wk3 E1a, E1b · wk4 P2a, P2b · **wk5 P5a** · wk6 P1a–c · wk7 B1, RV1, RV2, QA-X · wk8 P5, QA-R.

**Model rule (Operating Practice II-3) retained:** the authoring session never reviews its own work; reviews are separate sessions. Automated tests are the hard gate; human approval is the final gate.

---

## 3. Budget

| Group | Sessions | USD |
|---|---|---|
| Sonnet 4.6 authoring (F0, HF-1, HF-2, HF-3, HF-4, F1, E1a, E1b, P2a–b, P1a–c, B1, RV1, QA-X) | 16 | 23.50 – 31.50 |
| Haiku 4.5 authoring / QA (REL-HF, QA-HF, P5a, RV2, P5, QA-R) | 6 | 1.70 – 2.80 |
| Haiku 4.5 independent reviews (one per PR) | 18 | 3.60 – 5.40 |
| **Base** | **40** | **28.80 – 39.70** |
| Contingency: 3 rework loops (author + review) | 6 | 5.10 – 6.90 |
| **Total** | **46** | **33.90 – 46.60** |
| **Ceiling (approved with HF-4)** | | **47.00** |

- **Hotfix track** (HF-1…HF-4, REL-HF, QA-HF and reviews): $6.00 – 7.80.
- **Change from v2.2:** HF-4 approved and included; QA-HF added (release gate before the hotfix reaches production). F0 and its review were done within the original estimate.

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
| D17 | HF-4: after an iOS reload, return to the open flight, tab and phase | **Accepted** |
| D18 | How approved releases reach production `PilotBrief`: **A** — Exec copies the three files by GitHub web upload (steps in §7, REL-PROD); **B** — grant the Claude app access to `PilotBrief` with a branch rule that requires your approval on every change, and a Haiku session opens the release PR | **Open** — recommend **A** until the platform release, then review |
| — | Meaning of IA / TA windows in FlightKeys briefings | **Open** — Exec to define before P2b |
| D9 | Archive the undeployed September ruleset v1.2 | **Done** — moved to `90_Old Versions` |
| D11 | Private fixtures repository; names may be redacted before upload | **Accepted** |
| D12 | Keep on re-upload: notes, FCIR/ASAP, parking gate, ATIS, crew-updated times | **Accepted** |
| D13 | Older revision → warn and confirm | **Accepted** |
| D14 | `Revision : NN` right-aligned, left of share button | **Accepted** |
| D15 | BTB/ATB buttons when FCIR/ASAP is on; next upload of same flight number + departure + destination = new flight | **Accepted** — two assumptions to confirm at C5 (ADR-004) |

---

## 7. Session Prompts

### How every session runs

1. **Start a new Claude Code session** and confirm the repository at the top of the setup screen reads **`velocemente/relief-pilot`**. It remembers the last one used; if it shows `PilotBrief`, tap it and change it. Every prompt below also checks this itself (STEP 0) and moves to `relief-pilot` if needed.
2. **Choose the model** named in the *Start* line, paste the prompt, and let it run.
3. When it reports a **PR number**, start the **review** session (Haiku 4.5) with that number in the review prompt.
4. **Review verdict:**
   - **APPROVE-FOR-EXEC** → do *Your check* on the beta app, then merge (companion fixtures PR first, if there is one).
   - **CHANGES-REQUESTED** → paste the review's findings into the authoring session (*"Address these review findings on the same PR: …"*), then run the review again on the same PR number.
5. **Never** give Claude write access to `PilotBrief`, and never merge a PR whose CI is red.

---

### F0 — Foundation

**Status:** ✅ Done — PR #2 merged 29 Oct 2026; independent review APPROVE-FOR-EXEC. Snapshots in `pilotbrief-fixtures` (`snapshots/`). No further action.

---

### HF-1 — NOTAM Year Fixes (DEF-A)

**Status:** PR #3 open — run the review below with number **3**.

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: hf/def-a-notam-year
CONTEXT
Valid NOTAMs are judged "not in effect" at ETA because their validity year is misread.
Measured on 30 packages (pdf.js text): 214 of 3,424 NOTAMs, 118 operationally relevant.
Full analysis: docs/RPT-OFP-LiveDefectDiagnosis v1.1 (add to repo if absent).
SCOPE (Exec decision D8): fix ONLY R1 and R2. No other NOTAM behaviour changes.
R1  In xNW_standalone, inlineRe's trailing-year group (?:\s+(\d{4}))? crosses the
    newline and reads the daily schedule ("1410-2030") as year 1410.
    Fix: (?:[ \t]+(20\d{2})\b)?
R2  Start year is taken from the end/flight year. Fix: when the NOTAM number carries
    /YY, start year = latest year Y in [2000+YY, endYear] such that start(Y) <= end;
    PERM uses the same rule with end = +infinity. No /YY → unchanged.
RULES: READ AND QUOTE xNW_standalone, _parseDateToken, _resolveInlineDateRange first.
 UTC only. No UI change.
TESTS (add to test/): TC-110-001..006 from the diagnosis report §4, plus negatives:
 "- XXXX A0100/26 05JAN0000-30JAN2359" on 2026-01-10 → start 2026-01-05; no-ID → unchanged.
ACCEPTANCE: CI green. Golden snapshot diffs limited to NOTAM activity of R1/R2 items
 (list them); ops-relevant suppressed count 118 → 0.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/3
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: index.html NOTAM validity helpers only (xNW_standalone, _parseDateToken, _resolveInlineDateRange) + tests under test/unit/.
SPECIFIC CHECKS FOR THIS PR
a. Only R1 (same-line 20xx trailing year) and R2 (start year from the NOTAM's /YY issue
   year) are changed; no other NOTAM evaluation behaviour changes (decision D8).
b. Tests live in test/unit/*.test.js (so CI runs them) and cover TC-110-001…006 from
   docs/RPT-OFP-LiveDefectDiagnosis, plus the two negatives in the brief.
c. Golden snapshots should be UNCHANGED (the fix affects NOTAM evaluation at ETA, not
   _ofpRulesetParse output). No companion fixtures PR is expected; if snapshots changed,
   each difference must be explained.
d. Evidence reports the count of operationally relevant NOTAMs wrongly suppressed,
   before vs after (expected 118 → 0 on the 30 Navtech/eOFP packages).
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/3/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, open the RJAA–PANC 11 APR package: the RJAA airport card shows RWY 16L/34R CLSD on its scheduled days. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### HF-2 — Company Remarks Pairing (DEF-B)

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: hf/def-b-remarks
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
 (dumps removed), the trailing-dash cleanup on the 15 genuine remarks (list them), and
 the 4 FlightKeys Company NOTAM blocks the old code mis-filed as remarks (ZUCK and UAAA in
 FK ZUCK–UAAA; UAAA and EHAM in FK UAAA–EHAM) — these are now absent, as intended.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: index.html extractAptOpsNotes() only + tests under test/unit/ + companion snapshot PR.
SPECIFIC CHECKS FOR THIS PR
a. Remarks are read only from each Flight Plan copy's Remarks section, and dashed
   delimiters are treated as (open, close) pairs. No 600-character cap was added (D9).
b. Golden differences are limited to opsNotes: the 9 dump packages listed in
   docs/RPT-OFP-LiveDefectDiagnosis §3.2 lose their dumps; the 15 genuine Navtech
   remarks only lose a trailing dashed line; the 4 FlightKeys blocks mis-filed as
   remarks (ZUCK, UAAA / UAAA, EHAM) disappear. Any other snapshot change =
   CHANGES-REQUESTED.
c. A companion PR in pilotbrief-fixtures exists, and its snapshot changes match (b).
d. Tests cover TC-110-010…012 and the synthetic "CAT line after closing delimiter" case.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, open the RJAA–PANC 11 APR package: RJAA Company Remarks is short (no MEL, crew or fuel text); open an HKG–ANC package: the VHHH "B747 DEPARTURES" remark is still there. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### HF-3 — No Background Network Activity (iOS cellular alert)

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: hf/no-background-network
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: sw.js fetch handler and registration block; one "Check for update" row on the existing Settings screen; tests.
SPECIFIC CHECKS FOR THIS PR
a. In sw.js a cache HIT returns the cached response and starts no fetch of any kind.
   A cache MISS fetches once (install / missing file only).
b. No automatic update check and no connectivity probe were added to app code.
c. "Check for update" uses the existing Settings row style and the existing toast.
d. Registration uses updateViaCache:'all'; the PR explains that iOS may still run its own
   update check on reload, outside the app's control.
e. A unit test with mocked cache/fetch proves (a). CACHE_NAME is NOT changed here.
f. Golden snapshots unchanged (no parser change).
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta with cellular data and Wi-Fi off, move PilotBrief into Slide Over five times: at most one iOS alert. Settings shows "Check for update". Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### HF-4 — Return to the Open Flight After an iOS Reload

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: hf/resume-view
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: index.html navigation/start-up only (store and restore the open view) + tests.
SPECIFIC CHECKS FOR THIS PR
a. The stored view holds only {flightId, screen, tab, phase, scrollY}; all storage
   access is wrapped in try/catch; no flight data is duplicated.
b. Restore re-opens the flight through the existing loadFlight() path; a deleted flight
   falls back to the Flights list; a flight the crew closed is never auto-opened.
c. No visible UI change of any kind.
d. Golden snapshots unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, open a flight on the Enroute phase, move PilotBrief into Slide Over a few times: when iOS reloads it, it returns to the same flight and phase. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### REL-HF — Hotfix Release Version

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Haiku 4.5 · Standard** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Haiku 4.5 · Standard     REPO: velocemente/relief-pilot   BRANCH: rel/1.9.9-hf1
TASK: after HF-1, HF-2, HF-3 and HF-4 are merged: set APP_VERSION '1.9.9-hf1', sw.js
 CACHE_NAME 'pb-v1.9.9-hf1', manifest.json version '1.9.9-hf1'. Add release notes
 (plain language). CI green.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: APP_VERSION in index.html, CACHE_NAME in sw.js, version in manifest.json, release notes. Nothing else.
SPECIFIC CHECKS FOR THIS PR
a. Exactly three version strings change and all read 1.9.9-hf1 (CACHE_NAME 'pb-v1.9.9-hf1').
b. HF-1, HF-2, HF-3 and HF-4 are all merged into main before this PR (check main's history).
c. Release notes are plain language and list the four fixes.
d. Golden snapshots unchanged by this PR.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing on iPad yet; QA-HF follows. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### QA-HF — Hotfix Release Gate (QA)

> **Start (after REL-HF is merged):** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · paste the block below. No review session is needed — this produces a report, not a code change.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; use the latest main; read CLAUDE.md fully.
 This is a READ-ONLY session: no code changes, no PRs.

TASK — hotfix release gate for v1.9.9-hf1 (Operating Practice III-2)
1. Confirm main contains HF-1, HF-2, HF-3, HF-4 and REL-HF (list merge commits).
2. Confirm the latest CI run on main is green; read its output.
3. Confirm APP_VERSION, sw.js CACHE_NAME and manifest.json version all read 1.9.9-hf1.
4. Run locally: node test/check-syntax.js · npm test ·
   node test/golden/run.js compare --fixtures <pilotbrief-fixtures clone> ·
   node tools/extract/verify.js <clone>. All must pass.
5. Confirm every hotfix PR carries a review comment "Verdict: APPROVE-FOR-EXEC".
6. Fill the Release Gate table: ruleset/test gates, syntax, version alignment, open
   S0/S1 defects (none allowed), and the Exec items still to do.
OUTPUT: post the gate report as ONE comment on the REL-HF PR (gh api repos/velocemente/relief-pilot/issues/<REL-HF PR>/comments), first
 line "Gate: GO" or "Gate: NO-GO", then the table. End by telling the Exec, in plain
 language, what remains for C2.
```

> **Your check (C2), after "Gate: GO":** on beta — RJAA RWY 16L/34R CLSD shows; RJAA Company Remarks short; with cellular data off, Slide Over five times gives at most one alert and returns to the open flight; one airplane-mode cold start. Then do **REL-PROD-HF**.

---

### REL-PROD-HF / REL-PROD — Copy an Approved Release to Production

**Method A (D18, recommended for now) — you do it, about 10 minutes in Safari:**
1. Open **github.com/velocemente/relief-pilot** → `index.html` → **Raw** → Share → **Save to Files** (folder *PilotBrief release*). Repeat for `sw.js` and `manifest.json`.
2. Open **github.com/velocemente/PilotBrief** → **Add file → Upload files** → select the three files → commit message `Release 1.9.9-hf1 from relief-pilot <commit>` → **Commit changes**.
3. Wait for the production site to update (a few minutes), open the production app online once, close and reopen it, and confirm Settings shows the new version.

**Method B (only if D18 = B):** grant the Claude app access to `PilotBrief` *with* branch protection on `main` requiring your approval, then run:

> **Start:** new session · repository **velocemente/PilotBrief** (the only session ever started there) · model **Haiku 4.5**.

```
STEP 0 — This session is a PRODUCTION RELEASE. Confirm origin is
 https://github.com/velocemente/PilotBrief. Never push to main.
TASK: copy index.html, sw.js and manifest.json byte-for-byte from
 velocemente/relief-pilot main @ <commit> into a branch release/<version>; verify the
 git object hashes match relief-pilot's; confirm APP_VERSION = CACHE_NAME = manifest
 version = <version>; change nothing else. Open a PR titled "Release <version> from
 relief-pilot <commit>". Do not merge. Report the PR link to the Exec.
```

---

### F1 — Reorganise the Code (no behaviour change)

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: f1/modularise
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: new src/ modules, build/build.js, CI hash step; index.html becomes a generated file.
SPECIFIC CHECKS FOR THIS PR
a. CI proves sha256 of the built index.html equals the previous index.html.
b. Concatenating src/ in the declared order reproduces index.html exactly — reviewer
   spot-checks three module boundaries for edited lines (there must be none).
c. Golden compare, extractor verify and unit tests run against the built file and pass.
d. CLAUDE.md is updated to say edits go to src/, never to the generated index.html.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, use the app normally for two minutes: nothing looks or behaves differently (checkpoint C3). Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### E1a — Engine: PDF Adapter + Format Detector

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/e1a
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: new src/import/ adapter and detector modules + tests. NOT wired into the app.
SPECIFIC CHECKS FOR THIS PR
a. Adapter line text equals the app's existing assembly byte-for-byte on all 32
   fixtures (test output shows 32/32).
b. Detector classifies 30 Navtech/eOFP as atlas-5y and 2 as atlas-fk; mixed and
   truncated synthetic documents are rejected.
c. No change to app behaviour; golden snapshots unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### E1b — Engine: Field Registry, Validation, Provenance, Legacy Output

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/e1b
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: new src/import/ registry, NOTAM record, validation, provenance, toLegacyShape + tests. Not wired into the app.
SPECIFIC CHECKS FOR THIS PR
a. No OFP-layout patterns in this PR (format-free).
b. toLegacyShape(empty) key set equals the legacy _ofpRulesetParse key set; empties match.
c. Cross-check tests pass on the GTI7134 and FlightKeys ZUCK–UAAA numbers in the brief;
   a 1-unit change produces WARN.
d. resolveValidity reproduces the HF-1 rules and only flags (never evaluates) unresolved
   windows (D8).
e. Golden snapshots unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P2a — FlightKeys Profile: OFP Pages

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/p2a
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
THIS SESSION: P2a only (rows 1–42).

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: new atlas-fk profile (OFP pages, rows 1–42 of the field map) + tests. Not wired into the app.
SPECIFIC CHECKS FOR THIS PR
a. Every row 1–42 of docs/…FieldMap is either resolved (with a test quoting the fixture
   line) or returns the legacy empty value with a 'fixture pending' finding — no guesses.
b. Q (Special Qual Airport) flag set for ZUCK, UAAA, UCFM in the FK fixtures, and not for
   EHAM or EBBR.
c. Cross-checks pass on both FK fixtures.
d. Navtech/eOFP golden snapshots unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible yet; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P2b — FlightKeys Profile: Briefings

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/p2b
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
THIS SESSION: P2b only (rows 43–50). IA/TA windows: use only as defined by the Exec in docs/ADR-004 (if still open, keep them as text and do not use them for evaluation).

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: atlas-fk profile: Company NOTAMs, NOTAM briefing, weather briefing, FIR (rows 43–50) + tests. Not wired into the app.
SPECIFIC CHECKS FOR THIS PR
a. The four MANDATORY CHECKS in the brief all pass (ZUCK curfew 0100Z–1300Z; EHAM
   A2476/26 RWY 04/22 CLSD; every release airport has NOTAMs and weather or explicit
   nil; fleet NOTAM filed under no airport).
b. NOTAM validity from FlightKeys ISO dates — no year guessing; duplicates removed by ID.
c. Two-column weather pages: each METAR/TAF is complete and assigned to the right airport.
d. Navtech/eOFP golden snapshots unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible yet; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P5a — FlightKeys on the New Import

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Haiku 4.5 · Standard** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Haiku 4.5 · Standard     REPO: velocemente/relief-pilot   BRANCH: p/p5a
CONTEXT: ADR-004 v1.3. Engine (E1a, E1b) and 'atlas-fk' profile (P2a, P2b) are merged.
 FlightKeys is live; Navtech/eOFP must remain on the existing parser for now.
TASK: in parseOFP(): run the engine's detector. If the profile is 'atlas-fk' → engine
 path (model → validation → legacy output merged into S exactly as today; validation
 FAIL on a safety-critical field → existing warning path with the D2 text; bookmarks
 unchanged until B1). Any other result → today's parser, unchanged.
ACCEPTANCE: CI green; Navtech/eOFP golden snapshots unchanged; both FlightKeys fixtures
 import with NOTAMs, weather, curfews, crew, CAT II/III and MEL populated on beta.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: parseOFP() routing only: FlightKeys → engine; everything else → today's parser.
SPECIFIC CHECKS FOR THIS PR
a. Navtech/eOFP golden snapshots unchanged (proves they still use today's parser).
b. Both FK fixtures import with NOTAMs, weather, curfews, crew, CAT II/III and MEL populated.
c. Safety-critical validation FAIL uses the existing warning path with the D2 text.
d. No other UI change.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** checkpoint **C-FK**: on beta, import both FlightKeys prototypes (and any live FlightKeys package) — NOTAMs, weather, curfews, crew, CAT II/III and MEL all populated. After merge, release to production with REL-PROD (method per D18). Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P1a — Navtech Profile: OFP Core

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/p1a
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
THIS SESSION: P1a scope only.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: atlas-5y profile, P1a scope (identity, fuel, weights, flags, slot chain, exemption, CAT II/III, MEL, crew) + tests. Not wired into the app for Navtech yet.
SPECIFIC CHECKS FOR THIS PR
a. Engine output equals production output for every P1a field on all 30 Navtech/eOFP
   fixtures (the golden comparison for those fields shows zero differences).
b. Slot-time chain keeps all six priorities in the original order (positive and
   negative tests per priority).
c. Every changed pattern anchor is documented with a before/after quote.
d. The atlas-fk profile and the engine are untouched.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P1b — Navtech Profile: Route, ETOPS, TLR

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/p1b
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
THIS SESSION: P1b scope only.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: atlas-5y profile, P1b scope (nav log, TOC, ETOPS/CFS/ETP, POR, tracks, alternate routes, overflight, TLR) + tests.
SPECIFIC CHECKS FOR THIS PR
a. Engine output equals production output for every P1b field on all 30 fixtures.
b. ETOPS entry/exit and every ETP value trace to a quoted fixture line; positive (ETOPS
   fixtures) and negative (non-ETOPS fixture) tests exist.
c. Revisions de-duplicated for field data as today (3-revision GTI8975 fixture).
d. The atlas-fk profile and the engine are untouched.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### P1c — Navtech Profile: Company NOTAMs, NOTAMs, Weather

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/p1c
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
THIS SESSION: P1c scope only.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: atlas-5y profile, P1c scope (Company NOTAMs, remarks, NOTAM records, weather, FIR) + tests.
SPECIFIC CHECKS FOR THIS PR
a. Engine output equals production output for every P1c field on all 30 fixtures — the
   only accepted differences are the ones HF-1 and HF-2 already approved.
b. NOTAM record count per airport equals the count of NOTAM headers (deduplicated by ID).
c. Legacy notams text shape is still produced (the NOTAM engine is unchanged until phase ②).
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible; merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### B1 — Semantic Bookmarks

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/b1
CONTEXT: ADR-004 v1.3 §5; Exec decision D7: PilotBrief bookmarks ALWAYS replace the
 PDF's own outline. The existing bookmark pills render them — read their data
 contract from the getOutline path; do not change the pill component.
TASK: buildBookmarks(model) → ordered list in the ADR taxonomy, with page numbers
 from provenance (absolute PDF pages, never footer numbers); per-airport NOTAM,
 weather and Company NOTAM entries in role order; 'curfew' / 'runway closed' flags.
ACCEPTANCE: each bookmark's page contains its anchor text (test on all fixtures);
 the matched pair yields the same label set.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: engine buildBookmarks() + feeding the existing bookmark pills. Pill component unchanged.
SPECIFIC CHECKS FOR THIS PR
a. Every bookmark's target page contains its anchor text (test on all fixtures).
b. Same label set for the matched pair (Navtech ALA–AMS vs FlightKeys UAAA–EHAM).
c. PilotBrief bookmarks always replace the PDF outline (D7).
d. Bookmark pill component and styles unchanged.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, open one Navtech, one eOFP and one FlightKeys package: the same bookmark set appears in the same order, and each lands on the right page. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### RV1 — Revisions, Kept Crew Entries, Turn-Backs

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Sonnet 4.6 · High** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   BRANCH: p/rv1
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: revision field, same-flight rule, re-upload overwrite/keep logic, older-revision rule, compareRevisions, turn-back flag + tests. No UI.
SPECIFIC CHECKS FOR THIS PR
a. Kept on re-upload: notes, FCIR/ASAP state and events, parking gate, ATIS, every
   crew-edited time (D12) — one test each.
b. Older revision returns 'confirm required' and overwrites nothing until confirmed (D13).
c. compareRevisions compares canonical values and natural keys, never raw text; the
   synthetic test yields exactly the three expected changes.
d. Turn-back flag: next upload with same flight number + departure + destination creates
   a new flight; the original and its FCIR/ASAP record are untouched.
e. No UI change in this PR.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** nothing visible yet (RV2 shows it); merge after APPROVE-FOR-EXEC. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### RV2 — Revision Header, Changes Card, BTB/ATB Buttons, Q Marker

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Haiku 4.5 · Standard** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Haiku 4.5 · Standard     REPO: velocemente/relief-pilot   BRANCH: p/rv2
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

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: UI: Revision field on the OUT/IN row, changes card, older-revision confirm, BTB/ATB buttons, Q marker — existing components only.
SPECIFIC CHECKS FOR THIS PR
a. Only the five listed UI additions appear; all use existing components and styles.
b. "Revision : <n>" sits right-aligned, immediately left of the share button (D14).
c. Changes card: New left, Previous right; hides with the switch and stays hidden after reload.
d. BTB/ATB visible only while FCIR/ASAP is on.
e. Q shown for ZUCK, UAAA, UCFM; not for EHAM, EBBR.
f. esc() on every rendered value.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** checkpoint **C5** on beta: Revision field, changes card (upload two revisions of one flight), kept entries, older-revision warning, BTB/ATB then re-upload opens a new flight, Q on the airport cards. Confirm the two BTB/ATB assumptions in ADR-004. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### QA-X — Cross-Format Parity Audit (QA)

> **Start (after RV2 is merged):** new Claude Code session · repository **velocemente/relief-pilot** · model **Sonnet 4.6** · paste the block below. No review session is needed — this produces a report.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; use the latest main; read CLAUDE.md fully.
 READ-ONLY for app code. The only file you may add is the report, via one docs PR.

MODEL: Sonnet 4.6 · High        REPO: velocemente/relief-pilot   (read-only report)
TASK
1. Golden master green on all Navtech/eOFP fixtures.
2. Matched pair (Navtech ALA–AMS vs FlightKeys UAAA–EHAM): structural comparison per
   §4.4; list every difference and say whether it is a plan difference or an import gap.
3. Safety-critical audit per format: positive, negative and fallback evidence for slot
   time, DOT exemption alternate, CAT II/III, ETOPS entry/exit, block/min fuel, crew,
   airport NOTAM/weather/curfew.
4. Every fixture: self-check findings listed; zero silent empties.
5. Write "SME review pack": 3 flights, side-by-side key fields per format, for Exec C4.
6. Do NOT change app code. If you find a defect, list it with severity and evidence;
   it is fixed in a separate session.
OUTPUT: open ONE PR on relief-pilot adding docs/RPT-QA-RUN111-CrossFormat.md (first line
 "Audit: GO" or "Audit: NO-GO"; findings table S0–S4; the SME review pack). No crew
 names in the report — use the redacted fakes from tools/redact. Do not merge. Tell the
 Exec, in plain language, the verdict and what to look at in the SME pack.
```

> **Your check (C4):** read the SME review pack in the report PR (about 45 minutes), compare the sample briefings, and merge the report PR if you agree with "Audit: GO". Any finding you disagree with: reply on the PR.

---

### P5 — Full Switch-Over

> **Start:** new Claude Code session · repository **velocemente/relief-pilot** (confirm it at the top of the setup screen before starting) · model **Haiku 4.5 · Standard** · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; branch from the latest main; read CLAUDE.md fully
 before changing anything.

MODEL: Haiku 4.5 · Standard     REPO: velocemente/relief-pilot   BRANCH: p/p5
TASK: Navtech/eOFP now also use the engine ('atlas-5y'), as FlightKeys has since P5a:
 detect → profile → model → validation → legacy output merged into S exactly as today;
 reject or SC FAIL → existing warning path (D2 text); bookmarks from B1; revision and
 turn-back handling from RV1/RV2. Keep the legacy parser in the bundle, unused, for one
 release.
 Version bump aligned in index.html, sw.js, manifest.json.
ACCEPTANCE: CI green; one package per format imports on beta.

PULL REQUEST (on velocemente/relief-pilot only)
- Use .github/pull_request_template.md: What changes for crews · Evidence · Risk ·
  How to check on iPad — plain language, no crew names or fixture text.
- If golden snapshots change: run `node test/golden/run.js update --fixtures <clone>`,
  push the snapshots to velocemente/pilotbrief-fixtures on a branch with the SAME
  name, open a PR there, and link the two PRs both ways.
- Never merge your own PR. Never edit files outside the stated scope.
- Finish by reporting: the PR number and link, the CI result, and any companion
  fixtures PR.
```

> **Review — after the authoring session reports its PR number:** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · replace `<number>` (and `<number>` in the URL) · paste the block below.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 You are reviewing https://github.com/velocemente/relief-pilot/pull/<number>
 If this session is attached to velocemente/PilotBrief (PRODUCTION) or anything
 else: add velocemente/relief-pilot to this session with push access (needed only
 to post the review comment) and review there. Never review, comment on or change
 PilotBrief. Read CLAUDE.md in relief-pilot before reviewing.

You did NOT write this PR. Review only: do not push commits, do not merge.
STANDARD CHECKS
1. CI: the "test" check is green; open and read its output, not just the badge.
2. Scope: list every file changed; flag any file or function outside the scope below.
3. Golden snapshots: every snapshot difference is listed and explained in the PR's
   Evidence section. If the PR links a companion PR in velocemente/pilotbrief-fixtures,
   review it too: each snapshot change must match a listed difference.
4. Safety-critical fields (slot time, DOT exemption alternate, CAT II/III, ETOPS
   entry/exit, block/min fuel, crew, airport NOTAM/weather/curfew): any change has a
   positive AND a negative test.
5. UTC only; esc() on every newly rendered string; no new UI unless the brief allows it;
   no network activity added to app code.
6. No crew names, employee numbers or fixture text in the PR, its files or comments.
7. "What changes for crews" is accurate and understandable by a non-engineer;
   "How to check on iPad" has at most 5 steps and matches the change.
SCOPE OF THIS PR: parseOFP() routing for Navtech/eOFP to the engine; legacy parser kept but unused; version bump.
SPECIFIC CHECKS FOR THIS PR
a. Golden snapshots unchanged for all 30 Navtech/eOFP fixtures (engine output equals
   legacy output), apart from differences already approved.
b. Legacy _ofpRulesetParse remains in the bundle, not called.
c. APP_VERSION = CACHE_NAME = manifest version (new release version).
d. QA-X report merged with "Audit: GO" before this PR.
OUTPUT: post ONE comment on the PR (gh api repos/velocemente/relief-pilot/issues/<number>/comments):
 first line "Verdict: APPROVE-FOR-EXEC" or "Verdict: CHANGES-REQUESTED", then a
 numbered findings table (severity S0–S4 · file:line · evidence · required fix).
 Any S0/S1 finding, failing CI, or unexplained snapshot change = CHANGES-REQUESTED.
 Finish by telling the Exec the verdict in two sentences of plain language.
```

> **Your check, after APPROVE-FOR-EXEC:** on beta, import one package of each format; briefing looks right. QA-R follows. Then on GitHub: open the PR → **Merge pull request** → **Confirm merge** (merge any companion fixtures PR first).

---

### QA-R — Release Gate (QA)

> **Start (after P5 is merged):** new Claude Code session · repository **velocemente/relief-pilot** · model **Haiku 4.5** · paste the block below. No review session is needed.

```
STEP 0 — REPOSITORY CHECK (do this before anything else)
 Run: git remote get-url origin
 It must be https://github.com/velocemente/relief-pilot (development and beta).
 If it is velocemente/PilotBrief (PRODUCTION) or anything else: STOP. Do not
 branch, commit, push or open a PR there. Add velocemente/relief-pilot to this
 session with push access, clone it, and continue there.
 Then: git fetch origin main; use the latest main; read CLAUDE.md fully.
 READ-ONLY for app code.

TASK — platform release gate (Operating Practice III-2), RUN-111
1. Confirm main contains every planned PR (F1 … P5) and each carries a review comment
   "Verdict: APPROVE-FOR-EXEC"; confirm QA-X report says "Audit: GO".
2. Latest CI on main green; run locally: check-syntax, npm test, golden compare,
   extractor verify — all pass.
3. Version alignment: APP_VERSION = CACHE_NAME = manifest version.
4. No open S0/S1 findings in any review or in the QA-X report.
5. Fill the Release Gate table and list the Exec items for C6 (airplane-mode cold start,
   one package per format).
OUTPUT: open ONE PR adding docs/RPT-QA-RUN111-ReleaseGate.md (first line "Gate: GO" or
 "Gate: NO-GO"). Do not merge. Tell the Exec the verdict in plain language.
```

> **Your check (C6), after "Gate: GO":** airplane-mode cold start on beta, one package of each format; merge the gate report PR; then **REL-PROD** (method per D18) to put the release into production.

---

### Follow-up housekeeping

**Status:** ✅ Done — v2.3 added to `docs/` and the field-map §2.7 sentence restored, in the docs PR opened 29 Oct with this version.
