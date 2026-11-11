# Probability Engine — D-01 Research Complete Definition

## 1. Document control

| Field | Value |
| --- | --- |
| Decision ID | D-01 |
| Title | Probability Engine — Research Complete |
| Status | OWNER-APPROVED DEFINITION |
| Completion status | NOT ACHIEVED |
| Repository | `C:\Projects\apex-intelligence` |
| Branch | `main` |
| Baseline commit | `01684fb3230738f76058d54364768bb4657bc737` (`01684fb`) |
| Baseline check | Before this file was added, `main` and `origin/main` were that commit and `git status --porcelain` was empty. |
| Scope | Research-milestone definition only. |
| Date of this record | 2026-11-10 |
| What this record is | The repository ratification of the corrected five-clause definition. |
| What this record is not | A declaration that the Probability Engine is Research Complete. A phase closure. A parameter promotion. An authorization to implement, score, activate, deploy, or contact a live provider. |

The continuity document, `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md`, remains a provisional map. Its own control block (lines 3–12) audits commit `ceb9d4d770a2733d49cb601ceda8df0cc30469f8`. Commit `01684fb` adds that file and no other file. This ratification does not edit the continuity document. Section 13 of that file stays labeled PROPOSED in that file. The owner has approved the five clauses in section 2 of this file, not section 13.A–G of the continuity document, as the meaning of D-01.

The phrase “research-complete” in `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` line 7 is a feature-contract close. It is not this decision and it is not Probability Engine Research Complete.

No sealed 2025 outcome file was opened, read, unsealed, or scored while writing this record. No test, build, generator, or live provider was run.

## 2. Owner decision

The owner has approved the corrected five-clause definition proposed by the second independent D-01 audit.

That approval accepts the completion criteria below. It does not find that the criteria have been met. The Probability Engine is not Research Complete.

The second audit is not a file in this repository. This document is the repository record of the wording the owner approved. The five clauses below are that wording. A later section of this file applies them to repository evidence. It does not add a sixth scientific requirement and it does not relax a clause.

**Probability Engine — Research Complete** means all of the following.

1. **Formula fidelity.** The shipping 1X2, Over/Under 2.5, truncation, blend, and entropy confidence match `docs/PROBABILITY_ENGINE.md` and `EloPoissonHybridEngine` at a named commit. Research models are not described as that engine.
2. **Deferred mathematics, stated narrowly.** Dixon-Coles ρ, per-league refits of μ and w, temporal Elo, and `EloRatingProvider` are outside this milestone. Dixon-Coles is deferred because 5C.1 forbids it and because no production ρ was selected. GOALS-1F.1 was an audit with `noDixonColesFit: true`, not a fitted rejection for the product engine. The pre-registered catalogue questions — role bases, shrinkage, goal-difference term, and S, as assigned in 5C.1 arms A–D — stay inside the validation study until D-05 retires that pre-registration and a replacement is frozen.
3. **Mandatory unseen evaluation.** The milestone is reached only after D-05 is recorded as ACCEPT or AMEND, D-04 names the populations without opening sealed files, and the accepted study is scored on outcomes that the freeze classifies as unseen. The report includes the production CONTROL arm. Metrics remain log loss, Brier, and ECE, reported separately, under the promotion rules already written in 5C.1. N = 100 is not sufficient. No new threshold is added here. RETIRE closes 5C.1 only. RETIRE is not Research Complete. Time-prospective capture is the preferred design. Another historical season qualifies only under the three conditions in the freeze, lines 61–65. PL 2023, 2024, and 2025 do not qualify.
4. **Offline programs, scoped.** PE-3’s recorded C0 acceptance stands and is not repeated. PE-4I.21’s feature-foundation close stands, and `resolvePe4HistoricalExpectation` remains unavailable. GOALS k = 10 remains a research backbone with its 2025 holdout unevaluated. PE-5.2 is not called closed. PE-5.3D stands as an offline probe. PE-5.4B’s live NO-GO stands. The historical PE-5.4C offline GO stands only for the offline boundary, including in-memory durability, no crash recovery, no live flag, and the four recorded LOW behaviors. Missing PE-5.4C closure markdown does not erase that historical GO and does not extend it. RC2 5B remains diagnostic. RC2 5C.1 remains an unscored pre-registration until clause 3 happens.
5. **Boundary.** Squad evidence is not a model feature of this milestone. A later decision to make it one is a new pre-registered study. PE-6 and PE-7 have no specification and are unused names. Live acquisition, production wiring, C0 activation, `PredictionPipeline`, and a Betting Analyzer are outside this milestone. The original pipeline and calibrator path remains a production-readiness obligation. Copilot’s existing value scan is not authorized by this definition. It remains on its current contract. A future clause 3 score does not validate that scan, does not make it a Betting Analyzer, and does not authorize a change to Copilot code or behavior. Any betting-surface status remains D-08. No parameter is promoted by ratifying this paragraph.

