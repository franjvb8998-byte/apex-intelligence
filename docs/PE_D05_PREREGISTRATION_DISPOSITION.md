# Probability Engine — D-05 Preregistration Disposition

## 1. Document control

| Field | Value |
| --- | --- |
| Decision ID | D-05 |
| Title | Disposition of the RC2 5C.1 candidate pre-registration |
| Status | OWNER-APPROVED DISPOSITION — AMEND |
| Date of the owner decision | 2026-11-11 |
| Date of this record | 2026-11-11 |
| Date of the section 13 consolidation | 2026-11-17 |
| Date of the limited documentary ratification record | 2026-11-19 |
| Repository | `C:\Projects\apex-intelligence` |
| Branch | `main` |
| Baseline commit | `14c10fec9e49758bbca88a43079ef79ac88902a0` (`14c10fec`) |
| Baseline check | Before this file was added, `HEAD`, `main`, and `origin/main` were that commit and `git status --porcelain` was empty. |
| Scope | The owner’s disposition of `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` (RC2 5C.1). |
| What this record is | The repository record that the owner selected AMEND on 2026-11-11, the record of the methodological decisions in section 13, and the record of the later limited documentary ratification in section 6. |
| What this record is not | An edit of 5C.1. Blanket approval of unresolved addendum sentences. A new numeric threshold. A scoring population. Authorization to capture, score, acquire, or promote. A declaration that Research Complete has been achieved. Execution readiness. |

D-01 required a written D-05 disposition of ACCEPT, AMEND, or RETIRE before 5C.1 can be the accepted study (`docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` lines 109–112 and 203). D-04 left that disposition pending (`docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` lines 39 and 276). This file is the later disposition. It does not edit D-01 or D-04. Sentences in those files that call D-05 undecided or pending are the status of those files at their own baselines.

The prospective governance addendum required by section 6 is `docs/calibration/RC2_5C_PREREGISTRATION_GOVERNANCE_ADDENDUM.md`. Its status is **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY.** Approval of AMEND does not approve unresolved sentences in that file. Section 6 states the ratified scope.

No file under `data/calibration/` or `data/prospective/` was listed, hashed, or read while writing this record. No test, build, scoring job, simulation, acquisition, or live provider was run. No source file and no existing document was edited. The candidate-manifest digest was not recomputed.

## 2. Decision register

The owner approved AMEND on 2026-11-11, at the baseline in section 1, for the scope in section 1. The fourteen points below are that decision. Section 13 records later methodological decisions. It does not replace these fourteen points.

