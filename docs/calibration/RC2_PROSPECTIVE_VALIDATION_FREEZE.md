# RC2 Prospective Validation Freeze

This document freezes the **next** validation protocol **before** any unseen outcomes are scored.

It does **not** invent a production candidate.
It does **not** fill candidate slots from historical 5B.4–5B.16 metrics.

---

## Frozen date

2026-09-19

## Frozen purpose

Evaluate a later, separately pre-registered candidate architecture on unseen data without historical retuning.

## Frozen historical data (USED)

The following Premier League seasons were used for model investigation in 5B.1–5B.16:

- PL 2023 (holdout in 5B.6–5B.16)
- PL 2024 (development / pilot population)
- PL 2025 (holdout in 5B.6–5B.16)

They **MUST NOT** be called unseen again.

Do not collect a new season in 5B.17. Zero API remains required for this freeze sprint.

---

## Candidate slots

Slots only. Values are **UNASSIGNED — REQUIRES SEPARATE PRE-REGISTRATION BEFORE OUTCOME ACCESS**.

Do not fill these from historical best metrics.

| Slot | Meaning | Status |
|---|---|---|
| CONTROL | Current production model (S = 400, catalogue 1580/1520, HA = 65, drawBase = 0.28, blend = 0.7, independent Poisson) | Frozen as the production baseline. Not a new candidate. |
| CANDIDATE_A | Future frozen candidate **input geometry** | UNASSIGNED |
| CANDIDATE_B | Future frozen candidate **Elo→xG geometry** | UNASSIGNED |
| CANDIDATE_C | Future **combined** input + transform candidate | UNASSIGNED |
| CANDIDATE_D | Optional future **HIGH_EQUAL local operator** | UNASSIGNED |

A later pre-registration must name exact formulas, constants, and code hashes **before** loading or scoring any unseen outcomes. Historical D1 / C7 / P7 / M1–M3 / T1 remain forensic labels, not assigned candidates.

---

## Prospective data rule

An unseen prospective window is data whose outcomes were **not** used in 5B.1–5B.16.

Preferred design:

1. Collect predictions **before** match completion.
2. Store immutable pre-match prediction records.
3. Score only after results become final.
4. No retroactive candidate changes.

If a historical season **outside** 2023–2025 is used later, it qualifies as unseen only if:

1. The candidate configuration was frozen **before** loading or scoring that season’s outcomes.
2. No results from that season were used during 5B work.
3. No parameter adjustment occurs after outcome access.

5B.17 does not collect that season.

---

## Primary metrics

Frozen primary metrics (do not combine into one score):

1. Log loss
2. Brier score
3. ECE

Do **not** define winner thresholds from 5B.4–5B.16 historical results.

## Secondary descriptive metrics

- Accuracy
- Predicted vs observed H/D/A
- Home / draw / away bias
- Mean confidence (mean max probability)
- Share ≥80%, ≥90%, ≥95%
- HIGH_EQUAL O/E
- LOW_EQUAL O/E

These are descriptive. They are not a ranking function.

---

## Sample / stopping rule

Do not invent a statistically magical sample size.

Reporting checkpoints, if available:

- N = 100
- N = 250
- N = 500

Rules:

- No production promotion at N = 100 merely because metrics look good.
- Final promotion criteria must be defined in a later candidate pre-registration **before** scoring.
- No optional stopping: do not alter the candidate because an intermediate checkpoint looks bad.

---

## Immutable prediction record schema

Future prospective records must include at least:

| Field | At capture | After result |
|---|---|---|
| fixtureId | required | unchanged |
| competitionId | required | unchanged |
| season | required | unchanged |
| kickoff | required | unchanged |
| capturedAt | required | unchanged |
| modelVersion | required | unchanged |
| candidateId | required (`CONTROL` or later assigned id) | unchanged |
| inputEvidenceCounts | required | unchanged |
| homeElo | required | unchanged |
| awayElo | required | unchanged |
| eloGap | required | unchanged |
| lambdaHome | required | unchanged |
| lambdaAway | required | unchanged |
| probHome | required | unchanged |
| probDraw | required | unchanged |
| probAway | required | unchanged |
| confidence | required | unchanged |
| odds | optional if prospectively available | unchanged |
| marketImpliedHome / Draw / Away | optional if available | unchanged |
| resultStatus | `pending` | `final` / `void` |
| finalHomeGoals | **null** | filled only after final |
| finalAwayGoals | **null** | filled only after final |
| scoredAt | **null** | timestamp of scoring |

Outcome fields must be empty/null at prediction capture.

---

## Leakage rules

Frozen:

- Prediction captured before kickoff.
- Only evidence with timestamp **<** fixture kickoff.
- No final result available at prediction time.
- No post-kickoff odds used for pre-match scoring.
- No candidate modification after outcome access.
- Same fixture cannot appear twice per candidate.
- Same-kickoff ordering is deterministic.
- Result scoring is a separate step from prediction generation.

---

## Market / odds separation

Historical API-Football odds were unavailable in the prior pilot.

Therefore:

- Probability calibration validation, and
- Market / EV validation

must remain **separate**.

Future prospective odds may be captured pre-match if available.

- Do not require odds for probability-model validation.
- Do not use missing odds to discard probability observations.

---

## No gambling-profit claim

Model calibration validation does **not** establish betting profitability.

EV / bookmaker comparison requires separately captured contemporaneous odds and its own validation.

Do not use hit rate alone as evidence of profitability.

---

## What this freeze does not do

- It does not assign CANDIDATE_A/B/C/D.
- It does not choose S, shrinkage k, role bases, GD formula, ρ, drawBase, blend, HA, λ3, or a HIGH_EQUAL multiplier.
- It does not authorize live collection.
- It does not promote D1 or T1.
