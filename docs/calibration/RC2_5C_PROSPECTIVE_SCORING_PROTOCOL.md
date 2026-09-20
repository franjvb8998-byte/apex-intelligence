# RC2 5C.6 Prospective Scoring Protocol

Offline scoring infrastructure. **This sprint does not score any real fixture and must make zero provider calls.**

A previously captured PENDING five-arm batch is immutable evidence. After a fixture is finished, a separate SCORED artifact may be created. The pending file must remain byte-for-byte unchanged.

---

## 1. Purpose

Prepare deterministic, leakage-safe scoring so a later authorized sprint can attach a verified final result to a legitimate pending capture. 5C.6 uses synthetic outcomes only.

## 2. Frozen science (unchanged)

Candidate fingerprint:

`7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Protocol fingerprint:

`825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9`

Scoring is observational. It never edits candidate probabilities, Elo, lambda, draw logic, HIGH_EQUAL, the capture window, or production.

## 3. Immutability

```
PENDING ARTIFACT  +  VERIFIED FINAL OUTCOME
        |
        v
NEW SEPARATE SCORED ARTIFACT
```

There is no in-place `PENDING -> SCORED` rewrite. Frozen `scorePredictionRecord` in `candidate-record.ts` is not used on persisted prospective files.

The scored artifact stores `sourceBatchId`, `sourceBatchHash`, `sourceRecordsHash`, and `sourceEvidenceManifestHash`.

## 4. Existing metric conventions (reused, not redefined)

From frozen `lib/debug/calibration/metrics.ts`:

**Log loss (per observation):** `-log(min(1, max(1e-15, p_y)))` where `LOG_LOSS_EPS = 1e-15`. This is the same clamp used by 5B. Aggregate 5B `summarizeMetrics` then averages those contributions over `n`. 5C.6 stores the per-observation contribution and does not invent a new epsilon.

**Multiclass Brier (per observation):** `(p_H - y_H)^2 + (p_D - y_D)^2 + (p_A - y_A)^2`. This is **not** divided by 3. Aggregate 5B Brier is the mean of those row sums. 5C.6 stores the row sum plus the three class components.

**Predicted class / confidence:** `argmaxOutcome` from the same metrics module (home wins ties against draw/away; then away vs draw). Confidence is the frozen record `confidence` field, not recomputed.

**ECE:** 5B uses 10 equal-width confidence bins (`CALIBRATION_BIN_COUNT = 10`) and weighted |accuracy − mean confidence|. 5C.6 does **not** emit a one-fixture ECE. It stores `predictedClass`, `confidence`, `isCorrect`, the three probabilities, and the one-hot observed vector for a later aggregate layer.

## 5. AET / PEN policy

Reused from frozen `reconstruct.countableGoals` / 5B.3–5B.4:

Allowed final statuses: `FT`, `AET`, `PEN`.

`homeGoals` / `awayGoals` are the **90-minute plus extra-time** score. A penalty shootout is **not** used to choose HOME / DRAW / AWAY. If a `PEN` match finished 1–1 after extra time, the observed class is DRAW.

5C.6 does not add a shootout field. The synthetic outcome source must supply the same countable goals 5B would have used.

Observed class:

- homeGoals > awayGoals → HOME
- homeGoals == awayGoals → DRAW
- homeGoals < awayGoals → AWAY

via frozen `outcomeFromScore`.

## 6. Eligibility

A fixture may be scored only when:

- a valid five-arm PENDING batch exists
- candidate fingerprint and 5C.2 hashes verify
- kickoff is strictly before `scoredAt` and `outcomeCapturedAt`
- outcome fixture / competition / season match
- goals are non-negative integers
- status is `FT` / `AET` / `PEN`
- no scored artifact already exists for that source batch + fixture

Rejected: kickoff-time scoring, future fixtures, non-final status, fractional/negative/malformed goals, wrong fingerprint, tampered pending hashes, missing/duplicate/unknown arms, embedded pending results.

## 7. Atomicity and idempotency

All five arms score or no scored file is written. Persistence is temp-write then rename. Overwrite is refused. A second score of the same source is `ALREADY_SCORED`. Failures clean `.tmp` files. The pending file is re-read and must match its pre-score bytes after success and after every failure path.

## 8. N semantics

- `capturedN` = unique persisted five-arm PENDING fixtures under the frozen fingerprint
- `scoredN` = unique fixtures with a valid separate scored artifact

Scoring does not increment `capturedN`. Successful persist increments `scoredN` by 1. Five candidate rows are one observation.

## 9. Transport

`ProspectiveOutcomeSource` is synthetic-only (`kind: "synthetic"`). No live URL, credential, fetch, or axios implementation ships in 5C.6.

## 10. Persistence locations

Conceptual:

- `data/prospective/pending/`
- `data/prospective/scored/`

Both remain gitignored. 5C.6 tests write only to temporary directories.

## 11. Next step (not authorized here)

Human review, then a separate 5C.6 freeze checkpoint. Do not attach a provider final-result lookup until that freeze exists.