1. **Decision identity.** D-05. Date 2026-11-11. Baseline `14c10fec9e49758bbca88a43079ef79ac88902a0` on `main`, aligned with `origin/main` at preflight. Scope is the disposition of RC2 5C.1 only.
2. **ACCEPT unchanged was rejected.** The owner did not accept 5C.1 unchanged as the sole methodological authority for a later unseen study.
3. **AMEND was selected.** 5C.1 remains the frozen candidate pre-registration. A separate prospective methodological supplement is required before that pre-registration can serve as the accepted study.
4. **RETIRE was not selected.** 5C.1 is not closed. No replacement protocol is opened by this record. D-01’s statement that RETIRE is not Research Complete is untriggered, because RETIRE was not the disposition (`docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` lines 38 and 111–112).
5. **RC2 5C.1 remains frozen and unedited.** Its status line remains **FROZEN FOR REVIEW — no unseen outcomes scored** (`docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` lines 1–7 and 189–193). This disposition does not rewrite that file.
6. **The five arms remain.** `CONTROL_PRODUCTION`, `CANDIDATE_A_INPUT`, `CANDIDATE_B_TRANSFORM`, `CANDIDATE_C_COMBINED`, and `CANDIDATE_D_COMBINED_HIGH_EQUAL`. No sixth arm. Section 5 names them. Their formulas stay the formulas already written in 5C.1 sections 4–8.
7. **No formula or parameter promotion is authorized.** No value of S, blend weight, draw base, home advantage, shrinkage k, Dixon-Coles ρ, λ3, a HIGH_EQUAL multiplier, role bases, or a goal-difference formula is promoted. Arm D’s registered T1 operator is not promoted by being registered, and it is not promoted by this disposition.
8. **A separate prospective governance addendum is required.** The path from AMEND to an accepted study needs a methodological supplement. The draft at the path in section 1 is the document proposed for that role. Section 13 records later owner decisions on P-1, part of P-2, P-3, and P-5. Those decisions do not approve the draft. Sentences in the draft that section 13 does not record are not decisions of this file.
9. **The addendum needs an independent audit and explicit owner approval.** At the 2026-11-11 decision, it becomes the accepted methodological supplement only after both. This writing task is the draft’s creation. It is not that audit, and it is not that approval. Section 6 records the later limited documentary ratification. That record is not acceptance of the addendum as the methodological supplement, and unresolved sentences remain unbound.
10. **No scoring population is approved.** This record names no season, competition extract, or fixture set as the unseen scoring population.
11. **D-04 remains binding.** Option 1, both clarifications, the fail-closed eligibility rule, and the protected-population restrictions stand (`docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` sections 2, 3, 7, 8, and 9). Sections 7, 8, and 9 remain fully binding. This disposition does not relax them and does not resolve the unknowns in D-04 section 12.
12. **Capture and scoring require separate authorization.** Each must name its own files and action. This disposition is neither authorization. D-01 already states that writing D-05 would still need a separate authorization before any scoring run (D-01 line 122). D-04 repeats that scoring stays separately authorized (D-04 lines 215 and 289).
13. **D-01 Research Complete remains NOT ACHIEVED.** Clause 3 is not satisfied by recording AMEND alone. Gate B remains unmet (D-01 lines 124 and 172–176). Gate A remains unpassed (D-01 line 170). Gate D remains not achieved (D-01 lines 186–188). The completion status remains NOT ACHIEVED (D-01 lines 10 and 30–31).
14. **The disposition does not establish execution readiness.** No capture run, scoring run, live discovery, or production change becomes ready because AMEND is recorded.

Points 8 and 9 record the 2026-11-11 requirement for a separate addendum and the status of that text at that decision. Section 6 records the later limited documentary ratification. That later record does not rewrite these fourteen points and does not authorize capture, scoring, or promotion.

## 3. Effect on the accepted-study path

D-01 says ACCEPT or AMEND is the path on which 5C.1 can become the accepted study (lines 110–112). AMEND is now the recorded choice, so that path is the one the owner selected.

The path is not complete. Section 6 records the limited documentary ratification. An accepted study still requires all of the following, and this file grants none of them:

- blanket approval of unresolved addendum sentences;
- a scoring population that satisfies D-04;
- a separate capture authorization, if capture is the design used;
- a separate scoring authorization;
- a scored unseen evaluation that does not yet exist.

5C.1’s own promotion wording is not a promotion (D-01 line 203). This disposition does not apply those rules to any outcome.

## 4. What was not selected

ACCEPT unchanged would have left 5C.1 sections 14–18 as the sole methodological authority, including the undefined phrases “not worse” and “not materially worse”. The owner rejected that option.

RETIRE would have closed 5C.1 only. The owner did not select RETIRE. No successor protocol is identified, frozen, or accepted here. D-01 does not assign an identifier to a post-RETIRE replacement, and this file does not create one.

Keeping the five registered arms is part of AMEND. Retiring an arm, adding an arm, or changing a registered constant would be a different decision.

## 5. Frozen arms

These identities are the 5C.1 set. This table does not restate their constants as a second authority. The definitions remain 5C.1 sections 4–8 and the manifest those sections name.

| Arm | ID | Where the definition remains |
| --- | --- | --- |
| CONTROL | `CONTROL_PRODUCTION` | 5C.1 section 4, lines 29–50 |
| A | `CANDIDATE_A_INPUT` | 5C.1 section 5, lines 52–62 |
| B | `CANDIDATE_B_TRANSFORM` | 5C.1 section 6, lines 64–71 |
| C | `CANDIDATE_C_COMBINED` | 5C.1 section 7, lines 73–79 |
| D | `CANDIDATE_D_COMBINED_HIGH_EQUAL` | 5C.1 section 8, lines 81–94 |

