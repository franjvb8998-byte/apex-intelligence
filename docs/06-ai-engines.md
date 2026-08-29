# 06 — AI engines

## Table of contents

1. [Overview](#overview)
2. [Intelligence Core](#intelligence-core)
3. [Team Intelligence](#team-intelligence)
4. [Scoring Engine v2](#scoring-engine-v2)
5. [Probability Engine](#probability-engine)
6. [Reasoning Layer](#reasoning-layer)
7. [Explainability](#explainability)
8. [Learning Engine](#learning-engine)
9. [Intelligence Learning System](#intelligence-learning-system)
10. [APEX Vision](#apex-vision)
11. [Inputs and outputs](#inputs-and-outputs)
12. [Boundaries](#boundaries)
13. [Open questions](#open-questions)

---

## Overview

APEX Intelligence separates **probability** (numeric engine), **reasoning** (explanations / recommendations / value), and **learning** (feedback loops). Engines compose; they do not own HTTP or vendor SDKs.

## Intelligence Core

Shared types, ports, and composition root under `lib/intelligence/`. See [`docs/AI_ENGINE.md`](./AI_ENGINE.md).

## Team Intelligence

Club digital twin under `lib/team-intelligence/`. Coverage-weighted 0–100 from published team facts. **Does not** modify Probability, Decision Engine weights, or vendor HTTP. See [`docs/TEAM_INTELLIGENCE.md`](./TEAM_INTELLIGENCE.md).

## Scoring Engine v2

Official platform score under `lib/scoring-engine/`. Nine independently testable pillars, recalibrate `weights.ts`. Consumes Probability, Decision Engine value/risk/confidence, and Team Intelligence — it does not replace those engines' internals. See [`docs/SCORING_ENGINE.md`](./SCORING_ENGINE.md).

## Probability Engine

Elo + Poisson hybrid for 1X2 / O-U. **Do not modify** when extending reasoning. See [`docs/PROBABILITY_ENGINE.md`](./PROBABILITY_ENGINE.md).

## Reasoning Layer

Architecture scaffolding under `lib/intelligence/reasoning/` (Sprint 5).

- Contracts: `ReasoningInput`, `ReasoningOutput`, `Recommendation`, `RiskAnalysis`, `ConfidenceScore`, `Explanation`, `ValueOpportunity`, `PredictionReport`
- Stubs throw `Not implemented` — **no OpenAI** yet
- Full doc: [`docs/REASONING_LAYER.md`](./REASONING_LAYER.md)

## Explainability

Core module stubs (`modules/explainability`) vs Reasoning Layer `ExplainabilityService` — the latter is the path for match narratives and factor trees.

## Learning Engine

Separate package (`lib/learning-engine/`). Post-match PE evaluation (accuracy, Brier, ECE). Not modified by the recommendation learning sprint.

## Intelligence Learning System

Recommendation registry + settlement + ROI / calibration / market metrics under `lib/intelligence-learning/`. Persists Scoring Engine v2 recommendations from Scanner, Match Analysis and Smart Combo. Does not train models. See [`docs/INTELLIGENCE_LEARNING.md`](./INTELLIGENCE_LEARNING.md).

## APEX Vision

Probability produces numbers → Reasoning turns them into decisions users can trust → Learning closes the loop.

## Inputs and outputs

| Layer | Primary in | Primary out |
| --- | --- | --- |
| Probability | Match / team features | 1X2, markets |
| Reasoning | `ReasoningInput` (incl. optional probs) | `ReasoningOutput` / `PredictionReport` |
| Learning | Outcomes + prior predictions | Calibration updates |

## Boundaries

- Reasoning **must not** change Probability Engine, Learning Engine, Data Platform, or public APIs in this phase.
- LLM access only via `ReasoningLlmAdapter` (stub today).

## Open questions

- Persistence of `PredictionReport`
- When to call Reasoning from BFF vs Match Center
- Confidence calibration source of truth (Reasoning vs Core domain type)
