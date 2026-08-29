# RC1 Architecture Review — APEX Intelligence

**Status:** Release Candidate 1 technical review  
**Date:** 2026-08-28  
**Scope:** Entire product codebase. No new features. No product redesign.  
**Reviewer note:** Safe refactors applied in this pass are listed under [Refactors applied](#refactors-applied). Parallel engines were **not** merged — that is an RC2 product decision.

---

## Scores

| Dimension | Score | Reading |
| --- | ---: | --- |
| Architecture | **64 / 100** | Clear ports (`IDataProvider`, Decision Engine, Probability Engine). Parallel scoring/verdict engines still live on Match Analysis. |
| Performance | **55 / 100** | Feed/Lab stream independently. Opportunity scans and Match Center enrichment multiply API-Football calls. All product pages are `force-dynamic`. |
| Maintainability | **62 / 100** | Deterministic engines are well tested. Formatters, KPI shells, and Elo/confidence helpers were forked. Layering leak `lib → components` is reduced. |
| Code quality | **72 / 100** | TypeScript, Vitest coverage on engines, honest empty/error copy, no invented news tape. Intelligence Core / Reasoning Layer remain stubs. |
| **Production readiness** | **48 / 100** | **Not production-ready.** Guest product works. User data is mock. Quota can blank scans. Match Analysis shows conflicting recommendations. |

**RC1 verdict:** ship as a **closed beta / demo terminal**, not as a production betting platform.

---

## 1. Architecture review (by module)

Intended stack is sound:

```
External providers  →  IDataProvider / Auth
        ↓
Internal services   →  loaders in lib/*
        ↓
Engines             →  PE · Decision Engine · (legacy Match Rating)
        ↓
Presentation        →  app/* + components/*
```

| Module | Role | Assessment |
| --- | --- | --- |
| Match Center | Fixture desk + PE preview | Loads `ApexMatchBundle`, runs PE + Decision Engine + Match Rating + Rules recommendation. Dashboard rec card is **Rules**, not Decision Engine. |
| Match Analysis | Deep fixture | Same bundle path. **Three confidence numbers** and **two verdict systems** can appear on one page (Decision Card vs Intelligence Report vs PE gauge). |
| Decision Engine | Canonical recommendation | Deterministic v1. Consumed by Opportunities, Feed, Lab scan, Brain, Decision Card. **Not** Copilot, Portfolio, Bankroll, Match Center rec card. |
| APEX Brain | Narrative over DE | Maps DE verdict → BET/WATCH/SKIP. Does not re-score. |
| Portfolio | Book risk | `buildPortfolioReport(getMockBankroll())`. Forward EV/Kelly use **Laplace hit rate**, not PE/DE. |
| Opportunities | Daily scan | `getApexOpportunities` → Match Center bundle → DE → `ApexOpportunity`. Correct consumer of DE. |
| Intelligence Feed | Daily terminal | Cached scan + dashboard + mock bankroll. Island + Suspense pattern is the RC1 reference. |
| Bankroll | Session ledger | Mock bets. Fixture picker from catalogue. No persistence. |
| AI Copilot | Analyst chat | Numbers from Match Center / rules snapshot. Optional LLM rewrite. Stake helper invents units when Kelly is missing. |
| Dashboard | Catalogue home | Auth-gated. **No-key fallback is `MockDataProvider`**, while Match Center uses **recorded API-Football**. |
| Rating System | Legacy 10-metric board | `lib/match-rating`. Still computed on every preview. `ApexScoreCard` is unmounted. Lab still compares it. |
| APEX Lab | Research desk | Honest about samples. Scan can fail independently of Learning Engine mocks. |

### Duplication found

- **Elo input:** two copies of `estimateEloFromTeamId` (consolidated this pass).
- **PE confidence:** three copies of entropy → 0–1 (consolidated this pass).
- **EV formula:** shared `expectedValue(p, odds) = p * odds - 1` in `lib/match-center/markets.ts`. Portfolio uses a different **p**.
- **Kelly:** shared `quarterKelly` in `lib/match-rating/pricing.ts`. Four **policies** (DE snap, Rating caps, Report exposure, Rules inline, Copilot units).
- **KPI shells:** Feed `KpiStrip` vs Lab `LabKpiStrip`; Bankroll vs Portfolio KPI grids.
- **Charts:** `chartBounds` duplicated in bankroll, lab, match-analysis.
- **Formatters:** `formatPct` / `formatOdds` / `formatEv` still local in several match-analysis/match-center files (`"—"` vs `"n/d"`).

### Dead / unused (kept unless noted)

| Item | Action |
| --- | --- |
| `components/match-analysis/apex-score-card.tsx` | File kept (legacy board). Removed from public barrel. |
| `lib/lab/format.ts` `formatInt` | Removed (unused). |
| `HeatmapPlaceholder` | Design-system demo only. |
| Showcase (`/apex-showcase`) | Internal nav leftover. |
| `/apex-opportunities` redirect | Harmless alias. |
| Intelligence Core pipeline, Reasoning LLM, Simulation/Live/Learning **modules** | Stubs. Product uses PE + rules + DE instead. |

### Circular dependencies

No runtime import cycle found. Soft risks:

- `match-rating ↔ match-analysis` type cycle (`ApexScoreBreakdown` / `ApexMatchRating`).
- `decision-engine/from-match` → `intelligence-report/facts` → `match-analysis` types.
- `match-center/from-probability` composes **three** engines into one preview object.

---

## 2. Domain consistency — sources of truth

**Requirement:** one engine for Probability, EV, Kelly, Confidence, APEX Rating, Recommendation, Decision Engine.

**RC1 reality:**

| Domain | Canonical candidate | Unified? |
| --- | --- | --- |
| Probability 1X2 / Poisson | `EloPoissonHybridEngine` | **Mostly.** Elo *inputs* still estimated when no rating store exists. |
| Expected Value | `markets.expectedValue` | **Formula yes. Input p no** — Portfolio uses book hit rate. |
| Kelly | `quarterKelly` | **Formula yes. Stake policy no** — DE / Rating / Report / Rules / Copilot differ. |
| Confidence | DE `evaluateConfidence` (0–100) vs PE entropy (0–1) | **No.** Different meanings. Match Analysis shows both. |
| APEX Score | `evaluateDecision` | **Intended yes.** Match Rating `rateMatch` still runs in parallel. |
| Recommendation | `decideVerdict` (5-tier) | **No.** Rules, Rating (3-tier), Report, Brain labels all active. |
| Decision Engine | `evaluate.ts` | **Yes for Opportunities / Feed / Lab scan / Brain / Decision Card.** |

Highest-risk UX: **Match Analysis** can show Decision Engine Avoid next to Intelligence Report / Rating Watch on the same fixture.

---

## 3. Data flow

```
API-Football HTTP ─┬─ TTL cache ─ Next unstable_cache ─ IDataProvider
Recorded fixtures ─┘                      │
                                          ├─ match-center/load
                                          ├─ match-analysis/load
                                          ├─ dashboard/load
                                          ├─ apex-opportunities/load  ← full DE scan
                                          ├─ bankroll/load-fixtures
                                          └─ copilot/load

Feed/Lab wrap scan + dashboard in react.cache (per request only).
Supabase = auth only. Football tables in schema.sql are unused.
```

### Duplicated requests

- Catalogue list is loaded independently by Dashboard, Match Center, Opportunities, Feed, Lab, Bankroll, Copilot.
- `getApexOpportunities` is a full scan (odds + optional enrichment × N fixtures). Visiting Feed, Opportunities, and Lab in one session can run **three scans**.
- Featured match: Dashboard, Feed desk, Lab featured each call `loadDashboardWorkspace`.
- Live enrichment ≈ 8+ vendor calls per fixture (team stats, H2H, injuries, recents, lineups, standings).

### Layers

| Layer | Status |
| --- | --- |
| External providers | API-Football live; recorded fallback; SportMonks / Football-Data.org stubs |
| Internal services | Loaders in `lib/*` — good |
| Presentation | Pages still import `loadUnlessQuota` and quota cards |
| Leaks | `enrich.ts` / catalogue use `instanceof ApiFootballDataProvider`; BFF reaches `api.http`; error fallback imports quota helper; `test-football` bypasses the platform |

### Future database

Already in place: `IDataProvider`, `ApexMatchBundle`, `ProviderFactory`, unused Supabase schema, intelligence repository ports (stubbed).

To replace API-Football with minimal page churn:

1. Implement a DB-backed `IDataProvider` (ingest job optional).
2. Remove `instanceof ApiFootballDataProvider` from enrichment.
3. Unify Dashboard mock vs Match Center recorded fallback.
4. Persist Elo (`EloRatingProvider`).
5. Persist bankroll + learning cases.
6. Stop live HTTP from RSC; engines stay in-process.

---

## 4. Types

| Concept | Problem |
| --- | --- |
| `MatchOutcome` | Defined in both `lib/intelligence/types` and `lib/learning-engine/types/case` |
| Confidence | `ConfidenceScore` (0–1), `ApexConfidenceBlock` (0–100), Report `ConfidenceBlock` (0–100 + base) |
| Verdict | `ApexDecisionVerdictKind` (5) vs `ApexVerdictKind` (3) vs Rating `bet\|watch\|skip` vs Rules `bet\|pass\|watch\|reduce_stake` |
| Recommendation | Reasoning contracts vs Brain vs Rating vs Opportunities discovery labels |
| `ApexOpportunity` | Flattened DE projection — acceptable view-model, not a second engine |

RC2 should keep view-models but **stop exporting a second MatchOutcome** and document confidence scales in one place (`docs/DECISION_ENGINE.md` already distinguishes DE confidence from 1X2 probability).

---

## 5. Performance

| Pattern | Where | Note |
| --- | --- | --- |
| Server islands + Suspense + pane error boundary | Feed, Lab | **Reference.** |
| Monolithic client view | Match Center, Match Analysis (3× framer-motion heroes), Bankroll, Portfolio, Opportunities | No streaming of inner panes. |
| `dynamic = "force-dynamic"` | 11 product pages | Correct for live catalogue; no ISR. |
| `react.cache` | Feed/Lab loaders | Dedupes within one RSC request only. |
| Client bundle | Match Analysis ~900 LOC motion; Copilot chat 299; Vision + framer-motion | No chart library (inline SVG) — good size, duplicated helpers. |
| Mock bankroll | Loaded on server today | Safe. Barrel re-exports `MOCK_BANKROLL_BETS` — do not import from client. |

Missing `loading.tsx` / `error.tsx` on auth, landing, design-system, showcase — acceptable for non-product chrome.

---

## 6. UI consistency

Design system exports Card, Badge, MarketChip, ProbabilityBars, ConfidenceIndicator, ScoreGauge, Timeline, ExplanationPanel, TeamLogo.

Product still has **three card shells** (DS Card, FeedCard, LabPanel), **two explanation panels**, and **three verdict badge maps** (`VERDICT_BADGE_TONE` vs Decision Card vs recommendation-badge).

Language: Bankroll / Match Center / Dashboard / Copilot strings are largely **Spanish**. Feed / Lab / Portfolio / Opportunities discovery are **English**. Same metric is “Bankroll actual” and “Current Bankroll”.

Spacing: Feed/Lab `space-y-5` / `gap-3`; Bankroll/Portfolio/Opportunities `space-y-6`.

This is not a blocker for a demo terminal. It is a blocker for a single “professional product” feel.

---

## 7. Mock / real / cached inventory

Do **not** delete mocks still required for demo, tests, or quota fallback.

| Surface | Real API | Cached API | Recorded catalogue | In-repo mock | Placeholder / stub | Needs implementation |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| Match Center | ✓ | ✓ TTL + Next cache | ✓ no key / quota | `mock-data.ts` tests | — | EloRatingProvider |
| Match Analysis | ✓ | ✓ | ✓ | `mock-data.ts` | — | Same |
| Decision Engine | — | — | consumes catalogue | — | ML `DecisionEnginePort` | Alternate model |
| APEX Brain | — | — | — | — | — | — |
| Opportunities | ✓ | ✓ | ✓ | — | — | Cross-route scan cache |
| Feed | ✓ scan + desk | ✓ `react.cache` | ✓ | Bankroll pane | — | Shared scan with Opportunities |
| Lab | ✓ scan + featured | ✓ | ✓ | Learning Engine 4 cases, `LAB_MODELS` | Intelligence simulation module | Historical DE backtest |
| Bankroll | fixtures only | ✓ | ✓ | **Ledger** | — | Persistence |
| Portfolio | fixtures only | — | — | **Same ledger** | — | Persistence |
| Copilot | ✓ fixtures | ✓ | ✓ | — | Optional LLM | — |
| Dashboard | ✓ with key | ✓ | — | **No-key mock provider** | — | Align fallback with Match Center |
| Rating | computed | — | — | — | Unmounted ApexScoreCard | Retire or fold into DE |
| APEX Vision | — | — | — | **Client simulation** | Live module stub | Realtime events |
| Learning Engine | — | — | — | **Closed-book fixtures** | — | Wire finished matches |
| Auth | Supabase | session | — | — | — | — |
| Football DB | — | — | — | schema unused | Event store TODO | Ingest + read provider |
| BFF REST | ✓ via factory | — | — | default provider `mock` | — | Align env with pages |
| SportMonks / FD.org | — | — | — | demo payloads | HTTP TODO | — |

---

## 8. Technical debt

### High

1. **Unify recommendation on Match Analysis** — Decision Card is source of truth; Report/Rating must consume DE or be clearly labeled “legacy board”.
2. **Quota amplification** — one scan service shared by Opportunities, Feed, Lab; cap enrichment; prefer stale cache.
3. **Persist bankroll** — session mock is not a production book.
4. **Dashboard vs Match Center no-key fallback** — same catalogue, one provider.
5. **Remove `instanceof ApiFootballDataProvider`** from enrichment so a DB provider can ship.

### Medium

6. One formatter module (`n/d` vs `—`, kickoff locale).
7. One verdict badge tone map across Opportunities, Feed, Lab, Decision Card.
8. Suspense islands on Match Analysis (Brain / Decision / Report / charts).
9. Split `analysis-charts.tsx` (~465 lines) and `lib/feed/build.ts` (~540 lines).
10. Deduplicate Feed/Lab KPI strips and Bankroll/Portfolio KPI grids.
11. Retire or hide Showcase from production nav.
12. Single `MatchOutcome` type; document confidence 0–1 vs 0–100.
13. Copilot `suggestedStake` must not invent units when DE stake is 0%.
14. Portfolio forward EV labeled as **book hit-rate**, never “model EV”.

### Low

15. Align UI language (ES vs EN) per surface or globally.
16. Auth/landing `loading.tsx`.
17. Fold unused `ApexScoreCard` or remount it as Lab-only.
18. Intelligence Core / Reasoning stubs: keep as future ports; do not wire into UI until implemented.
19. `chartBounds` helper for SVG charts.
20. BFF default `APEX_DATA_PROVIDER=mock` vs pages defaulting to API-Football.

---

## Refactors applied (this review)

Safe, behavior-preserving only:

- **PE entropy confidence** lives in `lib/intelligence/modules/probability/confidence-from-hybrid.ts`. Match Center, Match Analysis rules, and Explainable AI consume it. Decision Engine confidence is unchanged.
- **Pseudo-Elo** lives in `lib/intelligence/modules/probability/elo-estimate.ts`. Match Center and Match Analysis Service no longer copy the hash.
- **Display formatters** moved to `lib/apex-opportunities/display.ts` so `lib/feed/build.ts` does not import `components/`.
- Removed unused `formatInt`. Stopped exporting unmounted `ApexScoreCard` from the match-analysis barrel.

Decision Engine math, APIs, and product layout were not changed.

---

## Remaining TODOs (code)

- `TODO(elo-provider)` — persist Elo instead of hashing team ids.
- `TODO(persistence)` — event store / bankroll / learning cases.
- `TODO(http)` — SportMonks, Football-Data.org.
- `TODO(realtime)` — Learning Engine fixtures from Data Platform; APEX Vision live.
- Intelligence adapters (`lib/intelligence/adapters/supabase`, `ai`) — not implemented.
- Simulation / Live / Learning **modules** under `lib/intelligence/modules/` — throw.

---

## Suggested roadmap for RC2

1. **Single recommendation surface** — Match Analysis, Match Center rec card, Copilot, and Opportunities all display `ApexDecision.verdict` (and Brain mapping). Keep Match Rating as a labeled Lab comparator only.
2. **Scan service** — `getApexOpportunities` as the only catalogue walk; Feed/Lab/Opportunities subscribe. Enrichment budget + stale-on-quota everywhere.
3. **Provider cleanup** — enrichment behind a port; one offline catalogue; BFF and pages share `APEX_DATA_PROVIDER`.
4. **Persistence slice** — bankroll bets + optional watchlist in Supabase; Learning Engine cases from finished fixtures.
5. **Performance** — island Match Analysis; drop unused motion; share KPI/chart primitives in the design system.
6. **i18n decision** — pick Spanish or English for product chrome (or ship both with a locale).
7. **Do not** merge Probability Engine into Decision Engine — they answer different questions (1X2 vs stake/verdict). Do **consume** PE probability inside DE value (already true).

---

## Production checklist (RC1)

| Gate | Pass? |
| --- | --- |
| Auth (login / recovery) | Yes (Supabase) |
| Guest can demo product pages | Yes (except `/dashboard`) |
| Decision Engine deterministic + tested | Yes |
| Probability Engine deterministic + tested | Yes |
| Honest empty / quota / error states | Mostly |
| No invented news / odds tape | Yes (Feed/Lab copy is explicit) |
| Single recommendation on analysis | **No** |
| User book persisted | **No** |
| API quota safe for daily use | **No** |
| Ready to replace API-Football | **Not yet** (instanceof + dual fallbacks) |

**Recommendation:** treat RC1 as an **internal intelligence terminal**. Do not market bankroll, yield, or “the model says Bet” as production-grade until High items 1–5 are closed.
