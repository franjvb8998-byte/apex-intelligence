# PE-4I.1 — Current Form & Schedule Evidence Gap Audit

**Phase:** evidence / coverage / architecture only (no modeling)  
**Authoritative HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Date:** 2026-09-24  
**Constraint:** offline; no provider HTTP; 2025 outcomes sealed

## Core finding

APEX can reconstruct **competition-scoped results + goals + common-baseline strength** as-of-T, but cannot yet represent a team’s **true pre-match physical schedule** (cross-competition) or **process performance** (shots / SoT / vendor xG) in historical offline research.

PE-4H.1 and GOALS-1H.1 already showed that **coarse result / goal residuals do not yield replicated form signal**. Fitting another W/D/L form model on the current evidence would mostly re-ask a question already answered.

## Recommended path

**PATH_D_NEED_BOTH_SCHEDULE_AND_PERFORMANCE_HISTORY**

Primary bottleneck for “lucky results vs genuine process”: **match statistics history**.  
Primary bottleneck for congestion / midweek load honesty: **multi-competition schedule history** (client methods already exist; offline corpus missing).

Do **not** open a new form-coefficient phase until those corpora exist.

## Inventory summary

See the full `PE4I1_CURRENT_FORM_EVIDENCE_GAP_REPORT` in the research chat / agent transcript for the complete matrix (availability, as-of-T, leakage, acquisition design, call estimates).

### Already usable offline (as-of-T safe patterns exist)

- Regulation score / WDL / GF / GA / GD (league universe; FT assumption loud for GOALS)
- Competition-scoped rest hours and rolling match counts
- Historical opponent/target common-baseline strength as of kickoff(M)
- Research MODEL_C expected points / residuals (debug only; production expectation UNAVAILABLE)
- Research G1 μ residuals (goals; PL-only)

### Provider client exists; not offline-persisted for research

- `GET /fixtures?team&season` / window (PE-4F)
- `GET /fixtures/statistics` (shots, SoT, possession; optional `expected_goals` if vendor emits)
- `GET /fixtures/lineups`, `GET /injuries` (live Match Center; no historical as-of-T archive)

### Not available / not verified in-repo

- Historical manager-change series (`/coachs` not in client)
- Travel / distance
- Extra-time **minutes** as load (AET status + ET goals fields exist; minute load not in research universe)
- Opta-quality xG time series in calibration rows (Elo→λ “xG” is model output, not vendor xG)

## Safety

- `PE3C_C0_RECON_ACTIVATION = false`
- Production `resolvePe4HistoricalExpectation` → UNAVAILABLE
- G1 k=10 frozen (`ad35f712…414b`)
- No commit/push in this phase
