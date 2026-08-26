# 06 — AI engines

## Table of contents

1. [Overview](#overview)
2. [Intelligence Core](#intelligence-core)
3. [Probability Engine](#probability-engine)
4. [Reasoning Layer](#reasoning-layer)
5. [Explainability](#explainability)
6. [Learning Engine](#learning-engine)
7. [APEX Vision](#apex-vision)
8. [Inputs and outputs](#inputs-and-outputs)
9. [Boundaries](#boundaries)
10. [Open questions](#open-questions)

---

## Overview

APEX Intelligence separates **probability** (numeric engine), **reasoning** (explanations / recommendations / value), and **learning** (feedback loops). Engines compose; they do not own HTTP or vendor SDKs.

## Intelligence Core

Shared types, ports, and composition root under `lib/intelligence/`. See [`docs/AI_ENGINE.md`](./AI_ENGINE.md).

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

Separate package (`lib/learning-engine/`). Not modified by the Reasoning Layer sprint.

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
