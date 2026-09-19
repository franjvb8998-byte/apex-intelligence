# RC2 5B File Manifest

Audit of durable files retained from 5B.1–5B.16 and of temporary files already removed.

Status column is **before 5B.17**. Recommended commit is for the later human checkpoint, not a commit made in this sprint.

---

## Already committed at HEAD `c1756cbfaf89a727ca54a5f581c77bb8a59ffe11`

| Path | Sprint | Purpose | Before 5B.17 | Recommended commit |
|---|---|---|---|---|
| `lib/intelligence/modules/probability/elo-estimate.ts` | 5B.1 | Missing-stat Elo prior; ID hash removed | tracked | already committed |
| `lib/match-center/from-data-platform.ts` | 5B.1 | Shares missing-stat resolver | tracked | already committed |
| `lib/debug/sprint-5b1-base-prior.test.ts` | 5B.1 | Production regressions for base prior | tracked | already committed |
| `lib/debug/sprint-5b2-catalogue-calibration.test.ts` | 5B.2 | Catalogue / PE audit after hash removal | tracked | already committed |
| `lib/debug/calibration/types.ts` | 5B.3A (+ later harness fields) | Row schema, artifact dir | tracked, dirty | include later checkpoint |
| `lib/debug/calibration/reconstruct.ts` | 5B.3A | Leakage-safe reconstruction | tracked | already committed |
| `lib/debug/calibration/policies.ts` | 5B.3A | Debug Elo policy placeholders | tracked | already committed |
| `lib/debug/calibration/bookmaker.ts` | 5B.3A | Odds timing disclaimer / implied probs | tracked | already committed |
| `lib/debug/calibration/metrics.ts` | 5B.3A | Log loss, Brier, ECE | tracked | already committed |
| `lib/debug/calibration/evaluate.ts` | 5B.3A | Offline policy scoring | tracked | already committed |
| `lib/debug/calibration/synthetic.ts` | 5B.3A | Synthetic rows | tracked | already committed |
| `lib/debug/calibration/collection-budget.ts` | 5B.3A | Logical-call budget | tracked | already committed |
| `lib/debug/calibration/split.ts` | 5B.3A | Chronological folds | tracked | already committed |
| `lib/debug/calibration/collector-integrity.ts` | 5B.3A | Season-list completeness | tracked | already committed |
| `lib/debug/calibration/leakage.ts` | 5B.3A | Kickoff leakage guards | tracked | already committed |
| `lib/debug/calibration/vendor-map.ts` | 5B.3B | Vendor envelope mapping | tracked | already committed |
| `lib/debug/calibration/vendor-map.test.ts` | 5B.3B | Vendor map tests | tracked | already committed |
| `lib/debug/calibration/fetch-season.ts` | 5B.3B | Season fixture fetch contract | tracked | already committed |
| `lib/debug/calibration/season-contract.ts` | 5B.3B | Microcollect envelope asserts | tracked | already committed |
| `lib/debug/calibration/select-targets.ts` | 5B.3B | Target selection | tracked | already committed |
| `lib/debug/calibration/micro-shape.ts` | 5B.3B | Microcollect constants | tracked | already committed |
| `lib/debug/calibration/microcollect.ts` | 5B.3B | Microcollect runner | tracked | already committed |
| `lib/debug/calibration/run-microcollect.ts` | 5B.3B | CLI entry | tracked | already committed |
| `lib/debug/calibration/persist.ts` | 5B.3A/3B (+ later loaders) | Artifact IO | tracked, dirty | include later checkpoint |
| `lib/debug/calibration/live-guard.ts` | 5B.3B (+ 5B.4/5B.6 budgets) | Fail-closed live auth | tracked, dirty | include later checkpoint |
| `lib/debug/calibration/live-transport.ts` | 5B.3B (+ pilot/validation transports) | Debug-only live transport | tracked, dirty | include later checkpoint |
| `lib/debug/calibration/index.ts` | 5B.3A–5B.16 | Harness barrel | tracked, dirty | include later checkpoint |
| `lib/debug/calibration/sprint-5b3a-calibration-harness.test.ts` | 5B.3A | Harness tests | tracked | already committed |
| `lib/debug/calibration/sprint-5b3a-integrity.test.ts` | 5B.3A | Integrity tests | tracked | already committed |
| `lib/debug/calibration/sprint-5b3b-microcollect.test.ts` | 5B.3B | Microcollect tests | tracked | already committed |

