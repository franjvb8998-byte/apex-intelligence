# APEX Intelligence — Master Handover

**Document status:** OWNER-APPROVED — MIGRATION CONTINUITY RECORD ONLY

**Owner approval date:** 2026-11-25.

**Document role:** Navigational and continuity record for migrating the repository to another Windows computer. This file is not a governing authority. It does not amend an owner decision, edit a frozen protocol, close a phase, promote a parameter, authorize a population, or change Research Complete status.

**Owner approval boundary.** Approval on 2026-11-25 approves this document as a migration continuity reference only. It does not create a new governing authority. It does not supersede D-01, D-04, D-05, or any frozen protocol. It does not resolve any open scientific, methodological, or technical decision. It does not certify any backup or restoration. It does not authorize scientific development during migration. It does not authorize prospective capture, scoring, population selection, parameter promotion, or production activation. Research Complete remains **NOT ACHIEVED**.

**Approval chronology.** Historical verdicts stay in this order.

- Stage 3A inventory verdict: **CONDITIONAL — EVIDENCE GAPS REQUIRE REVIEW**. Accepted only as limitations to preserve.
- Stage 3C independent audit: **CONDITIONAL PASS — HANDOVER REMEDIATION REQUIRED**. Ten confirmed findings: CRITICAL 0, HIGH 2, MEDIUM 5, LOW 3.
- Stage 3D: targeted remediation of all ten findings, F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, and F-11. No F-10 finding was recorded.
- Stage 3E independent re-audit: **PASS — READY FOR OWNER HANDOVER APPROVAL**. All ten original findings were independently verified as **RESOLVED**. N-01 was recorded as a LOW editorial finding.
- Stage 3F, 2026-11-25: the owner approved this handover and authorized the N-01 correction. The exact confirmation was: “Apruebo íntegramente la declaración de aprobación de la Memoria Maestra de Continuidad de APEX Intelligence y autorizo la corrección editorial N-01.” Publication has not occurred. No commit hash is assigned to this file.

**Drafting session:** 2026-11-25. One new file. No existing file was modified.

**Stage 3D remediation:** 2026-11-25. Documentation-only corrections for findings F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, and F-11. No F-10 finding is recorded. At the close of Stage 3D the file was still a draft. That remediation did not resolve a scientific or methodological decision.

**Stage 3F editorial correction:** 2026-11-25. N-01 only. Duplicate section 1.4 headings were ordered and renumbered. Substantive content of those subsections was not changed.

---

## Preserved status register

These statements are carried forward unchanged. Owner approval of this record does not resolve them.

| Item | Preserved state | Where recorded below |
| --- | --- | --- |
| Gate A | **NOT PASSED** | Sections 5 and 13 |
| Gate B | **NOT MET** | Sections 8 and 13 |
| Gate C | **NOT AWARDED** | Section 8. Gate C is not a third unfinished study. Gates A and B are the open research blockers. D-01 lines 180–182 and 188 |
| Gate D | **NOT ACHIEVED** | Sections 8 and 13 |
| Research Complete | **NOT ACHIEVED** | Sections 2, 8, and 13 |
| PE-5.2 formal closure | **UNRESOLVED** (D-03). Calling PE-5.2 closed remains forbidden | Sections 6, 10, 11, and 12 |
| PE-5.4C historical offline GO | Does **not** authorize live acquisition | Sections 6, 9, 10, and 14 |
| Four PE-5.4C LOW findings | Preserved. Source sites were not re-opened | Section 10 |
| Historical engineering results | `tsc --noEmit` passing; PE-scoped ESLint passing; 480 PE-5.4C tests passing; 2040 full-suite tests passing; full-repository ESLint 10 errors and 63 warnings. Historical only. Not re-executed. Logs are not committed evidence. Static counts of 283 `it(` sites and 30 `it.each(` sites are not those executed totals | Section 10.6 |
| Missing-document findings | Preserved, including absent phase records | Sections 6, 11, and 12 |
| Population identity unknowns | Preserved as **UNKNOWN** | Sections 8 and 11 |
| Operational season discovery vs scoring-population authorization | Distinct. Season 2026 is not a scoring population | Sections 11 and 12 |
| D-05 open items | All remain **OPEN / UNAPPROVED** | Section 11 |
| 5C.1 production commit pin | `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on `develop`. Not replaced by HEAD | Sections 5, 7, and 9 |
| 5C.1 manifest fingerprint | `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`. Cited from 5C.1 lines 108–110 and D-05 line 83. Not recomputed. Load-time digest verification remains **OPEN / UNAPPROVED** | Sections 5 and 9 |
| Document status | **OWNER-APPROVED — MIGRATION CONTINUITY RECORD ONLY**. Approval date 2026-11-25. Not a governing authority. Not publication | Header and section 18 |
| Stage 3A inventory verdict | **CONDITIONAL — EVIDENCE GAPS REQUIRE REVIEW**. Accepted only as limitations to preserve | Sections 1 and 17 |
| Stage 3C audit | **CONDITIONAL PASS — HANDOVER REMEDIATION REQUIRED**. Ten confirmed findings | Header |
| Stage 3E re-audit | **PASS — READY FOR OWNER HANDOVER APPROVAL**. Ten original findings **RESOLVED**. N-01 was the remaining LOW editorial finding and is corrected in section 1 | Header and section 1 |

---

## 1. Document control and verified repository baseline

### 1.1 What this drafting session verified

Verified in this drafting session by git metadata only. File contents were not re-read. No test, provider call, credential open, or data-directory listing was performed.

| Check | Result |
| --- | --- |
| Repository path | `C:\Projects\apex-intelligence` |
| Branch | `main` |
| HEAD | `34b086ae068b8ec872e7ae32e466178e9cb3db55` |
| `origin/main` | `34b086ae068b8ec872e7ae32e466178e9cb3db55` |
| Ahead / behind | 0 / 0 |
| Working tree before this file | Clean |
| `origin` URL | `https://github.com/franjvb8998-byte/apex-intelligence.git` (fetch and push) |
| Pre-handover checkpoint | `34b086ae068b8ec872e7ae32e466178e9cb3db55` |

This file is untracked at the time of drafting. No future commit hash is recorded. A later manual documentation commit, if the owner makes one, is a different checkpoint and must be verified on its own.

HEAD subject, from git metadata in this session: `docs(pe): ratify D-05 limited governance record`, dated 2026-11-25. That subject is a commit message. It is not a scientific closure.

### 1.2 Tracked delta since the continuity baseline

Stage 3A states that, since the continuity audit at `ceb9d4d`, the only tracked changes are five governance documents and that application source is unchanged.

Git metadata in this drafting session resolves that short hash and the five paths. This is not a content audit of those files.

| Full commit | Date | Subject | Paths added |
| --- | --- | --- | --- |
| `ceb9d4d770a2733d49cb601ceda8df0cc30469f8` | 2026-11-06 | Continuity-audit baseline. Git commit date 2026-11-06. The continuity control block also dates that audit 2026-11-06 (line 9). Parent of the next row | None in the range below; this is the range start |
| `01684fb3230738f76058d54364768bb4657bc737` | 2026-11-09 | `docs(pe): checkpoint provisional architecture continuity and remaining scope` | `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` |
| `3a3bd665164be12bf237e6880cbd94ba42d37a31` | 2026-11-11 | `docs(pe): ratify D-01 research complete definition` | `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` |
| `14c10fec9e49758bbca88a43079ef79ac88902a0` | 2026-11-11 | `docs(pe): ratify D-04 2025 population governance decision` | `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` |
| `34b086ae068b8ec872e7ae32e466178e9cb3db55` | 2026-11-25 | `docs(pe): ratify D-05 limited governance record` | `docs/PE_D05_PREREGISTRATION_DISPOSITION.md`; `docs/calibration/RC2_5C_PREREGISTRATION_GOVERNANCE_ADDENDUM.md` |

`git diff --name-status ceb9d4d770a2733d49cb601ceda8df0cc30469f8..HEAD` shows those five additions and no other tracked path. That supports the Stage 3A statement for tracked files. It says nothing about gitignored files.

### 1.3 Drafting basis, and what was not re-audited

The drafting basis is the Stage 3A Master Handover Evidence Inventory, produced on 2026-11-25 in a Cursor conversation. That inventory is external conversation history. It is not a file in this repository. It has not been independently audited. Its verdict was **CONDITIONAL — EVIDENCE GAPS REQUIRE REVIEW**. The owner accepted that verdict and its documented gaps solely as limitations to preserve. Acceptance does not close any scientific, methodological, technical, or governance gap.

This draft transcribes that inventory. It does not treat unchanged source files as newly audited files. Evidence grades in later sections are Stage 3A grades unless a cell is marked **GIT METADATA, THIS DRAFT** or **OWNER AUTHORIZATION, THIS DRAFT**.

Stage 3A stated that it did not open `data/calibration/` or `data/prospective/`, did not run tests, and did not contact a provider. This drafting session repeated those restrictions.

Repository-backed claims below are claims Stage 3A attributed to repository paths, with the grade Stage 3A assigned. Conversation history other than that inventory has not been independently inventoried and is not used as a source of technical fact. Owner instructions for this drafting session are recorded only as migration, safety, and resumption requirements.

### 1.4 Stage 3D source checks

Stage 3D re-read only the governing passages and code ranges named in the remediated sections. Those checks did not re-run `tsc`, ESLint, Vitest, or any evaluation. They did not recompute the manifest fingerprint. They did not open `data/calibration/` or `data/prospective/`. The original drafting session’s statement that it did not re-read file contents remains the record of that session.

### 1.5 How a later decision relates to an earlier sentence

A later owner-decision file can supersede an earlier “undecided” sentence without rewriting the earlier file. Both texts remain. The later file states the disposition. The earlier file keeps its historical sentence. This handover does not edit either file and does not treat the historical sentence as the current disposition.

---

## 2. Purpose, mission, and long-term product vision

**Source:** `docs/PRODUCT_BLUEPRINT.md`, foundational product vision and mission. Stage 3A read sections 1–2, lines 10–29. **READ AT HEAD** in Stage 3A. Not re-read in this draft.

**Vision.** Turn sports-betting decisions into a measurable, disciplined, evidence-based process. The stated aim is consistent better decisions. The product sentence in that section is that the vision is not “always winning.” Lines 10–16.

**Mission.** Help analytical bettors understand real performance, evaluate matches with traceable signals, record predictions and results, and learn from their own patterns. Lines 20–29.

**Platform composition, as stated there.** The platform combines user history, sports data, and a prediction engine with explicit confidence. Line 29.

The blueprint does not govern Probability Engine phase closure or parameter promotion.

**Separate milestone.** Probability Engine Research Complete is not the product vision. `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` lines 27–41 define it as five clauses and record that approval of the definition does not mean the clauses are met. Completion status in that file, as reported by Stage 3A: **NOT ACHIEVED**.

**Non-authoritative skeletons.** Stage 3A read these at HEAD and found headings only, or the create-next-app README. They are not a second mission statement and are not authoritative for current architecture or decisions:

- `docs/00-vision.md`
- `docs/01-product-principles.md`
- `docs/DECISIONS.md`
- `docs/02-architecture.md`
- `docs/ROADMAP.md`
- `README.md`

