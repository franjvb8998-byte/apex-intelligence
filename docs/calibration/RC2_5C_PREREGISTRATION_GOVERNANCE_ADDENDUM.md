# RC2 5C — Prospective Governance Addendum

**Status: OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY.**

The owner has ratified this document solely as the governance record of decisions already approved. The date of this ratification record is 2026-11-19. The task did not state a separate decision date. This file does not invent one. The AMEND decision date remains 2026-11-11. The section 13 consolidation date remains 2026-11-17.

The ratified scope is only:

- the D-05 AMEND disposition;
- P-1 strict separate log loss and Brier comparisons on identical evaluated fixtures;
- P-2 descriptive definitions and the calibration-conflict rule, with the remaining P-2 criteria unapproved;
- P-3 multiplicity and uncertainty disclosure principles;
- P-5 checkpoints at N = 100 and N = 250 as descriptive review, and N ≥ 500 as the first possible promotion review, without promotion;
- the L-B clarification that the precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**.

Sentences marked **OPEN / UNAPPROVED** or **PROPOSED, NOT YET APPROVED** are not ratified. This status does not approve a scoring population or season 2026. It does not authorize capture, scoring, promotion, production activation, a code change, PE-6, PE-7, a Betting Analyzer, or a Research Complete declaration. D-04 restrictions remain binding. Frozen 5C.1 stays separate from later protocol text.

No new model arm, parameter value, numeric promotion cutoff, or scoring dataset is selected here.

Named decisions recorded in `docs/PE_D05_PREREGISTRATION_DISPOSITION.md` section 13 are restated below with the label **RECORDED OWNER DECISION**. That label means the disposition records the choice and this limited ratification records that restatement. It does not approve any choice the label does not name. Choices not named in section 13 remain **OPEN / UNAPPROVED**. If a sentence of this document conflicts with section 13 on a named decision, section 13 is the record of that decision.

## How to read a label

Each methodological statement below carries one of these labels. A sentence may carry more than one label when an existing fact and a proposed use of that fact are different acts.

| Label | Meaning in this draft |
| --- | --- |
| FROZEN RULE | Already written in the prospective freeze or in RC2 5C.1. This draft does not edit it. |
| LATER PROTOCOL TEXT | Written in a protocol after the 2026-09-19 freeze and after 5C.1, including 5C.2, 5C.3, 5C.6, and 5C.7. This draft cites it and does not edit it. The citation does not make the sentence a rule of 5C.1. |
| IMPLEMENTATION CONVENTION | Already written in code, or in a later protocol that says it reuses earlier code. It is not, by that fact alone, a sentence of frozen 5C.1. A later protocol’s own operational rule, including a 5C.2 clock or a 5C.3 window, is LATER PROTOCOL TEXT even when code implements it. |
| PROPOSED, NOT YET APPROVED | A binding reading this draft asks the owner to accept. It is not disguised as a clarification of a number the freeze already stated. |
| RECORDED OWNER DECISION | A choice recorded in the D-05 disposition, section 13, and included in the limited governance record. This document restates it. The restatement does not edit 5C.1 and does not approve any choice that label does not name. |
| MISSING IMPLEMENTATION | Named by a frozen rule or by this draft, and not found as an implemented prospective procedure at this baseline. |
| OWNER DECISION STILL REQUIRED | A choice this draft deliberately does not make. |
| OPEN / UNAPPROVED | A choice section 13 of the disposition leaves unresolved. Printing it here does not approve it. |

This writing task did not execute code, recompute a fingerprint, open `data/calibration/` or `data/prospective/`, run a test, or contact a provider. Citations are readings at `14c10fec9e49758bbca88a43079ef79ac88902a0`.

## A. Document authority and relationship to frozen 5C.1

| Field | Value |
| --- | --- |
| Document | Prospective governance addendum for RC2 5C |
| Status | OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY |
| Date of this draft | 2026-11-11 |
| Date of the section 13 restatement | 2026-11-17 |
| Date of the limited documentary ratification record | 2026-11-19 |
| Repository | `C:\Projects\apex-intelligence` |
| Branch | `main` |
| Baseline commit | `14c10fec9e49758bbca88a43079ef79ac88902a0` |
| Parent disposition | `docs/PE_D05_PREREGISTRATION_DISPOSITION.md`, status OWNER-APPROVED DISPOSITION — AMEND. Section 13 records P-1, part of P-2, P-3, and P-5. Section 6 records this limited ratification. Unresolved sentences remain unapproved. |
| Frozen pre-registration | `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` |
| Population decision | `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md`, status OWNER-APPROVED DECISION |
| Research-complete definition | `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md`, completion status NOT ACHIEVED |

**FROZEN RULE.** 5C.1 remains the candidate pre-registration. Its status remains **FROZEN FOR REVIEW — no unseen outcomes scored** (5C.1 lines 1–7 and 189–193). This document is the limited governance record beside that file. It is not a replacement, and it does not change a byte of that file.

**FROZEN RULE.** The 2026-09-19 freeze required exact formulas, constants, and code hashes before loading or scoring unseen outcomes, and it left slots A–D unassigned (`docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` lines 32–47). 5C.1 is the later assignment of those slots. D-05 selected AMEND rather than ACCEPT unchanged and rather than RETIRE. The amendment path therefore needs a supplement. This document is the limited governance record of that supplement. Authority to apply it to capture, scoring, or promotion does not exist.

**OWNER DECISION STILL REQUIRED.** Blanket approval of sentences marked **OPEN / UNAPPROVED** or **PROPOSED, NOT YET APPROVED**. The limited ratification at the top of this document does not close those sentences.

If this draft conflicts with frozen 5C.1 on an arm identity, a primary-metric name, or a prohibition, frozen 5C.1 wins. This draft does not amend 5C.1. A reading of an undefined phrase has force only when section 13 of the disposition records that reading. A reading that this draft still marks **OPEN / UNAPPROVED**, or **PROPOSED, NOT YET APPROVED**, has no force. Applying an open phrase by analyst discretion after outcomes are seen is outside both the frozen rule and this draft.

## B. Preservation of the five registered arms

**FROZEN RULE.** Exactly five arms. No sixth. No grid. No adaptive creation after prospective results begin (5C.1 lines 96–98 and 172–174).

| Arm | ID | Definition that remains authoritative |
| --- | --- | --- |
| CONTROL | `CONTROL_PRODUCTION` | 5C.1 section 4, lines 29–50 |
| A | `CANDIDATE_A_INPUT` | 5C.1 section 5, lines 52–62 |
| B | `CANDIDATE_B_TRANSFORM` | 5C.1 section 6, lines 64–71 |
| C | `CANDIDATE_C_COMBINED` | 5C.1 section 7, lines 73–79 |
| D | `CANDIDATE_D_COMBINED_HIGH_EQUAL` | 5C.1 section 8, lines 81–94 |

The same five identifiers are the manifest order in `lib/debug/calibration/prospective/candidate-types.ts` lines 10–16 and `lib/debug/calibration/prospective/candidate-config.ts` lines 60–106. `assertExactlyFiveArms` refuses a list whose length is not five (`candidate-config.ts` lines 188–195).

**FROZEN RULE.** CONTROL must not change (5C.1 line 50). Candidates A–D keep the constants 5C.1 already assigned. This draft does not restate those constants as a second numeric authority, so a transcription cannot become a new parameter.

**FROZEN RULE.** M1, M2, and M3 are not registered. T1 is not claimed historically optimal (5C.1 line 94). Dixon-Coles production correction, bivariate Poisson, a new confidence formula, and historical retuning remain prohibited (5C.1 lines 183–185).

**IMPLEMENTATION CONVENTION.** Arm D calls `applyCandidateHighEqual`, which refuses any relative increase other than the existing `TRANSFER_HIGH_EQUAL_RELATIVE` of `0.1` and then calls `applyHighEqualTransfer` (`lib/debug/calibration/prospective/candidate-high-equal.ts` lines 13–22; `lib/debug/calibration/lm-5b16-shape.ts` line 28; `lib/debug/calibration/lm-5b16-formula.ts` lines 146–188). That operator is the registered arm. It is not a promoted production multiplier.

## C. Explicit metric conventions

5C.1 names log loss, Brier, and ECE and forbids combining them into one score (lines 133–139). The freeze states the same three names (lines 71–79). Neither document writes an epsilon, a Brier normalization, a bin count, or an empty-sample rule.

