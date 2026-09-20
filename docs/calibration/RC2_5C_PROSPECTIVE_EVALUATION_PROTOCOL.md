# RC2 5C.7 — Offline Prospective Evaluation Protocol

Status: debug-only reporting infrastructure. Not a promotion rule. Not a production change.

This sprint evaluates prospectively scored fixtures produced by frozen 5C.6.
It must not tune candidates, windows, production probability, or live capture.

## Boundary

- Synthetic scored artifacts only.
- Zero provider calls. No API-Football, Supabase, or network.
- Do not read `data/prospective/pending/` or `data/prospective/scored/`.
- Do not persist evaluation output into those directories.
- No API key access.

Frozen and unmodified by 5C.7:

- 5C.1 candidate preregistration
- 5C.2 capture
- 5C.3 live protocol
- 5C.4 discovery
- 5C.5A capture integration
- 5C.5B.1 live execution adapter
- 5C.5B.2 controlled live capture bridge
- 5C.6 prospective scoring
- production probability/model logic
- the auth/security checkpoint

## Input contract

Evaluation input is valid immutable 5C.6 `ProspectiveScoredArtifact` objects.

Before a fixture contributes to N, 5C.7 verifies:

- candidate fingerprint equals the frozen 5C.1 fingerprint
- exactly five candidate arms
- candidate IDs are exactly the frozen five
- scored hashes validate (`outcomeHash`, `candidateScoresHash`, `scoredArtifactHash`)
- fixture identity is present
- observed outcome exists and matches `deriveObservedClass(homeGoals, awayGoals)`
- candidate score rows are complete and finite
- frozen log loss / Brier / predicted class match the frozen metric functions
- the fixture is not a duplicate observation

One fixture = one prospective observation N.
Five candidate rows do not mean N=5.

Invalid, tampered, or incomplete artifacts are rejected. They are never repaired or imputed.

## Sample integrity

Rejected:

- duplicate fixture
- duplicate candidate row
- missing candidate arm
- unknown candidate arm
- wrong candidate fingerprint
- tampered scored artifact
- inconsistent observed class
- invalid probabilities
- non-finite metric values
- candidate score/result mismatch against frozen 5C.6 arithmetic

All valid arms are evaluated on the same fixture sample.
There is no candidate-specific sample cherry-picking.

## Rejection policy

Default mode: **STRICT**.

- Any invalid artifact rejects the entire evaluation (`EvaluationRejectedError`).
- Rejections are listed with deterministic reasons.
- Nothing is silently skipped.

Optional mode: **AUDITED_COLLECTION**.

- Invalid artifacts are excluded.
- Each exclusion is recorded with `fixtureId` + reason.
- Remaining valid fixtures are evaluated.

STRICT is the safer default and matches existing calibration reject-rather-than-repair behavior.

## Aggregate metrics

Reuse frozen 5C.6 / 5B definitions. Do not redefine them.

For every candidate, in frozen preregistered order:

1. Mean log loss (`logLossOneXTwo`, clip `LOG_LOSS_EPS = 1e-15`)
2. Mean multiclass Brier (`brierOneXTwo`, unnormalized SSE over H/D/A)
3. Descriptive 1X2 accuracy (argmax class vs observed class)
4. Mean predicted confidence (frozen score-row `confidence`)
5. Number correct
6. Number evaluated (`evaluatedN`, fixture count)

No ROI, profit, stake, Kelly, yield, bankroll, or odds-derived EV in this layer.

## Classwise calibration

For each candidate and each class HOME / DRAW / AWAY:

- observation count
- observed frequency (`count / N`)
- mean predicted probability of that class over the same fixture sample
- absolute calibration gap `|mean predicted − observed frequency|`

These are descriptive diagnostics. They do not declare a winner.

## ECE convention (reused, not invented)

An existing frozen convention already exists in `lib/debug/calibration/metrics.ts`:

- `CALIBRATION_BIN_COUNT = 10`
- `reliabilityBins`
- `expectedCalibrationError`

5C.7 reuses that convention.

Ten equal-width confidence bins:

| Index | Interval | 1.0 handling |
| --- | --- | --- |
| 0 | [0.0, 0.1) |  |
| 1 | [0.1, 0.2) |  |
| 2 | [0.2, 0.3) |  |
| 3 | [0.3, 0.4) |  |
| 4 | [0.4, 0.5) |  |
| 5 | [0.5, 0.6) |  |
| 6 | [0.6, 0.7) |  |
| 7 | [0.7, 0.8) |  |
| 8 | [0.8, 0.9) |  |
| 9 | [0.9, 1.0] | `confidence >= 1` enters this bin |

Implementation: `confidence >= 1 ? last : floor(confidence * 10)`.

ECE = sum over nonempty bins of `(n_bin / N) * |bin_accuracy − bin_mean_confidence|`.

Bin-level report: count, mean confidence, accuracy, absolute gap.

Empty sample: ECE = 0. No NaN/Infinity.
Binning is not optimized against synthetic results.

## Checkpoints

Frozen 5C.3 checkpoints: N = 100, 250, 500.

| N | State | Meaning |
| --- | --- | --- |
| N < 100 | `BELOW_FIRST_CHECKPOINT` | descriptive monitoring only |
| 100 ≤ N < 250 | `CHECKPOINT_100` | first formal evaluation checkpoint |
| 250 ≤ N < 500 | `CHECKPOINT_250` | second checkpoint |
| N = 500 | `CHECKPOINT_500` | major checkpoint |
| N > 500 | `ABOVE_500` | past major checkpoint |

Checkpoint labels are not significance claims.

`formalReviewAvailable` is true at N ≥ 100. That means a human/scientific review may occur. It is not auto-promotion.

## Pre-N100 hard lock

For N < 100 the evaluation system must not produce:

- winner
- best candidate
- recommended candidate
- promotion
- production replacement
- ranking
- score leaderboard
- bet or stake recommendation

Per-candidate metrics may be shown in frozen candidate order.
Candidates are never sorted by performance.

## Checkpoint does not mean auto-promotion

At N = 100, 250, 500, and above 500:

- 5C.7 still does not promote a candidate
- 5C.7 still does not mutate production
- 5C.7 still does not tune windows or arms

It may only state that formal human/scientific review is available.

## Neutral reporting

Candidate rows always appear in frozen preregistered order:

1. `CONTROL_PRODUCTION`
2. `CANDIDATE_A_INPUT`
3. `CANDIDATE_B_TRANSFORM`
4. `CANDIDATE_C_COMBINED`
5. `CANDIDATE_D_COMBINED_HIGH_EQUAL`

No winner badges, green/red ranking, best/worst labels, or promotion flags.

## Dataset summary

The report includes:

- `evaluationVersion`
- `candidateFingerprint`
- `protocolFingerprint`
- `evaluatedN` / fixture count / candidate row count
- checkpoint state
- first/last scored timestamp
- first/last kickoff
- observed HOME/DRAW/AWAY counts
- integrity status
- rejected artifact count and reasons
- candidate aggregates
- classwise calibration
- ECE/bin report
- evaluation hash
- provider-call accounting (always zero)

No secrets. No raw provider payloads.

## Determinism

Identical valid inputs produce identical metrics, checkpoint state, and evaluation hash.

Fixture order is normalized (`fixtureId` lexicographic) before aggregates and hashing.

No random IDs. No UUIDs.

Hashing uses the existing `sha256Canonical` convention.

## Empty and small samples

N = 0 is legal. The runner returns a finite empty report (zeros, empty timestamps, `BELOW_FIRST_CHECKPOINT`).

N = 1 and other N < 100 are legal descriptive samples. No small-sample winner inference.

## Future statistical seam

`EvaluateProspectiveResult.observations` stores paired per-fixture per-candidate rows that could later support:

- paired candidate comparisons
- confidence intervals
- bootstrap analysis
- significance testing

5C.7 does not implement selection, significance-based promotion, or ranking from that seam.

## Betting economics

Out of scope for 5C.7:

- profit / ROI / yield
- bankroll / stake / Kelly
- odds-derived EV / betting return

Those belong to a later separate validation layer, if ever authorized.