Product identity for a new machine is taken from `docs/PRODUCT_BLUEPRINT.md` and from the engine boundaries in `docs/06-ai-engines.md`.

---

## 3. Evidence classifications and document authority hierarchy

### 3.1 Evidence grades

Grades keep the meanings Stage 3A used. This draft adds only the last three rows.

| Grade | Meaning |
| --- | --- |
| **READ AT HEAD** | Stage 3A read the cited lines in the inventory session. This draft did not re-read them |
| **SOURCE UNCHANGED** | Stage 3A treated the file as identical to the continuity audit and did not re-read it line by line. This draft did not newly audit it |
| **OWNER DECISION** | Binding only inside the scope the decision file states |
| **HISTORICAL VERDICT** | A prior audit conclusion. Not re-executed in Stage 3A or in this draft |
| **PRIOR RECORD** | A continuity-document statement cited by Stage 3A. The cited continuity lines were not re-opened in this draft |
| **CONFLICT** | A preserved disagreement. Not reconciled here |
| **OPEN / UNAPPROVED** | Not approved. Remains open |
| **UNKNOWN** | Not established. Not filled in by inference |
| **PROVISIONAL** | The continuity map. Not an approved closure |
| **PROPOSAL** | Not adopted as a definition of done |
| **GIT METADATA, THIS DRAFT** | Git commands in this drafting session. Contents not audited |
| **OWNER AUTHORIZATION, THIS DRAFT** | Stage 3B owner instructions for migration, safety, and resumption. Not a scientific finding |
| **EXTERNAL CONVERSATION** | The Stage 3A inventory. Not a repository file. Not independently audited |

### 3.2 Document authority at HEAD

Stage 3A authority table. “What it does not govern” is part of the authority boundary and is preserved.

| Document | Authority at HEAD | Status | What it does not govern |
| --- | --- | --- | --- |
| `docs/PRODUCT_BLUEPRINT.md` | Foundational product vision and mission | Foundational. Sections 1–2, lines 10–29. **READ AT HEAD** | Probability Engine phase closure or parameter promotion |
| `docs/06-ai-engines.md` | Product engine boundaries | Probability, reasoning, and learning are separate. Lines 21–39 and 53–59. **READ AT HEAD** | PE-3 through PE-5. Those phases are not named |
| `docs/PROBABILITY_ENGINE.md` | Shipping v0.1 formula contract | Implemented contract, model `elo-poisson-hybrid-0.1.0`. Lines 1–5 and 39–126. **READ AT HEAD** | PE-4, PE-5, GOALS, RC2 promotion |
| `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` | Provisional map at `ceb9d4d` | **PROVISIONAL**. Lines 3–12. Not an approved closure | Later owner decisions. It still lists D-01, D-04, and D-05 as undecided |
| `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` | Binding five-clause definition | **OWNER-APPROVED DEFINITION**. Completion **NOT ACHIEVED**. Lines 7–10 and 27–41 | A claim that the milestone has been met. Its sentences that D-04 and D-05 are undecided are historical text at baseline `01684fb` |
| `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` | Binding population rule | **OWNER-APPROVED DECISION**, Option 1. Lines 7–10 and 26–38 | Fixture-level identity, D-05, scoring, or Research Complete |
| `docs/PE_D05_PREREGISTRATION_DISPOSITION.md` | Disposition of RC2 5C.1, plus named methodological decisions | **OWNER-APPROVED DISPOSITION — AMEND**. Lines 7–20. Section 6 is the limited ratification. Section 13 binds only the decisions it names | Blanket approval of the addendum. Capture, scoring, a population, or promotion |
| `docs/calibration/RC2_5C_PREREGISTRATION_GOVERNANCE_ADDENDUM.md` | Limited governance record of decisions already approved | **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY**. Lines 1–16 | Unresolved sentences. Those stay **OPEN / UNAPPROVED** or **PROPOSED, NOT YET APPROVED** |
| `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 2026-09-19 freeze before unseen scoring | Frozen. Used seasons at lines 18–26. Candidate slots A–D are the UNASSIGNED rows at lines 41–44. CONTROL at line 40 is frozen as the production baseline, not an unassigned slot | The later 5C.1 assignment. The freeze text was not edited |
| `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | Frozen five-arm pre-registration | **FROZEN FOR REVIEW — no unseen outcomes scored**. Lines 189–193. **READ AT HEAD** | An accepted study. D-05 selected AMEND and did not edit this file |
| `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | Diagnostic record of 5B.1–5B.16 | Does not select production parameters. Lines 1–7 and 14–27 | Permission to retune the product engine |
| `docs/PE3_FINAL_CLOSURE_AUDIT.md` | Scoped PE-3 closure | **CLOSED** on one live ticket. C0 default remains off. Lines 1–6 | Later research closure or standing C0 activation |
| `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` | PE-4 + GOALS checkpoint | Research checkpoint candidate. Lines 1–6 and 37–55 | Production activation |
| `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` | Offline feature-foundation close | **PASS WITH LIMITATIONS**. Line 7 uses “research-complete” for this contract only | Probability Engine Research Complete. Line 9, “PE-5 is not started,” is stale at HEAD |
| `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` | Evidence-class rules | Remediation recorded. A new independent closure audit has not been run. Lines 1–13 | A formal PE-5.2 close. Line 13 is stale for PE-5.3 and still accurate for PE-6 and PE-7 |
| `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` | Current offline probe | Does not authorize a live provider call. Lines 1–3 | Live transport |
| `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` | Live-acquisition refusal and threat model | Live pilot **NO-GO**. Lines 790–802 and 821 | A current implementation inventory. Lines 3, 10, and 821 are stale because offline PE-5.4C code exists |
| `docs/calibration/RC2_5C_PROSPECTIVE_CAPTURE_PROTOCOL.md` | 5C.2 capture infrastructure | **INFRASTRUCTURE FROZEN FOR REVIEW — no real fixtures captured, no outcomes scored**. Line 293 | Live capture authorization |
| `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | 5C.3 live protocol | **PROTOCOL FROZEN FOR LIVE AUTHORIZATION REVIEW**. Line 325 | A completed capture. `prospectiveSeason` stays unverified in that protocol |
| `docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` | 5C.5A composition runbook | Does not authorize live capture. Lines 1–5 | Season 2026 as a scoring population. See section 12, contradiction 7 |
| `docs/calibration/RC2_5C_LIVE_EXECUTION_ADAPTER.md` | 5C.5B.1 offline seam | Does not authorize live capture. Lines 1–3 | 5C.5C first live capture |
| `docs/calibration/RC2_5C_PROSPECTIVE_SCORING_PROTOCOL.md` | 5C.6 scoring infrastructure | Next step is not authorized in that file | An unseen score |
| `docs/calibration/RC2_5C_PROSPECTIVE_EVALUATION_PROTOCOL.md` | 5C.7 offline reporting | Debug-only. Not a promotion rule. Lines 1–3 | Production promotion |

`docs/PE4I1` through `docs/PE4I20` remain stage records. I.21 does not rewrite them. No committed PE-5.4C closure markdown exists. Continuity lines 113 and 123 record that absence. **PRIOR RECORD**.

Hierarchy in force for a reader of this handover:

1. Binding owner decisions D-01, D-04, and D-05, each only inside its own stated scope. D-05’s addendum ratification is the limited record, not a blanket approval.
2. Frozen protocol files, unedited by later decisions. Later files can assign or refuse what an earlier freeze left open. They do not rewrite the freeze.
3. Scoped historical audits, as historical verdicts, not as fresh runs.
4. The provisional continuity map, which still contains superseded “undecided” sentences.
5. Empty skeletons and the create-next-app README, which are not authorities.
6. This handover, which navigates the above and governs nothing.

---

## 4. Current architecture and component boundaries

Stage 3A section 3 is the map. Four systems share probability vocabulary. Continuity section 2 is the map Stage 3A relied on. Source files named there are **SOURCE UNCHANGED** since `ceb9d4d`, except where Stage 3D names a range it re-read. Flags Stage 3A re-read at HEAD are marked **READ AT HEAD**.

Stage 3D resolved three basename citations to full paths and checked those ranges: `lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24, `lib/intelligence/engine/pipeline.ts` lines 45–54, and `lib/debug/calibration/pe5-availability/protocol.ts` line 12. The `ConfidenceCalibrator` import is `lib/intelligence/engine/pipeline.ts` line 5, not lines 45–54. Other basename citations remain as Stage 3A wrote them.

| System | Boundary at HEAD | Status |
| --- | --- | --- |
| Product Elo × Poisson v0.1 | `EloPoissonHybridEngine`, `lib/intelligence/modules/probability/`. Contract `docs/PROBABILITY_ENGINE.md`. Defaults in `lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24. **READ AT HEAD** | Implemented and called by product surfaces. Not a statistically promoted model |
| Intelligence Core pipeline | `PredictionPipeline.run` and `runBatch` throw at `lib/intelligence/engine/pipeline.ts` lines 45–54. The class imports `ConfidenceCalibrator` at line 5 and does not run it. **READ AT HEAD** | Unimplemented. D-01 line 153 keeps this path outside Research Complete and still a production-readiness obligation |
| GOALS | `lib/debug/calibration/goals/`. Checkpoint lines 37–40 and 57–61 | Research only. G1 k = 10 is the recorded backbone, not the product λ formula |
| PE-4 expectation | `resolvePe4HistoricalExpectation` returns `status: "UNAVAILABLE"` and null probability fields at `lib/prematch-decision/pe4-form-schedule/expectation-contract.ts` lines 61–71. The reason constant `expectation_model_not_defined` is lines 26–27, and the return uses it at line 63. **READ AT HEAD** in Stage 3D for those ranges | Research only. `PE4I21_PRODUCTION_WIRING = false` at `pe4i21-protocol.ts` line 24. **READ AT HEAD** |
| PE-5 | Classifier, offline probe, and offline acquisition boundary under `lib/debug/calibration/` | Research only. `PE5_PRODUCTION_WIRING = false` at `lib/debug/calibration/pe5-availability/protocol.ts` line 12. `PE53B_LIVE_PROVIDER_AUTHORIZED = false` (`probe-fixtures.ts` line 8). Orchestrator `productionReady: false` and `liveProviderAuthorization: false` (`orchestrator.ts` lines 108–117). **READ AT HEAD** |
| C0 lifecycle | Code path exists. Default mode is `base_prior` while `PE3C_C0_RECON_ACTIVATION` is `false`. `pe3-activation.ts` lines 14–24. **READ AT HEAD** | Historical ticket closed. Standing activation is off |
| Reasoning | `docs/06-ai-engines.md` lines 41–46 | Stubs throw. No OpenAI in that phase |
| Learning | `docs/06-ai-engines.md` lines 53–59 | Post-match evaluation and recommendation metrics. Does not train the Probability Engine |
| Copilot value scan | Continuity section 8 names `lib/copilot/value-scan.ts` as a direct hybrid caller. **SOURCE UNCHANGED** | Existing contract. D-01 lines 41 and 158: a future clause-3 score does not validate it and does not make it a Betting Analyzer. Betting-surface status remains D-08 |

Product engine boundaries in `docs/06-ai-engines.md` lines 73–76 say reasoning must not change the Probability Engine, Learning Engine, Data Platform, or public APIs in that phase. **READ AT HEAD** in Stage 3A.