`live-guard.ts` and `live-transport.ts` are **debug/calibration infrastructure**, not production API-Football transport.

---

## 5B.4–5B.6 untracked durable code

| Path | Sprint | Purpose | Before 5B.17 | Recommended commit |
|---|---|---|---|---|
| `lib/debug/calibration/pilot-shape.ts` | 5B.4 | Pilot constants | untracked | include |
| `lib/debug/calibration/select-pilot.ts` | 5B.4 | Stratified sample | untracked | include |
| `lib/debug/calibration/pilot-collect.ts` | 5B.4 | Authorized pilot collect | untracked | include |
| `lib/debug/calibration/run-pilot.ts` | 5B.4 | Pilot CLI | untracked | include |
| `lib/debug/calibration/pilot-diagnostics.ts` | 5B.4 | Population diagnostics | untracked | include |
| `lib/debug/calibration/pilot-ha-forensics.ts` | 5B.4 | HA decomposition | untracked | include |
| `lib/debug/calibration/catalogue-forensics.ts` | 5B.4 | Catalogue gap forensics | untracked | include |
| `lib/debug/calibration/sprint-5b4-pilot.test.ts` | 5B.4 | Pilot tests | untracked | include |
| `lib/debug/calibration/sprint-5b41-forensics.test.ts` | 5B.4 | Forensics tests | untracked | include |
| `lib/debug/calibration/experiment-5b5-ha.ts` | 5B.5 | HA factorial configs | untracked | include |
| `lib/debug/calibration/experiment-5b5-dataset.ts` | 5B.5 | Frozen 2024 population | untracked | include |
| `lib/debug/calibration/experiment-5b5-evaluate.ts` | 5B.5 | Factorial evaluate | untracked | include |
| `lib/debug/calibration/experiment-5b5-report.ts` | 5B.5 | HA report | untracked | include |
| `lib/debug/calibration/experiment-5b5-run.ts` | 5B.5 | HA CLI | untracked | include |
| `lib/debug/calibration/sprint-5b5-experiment.test.ts` | 5B.5 | HA tests | untracked | include |
| `lib/debug/calibration/validation-5b6-shape.ts` | 5B.6 | Holdout contract | untracked | include |
| `lib/debug/calibration/validation-5b6-configs.ts` | 5B.6 | Frozen configs | untracked | include |
| `lib/debug/calibration/validation-5b6-integrity.ts` | 5B.6 | Leakage contract | untracked | include |
| `lib/debug/calibration/validation-5b6-collect.ts` | 5B.6 | Holdout collect | untracked | include |
| `lib/debug/calibration/validation-5b6-evaluate.ts` | 5B.6 | Holdout evaluate | untracked | include |
| `lib/debug/calibration/validation-5b6-persist.ts` | 5B.6 | Holdout IO | untracked | include |
| `lib/debug/calibration/validation-5b6-report.ts` | 5B.6 | Replication report | untracked | include |
| `lib/debug/calibration/validation-5b6-run.ts` | 5B.6 | Validation CLI | untracked | include |
| `lib/debug/calibration/sprint-5b6-validation.test.ts` | 5B.6 | Validation tests | untracked | include |

---

## 5B.7–5B.10 untracked durable code

