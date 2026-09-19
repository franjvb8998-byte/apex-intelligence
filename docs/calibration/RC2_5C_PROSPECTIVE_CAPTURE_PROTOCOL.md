# RC2 5C.2 Prospective Capture Protocol

Infrastructure only. Frozen **before** live fixture collection and **before** unseen outcome access.

This document describes the durable pre-match capture pipeline around the immutable 5C.1 candidates. It does **not** collect real fixtures. It does **not** score results. It does **not** modify the five frozen arms.

---

## 1. Purpose

Build a capture pipeline that can later:

1. receive an eligible pre-match fixture
2. freeze evidence available before kickoff
3. run all five pre-registered candidates
4. create one immutable prediction record per fixture/candidate
5. validate leakage and integrity constraints
6. persist the prediction batch **before** results are known
7. provide an auditable hash/manifest for the captured batch
8. prevent accidental overwrite or duplicate capture

5C.2 implements that pipeline on **synthetic** fixtures only.

## 2. Frozen candidate reference

Committed 5C.1 implementation at `132f82cf5312b8de81ac7da674b074a0611d7dda`.

Exactly five arms:

| ID | Architecture |
|---|---|
| `CONTROL_PRODUCTION` | C0 + S=400 + no HIGH_EQUAL |
| `CANDIDATE_A_INPUT` | C7 + S=400 + no HIGH_EQUAL |
| `CANDIDATE_B_TRANSFORM` | C0 + S=600 + no HIGH_EQUAL |
| `CANDIDATE_C_COMBINED` | C7 + S=600 + no HIGH_EQUAL |
| `CANDIDATE_D_COMBINED_HIGH_EQUAL` | C + T1 HIGH_EQUAL transfer |

Capture modules wrap `predictCandidate` / `capturePrediction`. They do not edit:

- `candidate-config.ts`
- `candidate-input.ts`
- `candidate-transform.ts`
- `candidate-high-equal.ts`
- `candidate-engine.ts`

## 3. Candidate fingerprint

Version: `apex.calibration.prospective.5c1.v1`

SHA-256: `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Runtime constant: `CANDIDATE_MANIFEST_FINGERPRINT`.

Every prediction record and every capture batch stores this fingerprint. A changed fingerprint is a freeze break.

## 4. Input contract

`ProspectiveFixtureInput` contains:

- `fixtureId`, `competitionId`, `season`, `kickoff`
- `homeTeamId`, `awayTeamId`, `homeTeamName`, `awayTeamName`
- `evidenceAsOf`
- `preMatchEvidence` (home/away counts)
- optional `oddsSnapshot`

No final-result fields are allowed. Explicitly prohibited:

- `finalHomeGoals`, `finalAwayGoals`
- `winner`, `result`, `score`
- `actualHomeGoals`, `actualAwayGoals`, `actualOutcome`
- `scoredAt`
- `fixtureStatus` of `FT` / `AET` / `PEN`

## 5. Time contract

Required:

```
evidenceAsOf <= capturedAt < kickoff
```

All evidence timestamps must be `< kickoff`.

Tests inject `createFixedClock` / `createInjectedClock`. Capture must not depend on wall-clock time for determinism.

## 6. Capture-window placeholder

Infrastructure constants only:

```
earliestCaptureMinutesBeforeKickoff = UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL
latestCaptureMinutesBeforeKickoff = UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL
```

Synthetic tests may inject numeric minutes. 5C.2 does **not** choose operational live values or a live schedule.

## 7. Evidence snapshot

Each accepted fixture produces an immutable snapshot:

- `fixtureId`, `capturedAt`, `evidenceAsOf`
- home/away: `teamId`, `matchesPlayed`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`
- source: `competitionId`, `season`
- optional frozen `oddsSnapshot`

The snapshot is deep-copied and `Object.freeze`d. It is sufficient to reconstruct candidate input Elos via `evidenceFromSnapshot` → `resolveCandidateElos`.

## 8. Five-arm rule

Every accepted fixture runs **exactly** the five frozen candidates.

Exactly five prediction records. No arm may be skipped because its probability looks strange. All five share `fixtureId`, `kickoff`, `capturedAt`, and evidence-snapshot identity. They differ only by frozen candidate definitions.

`recordCount = fixtureCount * 5`.

## 9. Prediction record

Uses the frozen 5C.1 `ProspectivePredictionRecord` schema.

At capture:

- `resultStatus = PENDING`
- `finalHomeGoals = null`
- `finalAwayGoals = null`
- `scoredAt = null`