Flags that remain false, as read by Stage 3A at HEAD:

- `PE3C_C0_RECON_ACTIVATION` is `false`. Default mode `base_prior`.
- `PE4I21_PRODUCTION_WIRING` is `false`.
- `PE5_PRODUCTION_WIRING` is `false`.
- `PE53B_LIVE_PROVIDER_AUTHORIZED` is `false`.
- Orchestrator `productionReady` is `false`.
- Orchestrator `liveProviderAuthorization` is `false`.

Match Center, Vision, and lifecycle clients are outside the PE-5 ledger. Continuity section 9. Whether deployed environments share one vendor credential is **UNKNOWN**. `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` line 811 leaves the dedicated-credential choice unset.

---

## 5. Mathematical models, formulas, constants, and known fidelity gaps

### 5.1 Shipping contract

`docs/PROBABILITY_ENGINE.md` lines 39–126. **READ AT HEAD** in Stage 3A. Not re-read here. Model name in that contract: `elo-poisson-hybrid-0.1.0`.

Recorded formulas and constants:

- Elo win expectancy with home advantage 65 and scale F = 400.
- Elo 1X2 bridge. Draw mass is `D_base * exp(-|Δ| / D_decay)`. The contract leaves draw base and draw decay as symbols.
- Elo-to-λ with μ 1.45 / 1.15, S = 400, γ = 1.0, clamp [0.05, 6].
- Independent Poisson scoreline, grid through 15, truncated 1X2 marginals, Over/Under 2.5 from the Poisson grid only.
- Blend `w * P_poisson + (1 - w) * P_elo` with w = 0.7.

`DEFAULT_HYBRID_CONFIG` adds numeric `eloDrawBase: 0.28` and `eloDrawDecay: 220`, and sets `modelVersion: "elo-poisson-hybrid-0.1.0"`. `lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24. **READ AT HEAD** in Stage 3A. Stage 3D re-checked that range.

Entropy confidence remains `1 - H_norm`, with bands at 0.75 and 0.45. `lib/intelligence/modules/probability/confidence-from-hybrid.ts` lines 16–23. **READ AT HEAD** in Stage 3A.

D-01 line 60 identifies `H_norm` as the normalized Shannon entropy of the blended 1X2 distribution. The existing code comment defines that quantity as `H_norm = -Σ p_i log2(p_i) / log2(3)` at `lib/intelligence/modules/probability/math/normalize.ts` lines 81–84. Stage 3D read those lines. The function that follows divides the accumulated base-2 entropy by `log2(3)` (lines 85–98). Citing that existing definition is not a Gate A verification and is not a new formula.

`docs/PROBABILITY_ENGINE.md` names entropy in the module map and does not state `1 - H_norm` or this definition of `H_norm`. D-01 lines 60–61. That documentation gap remains. Gate A remains **NOT PASSED**.

D-01 lines 58–59 require a future fidelity record to log that the formula document does not state `eloDrawBase` 0.28 and `eloDrawDecay` 220. This handover does not rewrite the contract and does not pass Gate A.

Engine TODOs still in source, `elo-poisson-engine.ts` lines 30–32, **READ AT HEAD** in Stage 3A: Dixon-Coles τ, per-league fit of μ and w, and `EloRatingProvider`.

D-01 section 4 places Dixon-Coles ρ, per-league refits, temporal Elo, and `EloRatingProvider` outside the Research Complete milestone. Deferral is not a fitted rejection.

**Fidelity limitation, preserved.** Poisson, Elo, and score-matrix function bodies were not re-read in the Stage 3A session. They are unchanged files since the continuity audit, which classified them as FACT. That classification is not the independent named-commit fidelity record D-01 clause 1 requires. Gate A remains **NOT PASSED**. D-01 lines 64–66 and 170. D-05 line 135 repeats that. This draft did not re-read those bodies and did not create the missing record.

`docs/PROBABILITY_ENGINE.md` line 3 still says the engine has no frontend or external APIs. Continuity line 131 marks that sentence stale relative to Match Center, Match Analysis, and Copilot. The sentence remains in the contract file. See section 12.

### 5.2 Research models

These are not the product engine and are not promoted parameters.

- GOALS G1 k = 10 is the checkpoint backbone. Checkpoint lines 28 and 40. Holdout 2025 remains `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL`.
- GOALS-1F.1 verdict `NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED` is an audit with Dixon-Coles fitting disabled. D-01 lines 79–83. It is not a production ρ.
- 5C.1 arms stay frozen. Stage 3A summary, which points at 5C.1 sections 4–8 and does not treat this handover as a second authority:
  - CONTROL: production constants.
  - A: role bases 1550/1550, shrinkage k = 8, and the GD-rate term.
  - B: S = 600.
  - C: A plus B.
  - D: C plus the T1 HIGH_EQUAL transfer.
- D-05 section 5 points at 5C.1 sections 4–8 and does not restate the constants as a second authority.
- 5C.1 line 94 states that M1, M2, and M3 are not registered and that T1 is not claimed historically optimal. That line does not itself say that registering arm D promotes or withholds a production multiplier.
- Arm D’s registered T1 operator is not promoted by being registered. That non-promotion sentence is D-05 section 2 point 7, line 38.
- Prospective shares at 0.80, 0.90, and 0.95 are named and not computed. Addendum section K.
- Signed class bias, prospective HIGH_EQUAL O/E, LOW_EQUAL O/E, and temporal periods are recorded as descriptive obligations and are not implemented prospective procedures. Addendum section K.

### 5.3 Frozen pin and fingerprint

Preserved exactly. Not recomputed. Not replaced.

| Item | Preserved value | Boundary |
| --- | --- | --- |
| 5C.1 production commit pin | `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on `develop` | 5C.1 lines 13–17. D-05 lines 85–86. Git metadata in Stage 3D shows this object is an ancestor of current `main`. HEAD `34b086ae068b8ec872e7ae32e466178e9cb3db55` is not a substitute for that pin. Ancestry is not a content audit |
| 5C.1 manifest fingerprint | `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c` | Read from 5C.1 lines 108–110 and from D-05 line 83. Not recomputed. Verification of the load-time manifest digest against this documented hex remains **OPEN / UNAPPROVED** |

The fingerprint string above is the documented hex. Stage 3D did not hash the manifest. The production pin’s ancestry was checked with Git metadata only.

---

## 6. Complete known Probability Engine phase register

Status words are scoped. A commit subject is not closure unless an audit file says so. Phases absent from this table were not identified by Stage 3A. This draft does not reconstruct them.

| Phase | Status | Evidence |
| --- | --- | --- |
| Product v0.1 math and direct callers | Implemented | Contract plus `lib/intelligence/modules/probability/hybrid/config.ts`. Statistical promotion is separate and not done |
| RC2 5B.1–5B.16 | Diagnostic complete | Findings lines 1–7. No production parameter selected. `PRODUCTION_CORRECTION_READY` remained NO because no unseen window existed. Findings lines 225–231, cited by D-01 line 142. **HISTORICAL VERDICT** |
| RC2 freeze, 2026-09-19 | Frozen | Candidate slots A–D are UNASSIGNED at freeze lines 41–44. CONTROL at line 40 is the frozen production baseline |
| RC2 5C.1 | Written and frozen for review | Five arms assigned. No unseen outcomes scored. Lines 189–193 |
| RC2 5C.2 through 5C.7 and 5C.5A / 5C.5B.1 | Infrastructure frozen or debug-only | Status lines cited in section 3. No real prospective sample is recorded as captured or scored |
| PE-3 | **HISTORICAL VERDICT: CLOSED** on fixture `1490209`, verifier PASS | `docs/PE3_FINAL_CLOSURE_AUDIT.md` lines 1–6 and 16–21. C0 remains off. Not re-executed in Stage 3A or here |
| PE-3A, 3B, 3C, 3E, 3F, 3G, 3H | Scoped complete in continuity section 4 | No separate closure markdown for 3A or 3E. Continuity lines 146–148. **PRIOR RECORD** |
| PE-3D | **UNKNOWN** | Continuity line 149. No module or governing document identified |
| PE-4A–H | Offline complete for that checkpoint | Expectation remains UNAVAILABLE. Checkpoint lines 11–20 |
| PE-4I.1–I.21 | Offline foundation closed | I.21 verdict PASS WITH LIMITATIONS. Production wiring false. Line 9 is stale as a later-phase inventory and remains that file’s close boundary |
| PE-5.1 | **UNKNOWN** | Cited at PE-5.2 line 6. File absent. Continuity line 119. This is part of D-02 |
| PE-5.2 | **PARTIAL** | Protocol says the re-audit has not been run. Commit `b7c0ff6` subject says “close.” Continuity lines 95 and 154. **CONFLICT**, unresolved. This is D-03. Formal closure remains unresolved |
| PE-5.3B, 5C, 5D | Offline probes committed | 5.3D is the current offline runner. 5.3C is superseded for mechanism. No PE-5.3B markdown was identified |
| PE-5.4A | **UNKNOWN** | Cited at PE-5.4B line 6. File absent. This is part of D-02 |
| PE-5.4B | Design complete | Live pilot **NO-GO**. Implementation inventory in that file is stale. The NO-GO still binds |
| PE-5.4C increments 1–8 | Offline code present through `ceb9d4d` | Historical offline GO is a commissioning-brief verdict, not a `docs/` closure file. Continuity lines 193–206. **HISTORICAL VERDICT**, not re-audited. That GO does not authorize live acquisition |
| PE-6 | Not started | No specification. D-01 line 40 and line 155. Continuity line 124 and lines 161–162. D-07 |
| PE-7 | Not started | No specification. Same citations as PE-6. D-07 |
| Betting Analyzer | Not started | No specification. D-08 |

### 6.1 Phase disposition classes

| Class | Items |
| --- | --- |
| Owner-approved and binding now | D-01 definition. D-04 Option 1. D-05 AMEND. Addendum only inside the limited ratification scope |
| Historical audited closure, not re-executed | PE-3 live ticket. PE-4I.21 PASS WITH LIMITATIONS. RC2 5B diagnostic consolidation. GOALS checkpoint selections and rejections |
| Provisional | Continuity document, including its section 13 gates and section 14 sequence |
| Deferred by D-01, still not built | Dixon-Coles ρ, per-league μ and w, temporal Elo, `EloRatingProvider`, PE-6, PE-7, Betting Analyzer, live acquisition, `PredictionPipeline` |
| Incomplete relative to Research Complete | Gate A fidelity record. Gate B unseen score. Accepted-study path after AMEND |
| Unresolved on purpose | PE-5.2 formal closure (D-03). Missing PE-5.1 and PE-5.4A (D-02). Fixture-level 2025 identity (D-04 section 12) |

---

## 7. Historical development checkpoints

Dates on the four documentation commits are **GIT METADATA, THIS DRAFT**. Scientific status words remain Stage 3A grades. Commit subjects are not upgraded into closures.