The owner’s approval makes these five clauses the binding definition. That approval is not evidence that clause 1 has been verified at a named commit, and it is not evidence that clause 3 has been scored. Clause 3 is the unmet pass condition of the milestone. Clauses 2 and 5 bind now as exclusions. They do not close the milestone, and they do not authorize the work they place outside it.

Two readings are part of applying the approved text. They are not extra clauses.

- Clause 1 is satisfied only when an independent verification record shows the match at a named commit. This file is not that record.
- RETIRE of 5C.1 does not satisfy clause 3. Clause 2 already requires a frozen replacement before the pre-registered catalogue questions leave the study. A replacement protocol would be required before any later unseen scoring. This document does not write that protocol. Acceptance of that replacement requires a new written owner decision. That decision is not a reuse of a RETIRE record, and this file does not assign it an identifier. Until that decision exists, the replacement cannot occupy the ACCEPT or AMEND role in clause 3, and clause 3 remains unmet.

## 3. Formula fidelity

Research Complete requires the shipping `EloPoissonHybridEngine` to match its documented v0.1 mathematical contract at a named commit, with an independent verification record of that match.

The contract for the shipping markets is `docs/PROBABILITY_ENGINE.md`:

- Identity and model version `elo-poisson-hybrid-0.1.0` (lines 1–5).
- Elo win expectancy, Elo 1X2 bridge, Elo-to-λ, independent Poisson scoreline, truncated grid, 1X2 marginalization, Over/Under 2.5 from the Poisson grid only, and the blend `w * P_poisson + (1 - w) * P_elo` (lines 39–126).