| Path | Sprint | Purpose | Before 5B.17 | Recommended commit |
|---|---|---|---|---|
| `lib/debug/calibration/draw-5b7-shape.ts` | 5B.7 | Draw forensics contract | untracked | include |
| `lib/debug/calibration/draw-5b7-formula.ts` | 5B.7 | Production draw audit | untracked | include |
| `lib/debug/calibration/draw-5b7-buckets.ts` | 5B.7 | Score/xG/gap buckets | untracked | include |
| `lib/debug/calibration/draw-5b7-trace.ts` | 5B.7 | Isolated PE replay | untracked | include |
| `lib/debug/calibration/draw-5b7-dataset.ts` | 5B.7 | Load persisted seasons | untracked | include |
| `lib/debug/calibration/draw-5b7-evaluate.ts` | 5B.7 | Draw evaluate | untracked | include |
| `lib/debug/calibration/draw-5b7-sensitivity.ts` | 5B.7 | drawBase sensitivity | untracked | include |
| `lib/debug/calibration/draw-5b7-report.ts` | 5B.7 | Draw attribution | untracked | include |
| `lib/debug/calibration/draw-5b7-run.ts` | 5B.7 | Draw CLI | untracked | include |
| `lib/debug/calibration/sprint-5b7-draw-forensics.test.ts` | 5B.7 | Draw tests | untracked | include |
| `lib/debug/calibration/dc-5b8-shape.ts` | 5B.8 | ρ grid | untracked | include |
| `lib/debug/calibration/dc-5b8-formula.ts` | 5B.8 | Poisson audit | untracked | include |
| `lib/debug/calibration/dc-5b8-dixon-coles.ts` | 5B.8 | DC τ / grids | untracked | include |
| `lib/debug/calibration/dc-5b8-evaluate.ts` | 5B.8 | DC evaluate | untracked | include |
| `lib/debug/calibration/dc-5b8-sensitivity.ts` | 5B.8 | ρ sensitivity | untracked | include |
| `lib/debug/calibration/dc-5b8-report.ts` | 5B.8 | DC attribution | untracked | include |
| `lib/debug/calibration/dc-5b8-run.ts` | 5B.8 | DC CLI | untracked | include |
| `lib/debug/calibration/sprint-5b8-dixon-coles.test.ts` | 5B.8 | DC tests | untracked | include |
| `lib/debug/calibration/xg-5b9-shape.ts` | 5B.9 | S / gap grids | untracked | include |
| `lib/debug/calibration/xg-5b9-formula.ts` | 5B.9 | Elo→xG mirror | untracked | include |
| `lib/debug/calibration/xg-5b9-geometry.ts` | 5B.9 | λ ratio geometry | untracked | include |
| `lib/debug/calibration/xg-5b9-evaluate.ts` | 5B.9 | Geometry evaluate | untracked | include |
| `lib/debug/calibration/xg-5b9-counterfactual.ts` | 5B.9 | Unclamped / μ probes | untracked | include |
| `lib/debug/calibration/xg-5b9-report.ts` | 5B.9 | Geometry attribution | untracked | include |
| `lib/debug/calibration/xg-5b9-run.ts` | 5B.9 | Geometry CLI | untracked | include |
| `lib/debug/calibration/sprint-5b9-elo-xg.test.ts` | 5B.9 | Geometry tests | untracked | include |
| `lib/debug/calibration/cat-5b10-shape.ts` | 5B.10 | Catalogue coefficients | untracked | include |
| `lib/debug/calibration/cat-5b10-formula.ts` | 5B.10 | Catalogue mirror | untracked | include |
| `lib/debug/calibration/cat-5b10-evaluate.ts` | 5B.10 | Gap decompose | untracked | include |
| `lib/debug/calibration/cat-5b10-counterfactual.ts` | 5B.10 | Role-base CF | untracked | include |
| `lib/debug/calibration/cat-5b10-maturity.ts` | 5B.10 | Played-before maturity | untracked | include |
| `lib/debug/calibration/cat-5b10-report.ts` | 5B.10 | Input attribution | untracked | include |
| `lib/debug/calibration/cat-5b10-run.ts` | 5B.10 | Catalogue CLI | untracked | include |
| `lib/debug/calibration/sprint-5b10-catalogue-input.test.ts` | 5B.10 | Catalogue tests | untracked | include |

---

## 5B.11–5B.16 untracked durable code