5C.1 section 9 freezes exactly five arms and forbids a sixth, a grid, and adaptive creation after prospective results begin (lines 96–98). The manifest module is `lib/debug/calibration/prospective/candidate-config.ts`. The documented fingerprint string in 5C.1 lines 108–110 is `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`. This record does not recompute it.

The production base commit named by 5C.1 remains `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on branch `develop` (5C.1 lines 13–17). This disposition’s baseline, `14c10fec`, is the commit at which the disposition was written. It is not a substitute for that production pin.

## 6. Required addendum — limited documentary ratification

AMEND requires a prospective governance addendum because 5C.1 leaves comparison phrases, confidence bases, materiality, and several secondary diagnostics without a binding reading precise enough to apply before outcomes are seen. Supplying that reading inside 5C.1 would edit a frozen file. This disposition does not do that.

The addendum is:

`docs/calibration/RC2_5C_PREREGISTRATION_GOVERNANCE_ADDENDUM.md`

Its status is **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY.**

The task that supplied this ratification did not state a separate decision date. This file does not invent one. The date of this ratification record is 2026-11-19. The AMEND decision date remains 2026-11-11. The section 13 consolidation date remains 2026-11-17.

The owner ratified the addendum solely as the governance record of decisions already approved. The ratified scope is only:

- the D-05 AMEND disposition;
- P-1 strict separate log loss and Brier comparisons on identical evaluated fixtures;
- P-2 descriptive definitions and the calibration-conflict rule, with the remaining P-2 criteria unapproved;
- P-3 multiplicity and uncertainty disclosure principles;
- P-5 checkpoints at N = 100 and N = 250 as descriptive review, and N ≥ 500 as the first possible promotion review, without promotion;
- the L-B clarification that the precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**.

Sentences in the addendum marked **OPEN / UNAPPROVED** or **PROPOSED, NOT YET APPROVED** stay unapproved. Section 13 remains the record of the named methodological decisions. This ratification does not edit 5C.1. It does not approve a scoring population, season 2026, capture, scoring, promotion, production activation, or Research Complete. D-04 sections 7, 8, and 9 remain fully binding. Frozen 5C.1 stays separate from later protocol text.

## 7. Population governance left in D-04’s hands

D-04 Option 1 remains the population decision. In particular, and without narrowing D-04:

- RC2 Premier League 2023, 2024, and 2025 stay used and cannot be called unseen (D-04 section 6; freeze lines 18–26; 5C.1 lines 19–27).
- PE-4 provider-season 2025, calendar-2025 UTC kickoff restrictions, and the GOALS 2025 reservations remain protected on their own texts (D-04 section 7).
- Unknown fixture-level overlap stays ineligible for future unseen-outcome validation until a separate authorized protocol establishes eligibility (D-04 section 8).
- Provider season is not inferred from the calendar (D-04 line 216; `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` lines 48–54).

No sentence in a capture runbook, and no source constant that names a season, becomes a scoring population by this disposition. D-04 section 9 states conditions for a later validation and does not authorize one.

## 8. Capture, scoring, and execution

Time-prospective capture remains the preferred design already written in the freeze (lines 54–59) and in 5C.1 (lines 176–181). Preference is not authorization.

5C.3 remains a protocol frozen for live-authorization review. Its own status line says no real fixtures were collected, no predictions were captured, and no outcomes were scored (`docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` line 325). This disposition does not move that status to authorized.

Execution readiness would require, at least, a D-04-eligible population decision for the actual window and separate capture and scoring authorizations. Section 6 records a limited governance record and does not supply that readiness. Section 2, point 14, records that this file does not supply that readiness. Section 13 does not supply it either. No component is declared ready here.

## 9. Research Complete

D-01’s completion status remains **NOT ACHIEVED**.

Recording AMEND removes only the “D-05 is undecided” part of gate B. Gate B still requires the accepted study to be scored on unseen outcomes. The limited ratification in section 6 records the decisions already approved and does not create that score. No such score exists. Approving a disposition is not that score. Section 13 does not score gate B.

This file does not pass gate A (D-01 line 170), does not award gate C, and does not achieve gate D (D-01 lines 186–188).

## 10. Explicit non-authorizations

This document does not authorize any of the following.

- Editing 5C.1, the prospective freeze, the 5B findings, 5C.3, D-01, D-04, the continuity document, or any source file.
- Treating the limited ratification as blanket approval of unresolved addendum sentences, or as authority to apply an open criterion.
- Approving a scoring population, including any season named in a runbook or a source constant.
- Opening, reading, listing, hashing, unsealing, or scoring protected outcome datasets.
- Live API-Football acquisition, a discovery call, or use of an offline path as a live client.
- A capture run or a scoring run.
- Parameter promotion, or promotion of any registered arm.
- Adding, removing, or altering a candidate arm or a registered constant.
- A new numeric promotion cutoff, tolerance, or significance threshold. Section 13 approves no tolerance and no significance threshold.
- Treating section 13 as promotion, as a materiality rule, as a pathology rule, as a superiority rule, or as a completed promotion review.
- Verifying or authorizing season 2026.
- Amending 5C.1, the freeze, or a later protocol retroactively. 5C.1’s frozen text stays separate from later protocol text.
- PE-6, PE-7, or a Betting Analyzer. Those names stay unused. Any betting-surface status remains D-08, as D-01 left it (D-01 lines 41 and 218).
- Setting `PE3C_C0_RECON_ACTIVATION`, `PE4I21_PRODUCTION_WIRING`, `PE5_PRODUCTION_WIRING`, or a live-provider flag to true.
- A declaration that Research Complete has been achieved.
- Implementation, tests, builds, configuration changes, commits, or pushes.

A later owner authorization has to name the files and the action in scope. Approval of AMEND authorizes this written disposition and further reading of it. Section 6 records the limited documentary ratification and does not authorize capture, scoring, population selection, season 2026, or promotion. Section 13 records the named methodological decisions and does not authorize those actions either.

## 11. Evidence

Grades used here:

| Grade | Meaning |
| --- | --- |
| READ AT THIS BASELINE | The cited lines were read in the working tree at `14c10fec` while writing this file. They were not executed. |
| OWNER DECISION | The approval recorded in section 2, section 6, or section 13. Section 6 ratifies the addendum only as the limited governance record. Section 13 does not approve unresolved addendum sentences. |
| HISTORICAL VERDICT | A conclusion already recorded by 5C.1, the freeze, D-01, or D-04. Not re-executed. |

| Proposition | Source | Lines | Grade |
| --- | --- | --- | --- |
| D-05 must be ACCEPT or AMEND before 5C.1 can be the accepted study; RETIRE is not Research Complete; writing the disposition is not a scoring authorization | `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` | 38, 109–112, 122, 203 | READ AT THIS BASELINE |
| Research Complete is not achieved; gate A is unpassed; gate B is unmet while the unseen study remains open | same | 10, 30–31, 124, 170, 172–176, 186–188 | READ AT THIS BASELINE |
| D-04 left D-05 pending and left gate B unmet | `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` | 39, 214–216, 276–279 | READ AT THIS BASELINE |
| D-04 fail-closed rule and protected populations remain the population decision | same | sections 6–9 | READ AT THIS BASELINE |
| 5C.1 status, five arms, fingerprint, metrics, promotion wording, and the prohibition on live collection in 5C.1 | `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | 1–7, 13–17, 19–98, 102–110, 133–166, 176–193 | READ AT THIS BASELINE |
| Freeze: used Premier League seasons, preferred prospective design, metrics, no promotion at N = 100 | `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 18–26, 50–66, 71–79, 95–109 | READ AT THIS BASELINE |
| 5C.3: provider season unverified; do not infer it from the calendar; PL 2023–2025 excluded; protocol not a completed capture | `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | 48–62, 325 | READ AT THIS BASELINE |
| Owner selection of AMEND, rejection of ACCEPT unchanged, and non-selection of RETIRE | This file, section 2 | — | OWNER DECISION |
| P-1 approved; P-2 partially approved; P-3 approved; P-5 approved; P-4 unused; materiality, pathology, superiority, and promotion criteria unapproved; addendum ratified only as the limited governance record | This file, sections 6 and 13 | — | OWNER DECISION |