| Order | Checkpoint | What it establishes | What it leaves open |
| --- | --- | --- | --- |
| 1 | Product v0.1 contract, `docs/PROBABILITY_ENGINE.md` | Shipping formula and direct callers exist | Statistical promotion. Gate A. Draw-base, draw-decay, and entropy documentation gaps |
| 2 | RC2 5B.1–5B.16 findings | Diagnostic record. `PRODUCTION_CORRECTION_READY` remained NO | No production parameter. No unseen window |
| 3 | RC2 freeze, 2026-09-19, `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | Used-season prohibition and unseen definition. Candidate slots A–D are UNASSIGNED at lines 41–44 | Later 5C.1 assignment. CONTROL at line 40 stays the frozen production baseline. The freeze was not rewritten |
| 4 | RC2 5C.1, `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | Five arms frozen for review. Production pin on `develop` as cited in section 5.3 | No unseen outcomes scored. Not an accepted study |
| 5 | RC2 5C.2–5C.7 and 5C.5A / 5C.5B.1 | Infrastructure or debug-only protocols | No recorded real prospective capture or score. 5C.5C first live capture is not authorized by the 5C.5B.1 adapter |
| 6 | PE-3 closure audit | **HISTORICAL VERDICT: CLOSED** on one live ticket | C0 remains off. Not later-research closure |
| 7 | PE-3A, 3B, 3C, 3E, 3F, 3G, 3H | Scoped complete in continuity section 4. **PRIOR RECORD** | No separate closure markdown for 3A or 3E |
| 8 | PE-3D | — | **UNKNOWN**. No module or governing document identified |
| 9 | PE-4A–H and GOALS checkpoint | Offline checkpoint. G1 k = 10 retained. Named non-promotions in section 10 | Expectation model UNAVAILABLE. Not production activation |
| 10 | PE-4I.1–I.21 | Offline foundation. I.21 PASS WITH LIMITATIONS | Production wiring false. Not Probability Engine Research Complete |
| 11 | PE-5.1 | — | File absent. **UNKNOWN**. D-02 |
| 12 | PE-5.2 | Remediation recorded in the protocol | Formal closure unresolved. **CONFLICT** with commit `b7c0ff6dbe5869df539f52a5d193d930a5a025a0`, whose subject says “close.” D-03 |
| 13 | PE-5.3B, 5.3C, 5.3D | Offline probes. 5.3D is the current offline runner | 5.3C superseded for mechanism. No PE-5.3B markdown identified. 5.3D does not authorize a live provider call |
| 14 | PE-5.4A | — | File absent. **UNKNOWN**. D-02 |
| 15 | PE-5.4B | Live-acquisition design. Live pilot **NO-GO** | Implementation-inventory sentences are stale. NO-GO still binds. Dedicated credential unset |
| 16 | PE-5.4C increments 1–8, through `ceb9d4d` | Offline code present. Historical offline GO. **HISTORICAL VERDICT** | No `docs/` closure file. Four LOW findings remain. GO does not authorize live acquisition |
| 17 | Continuity audit baseline `ceb9d4d770a2733d49cb601ceda8df0cc30469f8`, Git date 2026-11-06 | Stage 3A’s named audit baseline. Continuity control block line 9 dates the same audit 2026-11-06 | The continuity file itself was added in the next commit |
| 18 | `01684fb3230738f76058d54364768bb4657bc737`, 2026-11-09 | Adds the provisional continuity document. This commit is the D-01 baseline, not the D-01 introduction commit | That document still lists D-01, D-04, and D-05 as undecided. **PROVISIONAL** |
| 19 | `3a3bd665164be12bf237e6880cbd94ba42d37a31`, 2026-11-11 | D-01 introduction commit. Also the D-04 baseline | Adds the D-01 file. Parent is the D-01 baseline `01684fb`. Completion **NOT ACHIEVED**. Not the 5C.1 production pin |
| 20 | `14c10fec9e49758bbca88a43079ef79ac88902a0`, 2026-11-11 | D-04 introduction commit. Also the D-05 baseline | Adds the D-04 file. Parent is the D-04 baseline `3a3bd66`. Option 1 does not decide fixture-level identity. Not the 5C.1 production pin |
| 21 | `34b086ae068b8ec872e7ae32e466178e9cb3db55`, 2026-11-25 | D-05 introduction commit. Current HEAD and pre-handover checkpoint | Adds D-05 and the limited addendum. Parent is the D-05 baseline `14c10fec`. Git introduction date 2026-11-25 is not an in-file decision date. Limited ratification only. Research Complete remains **NOT ACHIEVED**. Not the 5C.1 production pin |
| 22 | Stage 3A inventory, 2026-11-25 | External conversation. **CONDITIONAL — EVIDENCE GAPS REQUIRE REVIEW** | Not a repository artifact. Gaps accepted only as limitations |
| 23 | This file at drafting, 2026-11-25 | Untracked draft, before Stage 3C | Historical drafting state. No commit hash existed then, and none is assigned now |
| 24 | Stage 3C independent audit | **CONDITIONAL PASS — HANDOVER REMEDIATION REQUIRED** | Ten confirmed findings. Historical verdict. Not rewritten by later approval |
| 25 | Stage 3D remediation | All ten findings remediated in this file | F-01 through F-09 and F-11. No F-10. Not a scientific decision |
| 26 | Stage 3E independent re-audit | **PASS — READY FOR OWNER HANDOVER APPROVAL** | All ten original findings independently verified as **RESOLVED**. N-01 remained a LOW editorial finding |
| 27 | Stage 3F owner approval, 2026-11-25 | **OWNER-APPROVED — MIGRATION CONTINUITY RECORD ONLY** | N-01 corrected. Not a commit. Not publication. Pre-handover checkpoint remains `34b086ae068b8ec872e7ae32e466178e9cb3db55` |

PE-6, PE-7, and the Betting Analyzer have no checkpoint. They are not started.

---

## 8. Binding owner decisions D-01, D-04, and D-05

Each decision binds only inside the scope Stage 3A recorded. Historical sentences inside an earlier file are not the current disposition when a later file says those sentences stay historical. The earlier files were not edited. D-04 lines 40–41. D-05 lines 22–23 and 187.