Records also carry `modelVersion`, `candidateId`, `candidateVersion`, `candidateFingerprint`, evidence counts, Elos, lambdas, 1X2 probabilities, confidence, and optional odds.

## 10. Odds policy

Odds are optional.

If supplied, the snapshot records `capturedAt`, `source` (bookmaker), and decimal `home` / `draw` / `away`. Valid prices yield normalized implied probabilities on the 5C.1 record.

Odds timestamp guard:

```
oddsCapturedAt <= capturedAt
oddsCapturedAt < kickoff
```

Post-capture or post-kickoff odds are rejected.

If odds are absent: `odds = null`, `marketImpliedProbabilities = null`. Probability capture continues.

## 11. Batch schema

`ProspectiveCaptureBatch` includes:

- `batchId`, `createdAt`
- `candidateVersion`, `candidateFingerprint`
- `fixtureCount`, `recordCount`
- `fixtureIds`, `fixtures`, `records`, `evidenceSnapshots`
- `evidenceManifestHash`, `recordsHash`, `batchHash`

Exactly `recordCount = fixtureCount * 5`.

## 12. Canonical hashing

Deterministic SHA-256 over canonical JSON:

- stable sorted object keys
- stable array order
- UTF-8
- only injected `capturedAt` / `createdAt` timestamps
- no platform-dependent paths inside the hashed material

Same logical batch → identical hashes. Any prediction or evidence mutation changes the relevant hash.

## 13. Batch ID

Derived, not random:

```
SHA-256(canonical({
  candidateFingerprint,
  createdAt,
  sorted fixtureIds,
  recordsHash
}))
```

No `Math.random`. No UUID for canonical batch identity.

## 14. Persistence

Local path: `data/prospective/`

Conceptual areas:

- `pending/` — 5C.2 may write here
- `scored/` — not implemented; 5C.2 must not write scored results

Default persist is **off**. `dryRun` defaults to true. Persist requires `dryRun: false`.

Do **not** write to `data/calibration/`.

## 15. Duplicate protection

Rejected:

- the same fixture twice in one input batch
- duplicate fixture/candidate records
- overwrite of an existing `batchId`
- recapture of a fixture already stored under the **same** candidate fingerprint

Earlier predictions are never silently replaced.

## 16. Leakage guards

Capture rejects:

- `kickoff <= capturedAt`
- evidence timestamp `>= kickoff`
- outcome fields
- final `FT` / `AET` / `PEN` status
- post-kickoff odds
- post-capture odds
- USED historical seasons

## 17. Historical firewall

Preserved from 5C.1. Premier League investigation seasons **2023 / 2024 / 2025** must not be captured as prospective validation data.

Synthetic tests use values such as `UNSEEN-TEST` / `2099`.

No persisted 5B historical datasets are loaded.

## 18. Dry-run behavior

`dryRun = true` (default):

- eligibility
- evidence snapshots
- all five candidates
- records
- hashes
- integrity checks
- report

and **does not write to disk**.

5C.2 tests primarily use dry-run.

## 19. Integrity report

Human-readable report contains:

- `batchId`, `createdAt`, candidate fingerprint
- fixture count, record count
- per fixture: id, teams, kickoff, capturedAt, evidenceAsOf, odds yes/no, five candidate IDs
- integrity summary: time, evidence, duplicate, hash, pending-outcome guards

No winner. No ranking.

## 20. Data git policy

`.gitignore` contains the narrow rule:

```
/data/prospective/
```

Captured pending/scored JSON must not be committed by default.

Source under `lib/debug/calibration/prospective/` and this document remain tracked. The prospective **source** directory is not ignored.

## 21. What 5C.2 does NOT do

- live API-Football or any origin HTTP
- real fixture collection
- result access or scoring
- candidate parameter changes
- production PE / Elo / EV / scanner edits
- commit or push
- operational capture-window assignment
- promotion or ranking

## 22. Transition requirements for 5C.3

Before live capture:

1. Keep the five arms and fingerprint immutable.
2. Assign operational `earliestCaptureMinutesBeforeKickoff` and `latestCaptureMinutesBeforeKickoff`.
3. Define the live fixture source and evidence-as-of protocol.
4. Capture only fixtures with `kickoff > capturedAt` on seasons **outside** {2023, 2024, 2025}.
5. Persist pending batches before any result is known.
6. Do not implement scoring until a later sprint explicitly authorizes it.
7. Do not promote or rank from capture reports.

---

Status: **INFRASTRUCTURE FROZEN FOR REVIEW — no real fixtures captured, no outcomes scored**