The fingerprint string is cited from 5C.1. It was not recomputed. No outcome was scored.

## 12. Limits of this record

- AMEND is an owner decision recorded here. Section 13 records the later methodological decisions named there. Decisions not named in section 13 remain open. Section 6 records the limited documentary ratification of the addendum as the governance record of decisions already approved. Unresolved addendum sentences remain unapproved.
- D-01 and D-04 still contain sentences that D-05 is undecided or pending. Those sentences are historical text in those files. This file is the later disposition and does not edit them.
- Gate A remains unpassed. Gate B remains unmet. Research Complete remains not achieved.
- No sealed outcome file was opened. No live provider was contacted. No test was run.
- The addendum’s limited ratification covers the decisions section 6 lists. A sentence the addendum marks open or proposed has no force. Section 13 has authority only for the decisions it records. Neither section edits 5C.1.

## 13. Recorded methodological decisions

The task that supplied this section did not state a separate decision date. This file does not invent one. The consolidation date is 2026-11-17. The AMEND decision date remains 2026-11-11.

These points are owner decisions. They bind only as written here. They do not approve unresolved addendum sentences. Section 6 records the later limited documentary ratification. This section does not close an open item in section 13.5. They do not edit 5C.1, the freeze, 5C.2, 5C.3, 5C.6, 5C.7, D-01, or D-04. They do not amend a frozen protocol retroactively. 5C.1’s frozen text stays separate from later protocol text. D-04 sections 7, 8, and 9 remain fully binding. Season 2026 is not verified and is not authorized. No scoring population, capture, scoring run, promotion, or production activation is approved. Research Complete remains not achieved.