**Baseline and introduction commits.** Each decision file names a baseline as the commit at which `main` stood before that file was added. Git metadata in Stage 3D confirms that the introduction commit’s parent is that named baseline. These commits are not the 5C.1 production pin `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on `develop`.

| Decision | Baseline, named in the control block | Introduction commit, the commit that added the file | In-file dates, distinct from the Git introduction date |
| --- | --- | --- | --- |
| D-01 | `01684fb3230738f76058d54364768bb4657bc737`. D-01 lines 13–14 | `3a3bd665164be12bf237e6880cbd94ba42d37a31`. Git parent is the baseline. Commit date 2026-11-11 | Record date 2026-11-10. D-01 line 16 |
| D-04 | `3a3bd665164be12bf237e6880cbd94ba42d37a31`. D-04 lines 14–15 | `14c10fec9e49758bbca88a43079ef79ac88902a0`. Git parent is the baseline. Commit date 2026-11-11 | Record date 2026-11-11. D-04 line 11 |
| D-05 | `14c10fec9e49758bbca88a43079ef79ac88902a0`. D-05 lines 16–17 | `34b086ae068b8ec872e7ae32e466178e9cb3db55`. Git parent is the baseline. Git introduction date 2026-11-25 | AMEND 2026-11-11 (lines 10–11 and 30). Section 13 consolidation 2026-11-17 (lines 12 and 194). Limited ratification record 2026-11-19 (lines 13 and 97). The Git date 2026-11-25 is not one of those in-file dates |

### 8.1 D-01 — Research Complete definition

**Status:** **OWNER-APPROVED DEFINITION**. Completion **NOT ACHIEVED**.

**Source:** `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md`. Stage 3A cites lines 7–10 and 27–41 for authority and the five-clause definition, and additional lines cited below. Not re-read in this draft. The clause descriptions here are the Stage 3A summary, not a fresh quotation. The decision file remains the authority.

| Clause, as summarized by Stage 3A | Preserved state |
| --- | --- |
| Clause 1. Formula fidelity with an independent record at a named commit | **NOT PASSED**. No such record is in the repository. Gate A **NOT PASSED** |
| Clause 2. Stated deferrals | Binding exclusions. They do not close the milestone |
| Clause 3. D-05 ACCEPT or AMEND, D-04 populations, unseen score including CONTROL, separate log loss, Brier, and ECE | The unmet scientific pass condition. D-04 is recorded. D-05 AMEND is recorded. The unseen score does not exist. Gate B **NOT MET** |
| Clause 4. Scoped offline dispositions | Must not be upgraded. PE-5.2 is not closed. PE-4I.21 is not Probability Engine Research Complete. PE-5.4C GO is not a live or probability-research close |
| Clause 5. Boundary | Squad evidence, PE-6, PE-7, live acquisition, C0 activation, `PredictionPipeline`, and Betting Analyzer stay outside. Copilot is unchanged |

Gate C is **NOT AWARDED**. D-01 lines 180–182. Gate C is a constraint on a Research Complete claim. It is not a request for a new closure audit, and it is not a finding that every offline program is complete. D-01 line 188: Gates A and B are the open blockers, and Gate C is not a third unfinished study. D-05 line 135 records that the D-05 file does not award Gate C.

Gate D is **NOT ACHIEVED**. D-05 lines 129–135 are the later confirmation that AMEND does not close these gates.

D-01 line 20: the owner approved the five clauses in section 2 of that file, not section 13.A–G of the continuity document, as the meaning of D-01. Line 21 is blank. Continuity section 13 was not adopted as the definition of done.

D-01 line 153: `PredictionPipeline` stays outside Research Complete and remains a production-readiness obligation. Line 154 is the separate Betting Analyzer exclusion.

D-01 lines 41 and 158: a future clause-3 score does not validate Copilot and does not make it a Betting Analyzer.

D-01 line 40 states that PE-6 and PE-7 have no specification and are unused names, and that they are outside this milestone. D-01 line 155 states that PE-6 or PE-7 implementation stays unused and that this decision does not define them. Line 156 is the sealed-outcome exclusion, not the PE-6 or PE-7 sentence.

D-01 lines 214 and 215 point at D-02 and D-03 as still open. See section 11.

Sentences in D-01 that D-04 or D-05 is undecided are historical text at the decision’s stated baseline. D-05 says those sentences stay historical. They were not rewritten.

### 8.2 D-04 — 2025 population governance, Option 1

**Status:** **OWNER-APPROVED DECISION**, Option 1.

**Source:** `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md`. Stage 3A cites lines 7–10 and 26–38, and sections 6, 7, 8, 9, 10, and 12.

**Scope that binds.** Named population separation and fail-closed eligibility where fixture overlap with used RC2 Premier League populations is unknown. Sections 7, 8, and 9 remain fully binding. D-05 section 2 point 11 and section 7 confirm that those sections stay binding.

**Scope that does not bind a further choice.** D-04 does not decide fixture-level identity, does not decide D-05, does not authorize scoring, and does not achieve Research Complete.

**Used populations.** Unseen means outcomes not used in 5B.1–5B.16. Freeze lines 50–52, as applied by D-01 and D-04. RC2 Premier League 2023, 2024, and 2025 are used and cannot be called unseen. Freeze lines 18–26. D-04 section 6 confines that confirmed-use label to those RC2 Premier League populations.

**Outcome files.** Publishing RC2 aggregate sentences is allowed. Opening outcome files is not. D-04 section 10.

**Unknowns that remain UNKNOWN.** D-04 section 12. Listed in full in section 11. This decision does not identify them.

Sentences in D-04 that D-05 is undecided are historical. D-05 is the later disposition and says those sentences stay historical. D-04 was not edited.

### 8.3 D-05 — 5C.1 disposition, AMEND

**Status:** **OWNER-APPROVED DISPOSITION — AMEND**.

**Source:** `docs/PE_D05_PREREGISTRATION_DISPOSITION.md`. Stage 3A cites lines 7–20, section 6 as the limited ratification, and section 13 as binding only the decisions it names.

**What was decided.**

- AMEND was selected.
- ACCEPT unchanged was rejected.
- RETIRE was not selected. The post-RETIRE replacement path is untriggered.
- 5C.1 stays frozen and unedited.
- The five arms remain.
- No scoring population is named.
- The addendum is ratified only as **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY**.

**Ratified scope, and nothing wider.** D-05 section 6, lines 99–106, limits the ratification to:

- the D-05 AMEND disposition;
- P-1 strict separate log loss and Brier comparisons on identical evaluated fixtures;
- P-2 descriptive definitions and the calibration-conflict rule, with the remaining P-2 criteria unapproved;
- P-3 multiplicity and uncertainty disclosure principles;
- P-5 checkpoints at N = 100 and N = 250 as descriptive review, and N ≥ 500 as the first possible promotion review, without promotion;
- the clarification that the precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**.

**P-1, as recorded in D-05 section 13.1, lines 202–220.** Log loss and Brier are compared separately against `CONTROL_PRODUCTION` on identical valid fixtures. Delta = candidate minus CONTROL. The requirement is delta ≤ 0. Delta = 0 meets it. No numerical tolerance is approved. N = 0 is excluded. Empty-sample zeros are sentinels. The comparison is a comparison of point estimates. It does not claim statistical significance, superiority, or promotion. ECE is outside P-1.

Brier in that comparison is the existing unnormalized three-class sum. D-05 line 206 states that section 13.1 adds no rescaled Brier. The addendum ratified by D-05 section 6 states the quantity at lines 100–102: `(p_H - y_H)^2 + (p_D - y_D)^2 + (p_A - y_A)^2`. The sum is not divided by 3. A mean that divides the sum by 3 is a different metric and is not permitted under the name Brier. This handover does not install a new Brier formula.

Where the log-loss result and the Brier result conflict, the result is **INCONCLUSIVE / REQUIRES REVIEW**. D-05 line 220.

**Approved descriptive P-2 components.** D-05 section 13.2, lines 222–231. The approved part is descriptive and writes no cutoff.

- Existing 10 equal-width argmax-probability ECE bins. The binned quantity is the maximum 1X2 probability. Stored entropy confidence is a different quantity.
- High-confidence rates at or above 0.80, 0.90, and 0.95, based on the maximum 1X2 probability and distinguished from stored entropy confidence. No new confidence formula is approved.
- Signed class bias: mean predicted probability minus observed frequency, separately for home, draw, and away. No pass or fail cutoff is approved.
- Chronological descriptive reporting. Periods are defined before viewing outcomes. D-05 does not name the periods. Period boundaries remain unapproved.
- HIGH_EQUAL comparison of arm D with arm C on identical valid fixtures, including O/E and deterioration where deterioration is present. No cutoff for that deterioration is approved.

The calibration-conflict rule, D-05 line 232: a calibration conflict that is relevant to a decision remains **INCONCLUSIVE / REQUIRES REVIEW** until materiality criteria are approved before viewing unseen outcomes. This handover does not approve materiality, pathology, superiority, significance, or promotion thresholds.

The residue listed at D-05 lines 234–243 remains **OPEN / UNAPPROVED**. Section 11 records it. P-4 remains unused.

**P-3 and P-5 inside the same ratified scope.** P-3 is multiplicity and uncertainty disclosure. D-05 lines 245–249. No new test and no new threshold is approved. P-5: N = 100 and N = 250 are descriptive review. The first possible promotion review is at N ≥ 500 valid comparable fixtures per candidate, and that review is not promotion. D-05 section 13.4. While section 13.2’s open criteria remain open, a promotion review cannot conclude in promotion.

Primary metrics remain log loss, Brier, and ECE, reported separately. No combined score. No promotion merely because N = 100 looks good.

**What AMEND does not do.** It does not blanket-approve the addendum. It does not authorize capture, scoring, a population, or promotion. It does not pass Gate A. It does not meet Gate B. It does not achieve Gate D or Research Complete. D-05 lines 129–135.

5C.2, 5C.3, 5C.6, and 5C.7 remain later protocol text. D-05 section 13 says they are not edited and are not incorporated into frozen 5C.1.

Preferred design is time-prospective capture. Freeze lines 54–59. Preference is not authorization. D-05 section 8.

Every item Stage 3A listed as still **OPEN / UNAPPROVED** under D-05 section 13.5 and addendum section L stays open. The full list is section 11.

---

## 9. Frozen research protocols and their authority boundaries

Frozen text stays in its own file. Later decisions do not amend it in place. This handover does not amend it either.

| Protocol | Boundary |
| --- | --- |
| 2026-09-19 freeze, `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | Used-season prohibition, unseen definition, three conditions for another historical season, separate metrics, no promotion at N = 100. Candidate slots A–D remain UNASSIGNED at lines 41–44. CONTROL at line 40 is the frozen production baseline |
| 5C.1, `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | Five immutable arms. Documented fingerprint `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c` at lines 108–110, also cited at D-05 line 83. Not recomputed. Load-time digest verification remains **OPEN / UNAPPROVED**. Promotion wording. No live collection in 5C.1. Status frozen for review. Production pin `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` on `develop`. That object is an ancestor of current `main`. HEAD is not a substitute |
| 5C.2, `docs/calibration/RC2_5C_PROSPECTIVE_CAPTURE_PROTOCOL.md` | Capture infrastructure frozen for review. No real fixtures captured |
| 5C.3, `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | Live protocol frozen for authorization review. Provider season unverified. Do not infer provider season from the calendar. Lines 48–54, as cited by D-04 |
| 5C.5A runbook, `docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` | Does not authorize live capture. Its season-2026 operational sentence is not a scoring-population approval. Section 12, contradiction 7 |
| 5C.5B.1, `docs/calibration/RC2_5C_LIVE_EXECUTION_ADAPTER.md` | Offline seam. Does not authorize live capture or 5C.5C |
| 5C.6 and 5C.7 | Scoring and evaluation infrastructure. Not promotion rules. 5C.7 is debug-only |
| PE-4I.21, `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` | Eligibility contract. Production wiring false. “research-complete” on line 7 is this contract only |
| PE-5.2, `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` | No coefficient, no join onto the PE-4 matrix. Line 90. The protocol does not constitute a formal close |
| PE-5.4B, `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` | Live **NO-GO** survives the later offline code. Dedicated credential still unset. Line 811 |
| D-04 sections 7–9 | Fail-closed eligibility and protected populations. Tighter existing seals still bind on their own text |

The historical PE-5.4C offline GO is a commissioning-brief verdict. It is not a frozen `docs/` closure file, and it does not authorize live acquisition.

---

## 10. Historical audits, test results, and remaining findings

Preserved. Not re-run in Stage 3A. Not re-run in this draft. A historical verdict is not fresh evidence.

### 10.1 PE-3 live ticket

**HISTORICAL VERDICT.** Live acceptance PASS for fixture `1490209`, league `253`, season `2026`, Seattle Sounders vs Real Salt Lake. `docs/PE3_FINAL_CLOSURE_AUDIT.md` lines 14–21. Production scheduler stays the BASE path. C0 default remains off. Not re-executed.

### 10.2 PE-4I.21

**HISTORICAL VERDICT.** PASS WITH LIMITATIONS. 117 candidates classified. Calendar-2025 ledger rows stay sealed. `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` lines 7–16 and 22–30. This contract’s “research-complete” wording is this contract only. It is not Probability Engine Research Complete.

### 10.3 RC2 5B

**HISTORICAL VERDICT.** `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md`.

- Hash fallback removed.
- Catalogue geometry and S = 400 can create large gaps.
- HIGH_EQUAL under-allocation replicated, especially 2-2.
- No production parameter selected.
- `PRODUCTION_CORRECTION_READY` remained NO because no unseen window existed. Findings lines 225–231, cited by D-01 line 142.
- Findings lines 17–27 carry the diagnostic points above, as cited by Stage 3A.

The findings file does not give permission to retune the product engine.

### 10.4 GOALS checkpoint

**HISTORICAL VERDICT.** `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md`.

- G1 k = 10 retained. Checkpoint lines 28 and 40.
- G3, distributional extension, market-calibrator promotion, recent-goal form, and rest/fatigue multiplier not promoted. Checkpoint lines 28–49.
- GOALS-1F.1 verdict `NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED`, Dixon-Coles fitting disabled. Not a production ρ. D-01 lines 79–83.
- Holdout 2025 remains `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL`.
- GOALS labels use an FT assumption, and rest/schedule coverage is Premier League only. Checkpoint lines 65–67.
- The checkpoint does not authorize production activation.

### 10.5 PE-5.4C historical offline GO and four LOW findings

**HISTORICAL VERDICT**, continuity lines 193–206 for the offline GO and lines 208–218 for the four behaviors. Not a `docs/` closure file. Not re-audited. Source sites were not re-opened in Stage 3A and were not re-opened in this draft.

The four LOW findings, preserved:

1. Unresolved reserved and sending rows.
2. Public simulator fault injection.
3. Unexpected exceptions can lose operation identifiers.
4. Approval expiry not rechecked at `beginSend`.

These behaviors remain relevant to any future live program. They do not authorize one. Offline tests passing are not live authorization. `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` lines 790–802.

PE-5.4C durability, as Stage 3A read at HEAD in `orchestrator.ts` lines 108–117: in-process only, with no disk persistence, no cross-process consistency, and no crash recovery. `productionReady: false`. `liveProviderAuthorization: false`.

### 10.6 Historical typecheck, lint, tests, and ESLint

The continuity document records the following historical outcomes. Continuity lines 199–204 and 413–417. They are **HISTORICAL VERDICT** from the owner brief that commissioned that document. The continuity writing task did not run Vitest, `tsc`, or ESLint (lines 201–202). Stage 3A did not run them. Stage 3D did not run them. They are not fresh verification. The continuity document states that the repository at that commit does not contain a committed log of 480 or 2040 (line 204), and that no committed `tsc` log was found (line 413). This handover does not reconstruct missing diagnostics, including the identities of the ESLint errors and warnings.

| Check | Historical outcome in the continuity document | What that outcome is not |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | Passing. Line 413 | Not re-executed. Not a committed log |
| PE-scoped ESLint | Passing. Line 414 | Not re-executed. The file set of that scoped run is not restated there, and this handover does not reconstruct it |
| Full-repository ESLint | 10 errors and 63 warnings. Line 415 | Not re-executed. The diagnostic identities are not copied in that file. Line 416 is the PE-5.4C test row, not part of the ESLint result |
| PE-5.4C tests | 480 passing. Lines 199 and 416 | Not re-executed. Not a committed execution log |
| Full suite | 2040 passing. Lines 200 and 417 | Not re-executed. Not a committed execution log |
| Static `it(` and `it.each(` sites | 283 line-anchored `it(` sites and 30 additional line-anchored `it.each(` sites. Line 204 | Source-site counts. Not expanded executed test counts. Not recomputed here. Distinct from the historical 480 and 2040 executed totals |

