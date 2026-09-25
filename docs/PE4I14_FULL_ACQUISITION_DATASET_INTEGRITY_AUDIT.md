# PE-4I.14 — Full Acquisition / Dataset Integrity Audit

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7` (main)  
**Phase:** Offline integrity audit only — **ZERO** provider / HTTP / Supabase calls  
**Modeling / fitting / calibration / odds-EV:** **NONE**  
**Holdout:** Calendar-2025 remains **SEALED** (raw acquisition evidence only; no outcome unsealing)

## Preflight

| Check | Result |
|---|---|
| HEAD | `bb5d9d0…733c7` |
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | **1094** |
| Statistics cache hits / uncached | **1094 / 0** |
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| Production expectation | **UNAVAILABLE** |
| G1 selectedShrinkageK | **10** (digest `ad35f712…7414b`) |
| **PREFLIGHT** | **PASS** |

## Lineage summary

| Stage | Artifact | providerCallsSucceeded |
|---|---|---|
| PE-4I.3 smoke | `smoke-i3/smoke-report.json` | **1** statistics success (2 total provider calls incl. schedule) |
| PE-4I.6 Stage-2A | `stage2a-i6/call-accounting.json` | 150 |
| PE-4I.7 Stage-2B | `stage2b-i7/call-accounting.json` | 150 |
| PE-4I.8 Stage-2C | `stage2c-i8/call-accounting.json` | 150 |
| PE-4I.9 Stage-2D | `stage2d-i9/call-accounting.json` | 150 |
| PE-4I.10 Stage-2E | `stage2e-i10/call-accounting.json` | 150 |
| PE-4I.11 Stage-2F | `stage2f-i11/call-accounting.json` | 150 |
| PE-4I.12 Stage-2G | `stage2g-i12/call-accounting.json` | 150 |
| PE-4I.13 Stage-2H | `stage2h-i13/call-accounting.json` | 43 |
| **Lineage sum (smoke stats + I.6–I.13)** | | **1 + 150×7 + 43 = 1094** |

Cache layout: smoke-i3 = 1 completed stats unit; bulk = 1093 completed stats units; unique fixture IDs = 1094.

## A–J audit findings

### A. Frozen queue
Digest/size match PE-4I.5 frozen constants; canonical sorted order verified.

### B. Statistics caches
Queue IDs with completed stats = **1094 / 1094**. Total completed stats units across caches = 1094.

### C. Fixture identity
Duplicate IDs = **0**; empty/malformed IDs = **0**; ordering matches digest canonical sort.

### D. Join
Every queue ID has exactly one completed statistics envelope; `providerFixtureId` mismatches = **0**.  
Team blocks: exactly 2 = **1091**; fewer than 2 = **3** (coverage helpers pad missing sides as missing — not zero). Non-blocking data-quality note; join completeness still 1094/1094.

### E. Temporal contracts
Existing helpers enforce `kickoff(history) < kickoff(target)` and self/same/future exclusion (`temporal.ts`, `as-of-t.ts`).  
Future schedule anticipation remains `UNAVAILABLE_NO_AS_OF_T_SCHEDULE_SNAPSHOT` — no as-of-T snapshots in local data. Acquisition stores evidence; feature builds must call helpers.

### F. Calendar-2025 / holdout
| Metric | Value |
|---|---|
| Cached queue fixtures with `calendarKickoffYear === 2025` | **288** |
| Cumulative audit artifact | present; count **288**; IDs match |
| Holdout | **SEALED** |
| Production imports of `pe4-acquisition` | **none** |

Paths that mention calendar-2025 / holdout firewall (acquisition/audit/docs only — not production fitting):

- `lib/debug/calibration/pe4-acquisition/holdout.ts`
- `lib/debug/calibration/pe4-acquisition/stage2c-batch.ts` … `stage2h-batch.ts`
- `lib/debug/calibration/pe4-acquisition/pe4i14-integrity-audit.ts`
- Stage docs PE4I9 / PE4I11–PE4I13 (and related batch docs)

No accidental research fitting consumption of sealed calendar-2025 **outcomes** observed in production roots (`lib/prematch-lifecycle`, `lib/prematch-decision`, `lib/match-center`, `app`, `workflows`).

### G. Field semantics + competition matrix (recomputed)

Missing ≠ zero (envelope `valuePresence`).

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 1840 | 348 | **84.095** |
| total_shots / SOT / possession / corners | 2182 | 6 | **99.726** |
| yellow_cards | 2080 | 108 | **95.064** |
| red_cards | 264 | 1924 | **12.066** |

xG (1094 fixtures): both **920** / one **0** / none **174** → **84.095%** → `XG_COVERAGE_PARTIAL`.

Competition matrix (Stage-2E+ observed-sample labels only — **not** model branches):

| Competition | n | both | Label | eg % | shots % | yel % | red % |
|---|---|---|---|---|---|---|---|
| Premier League | 760 | 760 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.842 | 13.158 |
| UEFA Champions League | 78 | 78 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 92.308 | 8.974 |
| UEFA Europa League | 57 | 57 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.491 | 14.035 |
| UEFA Europa Conference League | 29 | 25 | `XG_PARTIAL_IN_OBSERVED_SAMPLE` | 86.207 | 100 | 93.103 | 10.345 |
| FA Cup | 92 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 96.739 | 81.522 | 10.87 |
| League Cup | 78 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 100 | 96.154 | 5.128 |

### H. Status / AET / PEN

| Scope | FT | AET | PEN | Other |
|---|---|---|---|---|
| Stage-1 universe | 1254 | 5 | 34 | Canc/CANC present |
| Frozen Stage-2 queue | **1065** | **5** | **24** | **0** |

Queue AET+PEN total = **29**.

### I. Reproducibility
Offline audit run twice; content digests equal:

`db209c1c038bee7910f789d7da97d1b502d84c2bd97bc1ecb7db91b38efb4058`

Artifacts (gitignored): `data/calibration/pe4-acquisition-v1/stage2i14-audit/`.

### J. Call accounting coherence
**PASS** — lineage sum **1094** matches queue/cache completion.

## Production boundary

| Check | Result |
|---|---|
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| `pe4-acquisition` imports in lifecycle/scanner/scheduler/workflows/production PE | **none** |
| **Boundary** | **PASS** |

## Hygiene classification (dirty research tree)

Do **not** reset/stash/clean. Classification for checkpoint planning:

| Class | Count (approx) | Examples |
|---|---|---|
| **1 SHOULD_COMMIT_RESEARCH_CHECKPOINT** | research source + docs + `package.json` script | `lib/debug/calibration/pe4-acquisition/**`, `run-pe4i*.ts`, `docs/PE4I*.md`, `package.json` |
| **2 GENERATED_GITIGNORED** | all under `/data/calibration/` | bulk/smoke/stage artifacts, `stage2i14-audit/` |
| **3 SHOULD_NOT_COMMIT** | local env / secrets / logs | `.env*`, live-run logs under data (already gitignored) |
| **4 NEEDS_REVIEW** | none material for secrets | No tracked `.env`; key name strings only in live-transport error messages (no values) |

**PROVIDER_CALLS_MADE = 0** this phase.

## Blockers

**None.**

## Checkpoint readiness

| Field | Value |
|---|---|
| `CHECKPOINT_READY` | **true** |
| `FINAL_VERDICT` | **READY_FOR_RESEARCH_CHECKPOINT** |
| Proposed commit message | `docs(calibration): PE-4I.14 full acquisition dataset integrity audit` |
| Recommended next phase | Research checkpoint commit of PE-4I.1–I.14 source+docs (exclude gitignored data), then feature/as-of-T research planning **without** unsealing 2025 holdout |

## How to re-run (offline)

```bash
npm run calibration:pe4i14-integrity-audit
npx vitest run lib/debug/calibration/pe4-acquisition/pe4i14.integrity-audit.test.ts
```