The conventions in this section already exist in `lib/debug/calibration/metrics.ts` and are restated by the 5C.6 and 5C.7 protocols as reused definitions. **RECORDED OWNER DECISION.** P-1 compares the existing reported log loss and the existing reported Brier. The ECE part of P-2 uses the existing 10 equal-width argmax-probability bins. Empty-sample zeros are sentinels. Those choices use the quantities the existing functions already return. They do not approve a different epsilon, a Brier mean that divides the row sum by 3, a different bin count, a tolerance, or a code change. They do not extend this limited ratification beyond the decisions it names. A different formula is not installed by silence.

### C.1 Log loss

**IMPLEMENTATION CONVENTION.** `LOG_LOSS_EPS = 1e-15` (`lib/debug/calibration/metrics.ts` line 11). Per observation, log loss is `-log(min(1, max(eps, p_y)))` with that default epsilon (lines 82–89). The prospective scorer calls that function (`lib/debug/calibration/prospective/scoring/scoring-metrics.ts` lines 6–19 and 49). 5C.6 states the same formula and says 5C.6 does not invent a new epsilon (`docs/calibration/RC2_5C_PROSPECTIVE_SCORING_PROTOCOL.md` lines 40–42). 5C.7 averages those contributions (`docs/calibration/RC2_5C_PROSPECTIVE_EVALUATION_PROTOCOL.md` line 90).

The same numeric epsilon exists in `lib/prematch-evaluation/metrics.ts` line 6. That module is a separate product-evaluation implementation. This draft does not merge the two modules and does not treat the product module as the prospective scorer.

**RECORDED OWNER DECISION.** P-1 uses this existing mean of per-observation contributions as the candidate log loss and as the CONTROL log loss. The candidate and CONTROL are evaluated over the exact same evaluated fixture set. The precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**, as section E.2 records. `1e-15` remains that existing clip. It is not a promotion tolerance, not a comparison tolerance, and not a significance level. P-1 does not claim statistical significance.

### C.2 Multiclass Brier

**IMPLEMENTATION CONVENTION.** `brierOneXTwo` is `(p_H - y_H)^2 + (p_D - y_D)^2 + (p_A - y_A)^2` (`metrics.ts` lines 91–101). The sum is not divided by 3. The prospective scorer stores that sum and the three components (`scoring-metrics.ts` lines 50–53). 5C.6 lines 44–45 and 5C.7 line 91 state the same unnormalized sum. The reported Brier is the mean of those row sums (`lib/debug/calibration/prospective/evaluation/evaluation-aggregate.ts` lines 43–44).

**RECORDED OWNER DECISION.** P-1 uses that unnormalized three-class sum, averaged over the exact same evaluated fixture set, as the prospective Brier. The precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**, as section E.2 records. A mean that divides the sum by 3 would be a different metric. This decision does not define that rescaled metric and does not permit it to be compared with the unnormalized mean under the name Brier.

### C.3 ECE

**IMPLEMENTATION CONVENTION.** `CALIBRATION_BIN_COUNT = 10` (`metrics.ts` line 12). `reliabilityBins` bins the probability of the argmax class into ten equal-width bins. The argmax rule is: home when `p_home` is at least both rivals; otherwise away when `p_away` is at least `p_draw`; otherwise draw (`metrics.ts` lines 103–109). Bin index is `last` when that probability is `>= 1`, otherwise `floor(probability * 10)` (lines 128–135). The intervals are `[0.0, 0.1)`, …, `[0.8, 0.9)`, `[0.9, 1.0]`, with probability 1.0 in the last bin. ECE is the sum over nonempty bins of `(n_bin / N) * |bin accuracy − bin mean predicted probability|` (lines 151–158). 5C.7 lines 110–137 restate that convention. `eceReportsForCandidates` calls `reliabilityBins` on the three stored probabilities (`lib/debug/calibration/prospective/evaluation/evaluation-ece.ts` lines 28–59).

The quantity inside the bin is the argmax probability. It is not the stored entropy confidence defined in section D. 5C.6 line 46 says the stored `confidence` field is kept and not recomputed. That sentence preserves the stored field. It does not say that ECE bins that field. The binning function uses the argmax probability (`metrics.ts` lines 128–135).

5C.6 line 48 calls those ECE bins “confidence bins” and the bin mean “mean confidence.” 5C.7 lines 120–137 use the same wording, including “Ten equal-width confidence bins” and `bin_mean_confidence`, and line 133 places probability 1.0 in the last bin under the label `confidence >= 1`. In those sentences the word “confidence” names the probability `reliabilityBins` bins. That probability is the argmax probability. It is not the stored entropy confidence in section D.1. The protocols do not already say “argmax probability.”

**RECORDED OWNER DECISION.** Prospective ECE uses this existing 10 equal-width argmax-probability convention. Reports under this reading call the binned quantity argmax probability, which is the maximum 1X2 probability, and they distinguish it from stored entropy confidence. That reporting name is a vocabulary choice relative to the 5C.6 and 5C.7 sentences above. It is not a claim that those protocols already use it. This decision does not edit those protocols. It does not approve a materiality rule for ECE. “Not materially worse” remains **OPEN / UNAPPROVED**.

### C.4 Empty-sample sentinels

**IMPLEMENTATION CONVENTION.** `expectedCalibrationError` returns `0` when `n <= 0` (`metrics.ts` lines 151–152). `summarizeMetrics` returns `ece: 0` when no usable row exists (lines 164–170). `emptyCandidateAggregate` returns `meanLogLoss: 0` and `meanBrier: 0` when no row exists (`lib/debug/calibration/prospective/evaluation/evaluation-aggregate.ts` lines 15–26). 5C.7 states that an empty sample returns ECE = 0 and a finite empty report of zeros (`docs/calibration/RC2_5C_PROSPECTIVE_EVALUATION_PROTOCOL.md` lines 141 and 230–233). `classwiseCalibration` also returns zeros at `n === 0` (`evaluation-classwise.ts` lines 41–45). Those classwise zeros are descriptive. They are not inputs to proposal P-1.

**RECORDED OWNER DECISION.** Empty-sample zeros are sentinels. A returned ECE of 0 at `evaluatedN = 0` is an empty-sample sentinel. It is not evidence of perfect calibration. A returned mean log loss of 0 at `evaluatedN = 0`, and a returned mean Brier of 0 at `evaluatedN = 0`, are the same kind of sentinel. They are not evidence of perfect log loss or perfect Brier. A log loss of 0 on a non-empty sample can be a real perfect score, so the sentinel is identified by `evaluatedN = 0`, not by the zero alone. A report must not describe any of these empty-sample zeros as a performance result. P-1 excludes N = 0. This decision does not change the functions, does not add a tolerance, and does not authorize an implementation change. Replacing a sentinel with a null or another token would be a later code authorization, not a consequence of this sentence.

## D. Confidence definitions

Three quantities are already distinct in the repository. This draft does not collapse them and does not add a fourth.

### D.1 Stored entropy confidence

**IMPLEMENTATION CONVENTION.** `confidenceFromHybrid` sets `value = clamp01(1 - normalizedEntropy(oneXTwo))` (`lib/intelligence/modules/probability/confidence-from-hybrid.ts` lines 16–23). `normalizedEntropy` is Shannon entropy of the three probabilities divided by `log2(3)` (`lib/intelligence/modules/probability/math/normalize.ts` lines 81–98). The prospective engine stores that value on the prediction (`lib/debug/calibration/prospective/candidate-engine.ts` lines 74–89). For an arm with a HIGH_EQUAL transfer, the blended 1X2 is assigned at lines 60–63, and the entropy is taken from that post-transfer blended 1X2 at lines 74–77. The scorer copies `record.confidence` and does not replace it (`scoring-metrics.ts` lines 45 and 68).

**FROZEN RULE.** 5C.1 prohibits new confidence formulas (line 185). Keeping stored confidence equal to `1 - H_norm` is the existing implementation. This draft does not authorize a different stored formula.

The bands at `0.75` and `0.45` in `confidence-from-hybrid.ts` lines 21–22 are product `ConfidenceScore` bands. They are not the descriptive rates in section D.3 and they are not promotion cutoffs. This draft does not adopt them as either.

D-01 records that `docs/PROBABILITY_ENGINE.md` names entropy in the module map and does not state `1 - H_norm` (D-01 lines 60–61). That documentation gap remains. This draft does not rewrite the formula contract.

### D.2 Argmax probability