The per-file split of those static sites is written at continuity line 204. This handover does not recompute it.

### 10.7 Missing-document findings

Preserved as absences. Not filled by reconstruction.

| Missing record | Evidence |
| --- | --- |
| PE-5.1 document | Cited at `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` line 6. File absent. Continuity line 119. **UNKNOWN** authority. D-02 |
| PE-5.4A document | Cited at `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` line 6. File absent. D-02 |
| PE-5.3B markdown | Stage 3A found no markdown. Offline probe code is a separate statement |
| PE-5.4C closure markdown | Absent. Continuity lines 113 and 123 |
| Separate closure markdown for PE-3A and PE-3E | Absent. Continuity lines 146–148. **PRIOR RECORD** of scoped completeness only |
| PE-3D module or governing document | Not identified. Continuity line 149. **UNKNOWN** |
| Betting Analyzer specification | Absent. D-08 |
| Independent Gate A fidelity record at a named commit | Absent. Gate A **NOT PASSED** |
| Content in `docs/00-vision.md`, `docs/01-product-principles.md`, `docs/02-architecture.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md` | Headings only. **READ AT HEAD** in Stage 3A |
| Current-architecture content in `README.md` | Create-next-app text. **READ AT HEAD** in Stage 3A |

---

## 11. Open decision register

Nothing in this section is approved by this draft.

### 11.1 D-05 section 13.5 and addendum section L — OPEN / UNAPPROVED

- Blanket approval of addendum sentences outside the limited record.
- Precise fixture inclusion and validity predicate for P-1.
- Materiality, pathology, superiority, and promotion criteria, including “not materially worse” and “no new pathological ≥90/≥95 behavior.”
- Cutoffs for class bias, temporal stability, LOW_EQUAL degradation, and proper-score degradation.
- Period boundaries for the chronological report.
- Prospective LOW_EQUAL cell identity. The diagnostic cells `{0-0, 1-1}` are not approved for prospective O/E.
- Scoring population. Season 2026 is not verified and is not authorized.
- Capture authorization and scoring authorization.
- Post-capture settlement of an already stored pending record.
- Verification of the load-time manifest digest against the documented hex.
- Any numeric tolerance or significance threshold.
- P-4, which is unused on purpose.

While materiality and the other section 13.2 criteria stay open, a promotion review cannot conclude in promotion.

### 11.2 Continuity register items not decided by D-01, D-04, or D-05

| ID | State |
| --- | --- |
| D-02 | Authority of missing PE-5.1 and PE-5.4A. D-01 line 214. Can remain deferred for Research Complete. Still blocks any claim that those parents were applied |
| D-03 | Whether PE-5.2 is formally closed. D-01 line 215. Calling it closed remains forbidden. **CONFLICT** with commit `b7c0ff6dbe5869df539f52a5d193d930a5a025a0` subject “close.” Protocol says the re-audit has not been run |
| D-06 | Whether squad evidence is ever a model feature. Excluded from this milestone |
| D-07 | Whether PE-6 and PE-7 exist. Names stay unused |
| D-08 | Betting Analyzer preconditions. No specification. Calibration does not establish betting profitability. 5C.1 line 187 |
| D-09 | Whether live acquisition is a separate program. The Research Complete milestone does not wait on it. A live call remains forbidden |

### 11.3 D-04 section 12 population identity unknowns

D-04 section 12, lines 258–267, is the complete numbered list. It contains six unknowns. The six items below transcribe that list. This handover does not add a seventh item to it, does not investigate fixture identities, and does not resolve any unknown. Publishing the list does not convert an unknown into a fact. D-04 line 269.

1. Whether the Premier League 2025 rows used in RC2 5B are the same files, a subset, or a disjoint extract from the calendar-2025 rows the PE-4 ledger is allowed to store. D-04 cites continuity line 349 for this unknown and states that no sealed file was opened to resolve it.
2. Whether any gitignored artifact under `data/calibration/` or `data/prospective/` still contains outcome rows. A clean Git status does not describe gitignored files. D-04 cites continuity lines 350 and 421 for the `data/calibration/` limit and states that its writing task did not list either directory.
3. Whether “Premier League 2025” in RC2, “provider season 2025”, “calendar-2025 UTC kickoff”, and any of the nine GOALS 2025 holdout constants denote the same match set. D-04 cites continuity line 351 for the first three labels. Each GOALS constant is a further unresolved label. The nine constants are not claimed to be one fixture-level population. The checkpoint phrase “Premier League 2025 remains sealed” does not settle this identity question.
4. Which fixture IDs belong to RC2 PL 2023, RC2 PL 2024, or RC2 PL 2025. D-04 line 265 cites the shape file’s season names and dataset kind `NATURAL FULL POPULATION` at that file’s lines 9–16, and cites `ValidationSeasonMetadata` in `lib/debug/calibration/types.ts` lines 185–193. D-04 states that neither file, as read there, is a fixture dump, and that the writing task did not open a population artifact. Stage 3D did not re-open those files.
5. Whether a provider-season-2024 fixture with a calendar-2025 kickoff occurs in any retained ledger, and whether any such fixture was used in RC2. D-04 states that the code distinguishes the case and that occurrence is not measured.
6. The provider season id that a future live prospective capture would verify. D-04 cites 5C.3 lines 48–54, where that field remains `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`. D-04 does not discover it. This handover does not discover it.

The six items above are the complete transcription of D-04’s numbered section 12. Items 1 and 5 are included. Item 4 names RC2 PL 2023, RC2 PL 2024, and RC2 PL 2025, rather than a shorter “which fixture IDs were inside RC2.”

Notes that are not additional D-04 section 12 unknowns:

- This handover did not list `data/calibration/` or `data/prospective/`. Their presence on this computer remains unlisted. That migration limit is not a seventh population unknown.
- Whether deployed environments share one vendor credential remains **UNKNOWN** in the continuity record. It is not one of the six section 12 items.

### 11.4 Operational season discovery is not scoring-population authorization

These sentences stand together. They are not reconciled into a single season verdict.

- `docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` lines 33–39 say 5C.4 live discovery verified API-Football Premier League season 2026 as an operational fact for that runbook.
- 5C.3’s `prospectiveSeason` stays `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`. Do not infer provider season from the calendar. 5C.3 lines 48–54, as cited by D-04.
- D-05 section 13 and addendum section L item 11 say season 2026 is not verified and is not authorized as a scoring population.
- The runbook sentence is not a population approval.
- Stage 3A did not re-execute 5C.4. This draft did not re-execute 5C.4.
- D-04 fail-closed eligibility still binds where fixture overlap with used RC2 Premier League populations is unknown.

---

## 12. Implementation gaps and documentation contradictions

Contradictions are preserved. They are not defects to be smoothed in this draft.

### 12.1 Implementation gaps

- `PredictionPipeline.run` and `runBatch` throw at `lib/intelligence/engine/pipeline.ts` lines 45–54. Product callers use the hybrid engine directly. That split is not production readiness. D-01 line 153. Line 154 is the separate Betting Analyzer exclusion.
- `resolvePe4HistoricalExpectation` returns `status: "UNAVAILABLE"` and null probability fields at `lib/prematch-decision/pe4-form-schedule/expectation-contract.ts` lines 61–71. The reason constant `expectation_model_not_defined` is lines 26–27.
- `PE4I21_PRODUCTION_WIRING`, `PE5_PRODUCTION_WIRING`, `PE53B_LIVE_PROVIDER_AUTHORIZED`, and `PE3C_C0_RECON_ACTIVATION` are false.
- Prospective shares at 0.80, 0.90, and 0.95 are named and not computed. Addendum section K.
- Signed class bias, prospective HIGH_EQUAL O/E, LOW_EQUAL O/E, and temporal periods are descriptive obligations and are not implemented prospective procedures. Addendum section K.
- PE-5.4C durability is in-process only: no disk persistence, no cross-process consistency, and no crash recovery.
- Match Center, Vision, and lifecycle clients are outside the PE-5 ledger. Dedicated-credential choice unset. Shared-credential question **UNKNOWN**.
- Gate A fidelity record is absent.
- No D-04-eligible scoring population is approved.
- No unseen study has been scored.
- Capture authorization and scoring authorization do not exist.
- PE-6, PE-7, and Betting Analyzer have no specification and no implementation checkpoint in the inventory.

### 12.2 Preserved contradictions