| Path | Sprint | Purpose | Before 5B.17 | Recommended commit |
|---|---|---|---|---|
| `lib/debug/calibration/ig-5b11-shape.ts` | 5B.11 | Input-geometry arms | untracked | include |
| `lib/debug/calibration/ig-5b11-formula.ts` | 5B.11 | Shrinkage / C0–C7 | untracked | include |
| `lib/debug/calibration/ig-5b11-evaluate.ts` | 5B.11 | Input evaluate | untracked | include |
| `lib/debug/calibration/ig-5b11-report.ts` | 5B.11 | Input attribution | untracked | include |
| `lib/debug/calibration/ig-5b11-run.ts` | 5B.11 | Input CLI | untracked | include |
| `lib/debug/calibration/sprint-5b11-input-geometry.test.ts` | 5B.11 | Input tests | untracked | include |
| `lib/debug/calibration/xg-5b12-shape.ts` | 5B.12 | Transform arms | untracked | include |
| `lib/debug/calibration/xg-5b12-formula.ts` | 5B.12 | G0 / gap-cap | untracked | include |
| `lib/debug/calibration/xg-5b12-evaluate.ts` | 5B.12 | Transform evaluate | untracked | include |
| `lib/debug/calibration/xg-5b12-report.ts` | 5B.12 | Transform attribution | untracked | include |
| `lib/debug/calibration/xg-5b12-run.ts` | 5B.12 | Transform CLI | untracked | include |
| `lib/debug/calibration/sprint-5b12-elo-xg-geometry.test.ts` | 5B.12 | Transform tests | untracked | include |
| `lib/debug/calibration/draw-5b13-shape.ts` | 5B.13 | Draw-channel panels | untracked | include |
| `lib/debug/calibration/draw-5b13-formula.ts` | 5B.13 | Hybrid draw decompose | untracked | include |
| `lib/debug/calibration/draw-5b13-evaluate.ts` | 5B.13 | Draw-channel evaluate | untracked | include |
| `lib/debug/calibration/draw-5b13-report.ts` | 5B.13 | Draw-channel attribution | untracked | include |
| `lib/debug/calibration/draw-5b13-run.ts` | 5B.13 | Draw-channel CLI | untracked | include |
| `lib/debug/calibration/sprint-5b13-draw-channel.test.ts` | 5B.13 | Draw-channel tests | untracked | include |
| `lib/debug/calibration/hs-5b14-shape.ts` | 5B.14 | HIGH/LOW_EQUAL | untracked | include |
| `lib/debug/calibration/hs-5b14-formula.ts` | 5B.14 | Independent / bivariate grids | untracked | include |
| `lib/debug/calibration/hs-5b14-evaluate.ts` | 5B.14 | Higher-score evaluate | untracked | include |
| `lib/debug/calibration/hs-5b14-report.ts` | 5B.14 | Higher-score attribution | untracked | include |
| `lib/debug/calibration/hs-5b14-run.ts` | 5B.14 | Higher-score CLI | untracked | include |
| `lib/debug/calibration/sprint-5b14-higher-score-draw.test.ts` | 5B.14 | Higher-score tests | untracked | include |
| `lib/debug/calibration/tr-5b15-shape.ts` | 5B.15 | Locked H1/H2 / Q1–Q4 | untracked | include |
| `lib/debug/calibration/tr-5b15-formula.ts` | 5B.15 | Temporal HIGH_EQUAL | untracked | include |
| `lib/debug/calibration/tr-5b15-evaluate.ts` | 5B.15 | Halves / LOSO | untracked | include |
| `lib/debug/calibration/tr-5b15-report.ts` | 5B.15 | Temporal attribution | untracked | include |
| `lib/debug/calibration/tr-5b15-run.ts` | 5B.15 | Temporal CLI | untracked | include |
| `lib/debug/calibration/sprint-5b15-high-equal-temporal.test.ts` | 5B.15 | Temporal tests (30s evaluate timeout kept) | untracked | include |
| `lib/debug/calibration/lm-5b16-shape.ts` | 5B.16 | Local-mass arms | untracked | include |
| `lib/debug/calibration/lm-5b16-formula.ts` | 5B.16 | Multiplier / T1 compose | untracked | include |
| `lib/debug/calibration/lm-5b16-evaluate.ts` | 5B.16 | Local-mass evaluate | untracked | include |
| `lib/debug/calibration/lm-5b16-report.ts` | 5B.16 | Local-mass attribution | untracked | include |
| `lib/debug/calibration/lm-5b16-run.ts` | 5B.16 | Local-mass CLI | untracked | include |
| `lib/debug/calibration/sprint-5b16-local-high-equal.test.ts` | 5B.16 | Local-mass tests | untracked | include |

---

## 5B.17 durable documentation (created this sprint)