`docs/PROBABILITY_ENGINE.md` lines 39–126 state numeric defaults for home advantage 65, Elo expectancy scale F = 400, Elo-to-goals scale S = 400, μ 1.45 / 1.15, γ = 1.0, λ clamp [0.05, 6], blend weight 0.7, and grid through 15. Draw base and draw decay appear there as symbols only. `DEFAULT_HYBRID_CONFIG` (`lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24) also sets `eloDrawBase: 0.28` and `eloDrawDecay: 220`, and keeps `eloScale` and `eloGoalScale` as separate fields, both 400. The config object also sets `modelVersion: "elo-poisson-hybrid-0.1.0"`. A fidelity record must log that numeric draw-base and draw-decay documentation gap. This decision does not rewrite the formula contract.

Entropy confidence is part of approved clause 1. The implementation read at this baseline is `confidenceFromHybrid`: `1 - H_norm`, with `H_norm` the normalized Shannon entropy of the blended 1X2, and bands at 0.75 and 0.45 (`lib/intelligence/modules/probability/confidence-from-hybrid.ts` lines 16–24; `normalizedEntropy` in `lib/intelligence/modules/probability/math/normalize.ts` lines 81–99). `docs/PROBABILITY_ENGINE.md` names entropy only in the module map (line 28). It does not state `1 - H_norm` or the band cut points. A fidelity verification has to record that gap. This decision does not rewrite the contract to add the formula, and it does not drop entropy confidence from clause 1.

Research models are not this engine. GOALS G1, PE-4 expectation, and PE-5 evidence classification remain outside `EloPoissonHybridEngine`, as scoped in section 6.

**Present status of this requirement: NOT PASSED.**

This writing task did not produce a line-by-line independent verification that the engine matches the contract at `01684fb`. The continuity document’s section 6 describes the shipping formula as FACT at `ceb9d4d`. That description was not re-executed here, and it is not the named-commit verification clause 1 requires. No such verification record exists in the repository.

## 4. Narrow mathematical exclusions

The following are outside the Research Complete milestone. Deferral means they are not required for the milestone. It does not mean they were fitted, rejected, or removed from the product TODO list.

| Deferred item | Where the product still names it | What the deferral rests on |
| --- | --- | --- |
| Dixon-Coles ρ | `TODO(dixon-coles)` in `lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts` line 30 | No production ρ was selected (`docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` lines 91–93 and 203). 5C.1 prohibits a Dixon-Coles production correction (`docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` line 185). |
| Per-league refits of μ and the blend weight | `TODO(calibration)` in the same file, line 31, and `docs/PROBABILITY_ENGINE.md` line 171 | Listed enhancement. Distinct from measuring calibration of the current constants, which remains clause 3. |
| Temporal Elo infrastructure | `TODO(rating-history)` in `lib/intelligence/modules/probability/math/elo.ts` lines 38–39, and `docs/PROBABILITY_ENGINE.md` line 172 | Rating-history infrastructure. Not the catalogue-geometry questions below. |
| `EloRatingProvider` | Interface at `lib/intelligence/modules/probability/hybrid/types.ts` lines 77–89. The comment begins at line 77 and the interface body runs through line 89. `TODO(elo-provider)` at `elo-poisson-engine.ts` lines 32 and 159. `StaticEloRatingProvider` at lines 161–176 is a stub. Contract row at `docs/PROBABILITY_ENGINE.md` line 169. | Provider wiring. Not a substitute for the pre-registered input-geometry study. |

### GOALS-1F.1 is not a fitted Dixon-Coles rejection

GOALS-1F.1 is an audit protocol. The protocol type declares `auditOnly: true`, `noDixonColesFit: true`, `noNegativeBinomialFit: true`, and `noHyperparameterSelection: true` as literal types (`lib/debug/calibration/goals/distributional-audit/protocol.ts` lines 94–97). `goalsDistAuditProtocol()` sets those four flags at lines 125–128. The checkpoint records the verdict `NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED` and, under rejected or null branches, lists “Dixon–Coles / Negative Binomial extension (F.1)” (`docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` lines 30 and 46).

That checkpoint line must not be read as a fitted ρ for `EloPoissonHybridEngine`, and it must not be read as a product closure of the HIGH_EQUAL residual. RC2 5B.8 reported that a predeclared ρ grid did not establish Dixon-Coles as the production correction, that residual 2-2+ structure remained, and that no ρ was selected (findings lines 91–93). The replicated HIGH_EQUAL under-allocation remains an open 5B finding (findings lines 23–24 and 188–189). The pre-registered response inside 5C.1 is arm D, not a Dixon-Coles τ.

The G1 protocol type declares `noDixonColes: true` at line 83. `goalsG1Protocol()` sets `noDixonColes: true` at line 131. Holdout season `2025` is `GOALS_G1_HOLDOUT_SEASON` at line 27, and the returned protocol sets `holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL"` at line 107 (`lib/debug/calibration/goals/g1/protocol.ts`). That flag is a research-model boundary. It is not a product-engine rejection.

### Catalogue geometry stays inside the validation study

These questions stay inside the statistical validation study, because 5C.1 already assigned them and no unseen score exists:

| Question | 5C.1 assignment read at this baseline |
| --- | --- |
| Role bases, shrinkage, goal-difference term | Arm A, `CANDIDATE_A_INPUT`: role bases 1550/1550, shrinkage k = 8, GD-rate term (pre-registration lines 52–62). |
| Elo-to-goals scale S | Arm B, `CANDIDATE_B_TRANSFORM`: S = 600 on the production catalogue (lines 64–71). |
| Both layers together | Arm C, `CANDIDATE_C_COMBINED` (lines 73–79). |
| The same combination plus the HIGH_EQUAL operator | Arm D, `CANDIDATE_D_COMBINED_HIGH_EQUAL` (lines 81–93). Arm D is part of the frozen five-arm set. It is not reclassified here as a catalogue-geometry question, and it is not removed from the study by the Dixon-Coles deferral. |

CONTROL remains the production arm: role bases 1580/1520, no shrinkage, S = 400, home advantage 65, draw base 0.28, blend 0.7, independent Poisson (pre-registration lines 29–50). 5C.1 pins that arm to base commit `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on branch `develop` (lines 15–17). This decision does not treat `01684fb` as that pin. The manifest fingerprint recorded in that file is `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c` (lines 102–108). This decision does not recompute it.

Those arms stay inside the study until D-05 retires the pre-registration and a replacement protocol is frozen. This document does not retire them and does not write a replacement.

## 5. Mandatory unseen validation

The milestone is not reached by writing this file, by freezing 5C.1, or by RETIRE of 5C.1 alone.

Clause 3 requires all of the following before anyone may claim Research Complete:

1. A written D-04 decision that names populations. It must say which 2025 populations RC2 already used, which remain sealed, and which later studies may cite published RC2 aggregates without opening outcome files. The continuity document leaves the dataset relationship UNKNOWN (lines 345–352). This file does not resolve that unknown and does not open sealed files.
2. A written D-05 disposition of `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md`.
   - ACCEPT or AMEND is the path on which that pre-registration can become the accepted study.
   - RETIRE closes 5C.1 only. RETIRE is not Research Complete.
   - After RETIRE, a replacement protocol would be required. That protocol would have to be frozen before outcome access. Its acceptance would have to be a new written owner decision before it could satisfy clause 3. This file does not choose ACCEPT, AMEND, or RETIRE, does not draft the replacement, and does not assign an identifier to that later decision.
3. A study, under a later authorization this document does not grant, that scores genuinely unseen outcomes. Unseen, in the freeze, means outcomes not used in 5B.1–5B.16 (`docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` lines 50–52). Premier League 2023, 2024, and 2025 were used and must not be called unseen again (freeze lines 18–26; 5C.1 lines 19–27).
4. Inclusion of the production CONTROL arm in that study (freeze line 40; 5C.1 lines 29–50). Freeze line 41 is UNASSIGNED `CANDIDATE_A`, not a second CONTROL row.
5. Separate reporting of log loss, Brier, and ECE. They are not combined into one score (freeze lines 71–79; 5C.1 lines 133–139).
6. Compliance with the sample and promotion rules already written in the freeze (lines 95–109) and in 5C.1 (lines 147–166). Those rules include: no production promotion at N = 100 merely because metrics look good; no optional stopping; no automatic numeric promotion. This decision adds no statistical threshold and does not replace “not worse” or “not materially worse” with a number.

The preferred design is time-prospective capture: predictions stored before completion, scored only after final results, with no retroactive candidate changes (freeze lines 54–59; 5C.1 lines 178–179 and 181). 5C.1 line 180 says scoring is on seasons not in {2023, 2024, 2025} unless a later season was unused in 5B and this freeze predates its outcome access. That “unless” does not reopen Premier League 2023, 2024, or 2025. Those three seasons remain used (freeze lines 18–26; 5C.1 lines 19–27). A historical season outside 2023–2025 qualifies only if the candidate was frozen before that season’s outcomes were loaded or scored, no results from that season were used in 5B, and no parameter changes after outcome access (freeze lines 61–65).

5C.1’s own status remains **FROZEN FOR REVIEW — no unseen outcomes scored** (lines 1–7 and 189–193). No unseen outcomes have been scored under it. No production parameter has been selected or promoted.

**This document does not open outcomes and does not score outcomes.** Writing D-04 or D-05 later would still need a separate authorization before any scoring run.

**Present status of this requirement: NOT MET.**

## 6. Scoped offline research status

Clause 4 preserves scoped historical dispositions. It does not declare offline research, as a whole, complete. It does not order finished implementation work to be repeated. Counts of tests from earlier audits are not evidence in this file.

The continuity document records commissioning-brief test totals in its sections 5 and 10 and states that those totals were not re-run and are not in a committed log (lines 193–206 and 410–417). This ratification does not adopt those totals and does not present them as fresh execution.

| Item | Disposition this decision preserves | Grade in this file |
| --- | --- | --- |
| PE-3 | Historical scoped closure. `docs/PE3_FINAL_CLOSURE_AUDIT.md` lines 1–7 and 171–176: CLOSED on the controlled live C0 ticket for fixture `1490209`, verifier PASS. `PE3C_C0_RECON_ACTIVATION` remains false. Production scheduler remains the BASE path. The closure is not repeated here and is not a C0 activation. | HISTORICAL VERDICT, read from that audit. Not re-executed. |
| PE-4I.21 | Offline feature-foundation close, independent verdict PASS WITH LIMITATIONS (`docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` lines 7–9 and 116–118). `PE4I21_PRODUCTION_WIRING` is false (line 16). Calendar-2025 ledger rows stay sealed (line 129). The word “research-complete” on line 7 is this contract’s status, not D-01. Line 9, “PE-5 is not started,” is the close boundary of that file. The continuity document already marks it stale as a description of later HEAD (continuity lines 94 and 129). This decision does not rewrite it. | HISTORICAL VERDICT for the close. The stale PE-5 sentence is a preserved CONFLICT, not a current inventory. |
| PE-4 historical expectation | Remains unavailable. Continuity lines 54–58 state that `resolvePe4HistoricalExpectation` returns status `UNAVAILABLE` because the product hybrid engine is not a valid consumer of common-baseline pairwise indices. Continuity lines 297–299 state that the function returns null probabilities with reason `expectation_model_not_defined`. | PRIOR RECORD in the continuity document. `expectation-contract.ts` was not re-opened in this writing task. Commit `01684fb` does not modify that source file. |
| GOALS G1 k = 10 | Research-only backbone in the checkpoint (lines 28 and 40). Not the product λ formula. Holdout season 2025 is `GOALS_G1_HOLDOUT_SEASON` at `lib/debug/calibration/goals/g1/protocol.ts` line 27, and the returned protocol sets `holdoutPolicy` to `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL` at line 107. The type literal `noDixonColes: true` is line 83; `goalsG1Protocol()` sets that flag at line 131. The checkpoint production boundary (lines 57–61) states that `PE3C_C0_RECON_ACTIVATION` is false, that lifecycle, scanner, probability-engine, and app routes are not imported into the PE-4 expectation models or GOALS G0/G1/G3, and that `lib/prematch-decision/index.ts` does not export `pe4-form-schedule`. This writing task did not re-search the import graph. | HISTORICAL VERDICT for the k = 10 selection. Holdout policy and the production-boundary bullets were read. Holdout not evaluated here. |
| PE-5.2 | Closure is unresolved. The protocol says remediation was done and “a new independent closure audit has not been run” (`docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` lines 5–7). Eligible rows do not emit a model feature, a coefficient, or a join onto the PE-4 matrix (line 90). This decision does not call PE-5.2 closed. | READ AT THIS BASELINE for those protocol sentences. The commit-subject conflict recorded in the continuity document (line 154) is not resolved here. |
| PE-5.3D | Current offline probe runner. It does not authorize a live provider call (`docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` lines 1–3). | READ AT THIS BASELINE for that status line. Not a live authorization. |
| PE-5.4B | Live pilot remains NO-GO until a later explicit authorization, after an implementation audit and the credential rule (`docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` lines 790–802). The dedicated-credential choice is still unset (line 811). Line 3 says no module in that design is implemented. Line 10 says accepting the review does not authorize PE-5.4C or contact with API-Football. Line 821 repeats that no component described there is implemented and that none is authorized to contact API-Football. Those inventory sentences are stale at this HEAD, because offline PE-5.4C commits exist. They remain the design’s refusal of live acquisition. | HISTORICAL design verdict for the live NO-GO. Not re-executed. The stale inventory sentences are not deleted. |
| PE-5.4C | Historical offline GO only, for the implemented offline boundary. The continuity document records that GO as a commissioning-brief verdict, not as a closure markdown file (continuity lines 123, 160, and 193–206). Limits that travel with that GO: in-memory durability, no crash recovery, no live flag, `productionReady: false`. Four LOW findings are recorded in continuity lines 208–218: unresolved reserved and sending rows; public simulator fault injection; unexpected exceptions that can lose operation identifiers; approval expiry not rechecked at `beginSend`. The LOW severity label is a historical audit classification. This writing task did not re-open those source sites. The GO does not extend to live calls, production wiring, or probability research. | HISTORICAL VERDICT. Not re-audited here. |
| RC2 5B | Diagnostic only. The findings file does not select production parameters (lines 1–7 and 196–209). `PRODUCTION_CORRECTION_READY` remained NO at 5B.16 because no unseen window existed (lines 225–231). | HISTORICAL VERDICT. Not re-executed. |
| RC2 5C.1 | Unscored pre-registration. Status FROZEN FOR REVIEW — no unseen outcomes scored (lines 189–193). Owner disposition is D-05. | READ AT THIS BASELINE for the written status. No score was produced for this file. |

## 7. Explicit exclusions

Research Complete, including approval of this definition, does not authorize any of the following.

- Production parameter promotion, including S, blend weight, draw base, home advantage, shrinkage k, Dixon-Coles ρ, λ3, a HIGH_EQUAL multiplier, role bases, or a goal-difference formula.
- Live API-Football acquisition, including a PE-5.4B pilot and any use of PE-5.3 or PE-5.4C as a live client.
- Production wiring of PE-4 or PE-5. `PE4I21_PRODUCTION_WIRING` and `PE5_PRODUCTION_WIRING` stay false until a separate wiring decision.
- C0 activation. `PE3C_C0_RECON_ACTIVATION` stays false. The historical PE-3 ticket is not a standing activation.
- Implementation of `PredictionPipeline`, and any use of this decision to start the original pipeline and calibrator path. `run` and `runBatch` still throw (`lib/intelligence/engine/pipeline.ts` lines 45–54). The same file imports `ConfidenceCalibrator` (line 5) and does not run it. `docs/PROBABILITY_ENGINE.md` lines 180–182 still say the pipeline does not call the hybrid engine. That unimplemented path remains a production-readiness obligation under clause 5. It is outside this milestone.
- Betting Analyzer development. No repository specification was adopted by this decision.
- PE-6 or PE-7 implementation. The names stay unused. This decision does not define them.
- Opening, reading, unsealing, or scoring sealed 2025 outcome files, including gitignored artifacts under `data/calibration/`.
- Making squad evidence a model feature or a model coefficient, or joining it to λ or 1X2.
- Changes to existing Copilot behavior. Copilot’s existing value scan is not authorized by this definition. It remains on its current contract. A future clause 3 score does not validate that scan, does not make it a Betting Analyzer, and does not authorize a change to Copilot code or behavior. Any betting-surface status remains D-08. No such score exists.

Direct product callers of the hybrid engine may already exist. Their existence is not production readiness and is not Research Complete. This decision does not change them.

## 8. Acceptance gates

The four gates are separate. A pass on one is not a pass on another. This document passes none of them.

### A. Mathematical fidelity

Requirement: section 3. The shipping engine matches the documented v0.1 contract at a named commit, including the entropy-confidence gap and the numeric draw-base and draw-decay gap that a verifier must record, and an independent verification record exists.

**Present status: NOT PASSED.** No repository verification record names `01684fb`, or any other commit, as an independent fidelity pass for this gate.

### B. Statistical validation

Requirement: section 5. Written D-04. Written D-05 of ACCEPT or AMEND for the study that will be scored. RETIRE of 5C.1 leaves the gate unmet until a replacement protocol exists, is frozen before outcome access, and has been accepted by a new written owner decision. This file does not assign that decision an identifier. A separately authorized unseen study. Production CONTROL included. Log loss, Brier, and ECE reported separately. Frozen sample and promotion rules followed. No new threshold. This document does not grant that study.

**Present status: NOT MET.** D-04 is undecided. D-05 is undecided. 5C.1 is frozen for review and unscored. RETIRE of 5C.1, were it later chosen, would still leave this gate unmet.

### C. Scoped offline research disposition

Requirement: section 6, which is clause 4. A later Research Complete claim has to use those scoped dispositions and must not upgrade them. PE-5.2 is not called closed. PE-4I.21 is not called Probability Engine Research Complete. The PE-5.4C GO is not called a live or probability-research close. Historical test totals are not fresh evidence. Gate C is a constraint on the claim. It is not a request for a new closure audit, and it is not a finding that every offline program is complete.

**Present status: NOT AWARDED.** The cited historical sentences were read and are the approved reading. This writing task did not re-audit them. No Research Complete claim is being made, so this gate is not passed. PE-5.2’s closure conflict remains unresolved on purpose.

### D. Formal research milestone closure

Requirement: all five clauses are satisfied at once. Gate A has an independent fidelity record. Gate B has been met, including the written D-04 and D-05 conditions. The claim obeys gate C. Clauses 2 and 5 still exclude the work they list. Gate D has no separate shortcut.

**Present status: NOT ACHIEVED.** Approving this definition does not close the milestone. The continuity document’s gate D (lines 544–548) had no pass condition. This file supplies the pass condition and records that the condition is unmet. Gates A and B are the open blockers. Gate C is not a third unfinished study.

## 9. Remaining decisions and dependencies

D-01, as a definition, is decided by section 2. D-01, as a claim that Research Complete has been achieved, is not decided and is not available.

The continuity register (lines 431–439) left D-01 depending on D-05, D-07, D-08, and D-09, and left D-09 depending on D-01. This definition breaks that circle for the research milestone only: exclusions in sections 4, 6, and 7 state what the milestone does not include. It does not decide the deferred items. It does not edit the continuity register.

### Blockers to claiming Research Complete

These remain open. Silence on them leaves the milestone unclaimed.

| ID | What remains to be decided | Why it blocks the claim |
| --- | --- | --- |
| D-04 | Which populations are already used, which remain sealed, and which later studies may cite RC2 aggregates without opening outcome files. The continuity alternatives are a crosswalk that does not open sealed files, permanent separation, or a controlled comparison under a new protocol (line 434). | Clause 3 requires a written population decision before an unseen window can be named. Premier League 2023, 2024, and 2025 cannot be that window. The sealed-file rules of GOALS, PE-4, and PE-5 are not repealed. |
| D-05 | ACCEPT, AMEND, or RETIRE the 5C.1 pre-registration. Promotion rules already in that file are not a promotion. | Clause 3 requires ACCEPT or AMEND before 5C.1 can be the accepted study. RETIRE alone does not satisfy the gate. A replacement protocol would then be required, and a new written owner decision would have to accept it before scoring. This file does not assign that decision an identifier. No scoring is authorized by identifying this blocker. |
| Gate A evidence | An independent verification that the shipping engine matches the v0.1 contract at a named commit, recording the entropy-confidence documentation gap and the numeric draw-base and draw-decay documentation gap in section 3. | Clause 1 is a required clause. This file does not supply the verification. Closing gate B without that record would still leave gate D unachieved. |

The scientific pass condition identified with clause 3 is gate B. Gate A is also unpassed. Neither is waived.

### Decisions that can remain deferred

These do not have to be decided before a future Research Complete claim, provided the claim obeys the exclusions. Leaving them undecided is not permission to build them. A decision that contradicts an exclusion would be a new owner decision, not an interpretation of this file.

| ID | Question left open | Why it can remain deferred | What deferral still forbids |
| --- | --- | --- | --- |
| D-02 | Authority of the missing PE-5.1 and PE-5.4A files. Both are cited and neither is in the repository (continuity lines 119–120 and 432). | This definition does not treat those parents as read and does not require their recovery for the research milestone. | Further PE-5 interpretation that needs the missing text. Recovery would be a separate documentation authorization. |
| D-03 | Whether PE-5.2 is formally closed. The protocol says a new independent closure audit has not been run. A commit subject has said close (continuity line 433). | Clause 4 requires that PE-5.2 not be called closed. Resolving the conflict is not a prerequisite for the definition, and it is not a prerequisite for the milestone while that sentence stands. | Calling PE-5.2 closed. Changing the classifier. |
| D-06 | Whether squad evidence is ever intended to become a model feature. | Clause 5 excludes it from this milestone. Intent can wait. | Joining squad counts to λ or 1X2. A later “yes” is a new pre-registered study, not implementation authority. |
| D-07 | Whether PE-6 and PE-7 exist, and what they mean. | They are unused names outside this milestone. | Using the names as if a specification existed. Any implementation. |
| D-08 | Preconditions for a Betting Analyzer. No specification exists. Copilot value scan already computes a value path from the hybrid probability and odds. | The analyzer is outside this milestone. Clause 5 leaves any betting-surface status at D-08. A clause 3 score does not decide it. | Starting that product. Treating Copilot value scan as the analyzer, or as a validated betting surface. |
| D-09 | Whether live acquisition is a later separate program. | Clause 5 places live acquisition outside Research Complete, so the milestone does not wait on D-09. | A live API-Football call. Treating the PE-5.4C offline GO, or a future Research Complete claim, as the live authorization. The four LOW findings and the unset credential choice remain live-program issues (PE-5.4B line 811; continuity lines 208–218). |

D-02 and D-03 can block a different claim, such as “PE-5 is formally closed” or “the missing parent audits were applied.” They do not block the Research Complete claim defined here, because that claim must not say those things.

## 10. Explicit non-authorizations

This document is not permission to implement, score, activate, deploy, or contact a live provider.

In particular, it is not permission to:

- Edit application source, tests, configuration, or existing documents, including the continuity document and the frozen protocols.
- Run a scoring job, open a sealed outcome file, or load Premier League 2023, 2024, or 2025 outcomes as an unseen window.
- Promote or change a model parameter.
- Set `PE3C_C0_RECON_ACTIVATION`, `PE4I21_PRODUCTION_WIRING`, `PE5_PRODUCTION_WIRING`, or a live-provider flag to true.
- Implement `PredictionPipeline`, PE-6, PE-7, or a Betting Analyzer.
- Call API-Football, or treat `allow-offline` or a passing offline test as a live send.
- Change Copilot, Match Center, Match Analysis, Vision, or the lifecycle.
- Assign a new phase number.
- Treat this file, the continuity file, or the second audit’s chat record as a completed prospective study.

A later owner authorization has to name the files and the action in scope. Acceptance of this definition authorizes nothing except further reading of the definition.

## 11. Evidence references

Grades used here:

| Grade | Meaning |
| --- | --- |
| READ AT THIS BASELINE | The cited lines were read in the working tree at `01684fb` while writing this file. They were not executed. |
| HISTORICAL VERDICT | A conclusion already recorded by an audit, a protocol, or the continuity document. Not re-executed and not re-derived here. |
| PRIOR RECORD | A continuity-document statement whose underlying source file was not re-opened in this writing task. Commit `01684fb` adds only the continuity document, so it does not itself modify that source. |
| OWNER DECISION | The approval recorded in section 2. |
| UNKNOWN | Left unknown on purpose. |

| Proposition | Source | Lines | Grade |
| --- | --- | --- | --- |
| Continuity file is provisional and is not an approved phase closure | `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` | 3–12, 619–635 | READ AT THIS BASELINE |
| Continuity section 13 gates were proposals, and gate D had no pass condition | same | 510–548 | READ AT THIS BASELINE |
| D-01 through D-09 register | same | 425–439 | READ AT THIS BASELINE |
| 2025 population relationship unknown; no sealed file opened for that document | same | 307–354 | READ AT THIS BASELINE |
| Shipping v0.1 formula description at the continuity audit commit | same | 34–40, 226–260 | PRIOR RECORD for the code paths named there. Contract and config lines cited in section 3 of this file were read again. |
| PE-4 expectation UNAVAILABLE, with the reason code stated separately | same | 54–58, 297–299 | PRIOR RECORD. Lines 54–58 are the UNAVAILABLE rationale. Lines 297–299 are the null probabilities and `expectation_model_not_defined`. Source file not re-opened here. |
| Historical PE-5.4C GO, four LOW findings, and the statement that test totals were not re-run | same | 193–218, 410–417 | HISTORICAL VERDICT. LOW source sites not re-opened here. Totals not adopted. |
| v0.1 contract identity and formulas | `docs/PROBABILITY_ENGINE.md` | 1–5, 39–126 | READ AT THIS BASELINE |
| Contract TODOs, including provider, Dixon-Coles, per-league fit, rating history, and pipeline | same | 165–182 | READ AT THIS BASELINE |
| Entropy named in the contract map only | same | 28 | READ AT THIS BASELINE |
| Default constants and model version | `lib/intelligence/modules/probability/hybrid/config.ts` | 7–24 | READ AT THIS BASELINE |
| Product TODOs and static provider stub | `lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts` | 30–32, 156–176 | READ AT THIS BASELINE |
| `EloRatingProvider` still unwired | `lib/intelligence/modules/probability/hybrid/types.ts` | 77–89 | READ AT THIS BASELINE |
| Temporal Elo TODO | `lib/intelligence/modules/probability/math/elo.ts` | 38–39 | READ AT THIS BASELINE |
| Entropy function and confidence bands | `lib/intelligence/modules/probability/math/normalize.ts`; `lib/intelligence/modules/probability/confidence-from-hybrid.ts` | 81–99; 16–24 | READ AT THIS BASELINE |
| `PredictionPipeline` imports `ConfidenceCalibrator` and `run` / `runBatch` throw | `lib/intelligence/engine/pipeline.ts` | 5, 45–54 | READ AT THIS BASELINE |
| Freeze: used seasons, UNASSIGNED A-D slot table, with CONTROL specified, unseen rule, three historical-season conditions, metrics, N = 100 rule | `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 18–26, 32–46, 50–66, 71–79, 95–109 | READ AT THIS BASELINE |
| 5C.1 base commit, purpose, used seasons, five arms, fingerprint, metrics, promotion rules, Dixon-Coles prohibition, frozen-for-review status, and the line 180 season clause | `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | 1–7, 13–17, 19–93, 102–108, 133–139, 147–166, 176–193 | READ AT THIS BASELINE |
| 5B diagnostic limits, Dixon-Coles non-selection, catalogue-geometry findings, no production parameter, no unseen window | `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | 1–27, 91–93, 177–209, 225–231 | READ AT THIS BASELINE |
| GOALS-1F.1 type literals and function flags do not fit Dixon-Coles | `lib/debug/calibration/goals/distributional-audit/protocol.ts` | 94–97, 125–128 | READ AT THIS BASELINE |
| Checkpoint verdict and rejected-branch list, G1 k = 10, production boundary, sealed 2025 | `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` | 22–61 | READ AT THIS BASELINE |
| G1 `noDixonColes` type and function flag, and unevaluated 2025 holdout policy | `lib/debug/calibration/goals/g1/protocol.ts` | 27, 83, 107, 131 | READ AT THIS BASELINE |
| PE-3 scoped closure, C0 default off | `docs/PE3_FINAL_CLOSURE_AUDIT.md` | 1–7, 171–176 | READ AT THIS BASELINE |
| PE-4I.21 feature-contract close and limitations | `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` | 1–16, 116–130 | READ AT THIS BASELINE |
| PE-5.2 not re-audited; no coefficient | `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` | 1–13, 90 | READ AT THIS BASELINE |
| PE-5.3D offline, no live call | `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` | 1–3 | READ AT THIS BASELINE |
| PE-5.4B live NO-GO, unset credential choice, and stale implementation inventory | `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` | 1–10, 790–802, 811, 821 | READ AT THIS BASELINE |
| Owner approval of the five clauses; milestone not achieved | This file, section 2 | — | OWNER DECISION |

The fingerprint, the arm constants, and the promotion wording are cited from the pre-registration text. They were not re-hashed and not applied to outcomes.

## 12. Limits of this record

- The second independent D-01 audit that proposed the five clauses is not a committed repository file. This document records the owner’s approval of that wording. It does not republish the audit’s other findings as new verification.
- Gate A is not passed. The entropy-confidence formula is in code and is not written as a formula in `docs/PROBABILITY_ENGINE.md`. Draw base 0.28 and draw decay 220 are numeric in `DEFAULT_HYBRID_CONFIG` and are symbols only in that formula contract.
- Gate B is not met. D-04 and D-05 are undecided.
- Gate C is not a fresh audit. PE-5.4C has no closure markdown. Its offline GO and the LOW severity label remain historical.
- Gate D is not achieved.
- `resolvePe4HistoricalExpectation` was not re-opened in this writing task.
- The four PE-5.4C LOW behaviors were not re-opened in source. Their record is the continuity document.
- No numeric threshold was added. No outcome was scored.