1. D-01 and D-04 say D-05 is undecided. D-05 is the later disposition and says those sentences stay historical. The earlier files were not edited.
2. Continuity section 11 and the dependency graph still show D-01, D-04, and D-05 as unresolved. D-01 and D-04 are decided. D-05 is AMEND with a limited ratification. The continuity file was not edited.
3. The freeze leaves candidate slots A–D UNASSIGNED at lines 41–44. CONTROL at line 40 is the frozen production baseline. 5C.1 later assigns the candidate slots. Both texts stand. The freeze was not rewritten.
4. PE-4I.21 line 9 and PE-5.2 line 13 say later phases are not started. Later commits exist. The sentences remain the close boundaries of those files. PE-5.2 line 13 is stale for PE-5.3 and still accurate for PE-6 and PE-7.
5. PE-5.4B lines 3, 10, and 821 say no module in that design is implemented. Offline PE-5.4C code exists. The live **NO-GO** still binds.
6. PE-5.2’s protocol says it is not re-audited. Commit `b7c0ff6dbe5869df539f52a5d193d930a5a025a0` says “close.” D-03 is open. Formal closure remains unresolved.
7. The 5C.5A runbook lines 33–39 record an operational 5C.4 discovery of API-Football Premier League season 2026 for that runbook. 5C.3 keeps `prospectiveSeason` unverified. D-05 and addendum section L item 11 say season 2026 is not verified and is not authorized as a scoring population. The runbook sentence is not a population approval. See section 11.4.
8. Formula contract versus `DEFAULT_HYBRID_CONFIG`: draw base 0.28 and draw decay 220 are numeric in `lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24 and are symbols only in `docs/PROBABILITY_ENGINE.md`. Entropy confidence remains `1 - H_norm`. D-01 line 60 identifies `H_norm` as the normalized Shannon entropy of the blended 1X2. `lib/intelligence/modules/probability/math/normalize.ts` lines 81–84 define `H_norm = -Σ p_i log2(p_i) / log2(3)`. The formula contract does not state that definition. The gap remains. Gate A **NOT PASSED**.
9. Numbered product docs `00` through `02`, `DECISIONS.md`, and `ROADMAP.md` are empty. `README.md` is the create-next-app text. `docs/PRODUCT_BLUEPRINT.md` is the product statement that has content.
10. PE-5.1, PE-5.4A, PE-5.3B markdown, PE-5.4C closure markdown, and a Betting Analyzer specification are absent.
11. Gitignored calibration and prospective directories were not inventoried. Their presence on this computer is **UNKNOWN**. A clean Git status does not describe them.
12. Baseline and introduction are different commits, as the decision control blocks define them and as Git parents confirm. D-01 baseline `01684fb` is the parent of introduction commit `3a3bd66`. D-04 baseline `3a3bd66` is the parent of introduction commit `14c10fec`. D-05 baseline `14c10fec` is the parent of introduction commit `34b086ae`. None of those commits replaces the 5C.1 production pin. Section 8 records the dates.

`docs/PROBABILITY_ENGINE.md` line 3, the “no frontend or external APIs” sentence, remains stale relative to Match Center, Match Analysis, and Copilot. Continuity line 131. The file was not edited to remove it.

---

## 13. Research Complete requirements and blockers

Research Complete means all five D-01 clauses at once. Present status: **NOT ACHIEVED**.

| Requirement | Status |
| --- | --- |
| Clause 1, formula fidelity with an independent record at a named commit | **NOT PASSED**. No such record is in the repository. Gate A **NOT PASSED** |
| Clause 2, stated deferrals | Binding exclusions. They do not close the milestone |
| Clause 3, D-05 ACCEPT or AMEND, D-04 populations, unseen score including CONTROL, separate log loss, Brier, and ECE | D-04 is recorded. D-05 AMEND is recorded. The unseen score does not exist. Gate B **NOT MET** |
| Clause 4, scoped offline dispositions | Must not be upgraded. PE-5.2 is not closed. PE-4I.21 is not Probability Engine Research Complete. PE-5.4C GO is not a live or probability-research close |
| Clause 5, boundary | Squad evidence, PE-6, PE-7, live acquisition, C0 activation, `PredictionPipeline`, and Betting Analyzer stay outside. Copilot is unchanged |

Gate C remains **NOT AWARDED**. D-01 lines 180–182. It is not a third unfinished study. Gates A and B remain the open research blockers. D-01 line 188.

Gate D remains **NOT ACHIEVED**.

Blockers to the claim:

1. Gate A evidence does not exist.
2. No D-04-eligible scoring population is approved.
3. Fixture inclusion predicate, materiality, pathology, superiority, and promotion criteria remain open, so a promotion review cannot conclude.
4. Capture and scoring each need a separate authorization. Neither exists.
5. No unseen study has been scored.

RETIRE was not selected, so the post-RETIRE replacement path is untriggered.

Clause 4 forbids upgrading these historical or scoped results into Research Complete:

- PE-3 closure of one live ticket.
- PE-4I.21 PASS WITH LIMITATIONS, including the contract-local word “research-complete.”
- RC2 5B diagnostic completion.
- GOALS checkpoint selections.
- PE-5.4C historical offline GO.

---

## 14. Deferred scope and future production dependencies

These are recorded dependencies, not an approved build order. Continuity section 13 gates E, F, and G are **PROPOSAL**. D-01 did not adopt that section as the definition of done. D-01 line 20 states that the owner approved the five clauses in D-01 section 2, not continuity section 13.A–G. Line 21 of D-01 is blank.

Deferred by D-01, still not built:

- Dixon-Coles ρ and the engine TODO for Dixon-Coles τ. Deferral is not a fitted rejection. GOALS-1F.1 is not a production ρ.
- Per-league μ and w.
- Temporal Elo.
- `EloRatingProvider`.
- PE-6 and PE-7. D-07. Names stay unused.
- Betting Analyzer. D-08. No specification. 5C.1 line 187: calibration does not establish betting profitability.
- Live acquisition. D-09. The Research Complete milestone does not wait on it. A live call remains forbidden.
- `PredictionPipeline` and the calibrator path. They remain unwired. They stay a production-readiness obligation outside Research Complete.

Future production integration, if it is ever authorized by a separate decision:

- A future production constant change needs Gate A and Gate B for the constants production will keep or change. No parameter is promoted now.
- C0 stays off unless a separate activation decision sets `PE3C_C0_RECON_ACTIVATION`.
- `PE4I21_PRODUCTION_WIRING` and `PE5_PRODUCTION_WIRING` stay false until a separate wiring decision.
- Live acquisition stays **NO-GO** until a later authorization, an implementation audit, and the PE-5.4B credential rule. Offline tests passing are not that authorization. PE-5.4B lines 790–802.
- The four PE-5.4C LOW findings remain live-program issues.
- Product API-Football clients used by Match Center, Vision, and the lifecycle scheduler are a separate credential surface from the PE-5 ledger.
- `allow-offline` is not a live send. Continuity section 9.

No parameter promotion, no PE-6 initiation, no PE-7 initiation, no Betting Analyzer initiation, and no production activation is authorized by this handover.

---

## 15. Development environment and repository conventions

### 15.1 Versions and tools Stage 3A read

**READ AT HEAD** in Stage 3A from `package.json` and `.github/workflows/apex-prematch-lifecycle.yml`. Not re-read in this draft.

- Package `apex-intelligence` `0.1.0`, private.
- Next.js `16.3.0`, React `19.2.8`, TypeScript 5, ESLint 9, Vitest `4.1.10`, Tailwind 4.
- The prematch lifecycle workflow uses Node.js 22.
- No `.nvmrc` was found by Stage 3A.
- `AGENTS.md` states that this Next.js version differs from ordinary training-data assumptions and points at `node_modules/next/dist/docs/`.
- App scripts include `dev`, `build`, `start`, `lint`, and `test`.
- Many `calibration:*` scripts exist. They are manual CLIs. Stage 3A did not authorize running them. This handover does not authorize running them.

### 15.2 Local toolchain versions

Actual local Node.js, npm, and Git versions were not recorded by Stage 3A and were not collected in this drafting session. They still require owner-side verification. Workflow Node.js 22 is a CI pin in the lifecycle workflow, not a measurement of the local install. Absence of `.nvmrc` is the Stage 3A finding. This draft does not create one.

### 15.3 Repository conventions relevant to continuity

- Pre-handover line is `main` at `34b086ae068b8ec872e7ae32e466178e9cb3db55`, aligned with `origin/main`.
- Tracked changes since `ceb9d4d770a2733d49cb601ceda8df0cc30469f8` are the five documentation additions in section 1.2.
- Do not edit frozen protocols so that a later narrative looks cleaner. Continuity lines 631–632.
- Do not treat a commit subject that says “close” or “ratify” as a scientific closure beyond the file’s own status words.
- `.env*` is gitignored. Credentials were not opened.
- `/data/calibration/` and `/data/prospective/` are gitignored at `.gitignore` lines 37–41. A clean Git status does not describe them. A clone of Git history does not carry those artifacts.

---

## 16. Operational safety restrictions

### 16.1 Already in force in the repository record

Stage 3A operational rules, preserved:

- Do not treat a clean worktree as proof that ignored research files moved with the clone.
- Do not call API-Football, score outcomes, or set `PE3C_C0_RECON_ACTIVATION`, `PE4I21_PRODUCTION_WIRING`, or `PE5_PRODUCTION_WIRING` to true under the inventory. This handover does not grant that permission either.
- Do not edit frozen protocols to clean up a later narrative.
- `allow-offline` is not a live send.
- Do not open outcome files. D-04 section 10. Publishing RC2 aggregate sentences remains a separate, already-recorded allowance inside D-04.
- Do not infer provider season from the calendar.
- Live acquisition remains **NO-GO**.
- PE-5.4C historical offline GO does not authorize live acquisition.
- Season 2026 is not authorized as a scoring population.
- No scoring population is named.
- Gate A is **NOT PASSED**. Gate B is **NOT MET**. Research Complete is **NOT ACHIEVED**.

### 16.2 Migration-window restrictions

**OWNER AUTHORIZATION, THIS DRAFT.** In force for migration. They do not relax section 16.1.

- No application code changes.
- No modifications to existing documents.
- No changes to frozen protocols.
- No tests or evaluation runs.
- No live API calls.
- No credential access. Credentials must not be exposed, printed, or committed.
- Do not open `data/calibration/` or `data/prospective/`.
- No prospective capture or scoring.
- No population or season authorization.
- No parameter promotion.
- No PE-6, PE-7, or Betting Analyzer initiation.
- No production activation.
- No staging, commit, push, or branch creation as part of this drafting session.
- Do not resume scientific development during migration.

Protected research directories, if they exist locally, are preserved only through a secure, opaque backup that does not inspect their contents. This draft did not inspect them.

---

## 17. Migration requirements and limitations

**OWNER AUTHORIZATION, THIS DRAFT**, together with Stage 3A’s gitignore finding. This handover does not certify any backup or any restoration.

| Requirement | Limitation |
| --- | --- |
| Git history and GitHub | `origin` is `https://github.com/franjvb8998-byte/apex-intelligence.git`. GitHub does not preserve all local ignored files. A clone of Git history does not carry gitignored artifacts. Stage 3A already recorded that limit for `/data/calibration/` and `/data/prospective/` |
| Protected research directories | `data/calibration/` and `data/prospective/` are gitignored (`.gitignore` lines 37–41). They must be preserved through a secure, opaque backup without inspecting their contents. Their presence on this computer is **UNKNOWN**. This draft did not list or open them |
| Credentials | `.env*` is gitignored. Credentials must not be exposed, printed, or committed. None were opened in Stage 3A or in this draft. The PE-5.4B dedicated-credential choice remains unset. Whether deployed environments share one vendor credential is **UNKNOWN** |
| Cursor conversation history and settings | These require a separate backup. The Stage 3A inventory exists as external conversation history, not as a repository file. This handover transcribes it. The transcription does not replace a backup of Cursor history or settings, and it does not include conversation history that Stage 3A did not put in the inventory |
| Local toolchain | Actual local Node.js, npm, and Git versions still require owner-side verification. They were not collected here |
| Destination computer | Migration completion requires verification on the destination computer. Matching this pre-handover commit on a clone does not, by itself, prove that ignored files, credentials, or Cursor state arrived |
| This document | Does not certify a backup. Does not certify a restoration. Does not certify Gate A, Gate B, Gate D, Research Complete, PE-5.2 closure, or live acquisition |

Stage 3A’s own resumption sentence said master-handover drafting had not started. That sentence is historical. The owner later authorized the draft, the Stage 3E re-audit passed, and Stage 3F records owner approval. The current resumption point is section 18.

Scientific development does not resume during migration.

---

## 18. Exact resumption point

**Pre-handover checkpoint:** `34b086ae068b8ec872e7ae32e466178e9cb3db55` on `main`, with `origin/main` at the same commit. That checkpoint is unchanged. No future commit hash is assigned to this file. Publication has not occurred.

**Document status at this resumption point:** **OWNER-APPROVED — MIGRATION CONTINUITY RECORD ONLY**. Approval date 2026-11-25. The file remains untracked until a separate manual documentation commit.

**Immediate next action:** owner-side verification of the final documentary changes, followed by a separate manual documentation commit and push.

**After publication:** continue with migration environment inventory and secure backups. This sentence does not certify that publication, backup, or restoration has occurred.

**Not the resumption point:** any research phase, production phase, capture, scoring run, provider call, population choice, season authorization, parameter promotion, PE-6, PE-7, Betting Analyzer, or production activation. Scientific development does not resume during migration.

The approved record stops at the same line D-05 already draws: Research Complete is **NOT ACHIEVED**; D-04 sections 7, 8, and 9 stay binding; the addendum’s open sentences stay open. Owner approval does not move that line.

---

## 19. Authoritative source index