| Path | Sprint | Purpose | Before 5B.17 | Recommended commit |
|---|---|---|---|---|
| `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | 5B.17 | Consolidated evidence | new | include |
| `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 5B.17 | Prospective protocol freeze | new | include |
| `docs/calibration/RC2_5B_FILE_MANIFEST.md` | 5B.17 | This manifest | new | include |
| `package.json` | 5B.4–5B.16 | Durable calibration scripts | tracked, dirty | include |

---

## Generated gitignored artifacts — KEEP, do not commit

`.gitignore` already has `/data/calibration/`. Do not broaden.

| Path | Sprint | Action |
|---|---|---|
| `data/calibration/micro-2026-09-19T05-11-40-221Z.jsonl` | 5B.3B | KEEP, exclude from commit |
| `data/calibration/micro-2026-09-19T05-11-40-221Z.meta.json` | 5B.3B | KEEP, exclude |
| `data/calibration/pilot-2026-09-19T05-40-15-494Z.jsonl` | 5B.4 | KEEP, exclude |
| `data/calibration/pilot-2026-09-19T05-40-15-494Z.meta.json` | 5B.4 | KEEP, exclude |
| `data/calibration/pilot-2026-09-19T05-52-08-473Z.population.jsonl` | 5B.4 | KEEP, exclude |
| `data/calibration/pilot-2026-09-19T05-52-08-473Z.sample.jsonl` | 5B.4 | KEEP, exclude |
| `data/calibration/pilot-2026-09-19T05-52-08-473Z.meta.json` | 5B.4 | KEEP, exclude |
| `data/calibration/experiment-5b5-2026-09-19T06-01-06-483Z.json` | 5B.5 | KEEP, exclude |
| `data/calibration/validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.population.jsonl` | 5B.6 | KEEP, exclude |
| `data/calibration/validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.meta.json` | 5B.6 | KEEP, exclude |
| `data/calibration/validation-5b6-pl-2025-2026-09-19T06-15-51-490Z.population.jsonl` | 5B.6 | KEEP, exclude |
| `data/calibration/validation-5b6-pl-2025-2026-09-19T06-15-51-490Z.meta.json` | 5B.6 | KEEP, exclude |
| `data/calibration/validation-5b6-offline-eval-2026-09-19.json` | 5B.6 | KEEP, exclude |
| `data/calibration/draw-5b7-forensics-2026-09-19T15-12-41-230Z.json` | 5B.7 | KEEP, exclude |
| `data/calibration/dc-5b8-forensics-2026-09-19T15-22-31-975Z.json` | 5B.8 | KEEP, exclude |
| `data/calibration/xg-5b9-forensics-2026-09-19T15-44-56-796Z.json` | 5B.9 | KEEP, exclude |
| `data/calibration/cat-5b10-forensics-2026-09-19T16-03-01-669Z.json` | 5B.10 | KEEP, exclude |
| `data/calibration/ig-5b11-forensics-2026-09-19T16-21-00-327Z.json` | 5B.11 | KEEP, exclude |
| `data/calibration/xg-5b12-forensics-2026-09-19T16-36-05-515Z.json` | 5B.12 | KEEP, exclude |
| `data/calibration/draw-5b13-forensics-2026-09-19T16-52-20-359Z.json` | 5B.13 | KEEP, exclude |
| `data/calibration/hs-5b14-forensics-2026-09-19T17-20-31-606Z.json` | 5B.14 | KEEP, exclude |
| `data/calibration/tr-5b15-forensics-2026-09-19T17-42-29-540Z.json` | 5B.15 | KEEP, exclude |
| `data/calibration/lm-5b16-forensics-2026-09-19T17-53-01-909Z.json` | 5B.16 | KEEP, exclude |

---

## Temporary files deleted

None deleted in 5B.17. The working tree had no remaining `_extract*`, `_*extract*.json`, or `*-summary-tmp.json`.

Already removed during 5B.16 (not present at 5B.17 start):

| Path | Reason deleted |
|---|---|
| `lib/debug/calibration/_extract-5b16.mjs` | One-off report extraction script; not imported; not a package script; durable evaluate/report modules remain |
| `data/calibration/_lm-5b16-extract.json` | One-off extraction output; equivalent numbers live in `lm-5b16-forensics-*.json` |

---

## Unresolved REVIEW files

None.