**IMPLEMENTATION CONVENTION.** Argmax probability is `predicted[argmaxOutcome(predicted)]`, using the tie break in section C.3. ECE bins that number. Accuracy compares that class with the observed class (`scoring-metrics.ts` lines 35 and 48; `evaluation-aggregate.ts` lines 42 and 51).

**FROZEN RULE.** Accuracy is a secondary, descriptive metric (5C.1 lines 141–145). Promotion on accuracy alone is forbidden (5C.1 line 153).

### D.3 Descriptive rates at or above 0.80, 0.90, and 0.95

**FROZEN RULE.** Secondary metrics include mean confidence and rates at or above 80, 90, and 95 percent, and those metrics are descriptive only (5C.1 lines 141–145). The freeze’s secondary list says “Mean confidence (mean max probability)” and then “Share ≥80%, ≥90%, ≥95%” (freeze lines 86–87). 5C.1’s own secondary sentence says “mean confidence” and does not repeat the words “mean max probability” (5C.1 line 143).

**IMPLEMENTATION CONVENTION.** The manifest names `share80`, `share90`, and `share95` (`candidate-config.ts` lines 116–119). No function under `lib/debug/calibration/prospective/` computes those shares. **MISSING IMPLEMENTATION.**

**IMPLEMENTATION CONVENTION.** `aggregateCandidates` averages the stored `confidence` field (`evaluation-aggregate.ts` lines 45 and 51). That field is entropy confidence, section D.1. The freeze’s parenthetical says mean max probability. Those are different numbers. 5C.7 line 93 calls the aggregate “mean predicted confidence” of the frozen score-row `confidence`, which follows the stored field.

**RECORDED OWNER DECISION.** The rates at or above 0.80, 0.90, and 0.95 use the maximum 1X2 probability. That quantity is the argmax probability in section D.2. Stored entropy confidence is a different quantity. Reports distinguish the two. One label is not used for both. This choice does not rewrite 5C.1’s words “mean confidence,” and it does not edit the freeze. It does not authorize a new confidence formula.

**RECORDED OWNER DECISION.** Those rates are descriptive. No pathology criterion is approved. A rate at or above 0.90 or 0.95 is not, by itself, a finding of “pathological ≥90/≥95 behavior” (5C.1 line 161). That phrase remains **OPEN / UNAPPROVED**. The basis is not chosen after outcomes are known.

The same distinction applies to any reported “mean confidence.” A table that averages stored entropy confidence says so. A table that averages the maximum 1X2 probability says so.

### D.4 HIGH_EQUAL and LOW_EQUAL O/E

**FROZEN RULE.** HIGH_EQUAL O/E and LOW_EQUAL O/E are descriptive only (5C.1 lines 143–145; freeze lines 88–91). They are not a ranking function. The D-versus-C special rule uses HIGH_EQUAL O/E as a review input, not as an automatic promotion score (5C.1 lines 168–170).

**FROZEN RULE.** HIGH_EQUAL means `k-k` for `k ≥ 2` (5C.1 line 87). The diagnostic predicate matches that definition (`lib/debug/calibration/lm-5b16-shape.ts` lines 32–34; `lib/debug/calibration/hs-5b14-shape.ts` lines 140–142).

**IMPLEMENTATION CONVENTION.** The diagnostic LOW_EQUAL predicate is the equal scores 0-0 and 1-1 (`lm-5b16-shape.ts` lines 36–38; `hs-5b14-shape.ts` lines 136–138; `lowEqualFromEqual` in `lm-5b16-formula.ts` lines 277–278). 5C.1 names LOW_EQUAL O/E and does not write those cells in section 15.

**OWNER DECISION STILL REQUIRED.** Confirm that a prospective LOW_EQUAL O/E, when implemented, uses those existing diagnostic cells. This draft does not treat the confirmation as already given, because 5C.1 did not write the cells. It also does not propose a different partition.

**MISSING IMPLEMENTATION.** Prospective evaluation does not compute HIGH_EQUAL O/E or LOW_EQUAL O/E. The names exist on the manifest (`candidate-config.ts` lines 120–121). Historical O/E from 5B is not a prospective result.

**RECORDED OWNER DECISION.** HIGH_EQUAL compares arm D with arm C on identical valid fixtures. The comparison includes O/E. It includes deterioration where the compared quantities deteriorate. No materiality cutoff, pathology cutoff, superiority cutoff, or promotion cutoff is approved for that comparison. “Useful direction” and “material” degradation remain **OPEN / UNAPPROVED**. The LOW_EQUAL cell confirmation marked **OWNER DECISION STILL REQUIRED** above remains open, so a LOW_EQUAL component of this comparison has no approved partition yet. HIGH_EQUAL’s cell definition remains the frozen `k-k` for `k ≥ 2`.

**FROZEN RULE.** No historical-fit threshold is registered for the D-versus-C rule (5C.1 line 170). `LOW_EQUAL_RATE_FLAG = 0.01` (`lm-5b16-shape.ts` line 30) is a 5B.16 diagnostic flag. This draft does not adopt it as a prospective materiality cutoff.

## E. Promotion-rule clarification

Proposal identifiers in this draft are P-1, P-2, P-3, and P-5. P-4 is unused. The gap is intentional. No proposal was removed, renumbered, or given a new meaning to fill that number. P-1, the descriptive part of P-2, P-3, and P-5 are recorded owner decisions. The remainder of P-2 stays **OPEN / UNAPPROVED**. The precise fixture inclusion and validity predicate for the P-1 evaluated fixture set stays **OPEN / UNAPPROVED**. P-4 stays unused.

### E.1 Direction of the three primary metrics

**IMPLEMENTATION CONVENTION, read with the metric identities.** Log loss, the unnormalized Brier sum, and ECE, as defined in section C, are penalty measures. A smaller value is a better value on that measure. 5C.1 does not print the sentence “lower is better.” The comparison words “worse” and “not worse” have no other direction available inside these definitions. This draft does not reverse that direction and does not combine the three measures.

### E.2 Meaning of “not worse”

**FROZEN RULE.** At `N ≥ 500`, the promotion list requires log loss not worse than CONTROL and Brier not worse than CONTROL (5C.1 lines 155–159). ECE is a different phrase: “not materially worse” (line 160). D-01 states that its own text adds no threshold and does not replace “not worse” or “not materially worse” with a number (D-01 line 116).

**RECORDED OWNER DECISION. Proposal P-1 is approved.**

Compare log loss and Brier separately against `CONTROL_PRODUCTION`, on identical valid fixtures. One metric is compared at a time. P-1 requires the candidate and CONTROL to be evaluated over the exact same evaluated fixture set. The same fixtures enter the candidate mean and the CONTROL mean. Each candidate is compared with CONTROL on the exact same evaluated fixture set for that comparison. The precise fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**. This clarification does not incorporate 5C.6, 5C.7, or any later-protocol rejection rule into frozen 5C.1. This decision adds no new predicate, no tolerance, no numerical threshold, no scoring rule, and no promotion criterion.

For log loss, and separately for Brier:

- The reported mean is the mean already defined in section C for that metric.
- Delta = candidate mean − CONTROL mean.
- The requirement is delta ≤ 0.
- Delta > 0 means the requirement is not met on that metric.
- Delta = 0 meets the requirement.
- No numerical tolerance is approved.

P-1 adds no absolute tolerance, no relative tolerance, and no comparison epsilon. The comparison uses the reported means as the existing functions return them. Sensitivity of a difference to the last stored bit is a limitation of refusing a tolerance. Defining a tolerance that would absorb that bit would be a new numeric threshold. P-1 does not define one.

P-1 does not apply when the fixture count is 0. At that count the reported mean log loss and mean Brier are the empty-sample sentinels in section C.4. Empty-sample zeros are sentinels. A difference of zero between two sentinels is not a result. The exclusion is the sample count. It is not a margin around zero.

P-1 does not apply to ECE. The frozen ECE phrase is “not materially worse,” and section E.3 leaves materiality **OPEN / UNAPPROVED**.

P-1 is a comparison of point estimates. It does not claim statistical significance. It is not a significance test, a non-inferiority test, a superiority finding, or a promotion. An arm can meet delta ≤ 0 and still leave the review unresolved because another criterion is unapproved. Meeting delta ≤ 0 is not promotion. Delta > 0 means the frozen “not worse” requirement is not met on that metric. That failure is not a significance claim, and it does not retire the arm. Where the log-loss comparison and the Brier comparison conflict, the result is **INCONCLUSIVE / REQUIRES REVIEW** (5C.1 line 166). A decision that depends on a criterion section E.3 leaves open has the same result.