This index lists sources Stage 3A treated as the continuity record, plus git metadata verified in this drafting session. It does not add new governing documents. Grades are Stage 3A grades unless marked otherwise. “Not re-audited here” means this drafting session did not re-read the file.

### 19.1 Governing and frozen documents

| Path | Grade in Stage 3A | Role in this handover |
| --- | --- | --- |
| `docs/PRODUCT_BLUEPRINT.md` | **READ AT HEAD**, lines 10–29 | Mission and vision. Not phase closure |
| `docs/06-ai-engines.md` | **READ AT HEAD**, lines 21–39, 41–46, 53–59, 73–76 | Engine boundaries |
| `docs/PROBABILITY_ENGINE.md` | **READ AT HEAD**, lines 1–5 and 39–126; line 3 stale | Shipping v0.1 contract. Not a Gate A pass |
| `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` | **PROVISIONAL**, lines 3–12; many **PRIOR RECORD** line citations | Continuity map. Superseded “undecided” sentences remain in the file |
| `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` | **OWNER DECISION** | Five-clause definition. Completion **NOT ACHIEVED** |
| `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` | **OWNER DECISION** | Option 1. Sections 7–9 binding. Section 12 **UNKNOWN** |
| `docs/PE_D05_PREREGISTRATION_DISPOSITION.md` | **OWNER DECISION** | AMEND. Limited ratification. Section 13.5 still open |
| `docs/calibration/RC2_5C_PREREGISTRATION_GOVERNANCE_ADDENDUM.md` | **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY** | Only the ratified scope. Section L stays open |
| `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | Frozen | 2026-09-19 freeze. Candidate slots A–D are UNASSIGNED at lines 41–44. CONTROL at line 40 is the production baseline |
| `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | **READ AT HEAD**, lines 13–17, 108–110, and 189–193. Line 94 is the “T1 is not claimed historically optimal” sentence. Line 187 is the profitability sentence | Frozen five-arm pre-registration. Fingerprint cited, not recomputed |
| `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | **HISTORICAL VERDICT** | Diagnostic. No parameter selected |
| `docs/PE3_FINAL_CLOSURE_AUDIT.md` | **HISTORICAL VERDICT** | One live ticket. C0 off |
| `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` | **HISTORICAL VERDICT** | Research checkpoint. Not production |
| `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` | **HISTORICAL VERDICT** | PASS WITH LIMITATIONS for that contract only |
| `docs/PE4I1` through `docs/PE4I20` | Stage records | Not rewritten by I.21. Not re-read here |
| `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` | Protocol. Formal close unresolved | Evidence-class rules. D-03 |
| `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` | Current offline probe | Does not authorize live transport |
| `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` | Live **NO-GO** | Stale implementation inventory. NO-GO binds |
| `docs/calibration/RC2_5C_PROSPECTIVE_CAPTURE_PROTOCOL.md` | Frozen for review | 5C.2. No real fixtures captured |
| `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | Frozen for authorization review | 5C.3. `prospectiveSeason` unverified |
| `docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` | Does not authorize live capture | 5C.5A. Operational season sentence is not population approval |
| `docs/calibration/RC2_5C_LIVE_EXECUTION_ADAPTER.md` | Does not authorize live capture | 5C.5B.1. Does not authorize 5C.5C |
| `docs/calibration/RC2_5C_PROSPECTIVE_SCORING_PROTOCOL.md` | Infrastructure | 5C.6. No unseen score |
| `docs/calibration/RC2_5C_PROSPECTIVE_EVALUATION_PROTOCOL.md` | Debug-only | 5C.7. Not a promotion rule |

### 19.2 Non-authoritative repository files

| Path | Grade in Stage 3A | Role |
| --- | --- | --- |
| `README.md` | **READ AT HEAD** | Create-next-app text. Not current architecture |
| `docs/00-vision.md` | **READ AT HEAD** | Empty skeleton |
| `docs/01-product-principles.md` | **READ AT HEAD** | Empty skeleton |
| `docs/02-architecture.md` | **READ AT HEAD** | Empty skeleton |
| `docs/DECISIONS.md` | **READ AT HEAD** | Empty skeleton |
| `docs/ROADMAP.md` | **READ AT HEAD** | Empty skeleton |

### 19.3 Code and config citations

Stage 3D resolved the three ambiguous basenames named in F-06 and corrected the expectation-contract ranges named in F-08. Other basename citations remain as Stage 3A wrote them. Files marked **SOURCE UNCHANGED** were not re-read line by line, except the ranges Stage 3D names.

| Citation | Stage 3A grade | Point preserved |
| --- | --- | --- |
| `lib/intelligence/modules/probability/` | Map; contract **READ AT HEAD** | Product hybrid engine location |
| `lib/intelligence/modules/probability/hybrid/config.ts` lines 7–24 | **READ AT HEAD**. Range re-checked in Stage 3D | `eloDrawBase` 0.28, `eloDrawDecay` 220, `modelVersion` `elo-poisson-hybrid-0.1.0` |
| `lib/intelligence/modules/probability/confidence-from-hybrid.ts` lines 16–23 | **READ AT HEAD** | Entropy confidence `1 - H_norm`, bands 0.75 and 0.45 |
| `lib/intelligence/modules/probability/math/normalize.ts` lines 81–84 | **READ AT HEAD** in Stage 3D | `H_norm = -Σ p_i log2(p_i) / log2(3)`. Not a Gate A pass |
| `elo-poisson-engine.ts` lines 30–32 | **READ AT HEAD** | TODOs: Dixon-Coles τ, per-league μ and w, `EloRatingProvider` |
| `lib/intelligence/engine/pipeline.ts` line 5 and lines 45–54 | **READ AT HEAD**. Range re-checked in Stage 3D | Line 5 imports `ConfidenceCalibrator`. Lines 45–54: `run` and `runBatch` throw |
| `lib/debug/calibration/goals/` | Checkpoint citations | Research only |
| `lib/prematch-decision/pe4-form-schedule/expectation-contract.ts` lines 26–27 and 61–71 | **READ AT HEAD** in Stage 3D | Reason constant `expectation_model_not_defined` at lines 26–27. Return `status: "UNAVAILABLE"` and null probability fields at lines 61–71 |
| `pe4i21-protocol.ts` line 24 | **READ AT HEAD** | `PE4I21_PRODUCTION_WIRING = false` |
| `lib/debug/calibration/pe5-availability/protocol.ts` line 12 | **READ AT HEAD**. Range re-checked in Stage 3D | `PE5_PRODUCTION_WIRING = false` |
| `probe-fixtures.ts` line 8 | **READ AT HEAD** | `PE53B_LIVE_PROVIDER_AUTHORIZED = false` |
| `orchestrator.ts` lines 108–117 | **READ AT HEAD** | `productionReady: false`, `liveProviderAuthorization: false`, in-process durability |
| `pe3-activation.ts` lines 14–24 | **READ AT HEAD** | `PE3C_C0_RECON_ACTIVATION` false, default `base_prior` |
| `lib/copilot/value-scan.ts` | **SOURCE UNCHANGED** | Direct hybrid caller. Not a Betting Analyzer |
| `package.json` | **READ AT HEAD** | Package and dependency versions in section 15 |
| `.github/workflows/apex-prematch-lifecycle.yml` | **READ AT HEAD** | Node.js 22 in that workflow |
| `.gitignore` lines 37–41 | Cited by Stage 3A | Ignores `/data/calibration/` and `/data/prospective/` |
| `AGENTS.md` | Cited by Stage 3A | Next.js docs pointer. Not a scientific authority |

Poisson, Elo, and score-matrix function bodies are **SOURCE UNCHANGED** relative to the continuity audit’s FACT classification. They were not re-read in Stage 3A and were not re-read here. That is not Gate A.

### 19.4 External and unverified sources

| Source | Class | Limit |
| --- | --- | --- |
| Stage 3A Master Handover Evidence Inventory, Cursor conversation on 2026-11-25 | **EXTERNAL CONVERSATION** | Drafting basis. Not a repository file. Not independently audited. Verdict **CONDITIONAL — EVIDENCE GAPS REQUIRE REVIEW** |
| Other Cursor conversation history | Not inventoried | Not a source of technical fact for this handover. Requires a separate backup if it is to survive migration |
| Cursor settings | Not inventoried | Separate backup. Not certified here |
| `data/calibration/` and `data/prospective/` | **UNKNOWN** presence. Not opened | Opaque backup only, if the owner later authorizes backup. Contents not a source for this draft |
| `.env*` and any credential store | Not opened | Must not be printed or committed |
| Local Node.js, npm, and Git version commands | Not run | Owner-side verification still required |
| Destination-computer restoration | Not performed | This handover does not certify it |

### 19.5 Git objects cited

| Object | Class | Note |
| --- | --- | --- |
| `34b086ae068b8ec872e7ae32e466178e9cb3db55` | **GIT METADATA, THIS DRAFT** and Stage 3A HEAD | Pre-handover checkpoint. Not the 5C.1 production pin |
| `ceb9d4d770a2733d49cb601ceda8df0cc30469f8` | **GIT METADATA, THIS DRAFT** | Continuity-audit baseline. Git date 2026-11-06. Not the 5C.1 production pin |
| `01684fb3230738f76058d54364768bb4657bc737` | **GIT METADATA, THIS DRAFT** | D-01 baseline. Also the commit that added the continuity document. Parent of the D-01 introduction commit |
| `3a3bd665164be12bf237e6880cbd94ba42d37a31` | **GIT METADATA, THIS DRAFT** | D-01 introduction commit and D-04 baseline |
| `14c10fec9e49758bbca88a43079ef79ac88902a0` | **GIT METADATA, THIS DRAFT** | D-04 introduction commit and D-05 baseline |
| `b7c0ff6dbe5869df539f52a5d193d930a5a025a0` | **GIT METADATA, THIS DRAFT** | Full form of Stage 3A’s `b7c0ff6`. Subject says “close.” D-03 remains open. Object contents were not audited |
| `967b541f3947a4f9cfe0d1fe5eea57f3de880f62` | Preserved 5C.1 pin on `develop`. 5C.1 lines 13–17 | Ancestor of current `main`, verified by Git metadata in Stage 3D. HEAD is not a substitute. Contents not audited |
| Fingerprint `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c` | Read from 5C.1 lines 108–110 and D-05 line 83 | Not recomputed. Load-time digest verification remains **OPEN / UNAPPROVED** |

---

## Document close

This file is **OWNER-APPROVED — MIGRATION CONTINUITY RECORD ONLY**. Approval date 2026-11-25. It is not a governing authority. It does not supersede D-01, D-04, D-05, or any frozen protocol. It does not certify a backup or a restoration. Publication has not occurred.

Research Complete remains **NOT ACHIEVED**. Gate A remains **NOT PASSED**. Gate B remains **NOT MET**. Gate C remains **NOT AWARDED**. Gate C is not a third unfinished study. Gates A and B remain the open research blockers. PE-5.2 formal closure remains unresolved. The PE-5.4C historical offline GO does not authorize live acquisition.

The immediate next action is owner-side verification of these final documentary changes, followed by a separate manual documentation commit and push. After publication, migration continues with environment inventory and secure backups. Scientific development does not resume during migration. The pre-handover checkpoint remains `34b086ae068b8ec872e7ae32e466178e9cb3db55`.