CONTROL remains `CONTROL_PRODUCTION`. Candidates A–D remain `CANDIDATE_A_INPUT`, `CANDIDATE_B_TRANSFORM`, `CANDIDATE_C_COMBINED`, and `CANDIDATE_D_COMBINED_HIGH_EQUAL`. Their formulas and parameters remain the formulas and parameters in 5C.1 sections 4–8. The checkpoints remain `N = 100`, `N = 250`, and `N = 500`.

P-4 is unused. The gap is intentional. No proposal was removed, renumbered, or given a new meaning to fill that number.

### 13.1 P-1 — approved

Compare log loss and Brier separately against `CONTROL_PRODUCTION`, on identical valid fixtures.

P-1 requires the candidate and CONTROL to be evaluated over the exact same evaluated fixture set. The same fixtures enter the candidate mean and the CONTROL mean. Each candidate is compared with CONTROL on the exact same evaluated fixture set for that comparison. The precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**. This clarification does not incorporate 5C.6, 5C.7, or any later-protocol rejection rule into frozen 5C.1. This section adds no new predicate, no new epsilon, no tolerance, no numerical threshold, no scoring rule, no promotion criterion, and no rescaled Brier.

For each of log loss and Brier:

- Delta = candidate minus CONTROL.
- The comparison requires delta ≤ 0.
- Delta = 0 meets the requirement.
- Delta > 0 means the requirement is not met on that metric.
- No numerical tolerance is approved.

The comparison excludes N = 0. Empty-sample zeros are sentinels. A difference of zero between sentinels is not a result. The exclusion is the sample count. The same sentinel rule covers a returned ECE of 0 at N = 0. That zero is not evidence of perfect calibration. P-1 still does not compare ECE.

The comparison is a comparison of point estimates. It does not claim statistical significance. It is not a superiority finding and it is not promotion. ECE is outside P-1. Meeting delta ≤ 0 on both metrics does not promote an arm.

Where the log-loss result and the Brier result conflict, the result is **INCONCLUSIVE / REQUIRES REVIEW**. A decision that still depends on a criterion section 13.2 leaves open has the same result.

### 13.2 P-2 — partially approved