### E.3 Materiality, class bias, temporal stability, and D versus C

**FROZEN RULE.** The promotion list also requires: no material leakage or integrity violation; no new pathological behavior at the ≥90 and ≥95 rates; class biases inspected individually; temporal stability inspected; no candidate modification during the window (5C.1 lines 157–164). The D-versus-C rule requires HIGH_EQUAL O/E to move in a useful direction without material LOW_EQUAL degradation, material proper-score degradation, or a new class-calibration pathology, and it forbids historical-fit thresholds (lines 168–170). The manifest records those obligations as booleans (`candidate-config.ts` lines 124–150). A boolean that an inspection is required is not the inspection rule.

**IMPLEMENTATION CONVENTION.** `classwiseCalibration` stores, separately for HOME, DRAW, and AWAY, the mean predicted probability of that class and the observed frequency of that class, and it also stores `absoluteCalibrationGap` as the absolute value of their difference (`lib/debug/calibration/prospective/evaluation/evaluation-classwise.ts` lines 25–54). The computation is descriptive. It contains no pass/fail cutoff.

**MISSING IMPLEMENTATION.** No prospective module defines temporal stability, a pathological-rate test, or a HIGH_EQUAL / LOW_EQUAL O/E comparison of arm D with arm C. 5B.15’s historical splits are diagnostic history (findings lines 142–150). They are not a prospective stability procedure, and their split sizes are not adopted here.

**RECORDED OWNER DECISION. Proposal P-2 is partially approved.** The approved part is descriptive. It writes no cutoff.

1. ECE uses the existing 10 equal-width argmax-probability bins in section C.3. This approves the binning. It does not approve a meaning of “not materially worse.”
2. The rates at or above 0.80, 0.90, and 0.95 use the maximum 1X2 probability, as section D.3 records. Stored entropy confidence is distinguished from that probability. This approves the basis. It does not approve a pathology rule.
3. Class bias is mean predicted probability minus observed frequency, separately for home, draw, and away. The approved bias is that signed difference. `absoluteCalibrationGap` is not a substitute definition, and it is not a pass or fail cutoff. No code change is authorized.
4. Temporal stability is chronological descriptive reporting. The periods are defined before viewing outcomes. This decision does not name the periods. No failure result is approved.
5. HIGH_EQUAL compares D with C on identical valid fixtures, including O/E and including deterioration where it is present. The comparison can show deterioration. It does not define how much deterioration is material.

**OPEN / UNAPPROVED.** No materiality criterion, pathology criterion, superiority criterion, or promotion criterion is approved. The following remain unapproved:

- what “not materially worse” means for ECE;
- what “no new pathological ≥90/≥95 behavior” means;
- which class-bias result would fail an inspection;
- which temporal-stability result would fail an inspection;
- what “useful direction,” “material LOW_EQUAL degradation,” “material proper-score degradation,” and “new class-calibration pathology” mean;
- the period boundaries of the chronological report;
- the prospective LOW_EQUAL cell identity in section D.4;
- the precise fixture inclusion and validity predicate for the evaluated fixture set on which P-1 compares a candidate with CONTROL.

Inventing a cutoff from 5B tables after this draft, or after outcomes exist, is historical fitting, which 5C.1 line 170 and the freeze lines 79 and 192–194 already forbid.

**RECORDED OWNER DECISION.** A calibration conflict that is relevant to a decision remains **INCONCLUSIVE / REQUIRES REVIEW** until materiality criteria are approved before viewing unseen outcomes. Approving those criteria after outcomes have been viewed is outside this decision. Until the applicable criterion exists and was approved before that viewing, the gate cannot be marked passed. The missing criterion does not drop the gate, and it does not authorize the analyst to supply it after seeing outcomes.

### E.4 Conflicts and automatic promotion

**FROZEN RULE.** If metrics conflict: **INCONCLUSIVE / REQUIRES REVIEW**. No automatic numeric promotion. No single winner score (5C.1 line 166). The manifest sets `conflictResult` to `INCONCLUSIVE_REQUIRES_REVIEW`, `noCombinedWinnerScore` to true, and `noAutomaticNumericPromotion` to true (`candidate-config.ts` lines 135–137).

**FROZEN RULE.** Checkpoints do not authorize candidate modification (5C.1 lines 147–149 and 172–174).

This draft adds no winner score and no automatic promotion function.

## F. Statistical integrity

**FROZEN RULE.** Reporting checkpoints, if available, are `N = 100`, `N = 250`, and `N = 500` (5C.1 lines 147–149; freeze lines 99–103). The checkpoints are descriptive. They are not adaptive stopping. 5C.1 line 149 states those checkpoints “per candidate.” That sentence does not define unique fixtures.

**LATER PROTOCOL TEXT.** 5C.3 repeats the same three checkpoint numbers (5C.3 lines 240–244). 5C.3, 5C.6, and 5C.7 count `N` as unique fixtures with a five-arm capture, not as candidate rows (5C.3 lines 231–238; 5C.6 lines 86–92; 5C.7 lines 45–46). That unique-fixture count was not written in the 5C.1 freeze. This draft does not rewrite 5C.1 line 149 and does not incorporate the later count as a new clause of the amended study.

**FROZEN RULE.** No production promotion at `N = 100` merely because metrics look good (freeze lines 105–107). The section 17 promotion list is introduced by “At N ≥ 500” (5C.1 lines 155–164).

**IMPLEMENTATION CONVENTION.** `formalReviewAvailable` returns true when `evaluatedN` is at least the first checkpoint, which is 100 (`lib/debug/calibration/prospective/evaluation/evaluation-checkpoint.ts` lines 8–18). 5C.7 calls the `N = 100` state the first formal evaluation checkpoint and says the flag means a human or scientific review may occur and is not auto-promotion (5C.7 lines 149–158 and 176–184). 5C.7 also says checkpoint labels are not significance claims (line 156).

**RECORDED OWNER DECISION. Proposal P-5 is approved.**

N = 100 and N = 250 are descriptive review only. They are not a promotion review. They do not modify candidates and they do not promote. The existing flag `formalReviewAvailable` at N ≥ 100 is not authorization to apply the section 17 promotion gates. This decision does not rename the flag and does not edit 5C.7.

The first possible promotion review requires N ≥ 500 valid comparable fixtures per candidate. Valid comparable fixtures are the identical valid fixtures used to compare that candidate with CONTROL under P-1. “Per candidate” follows 5C.1 line 149. This decision does not replace that wording with the later unique-fixture count described above. The review is never automatic promotion. Opening the review does not promote an arm.

`evaluationCheckpointState` returns `CHECKPOINT_500` only when `evaluatedN === 500` and returns `ABOVE_500` when `evaluatedN` is greater (`evaluation-checkpoint.ts` lines 13–14). `ABOVE_500` remains inside the frozen `N ≥ 500` count condition (5C.1 lines 155–164). The separate code label does not put a count above 500 outside that condition. `ABOVE_500` satisfies the count condition only, and only when the count is a count of valid comparable fixtures per candidate. The code label alone does not establish that the fixtures were valid and comparable. `ABOVE_500` is not promotion clearance. A review at a count above 500 stays subject to every unresolved criterion, to D-04, and to a separate scoring authorization.

Where metrics conflict, or where a criterion the review needs is unresolved, the result is **INCONCLUSIVE / REQUIRES REVIEW**. While the open criteria in section E.3 remain open, a promotion review cannot conclude in promotion.

**LATER PROTOCOL TEXT.** 5C.7 line 156 says the checkpoint labels are not significance claims. 5C.7 lines 236–245 name a future seam for intervals, bootstrap, and significance testing, and state that 5C.7 does not implement selection or significance-based promotion from that seam. Those sentences are 5C.7. They are not sentences of 5C.1. Proposal P-3 asks for a related disclosure in later reports. The disclosure below is a recorded owner decision. It does not move the 5C.7 seam into 5C.1, and it does not implement that seam.

**RECORDED OWNER DECISION. Proposal P-3 is approved.**

Any later report of primary metrics discloses all of the following in the report itself:

- the figures are point estimates, and a point estimate is not statistical superiority;
- multiple comparisons are disclosed: five arms are examined together on three primary metrics, plus whatever secondary diagnostics are actually computed;
- no significance claim is made unless a procedure was prespecified and then executed;
- no new test and no new threshold is approved;
- no multiplicity adjustment, confidence-interval procedure, hypothesis test, bootstrap count, or non-inferiority margin is chosen by 5C.1 or by this decision.

P-3 requires that disclosure. It does not fill the disclosure with a significance threshold. Choosing `α`, a bootstrap count, or a margin would be a new method and a new numeric choice. This decision does not make that choice. The 5B.15 bootstrap settings are historical diagnostic settings. They are not adopted.

## G. Population governance

**OWNER-APPROVED DECISION.** D-04 applies in full. This draft does not amend it and does not replace it. D-04 sections 7, 8, and 9 remain binding. That includes the PE-5 provider-season 2025 and calendar-2025 exclusions in section 7 (D-04 lines 177–182) and the narrower distinction for a differently labeled 2023 or 2024 population in section 8 part 3 (D-04 line 200). The bullets below are RC2-facing reminders. They are not the complete operative text of D-04. This section does not declare any population unseen-eligible.

- RC2 Premier League 2023, 2024, and 2025 are used investigation seasons and cannot be reused as unseen (D-04 section 6; freeze lines 18–26; 5C.1 lines 19–27; 5C.3 lines 58–62).
- PE-4 provider-season 2025 and calendar-2025 UTC kickoff restrictions remain binding on their own texts (D-04 section 7).
- PE-5 restrictions in D-04 section 7 remain binding on their own texts, including the PE-5.2, PE-5.3D, and PE-5.4B exclusions of provider season 2025 and calendar-2025 kickoffs (D-04 lines 177–182). This reminder does not restate every PE-5 sentence.
- Each GOALS 2025 holdout reservation under `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL` remains protected inside its own protocol (D-04 section 4 and section 7). This draft does not collapse those constants into one fixture set. The GOALS protocol files were not re-opened for this draft. The authority cited here is D-04, which was read at this baseline.
- Unknown fixture-level overlap fails closed for future unseen-outcome validation (D-04 section 8). Absence of a crosswalk is not a finding that every overlapping label was scored in 5B, and it is not permission to treat the row as unseen.
- D-04 section 8 part 3 limits one RC2 overlap restriction on a differently labeled 2023 or 2024 population to rows identified as Premier League or as provider competition `39`, and to rows whose competition identity is unknown. A row with a documented competition id other than `39` is outside that specific restriction. Leaving that restriction does not itself establish unseen eligibility. PE-4, PE-5, GOALS, and calendar-2025 restrictions remain in force on their own texts (D-04 line 200).
- Provider season is not inferred from the calendar (5C.3 lines 48–54; D-04 line 216).
- D-04 section 9 states conditions for a later validation and does not authorize one. A historical season outside 2023–2025 qualifies only under the three freeze conditions at freeze lines 61–65. This draft does not find that any named season meets those conditions, and it does not declare any such season unseen-eligible.

**OWNER DECISION STILL REQUIRED.** The scoring population. This draft approves none.

**IMPLEMENTATION CONVENTION, not an approval.** `ACCEPTED_PROSPECTIVE_SEASON = "2026"` (`lib/debug/calibration/prospective/live-capture/live-capture-types.ts` line 17). The 5C.5A runbook says 5C.4 live discovery verified API-Football Premier League season 2026 as an operational fact for that runbook, and it says the frozen 5C.3 field `prospectiveSeason` remains `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY` (`docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` lines 33–41). The runbook also says 5C.5A does not authorize live capture (lines 1–5 and 182–195). The frozen protocol object still assigns `prospectiveSeason: PROSPECTIVE_SEASON_UNVERIFIED` (`lib/debug/calibration/prospective/protocol/protocol-config.ts` lines 36–40; `protocol-types.ts` line 8).

**RECORDED OWNER DECISION.** Season 2026 is not verified and is not authorized. Neither that runbook sentence nor that source constant approves season 2026 as an unseen scoring population. D-04 does not verify a provider season (D-04 lines 188 and 267). A later scoring population, if the owner approves one, has to satisfy section 9 of D-04 and has to be named in that later decision. This draft does not name it.

Quotation of published RC2 aggregates remains governed by D-04 section 10. Quotation is not outcome access and does not make a quoted season unseen.

## H. Temporal integrity

A sentence of the freeze or of 5C.1 is labeled FROZEN RULE. A sentence of 5C.2, 5C.3, 5C.6, or 5C.7 is labeled LATER PROTOCOL TEXT. Later protocol text did not originate in the 5C.1 freeze. Frozen protocols are not amended retroactively. 5C.1’s frozen text stays separate from later protocol text. This draft does not edit those protocols and does not move their sentences into 5C.1. It does not incorporate a later sentence as a new clause of the amended study. An incorporation of that kind would have to be marked PROPOSED, NOT YET APPROVED. This draft does not make that proposal. It does not add a capture window, a clock, or a grace period.

**FROZEN RULE.** Predictions are collected before match completion. Records are immutable at capture. Scoring happens after results are final. Candidates are not changed retroactively (freeze lines 54–59; 5C.1 lines 176–181).

**FROZEN RULE.** At capture, `resultStatus` is pending and the final goals and `scoredAt` are null (5C.1 lines 116–117; freeze lines 138–141).

**LATER PROTOCOL TEXT.** 5C.2 capture rejects outcome fields and final statuses (`docs/calibration/RC2_5C_PROSPECTIVE_CAPTURE_PROTOCOL.md` lines 209–219). That rejection is not a sentence of 5C.1.

**FROZEN RULE.** 5C.1 requires `kickoff > capturedAt` and `evidenceAsOf < kickoff` (lines 120–121). The freeze requires the prediction to be captured before kickoff and limits evidence to timestamps `<` kickoff (freeze lines 151–152).

**LATER PROTOCOL TEXT.** 5C.2 requires `evidenceAsOf <= capturedAt < kickoff` and evidence timestamps `< kickoff` (capture protocol lines 75–81 and 211–214). The added constraint `evidenceAsOf <= capturedAt` is not written in 5C.1. 5C.3 admits only prior completed fixtures with `prior kickoff < target kickoff`, and fixtures that share a kickoff do not inform one another (5C.3 lines 117–137). The operational capture window `[T-75, T-45]` minutes before scheduled kickoff, target 60, is the 5C.3 window (5C.3 lines 79–93). This draft does not retune that window and does not write it into 5C.1.

**FROZEN RULE.** Scoring is a separate step from prediction (5C.1 line 127; freeze line 158).

**LATER PROTOCOL TEXT.** 5C.6 forbids an in-place rewrite of the pending file (`docs/calibration/RC2_5C_PROSPECTIVE_SCORING_PROTOCOL.md` lines 23–35). Pending records must still be `PENDING` with null goals when scoring starts (`scoring-eligibility.ts` lines 17–31). Eligible final statuses in that scorer are `FT`, `AET`, and `PEN` (`scoring-types.ts` line 12). Penalty shootout goals do not choose the class (`scoring-types.ts` lines 18–24; 5C.6 lines 50–57). The 5C.6 entry check accepts synthetic provenance only (`scoring-outcome.ts` lines 42–44). That check is an existing offline boundary. It is not a live scoring authorization. None of these 5C.6 sentences is a sentence of 5C.1.

**LATER PROTOCOL TEXT.** Postponement and cancellation policy is 5C.3, not 5C.1. Postponed before capture is not captured. A fixture already captured and later postponed keeps the original pending record. Future settlement must mark that kickoff non-scorable and must not overwrite it. A new kickoff is a new capture only when the protocol can distinguish it. Cancelled fixtures are not scored. Abandoned fixtures are not scored unless a later scoring protocol defines that case. 5C.3 says this is policy only (5C.3 lines 107–115). This draft does not move that policy into 5C.1.

**MISSING IMPLEMENTATION.** A prospective settlement that marks a captured kickoff non-scorable after a later postponement or cancellation, without rewriting the pending prediction. `RESULT_STATUSES` includes `VOID` (`candidate-types.ts` line 25). No function under `lib/debug/calibration/prospective/` was found that performs that post-capture settlement. The planner dispositions `POSTPONED_BEFORE_CAPTURE` and `CANCELLED_BEFORE_CAPTURE` are before-capture classifications (`protocol-types.ts` lines 11–20; `protocol-status.ts` lines 23–45). They do not settle an already stored pending record.

