# PE-4 + GOALS Research Checkpoint Audit

**Status:** research checkpoint candidate (not production activation)  
**Authoritative committed base:** `24680fa9d265b44926e80ddd1ab24cfa8259be2a`  
(`APEX Probability Engine PE-3: Close live C0 acceptance`)  
**Audit date:** 2026-09-24  
**Scope:** accumulated uncommitted PE-4 + GOALS offline research since PE-3 close

## Research lineage

### PE-4 (1X2 / form & schedule evidence)

| Phase | Role | Outcome |
| --- | --- | --- |
| PE-4A–D | Architecture + offline competition-scoped extractors under `lib/prematch-decision/pe4-form-schedule/` | Evidence contracts only; production expectation remains **UNAVAILABLE** |
| PE-4E / E.1 / F | Cross-comp schedule design + client methods + offline acquire | Additive API-Football client methods; **not** lifecycle-wired |
| PE-4G.3 | Expectation dataset | digest `139f6f8139490ea95154ada6b68df571b4326cf348c786034a011d25250feda3` |
| PE-4G.4 | Expectation POC | protocol `1c43a790…ed24`; preferred family **MODEL_C** |
| PE-4G.5 | Expectation refinement | protocol `9aabd539…050f`; **C2 not promoted** |
| PE-4H.1 | Residual-form signal audit | protocol `b38501c6…8f5b`; all primary windows **near_zero** (no residual-form blend) |

### GOALS (goals markets research)

| Phase | Protocol digest | Verdict / selection |
| --- | --- | --- |
| GOALS-1B evidence | dataset `e06c44a6…5b95` | PL regulation labels use loud **FT_ASSUMED** provenance |
| GOALS-1C G0 | `a63f9e4a…8712` | Independent Poisson league baseline |
| GOALS-1D G1 | `ad35f712…414b` | **k=10** preferred GOALS backbone |
| GOALS-1E G3 | (artifact `f981fd1d…`) | **β=0** / `NO_INCREMENTAL_SIGNAL` |
| GOALS-1F.1 | `70972c50…f067` | `NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED` |
| GOALS-1G.1 | `4a408a23…b97b` | Market calibration audit |
| GOALS-1G.2 | `b1a054ab…d00e` | `PARTIAL_CALIBRATION_CANDIDATE` (research only) |
| GOALS-1G.3 | `d29871a4…8901` | `INCONCLUSIVE_REQUIRES_MORE_EVIDENCE` — raw G1 preferred |
| GOALS-1H.1 | `6436461e…a2e7` | `NO_INCREMENTAL_RECENT_GOAL_SIGNAL` |
| GOALS-1I.1 | `ea3ec3ae…93d7` | `WEAK_INCONSISTENT_SIGNAL` — PL-only rest/load; no fatigue multiplier |

## Promoted research backbones (offline only)

- **PE-4 expectation research:** MODEL_C (not wired; production historical expectation stays UNAVAILABLE)
- **GOALS research:** G1 attack/defense Poisson with **k=10**

## Rejected / null branches (preserve)

- PE-4 residual-form blend (H.1 near_zero)
- G3 opponent-quality adjustment (β=0)
- Dixon–Coles / Negative Binomial extension (F.1)
- Market calibrator production promotion (G.2 partial / G.3 inconclusive)
- Recent goal-form blend (H.1)
- Rest/fatigue multiplier (I.1 weak/inconsistent; PL-only coverage)

## Sealed holdout

- Premier League **2025** remains sealed for PE-4 and GOALS research paths.
- References are structural (constants, exclusion, rejection tests) only.
- Artifacts under `data/calibration/` are **gitignored**.

## Production boundary

- `PE3C_C0_RECON_ACTIVATION = false`
- No imports from lifecycle / scanner / probability-engine / app routes into PE-4 expectation models, GOALS G0/G1/G3, calibration POCs, form, or rest modules
- `lib/prematch-decision/index.ts` does **not** export `pe4-form-schedule`
- New package scripts are manual `calibration:*` CLIs only (not postinstall/prepare/build/start/lifecycle)

## Known limitations

1. GOALS historical labels: explicit league **FT assumption** (not proven FT status persistence).
2. GOALS-1I.1 schedule features are **Premier League only** (cups/UEFA absent).
3. Future schedule anticipation: unavailable without as-of-T snapshots.
4. `pe4-form-schedule` lives under `prematch-decision/` for shared types but is research-unwired — treat as research module.
5. API-Football `getTeamFixturesBySeason*` methods are additive dormant surface (fixture-client stubs empty lists).

## Next research direction (after checkpoint commit)

Do **not** open GOALS-1I.2, residual-form blending, or production PE-4/GOALS activation by default.

Prefer product-driven next steps, e.g.:

- Expand offline multi-competition schedule history **before** any fatigue modeling, or
- Keep raw G1 + MODEL_C as frozen research references while PE-3 BASE remains production.