The approved part is descriptive. It writes no cutoff.

1. **ECE.** Use the existing 10 equal-width argmax-probability bins. The binned quantity is the maximum 1X2 probability. Stored entropy confidence is a different quantity. This reading does not edit the 5C.6 or 5C.7 sentences that call those bins confidence, and it does not claim those protocols already say “argmax probability.”
2. **High confidence.** The rates at or above 0.80, 0.90, and 0.95 use the maximum 1X2 probability. Reports distinguish that probability from stored entropy confidence. No new confidence formula is approved.
3. **Class bias.** Mean predicted probability minus observed frequency, separately for home, draw, and away. The approved quantity is that signed difference. No pass or fail cutoff is approved.
4. **Temporal stability.** Chronological descriptive reporting. The periods are defined before viewing outcomes. This section does not name the periods. No pass or fail cutoff is approved.
5. **HIGH_EQUAL.** Compare arm D with arm C on identical valid fixtures. The comparison includes O/E and includes deterioration where deterioration is present. No cutoff for that deterioration is approved.

A calibration conflict that is relevant to a decision remains **INCONCLUSIVE / REQUIRES REVIEW** until materiality criteria are approved before viewing unseen outcomes. Approving those criteria after outcomes have been viewed is outside this decision.

The following remain **OPEN / UNAPPROVED**:

- materiality criteria, including the meaning of “not materially worse” for ECE;
- pathology criteria, including the meaning of “no new pathological ≥90/≥95 behavior”;
- superiority criteria;
- promotion criteria;
- any cutoff for class bias, temporal stability, useful direction, LOW_EQUAL degradation, proper-score degradation, or class-calibration pathology;
- the period boundaries for the chronological report;
- the prospective cell identity of LOW_EQUAL;
- the precise fixture inclusion and validity predicate for the evaluated fixture set on which P-1 compares a candidate with CONTROL.

### 13.3 P-3 — approved

Later reports disclose multiple comparisons. They distinguish point estimates from statistical superiority. A point estimate is not statistical superiority.

No significance claim is made without a procedure that was prespecified and then executed. This decision prespecifies no such procedure and does not execute one. No new test and no new threshold is approved. No multiplicity adjustment, confidence-interval procedure, hypothesis test, bootstrap count, or non-inferiority margin is chosen.

### 13.4 P-5 — approved

N = 100 and N = 250 are descriptive review only. They are not a promotion review. They do not modify candidates and they do not promote.

The first possible promotion review is at N ≥ 500 valid comparable fixtures per candidate. Valid comparable fixtures are the identical valid fixtures in section 13.1 for that candidate against CONTROL. “Per candidate” follows 5C.1’s checkpoint wording. This decision does not replace that wording with a later protocol’s unique-fixture count.

The review is never automatic promotion. Opening it does not promote an arm.

`ABOVE_500` satisfies the count condition only. It satisfies that condition only when the count is a count of valid comparable fixtures per candidate. The code label alone does not establish that the fixtures were valid and comparable. `ABOVE_500` is not promotion clearance.

Where metrics conflict, or where a criterion the review needs is unresolved, the result is **INCONCLUSIVE / REQUIRES REVIEW**. While section 13.2’s open criteria remain open, a promotion review cannot conclude in promotion.

The code flag `formalReviewAvailable` at N ≥ 100 is not this promotion review.

### 13.5 Governance that this section does not decide

The following remain **OPEN / UNAPPROVED**. Maintaining them as open is part of this decision.

- Blanket approval of addendum sentences outside the limited governance record in section 6. Proposed rules, unresolved criteria, and future execution steps remain unapproved.
- A scoring population.
- Season 2026. It is not verified and it is not authorized.
- Capture authorization and scoring authorization.
- Post-capture settlement of an already stored pending record.
- Verification of the load-time manifest digest against the documented hex.
- Any numeric tolerance, materiality cutoff, pathology cutoff, superiority cutoff, promotion cutoff, or significance threshold.
- The precise fixture inclusion and validity predicate for the evaluated fixture set in section 13.1.
- P-4. It remains unused.