**FROZEN RULE.** No retrospective candidate selection. After the 5C.1 freeze, arms are not added, S is not interpolated, k is not changed, and T1 is not replaced because a checkpoint looks good or bad (5C.1 lines 172–174).

**LATER PROTOCOL TEXT.** Missed windows are not backfilled (5C.3 lines 205–211). That no-backfill rule is 5C.3. It is not the 5C.1 sentence at lines 172–174.

## I. Reproducibility

**FROZEN RULE.** The documented candidate fingerprint is `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c` (5C.1 lines 108–110).

**LATER PROTOCOL TEXT.** 5C.3 repeats that candidate fingerprint (5C.3 lines 32–37). The documented protocol fingerprint `825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9` is 5C.3’s own fingerprint (5C.3 lines 283–291). It is not the 5C.1 candidate fingerprint. The candidate version string `apex.calibration.prospective.5c1.v1` is the code constant at `candidate-types.ts` line 5 and is repeated at 5C.3 line 38. Neither the protocol fingerprint nor that version string is a sentence of the 5C.1 freeze.

**IMPLEMENTATION CONVENTION.** `CANDIDATE_MANIFEST_FINGERPRINT` is a SHA-256 of canonical JSON computed when the module is loaded (`candidate-config.ts` lines 152–180). This draft did not load that module and does not claim that the computed digest equals the documented hex. That equality is unverified at this baseline. A later verification has to execute under an authorization this draft does not give. Until that verification is recorded, the documented hex and the source expression are both cited, and neither is reported as a fresh passing check.

**FROZEN RULE.** 5C.1 requires the manifest fingerprint on prediction records (5C.1 lines 104–106).

**LATER PROTOCOL TEXT.** Capture batches store the candidate fingerprint and batch hashes (capture protocol lines 147–168). 5C.6 stores source hashes on the separate scored artifact (5C.6 lines 36–37). Those storage sentences are not sentences of 5C.1.

**IMPLEMENTATION CONVENTION.** `assertScoringEligible` refuses a candidate-fingerprint mismatch at `scoring-eligibility.ts` lines 118–122. It refuses a capture-batch integrity or hash failure at lines 127–135. That function does not store hashes. 5C.7 refuses a scored artifact whose fingerprint or hashes do not verify (5C.7 lines 33–43).

**MISSING IMPLEMENTATION.** A search of `lib/debug/calibration/prospective` found no field that records the git commit which executed a capture or a scoring run. 5C.2’s batch schema, as written in the protocol, records identifiers, counts, fingerprints, and hashes (capture protocol lines 147–154). It does not record an executed commit.

**PROPOSED, NOT YET APPROVED.** Any later authorized capture or scoring run records, in the run’s own audit artifact:

- the documented manifest fingerprint and the digest computed at execution, and whether they matched;
- the git commit that was actually executed;
- the candidate version, the protocol fingerprint, and the production base commit the arm specs name (`967b541f3947a4f9cfe0d1fe5eea57f3de880f62`, 5C.1 lines 13–17);
- the parameter provenance already inside the manifest, without substituting this draft’s baseline `14c10fec` for the 5C.1 production pin or for the 5C.3 protocol base `82162ad2cea7132cede9631ff268ad1c0fcee608` (5C.3 lines 26–30).

Those three commits are different facts. A report that swaps them is not a reproducibility record.

**PROPOSED, NOT YET APPROVED.** The audit trail keeps the pending prediction artifact immutable and stores scoring in a separate artifact, which 5C.6 already requires. This draft does not claim that any pending or scored file exists, and it does not claim that any unexecuted integrity check passed. Dry-run success, where a protocol describes it, is not a live capture and is not a score (capture protocol lines 228–243; 5C.6 lines 1–3; 5C.7 lines 8–14).

## J. Historical-discovery disclosures

**HISTORICAL VERDICT.** The 5B findings are diagnostic. They do not select production parameters (findings lines 1–7 and 196–209). `PRODUCTION_CORRECTION_READY` remained NO at 5B.16 because no unseen window existed (findings lines 225–231).

**HISTORICAL VERDICT.** Candidate C7’s earlier label was non-candidate. Findings section 14 states that frozen non-candidate input arms were examined and that **C7 / later D1 is a forensic cleaner panel, not a production candidate** (findings line 120). Findings line 229 repeats that D1, C7, P7, and T1 are forensic panels and probes, not candidates.

**FROZEN RULE, later than that label.** 5C.1 section 5 assigns the previously implemented C7 mechanics to arm A and says they are not re-optimized (5C.1 lines 52–56). That assignment is a pre-registration choice. It is not a 5B finding that C7 had already been selected.

**HISTORICAL VERDICT.** T1 was defined inside the 5B.16 diagnostic: `+10%` relative HIGH_EQUAL mass taken only from non-draw cells, with 0-0 and 1-1 untouched (findings lines 154–160). On the historical D1 holdout, 5B.16 reported directional movement and then stated: **No multiplier was selected. Historical metrics are not a production value** (findings lines 162–173). Findings line 208 records that no HIGH_EQUAL multiplier was selected.

**FROZEN RULE.** 5C.1, a later pre-registration, registers that same T1 operator on arm D only (5C.1 lines 81–94). Line 94 says T1 is not claimed historically optimal. The choice to register T1 was made after the 5B.16 diagnostic existed, in the pre-registration, and the diagnostic itself had refused to select a multiplier. Registering the probe is not independent confirmation of the probe.

**FROZEN RULE.** Historical evidence from 5B.1–5B.16 is not independent confirmation of arms A–D. The freeze says historical D1, C7, P7, M1–M3, and T1 remain forensic labels, not assigned candidates, in the freeze’s own slot table (freeze lines 46–47). 5C.1 then assigned specific forensic mechanics and simultaneously forbade using PL 2023, 2024, and 2025 to choose or rank those candidates (5C.1 lines 19–27). A prospective result on unseen outcomes does not yet exist. Until it exists under a separate scoring authorization, there is no independent confirmation to cite.

The findings’ numeric historical O/E remarks are disclosures that the investigation used those seasons. They were not recomputed for this draft, and they are not thresholds.

## K. Remaining implementation prerequisites

The following are unresolved at this baseline. Naming them does not authorize the implementation. Each needs its own later authorization if the owner wants it built. None of them is a reason to open outcomes now.

| Prerequisite | State at this baseline |
| --- | --- |
| Descriptive rates at or above 0.80, 0.90, and 0.95 | Basis recorded: maximum 1X2 probability, distinguished from stored entropy confidence (section D.3). Not computed. No pathology cutoff is approved. |
| Signed class bias | Signed class bias is mean predicted class probability minus observed class frequency, separately for home, draw, and away. Existing `absoluteCalibrationGap` is not the signed bias. The signed difference is not a stored field. No cutoff is approved. No code change is authorized. |
| HIGH_EQUAL O/E and LOW_EQUAL O/E on prospective scored fixtures | D-versus-C comparison on identical valid fixtures is a recorded descriptive obligation, including O/E and deterioration. Not computed. HIGH_EQUAL cells remain the frozen `k-k` for `k ≥ 2`. LOW_EQUAL cell identity still needs the confirmation in section D.4. |
| Temporal stability | Chronological descriptive reporting is recorded. Periods must be defined before viewing outcomes and are not named here. No failure cutoff is approved. No prospective procedure. |
| Postponed-after-capture settlement | Policy is 5C.3 lines 109–110. The non-scorable settlement of an already stored pending record is not implemented (section H). |
| Independent source and version verification | Documented fingerprint hex versus the load-time digest was not executed here. Executed git commit is not a stored prospective field (section I). Provider season in the frozen 5C.3 config remains unverified (section G). |
| Separate scoring authorization | Required by D-01 line 122 and D-04 line 215. Not granted by D-05 and not granted by this limited ratification. |

A prerequisite that is missing blocks any claim that depends on it. It does not block the continued existence of the frozen arms, and it does not authorize a partial score that ignores the missing gate.

## L. Owner choices, recorded and still open

A recorded item below is a decision in the disposition, section 13, and, where the status at the top includes it, part of the limited governance record. The restatement does not approve a choice the item leaves open. An item marked **OPEN / UNAPPROVED** is not decided by silence. P-4 does not appear below because it is not a proposal. P-4 remains unused.

1. **Limited documentary ratification. RECORDED for the named scope only.** The status at the top of this document is **OWNER-RATIFIED — LIMITED GOVERNANCE RECORD ONLY.** The ratified scope is the D-05 AMEND disposition, P-1, the descriptive part of P-2 and the calibration-conflict rule, P-3, P-5, and the L-B clarification that the fixture inclusion and validity predicate remains **OPEN / UNAPPROVED**. **OPEN / UNAPPROVED:** blanket approval of proposed rules, unresolved criteria, implementation dependencies, and future execution steps.
2. **Proposal P-1. RECORDED OWNER DECISION.** Log loss and Brier are compared separately with CONTROL. The candidate and CONTROL are evaluated over the exact same evaluated fixture set. Delta = candidate minus CONTROL. The requirement is delta ≤ 0, with no numerical tolerance. N = 0 is excluded. Empty-sample zeros are sentinels. The comparison does not claim statistical significance. **OPEN / UNAPPROVED:** the precise fixture inclusion and validity predicate. This item does not incorporate 5C.6, 5C.7, or any later-protocol rejection rule into frozen 5C.1, and it adds no new predicate, tolerance, numerical threshold, scoring rule, or promotion criterion. Any tolerance, rounding rule, or non-inferiority margin remains a different and unapproved decision.
3. **Proposal P-2. PARTIALLY RECORDED.** The descriptive readings in section E.3 are recorded: existing 10 equal-width argmax-probability ECE bins; high-confidence rates on the maximum 1X2 probability at or above 0.80, 0.90, and 0.95, distinguished from stored entropy confidence; class bias as mean predicted probability minus observed frequency, separately for home, draw, and away; chronological descriptive temporal reporting, with periods defined before viewing outcomes; HIGH_EQUAL comparison of D with C on identical valid fixtures, including O/E and deterioration. **OPEN / UNAPPROVED:** materiality criteria, pathology criteria, superiority criteria, promotion criteria, every cutoff those phrases would need, the unnamed period boundaries, and the LOW_EQUAL cell identity. Calibration conflicts relevant to a decision remain **INCONCLUSIVE / REQUIRES REVIEW** until materiality criteria are approved before viewing unseen outcomes.
4. **Proposal P-3. RECORDED OWNER DECISION.** Reports disclose multiple comparisons and distinguish point estimates from statistical superiority. No significance claim is made without a procedure that was prespecified and then executed. No new test and no new threshold is approved. `α`, a bootstrap count, and an interval method remain unchosen.
5. **Proposal P-5. RECORDED OWNER DECISION.** N = 100 and N = 250 are descriptive review only. The first possible promotion review is at N ≥ 500 valid comparable fixtures per candidate, and it is never automatic promotion. `ABOVE_500` satisfies the count condition only and remains inside that count condition. It is not promotion clearance. Conflicts or unresolved criteria produce **INCONCLUSIVE / REQUIRES REVIEW**. The 5C.7 flag at N ≥ 100 stays an existing label. This decision does not rename it and does not edit 5C.7. P-4 is unused and is not this item.
6. **Metric quantities used by the recorded comparisons. RECORDED OWNER DECISION for those quantities only.** P-1 uses the existing reported log loss and the existing unnormalized Brier. The ECE part of P-2 uses the existing 10-bin argmax convention. Empty-sample zeros are sentinels. 5C.1 did not write those formulas. The decision uses the quantities the existing functions return. It does not approve a different epsilon, a Brier divided by 3, a different bin count, or a code change. Blanket approval beyond that limited record remains **OPEN / UNAPPROVED**.
7. **Empty-sample sentence. RECORDED OWNER DECISION.** ECE `0`, mean log loss `0`, and mean Brier `0` at `evaluatedN = 0` are sentinels. They are not evidence of perfect calibration or perfect scores. The functions’ return values are already `0`. The decision adds no tolerance and does not change the functions.
8. **Probability basis for the three descriptive rates. RECORDED OWNER DECISION.** The rates use the maximum 1X2 probability. Stored entropy confidence is not that basis. The two are distinguished. No new confidence formula is approved.
9. **Mean-confidence label. RECORDED AS A DISTINCTION.** A report that averages stored entropy confidence says so. A report that averages the maximum 1X2 probability says so. One label is not used for both. 5C.1’s words “mean confidence” are not rewritten. No further name is approved.
10. **LOW_EQUAL cells. OPEN / UNAPPROVED.** Confirm or refuse the existing diagnostic identity `{0-0, 1-1}` for prospective LOW_EQUAL O/E. 5C.1 names the metric and does not write the cells. The recorded D-versus-C comparison does not decide this identity.
11. **Scoring population. OPEN / UNAPPROVED.** Approve a population, or continue to approve none. D-04’s fail-closed rule stands until a separate protocol is authorized. D-04 sections 7, 8, and 9 remain fully binding. Season 2026 is not verified and is not authorized. Season `2026` in the 5C.5A runbook and in `ACCEPTED_PROSPECTIVE_SEASON` is not this approval.
12. **Capture authorization. OPEN / UNAPPROVED.** Separate from this draft and from section 13.
13. **Scoring authorization. OPEN / UNAPPROVED.** Separate from this draft and from section 13.
14. **Post-capture settlement. OPEN / UNAPPROVED.** Authorize an implementation that keeps the pending record immutable and records a postponed or cancelled kickoff as non-scorable, or leave that behavior unspecified. Until it is specified, section H’s missing settlement stands.
15. **Fingerprint verification. OPEN / UNAPPROVED.** Authorize an execution that compares the load-time manifest digest with the documented hex, or leave that comparison unverified. This draft did not run it. The reproducibility sentences in section I that ask a later run to record that comparison remain **PROPOSED, NOT YET APPROVED**.

Items 12–15 are authorizations or verifications. They are not implied by the recorded decisions in items 2–9. Items 1, 2’s open predicate, 3’s open residue, 10, and 11 are not implied by those decisions either.

## M. Explicit non-authorizations

This draft does not authorize any of the following.

- Blanket approval of this document. The limited ratification covers only the governance record of decisions already approved. A sentence marked **OPEN / UNAPPROVED** or **PROPOSED, NOT YET APPROVED** is not approved by being printed here. The limited ratification does not authorize outcome access, capture, scoring, or promotion.
- Editing 5C.1, the freeze, the 5B findings, 5C.2, 5C.3, 5C.6, 5C.7, D-01, D-04, the continuity document, or any source file.
- A sixth arm, a change to a registered constant, or promotion of S, blend weight, draw base, home advantage, shrinkage k, Dixon-Coles ρ, λ3, a HIGH_EQUAL multiplier, role bases, or a goal-difference formula.
- A new numeric promotion cutoff, a comparison tolerance, a materiality cutoff, a rate cutoff, a temporal-stability cutoff, or a significance threshold. The existing constants cited above stay what they already are. Citation is not a new threshold.
- Adoption of `LOW_EQUAL_RATE_FLAG = 0.01`, of any 5B.15 split size, or of any 5B.16 historical O/E value as a prospective rule.
- A scoring population, including Premier League 2023, 2024, or 2025, and including season 2026 as named by the 5C.5A runbook or by `ACCEPTED_PROSPECTIVE_SEASON`.
- Inferring provider season from the calendar, or treating `dev_or_conf_eligible` as unseen-validation eligibility (D-04 section 8).
- Opening, listing, hashing, or reading `data/calibration/` or `data/prospective/`.
- Live API-Football contact, discovery, or capture.
- A scoring run, including a run that uses only synthetic fixtures as if it were the unseen study.
- Treating `formalReviewAvailable` at `N ≥ 100` as promotion clearance.
- Treating an empty-sample ECE of 0, an empty-sample mean log loss of 0, or an empty-sample mean Brier of 0 as a perfect result. P-1 records that those zeros are sentinels. That record does not change the functions and does not authorize a code change.
- Treating `ABOVE_500`, or a count of N ≥ 500, as promotion clearance. The count condition is only a count.
- Amending 5C.1, the freeze, or a later protocol retroactively, or moving later protocol text into 5C.1.
- PE-6, PE-7, or a Betting Analyzer. Calibration still does not establish betting profitability (5C.1 line 187; freeze lines 180–186).
- A declaration that Research Complete has been achieved.
- A claim that an unexecuted check passed, including the manifest digest, a capture, or a score.
- Implementation, tests, builds, commits, or pushes.

## N. Evidence and citations

Grades:

| Grade | Meaning |
| --- | --- |
| READ AT THIS BASELINE | The cited lines were read at `14c10fec` while writing this draft. They were not executed. |
| HISTORICAL VERDICT | A conclusion already recorded by the findings, the freeze, or 5C.1. Not recomputed from outcomes. |
| OWNER DECISION | A decision recorded in the D-05 disposition, including AMEND, section 13, and the limited documentary ratification. That ratification does not approve an open or proposed sentence. |
| PROPOSED | A sentence of this draft marked PROPOSED, NOT YET APPROVED. |

| Proposition | Source | Lines | Grade |
| --- | --- | --- | --- |
| D-05 selected AMEND. This document is later ratified only as the limited governance record of decisions already approved | `docs/PE_D05_PREREGISTRATION_DISPOSITION.md` | sections 2 and 6 | OWNER DECISION for AMEND and for the limited ratification. Unresolved sentences are not part of that approval. |
| P-1 approved; P-2 partially approved; P-3 approved; P-5 approved; empty-sample zeros are sentinels; season 2026 is not verified or authorized; P-4 unused; materiality, pathology, superiority, and promotion criteria unapproved | `docs/PE_D05_PREREGISTRATION_DISPOSITION.md` | section 13 | OWNER DECISION. This document restates it in sections C, D.3, D.4, E, F, G, and L. The restatement is inside the limited governance record and does not approve an open criterion. |
| Research Complete is not achieved; no new threshold in D-01; scoring needs a separate authorization | `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` | 10, 30–31, 38, 60–61, 109–122, 147–149, 186–188, 203 | READ AT THIS BASELINE |
| D-04 sections 7, 8, and 9 remain binding, including PE-5 restrictions and the narrower 2023/2024 distinction; no population is declared unseen-eligible | `docs/PE_D04_2025_POPULATION_GOVERNANCE_DECISION.md` | sections 4, 6, 7, 8, 9, and 10; lines 177–182, 188, 200, 215–216, 267, 276 | READ AT THIS BASELINE |
| Five arms, fingerprint, metrics, descriptive secondaries, checkpoints, promotion phrases, D-versus-C rule, no adaptive tuning, frozen status | `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | 1–7, 13–17, 19–98, 102–127, 133–174, 176–193 | READ AT THIS BASELINE |
| Used seasons, unassigned historical labels, prospective design, three historical-season conditions, metric names, mean max probability, checkpoints, no promotion at N = 100 | `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 18–26, 32–47, 50–66, 71–91, 95–109, 180–194 | READ AT THIS BASELINE |
| C7 non-candidate label; T1 defined and not selected in 5B.16; no production parameter; no unseen window | `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | 1–7, 120, 142–173, 196–209, 225–231 | HISTORICAL VERDICT, read at this baseline |
| Provider season unverified; PL 2023–2025 excluded; capture window; postponement policy; fixture-level N; checkpoints | `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | 32–62, 79–115, 117–137, 205–244, 283–291, 325 | READ AT THIS BASELINE |
| Capture time contract, null outcomes, hashes, leakage rejects, dry-run | `docs/calibration/RC2_5C_PROSPECTIVE_CAPTURE_PROTOCOL.md` | 24–36, 46–52, 75–81, 108–127, 147–168, 209–243 | READ AT THIS BASELINE |
| Season 2026 runbook sentence is not a 5C.3 config edit and is not a live-capture authorization | `docs/calibration/RC2_5C_FIRST_PROSPECTIVE_CAPTURE_RUNBOOK.md` | 1–5, 33–41, 182–195 | READ AT THIS BASELINE |
| Log-loss epsilon, unnormalized Brier, argmax, 10-bin ECE, empty ECE returns 0 | `lib/debug/calibration/metrics.ts` | 11–12, 82–109, 111–159, 164–170 | READ AT THIS BASELINE |
| Prospective scorer copies stored confidence and calls the metric functions | `lib/debug/calibration/prospective/scoring/scoring-metrics.ts` | 6–19, 29–53 | READ AT THIS BASELINE |
| 5C.6 restates the metric conventions, calls ECE bins confidence at line 48, and separates the scored artifact; synthetic outcomes only | `docs/calibration/RC2_5C_PROSPECTIVE_SCORING_PROTOCOL.md` | 1–3, 23–48, 50–57, 86–92 | READ AT THIS BASELINE |
| Stored confidence is `1 - H_norm`; product bands 0.75 and 0.45 | `lib/intelligence/modules/probability/confidence-from-hybrid.ts` | 16–23 | READ AT THIS BASELINE |
| `H_norm` definition | `lib/intelligence/modules/probability/math/normalize.ts` | 81–98 | READ AT THIS BASELINE |
| Prospective engine stores that confidence; blend assignment is lines 60–63; entropy uses that blended 1X2 at lines 74–77 | `lib/debug/calibration/prospective/candidate-engine.ts` | 60–63, 74–89 | READ AT THIS BASELINE |
| Five arm specs; secondary names including shares and O/E; promotion booleans; fingerprint expression | `lib/debug/calibration/prospective/candidate-config.ts` | 53–58, 60–150, 166–195 | READ AT THIS BASELINE |
| Five identifiers; checkpoints; `VOID` in the result-status list; production base commit | `lib/debug/calibration/prospective/candidate-types.ts` | 5–16, 25–30, 72–101 | READ AT THIS BASELINE |
| T1 transfer implementation and LOW_EQUAL mass as 0-0 plus 1-1 | `lib/debug/calibration/lm-5b16-formula.ts` | 146–188, 273–278 | READ AT THIS BASELINE |
| HIGH_EQUAL and LOW_EQUAL cell predicates; relative increase 0.1; diagnostic flag 0.01 | `lib/debug/calibration/lm-5b16-shape.ts` | 28–38 | READ AT THIS BASELINE |
| Same cell predicates in the 5B.14 shape module | `lib/debug/calibration/hs-5b14-shape.ts` | 136–142 | READ AT THIS BASELINE |
| Mean log loss, mean Brier, and mean stored confidence | `lib/debug/calibration/prospective/evaluation/evaluation-aggregate.ts` | 15–55 | READ AT THIS BASELINE |
| ECE report uses `reliabilityBins` on the three probabilities | `lib/debug/calibration/prospective/evaluation/evaluation-ece.ts` | 1–74 | READ AT THIS BASELINE |
| Classwise output stores mean predicted probability, observed frequency, and an absolute gap, and it has no cutoff. The recorded bias is the signed difference | `lib/debug/calibration/prospective/evaluation/evaluation-classwise.ts` | 25–54 | READ AT THIS BASELINE for the stored fields. The signed-difference choice is an OWNER DECISION in disposition section 13. |
| Checkpoint states; `formalReviewAvailable` at the first checkpoint | `lib/debug/calibration/prospective/evaluation/evaluation-checkpoint.ts` | 1–19 | READ AT THIS BASELINE |
| 5C.7 ECE restatement, empty sample, checkpoint wording, future statistical seam not implemented | `docs/calibration/RC2_5C_PROSPECTIVE_EVALUATION_PROTOCOL.md` | 84–158, 176–184, 230–245 | READ AT THIS BASELINE |
| Scoring eligibility keeps pending records clean; fingerprint refusal at lines 118–122; hash refusal at lines 127–135; the function does not store hashes | `lib/debug/calibration/prospective/scoring/scoring-eligibility.ts` | 17–31, 102–135 | READ AT THIS BASELINE |
| Final statuses and shootout policy | `lib/debug/calibration/prospective/scoring/scoring-types.ts` | 12–24 | READ AT THIS BASELINE |
| Synthetic-only outcome gate | `lib/debug/calibration/prospective/scoring/scoring-outcome.ts` | 38–50 | READ AT THIS BASELINE |
| Frozen protocol season value remains the unverified token | `lib/debug/calibration/prospective/protocol/protocol-config.ts` | 23–48 | READ AT THIS BASELINE |
| Unverified-season constant and before-capture dispositions | `lib/debug/calibration/prospective/protocol/protocol-types.ts` | 5–20 | READ AT THIS BASELINE |
| `ACCEPTED_PROSPECTIVE_SEASON` constant | `lib/debug/calibration/prospective/live-capture/live-capture-types.ts` | 16–17 | READ AT THIS BASELINE |
| Reproducibility fields proposed for a later authorized run | This draft, section I | — | PROPOSED |

No sealed outcome file was opened. No fingerprint was recomputed. No row in this table approves an open or proposed sentence, and none authorizes capture, scoring, or promotion. The limited ratification is the status at the top of this document. A recorded owner decision was not recomputed from outcomes.
