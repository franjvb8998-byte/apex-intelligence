# APEX Data Platform v1

**Status:** architecture + contracts landed. Product pages still call API-Football at request time.  
**Date:** 2026-08-28  
**Code:** `lib/data-platform/v1/`  
**Schema (design only, not applied):** `supabase/schema-data-platform-v1.sql`  
**Do not apply that SQL** until a reviewed migration exists. Auth `profiles` in `supabase/schema.sql` stays.

This document is the source of truth for turning APEX from a vendor-coupled Next.js app into a data-driven SaaS platform that can serve tens of thousands of users without burning API-Football quota on every page view.

---

## 0. Verdict

APEX already has pieces of a data platform (`ApexMatchBundle`, `MatchDataProvider`, normalizer, HTTP TTL cache). It does **not** have a data plane. Every product module still reaches the vendor (or a recorded fixture) during the RSC request.

**Overall readiness: 38 / 100.**

Do not write a large collector, a Postgres store, or a UI migration in one sprint. The next implementation step is at the end of this document.

---

## 1. Target architecture

```text
                    ┌─────────────────────────────────────┐
                    │           API-Football              │
                    │     (and future vendors)            │
                    └─────────────────┬───────────────────┘
                                      │ raw envelopes only
                                      ▼
                    ┌─────────────────────────────────────┐
                    │             Collector               │
                    │   jobs, watermarks, never React     │
                    └─────────────────┬───────────────────┘
                                      │ ProviderRawEnvelope
                                      ▼
                    ┌─────────────────────────────────────┐
                    │            Normalizer               │
                    │   mapper per vendor → Apex*         │
                    └─────────────────┬───────────────────┘
                                      │ ApexMatchBundle
                                      ▼
                    ┌─────────────────────────────────────┐
                    │             Database                │
                    │   fixtures, odds, standings, …      │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │               Cache                 │
                    │   catalogue TTL + permanent history │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │          Decision Engine            │
                    │   PE → 1X2; DE → rec / EV / Kelly   │
                    └─────────────────┬───────────────────┘
                                      │ persisted outputs
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         Internal Services           │
                    │  Fixture · Odds · Standings · Recs  │
                    │  Opportunity · Portfolio · Bankroll │
                    └─────────────────┬───────────────────┘
                                      │ view-models
                                      ▼
                    ┌─────────────────────────────────────┐
                    │              Frontend               │
                    │     no vendor JSON, no HTTP keys    │
                    └─────────────────────────────────────┘
```

**Hard rules**

1. Collector never imports `app/` or `components/`.
2. React never sees `ProviderRawEnvelope` or API-Football response shapes.
3. Internal services never call `createApiFootballDataProvider`.
4. Decision Engine is not re-implemented in loaders, Copilot, Portfolio, or Match Rating UI.
5. News is not invented. If there is no news vendor, the table stays empty.

---

## 2. What exists today

Two overlapping stacks already live in `lib/data-platform/`:

| Stack | Contract | Used by product? |
| --- | --- | --- |
| Access layer (“v2”) | `IDataProvider.getMatch` / `listFixtures` → `ApexMatchBundle` | **Yes.** Match Center, Match Analysis, Dashboard, Opportunities, Feed, Lab, Bankroll, Copilot, BFF. |
| Ingest layer (legacy, correct shape) | `MatchDataProvider` (raw envelopes) → Normalizer → EventStore | **No.** Only `createDataPlatform().ingestMatch` and tests. |

v1 reuses the ingest stack and inserts a **catalogue** between normalizer and UI. `IDataProvider` becomes an adapter the Collector may use internally until `MatchDataProvider` grows the remaining resources. It is not a product API.

Canonical model (`lib/data-platform/types/`):

- `ApexMatch`, `ApexTeam`, `ApexLeague`, `ApexPlayer`
- `ApexMatchEvent`, `ApexOddsQuote`
- `ApexMatchBundle` (snapshot + provenance + optional trust score)
- IDs: `apex:{provider}:{entity}:{externalId}` until Postgres UUIDs replace them

---

## 3. Phase 1 — dependency map

### 3.1 Who calls API-Football

All of these create `ApiFootballDataProvider` (or `instanceof` it) during a user request unless a test injects a mock.

| Consumer | Entry | What it pulls |
| --- | --- | --- |
| Match Center | `lib/match-center/load.ts` | Today’s fixtures, then PL 2025 fallback; `getMatch`; enrichment |
| Match Center enrich | `lib/match-center/enrich.ts` | Team stats ×2, H2H, injuries, last-5 ×2, lineups, standings |
| Match Analysis | `lib/match-analysis/load.ts` | Same centre path + catalogue |
| Match Analysis catalogue | `lib/match-analysis/catalogue.ts` | Standings **again**, fixture statistics |
| Opportunities | `lib/apex-opportunities/load.ts` | Full centre catalogue + `getMatch` if odds missing + enrich if ≤3 fixtures |
| Feed | `lib/feed/load.ts` | `getApexOpportunities` + dashboard workspace |
| Lab | `lib/lab/load.ts` | Same opportunities scan + dashboard featured |
| Dashboard | `lib/dashboard/load.ts` | Separate `resolveDashboardProvider` (mock if no key); also `getMatchCenterData` for featured |
| Bankroll | `lib/bankroll/load-fixtures.ts` | `listMatchCenterFixtureBundles` |
| Copilot | `lib/copilot/load.ts` | Same provider factory as Match Center |
| BFF | `lib/bff/catalog.ts` | `IDataProvider` + `instanceof` for extra HTTP |
| Dev bypass | `app/api/test-football/route.ts` | **Raw `fetch` to api-sports.io**, no client, no cache, no normalizer |

`ProviderFactory` (`APEX_DATA_PROVIDER`) is **not** what product pages use. BFF defaults to mock. Match Center / Analysis / Opportunities **hardcode** API-Football (recorded fallback without a key). Dashboard is the only product surface that falls back to `MockDataProvider` when the key is missing.

### 3.2 Duplicated requests

| Pattern | Effect |
| --- | --- |
| `listMatchCenterFixtureBundles` | Independent catalogue pull from Dashboard, Match Center, Opportunities, Feed, Lab, Bankroll, Copilot. `react.cache` only dedupes **inside one RSC request**. |
| `getApexOpportunities` | Full Decision Engine scan. Feed, Lab, and `/opportunities` can each run it. |
| Enrichment vs catalogue | Match Center already fetched standings; Match Analysis fetches standings again. |
| Odds attach | Opportunities calls `getMatch` per fixture when the list payload has empty odds. |
| Dashboard featured | Loads a full Match Center (PE + DE + enrich) for one card. |
| `/api/test-football` | Uncached vendor hit that bypasses every control. |

Worst case for one authenticated session that opens Feed: catalogue + N× getMatch + up to 8 enrichment calls × N (capped) + dashboard date scans. Free-plan API-Football dies in hours, not days.

### 3.3 Duplicated transformations

| Transform | Location | Output |
| --- | --- | --- |
| Vendor fixture → Apex | `providers/api-football/mapper.ts` | `ApexMatchBundle` |
| Vendor fixture → Apex (ingest) | `providers/api-football/match-data-adapter.ts` | same, unused by UI |
| Vendor extras → analysis shapes | `providers/api-football/adapters/` | team stats, used by enrich |
| Apex → Match Center VM | `lib/match-center/from-data-platform.ts` | also runs PE + DE + Match Rating |
| Apex → Dashboard cards | `lib/dashboard/map.ts` | summaries |
| Apex → BFF DTOs | `lib/bff/normalize.ts` | public API |
| Match Center → Opportunity | `lib/apex-opportunities/map.ts` | board row |
| Elo stub | `estimateEloFromTeamId` | PE input, no DB ratings |

The Apex bundle is the right seam. View-models should stay. Vendor JSON must stop at the normalizer.

### 3.4 Duplicated caching

| Cache | Scope | TTL today |
| --- | --- | --- |
| `sharedApiFootballCache` | process memory | fixtures **10m**, match **10m**, standings **30m**, team **24h** |
| Next `unstable_cache` | Data Cache | same keys, server restart still hits Next |
| `react.cache` in Feed loaders | one request | not cross-page |
| Watchlist | `localStorage` | not a data cache |
| Bankroll | `getMockBankroll()` | session mock, not cached vendor data |

There is **no** catalogue cache, **no** odds-specific TTL, **no** permanent historical store. Product TTL targets in §6 are not what production is doing.

### 3.5 Migration plan (summary)

Keep `IDataProvider` as a Collector adapter. Stop using it from `app/` and `lib/*-load.ts`.

Order (product priority, not code convenience):

1. Match Center  
2. Match Analysis  
3. Opportunities  
4. Dashboard  
5. Portfolio  
6. Feed  
7. Bankroll  

Details in §8.

---

## 4. Phase 2 — database design

**Not applied.** File: `supabase/schema-data-platform-v1.sql`.

Current `schema.sql` football tables (`leagues`, `teams`, `matches`, `predictions`, `user_predictions`) are unused by the app. They cannot host this model:

- `teams.league_id` required — a club in two competitions does not fit
- no `seasons` entity (season is a string on league)
- `predictions` is 1X2 only — no EV, Kelly, verdict, APEX score
- no odds, standings, bets, watchlist, opportunities, feed

Applying v1 requires a **replacement migration** of those unused tables, not `CREATE IF NOT EXISTS` on top of them.

### 4.1 Entity map

| Entity | Table | PK | Relationships | Indexes (intent) |
| --- | --- | --- | --- | --- |
| Users | `profiles` + `user_settings` | `profiles.id` → `auth.users` | 1:1 settings; 1:N bets, watchlist | owner lookups |
| Teams | `teams` | uuid | N:M seasons via `season_teams` | name |
| Leagues | `leagues` | uuid | 1:N seasons | — |
| Seasons | `seasons` | uuid | N:1 league; unique `(league, year_start)` | current season partial |
| Fixtures | `fixtures` | uuid | N:1 season/league; N:1 home/away team | kickoff, status+kickoff, league+kickoff, team+kickoff |
| Standings | `standings` | uuid | unique `(season, team)` | season+rank |
| Markets | `markets` | uuid | unique `(type, name, line)` | — |
| Odds | `odds_quotes` + `odds_selections` | uuid | N:1 fixture, N:1 market; **append-only** | fixture+captured_at desc |
| Predictions | `predictions` | uuid | N:1 fixture; **PE 1X2 only** | fixture+created desc |
| Recommendations | `recommendations` | uuid | N:1 fixture; optional prediction; **DE only** | fixture, verdict |
| Match Ratings | `match_ratings` | uuid | N:1 fixture; optional recommendation | fixture+created |
| Bankroll | `bankroll_accounts` | uuid | 1:1 user | user unique |
| Bets | `bets` | uuid | N:1 account; optional fixture + recommendation | account+placed, result |
| Portfolio | `portfolio_snapshots` | uuid | N:1 account; materialized report | account+captured |
| Watchlist | `watchlist_items` | uuid | unique `(user, fixture)` | user+created |
| Opportunities | `opportunities` | uuid | N:1 fixture + recommendation | published, rank_score |
| News | `news_items` | uuid | optional fixture/team; **no collector until a vendor exists** | published |
| Feed | `feed_items` | uuid | optional fixture/opportunity; island key | island+rank |

Plus:

- `external_ids` — `(provider, entity_type, external_id)` unique → `apex_id`
- `collector_watermarks` — `(resource, scope_key)` so jobs do not re-pull inside TTL

### 4.2 Scalability

- **Do not** use API-Football fixture ids as primary keys. Map them in `external_ids`.
- Odds and recommendations are snapshots. Latest quote = `DISTINCT ON (fixture_id, market_id) … ORDER BY captured_at DESC`. Never update a historical quote.
- When fixture volume grows, partition `fixtures` and `odds_quotes` by `kickoff_at` month.
- Collector is the only writer of football tables (service role). RLS: authenticated read; owner-only on bankroll / bets / watchlist / settings.
- Feed and opportunities are **materialized**. Regenerating them on every `/feed` request is what we are leaving.

### 4.3 ID transition

Until Postgres is live, catalogue keys remain `ApexId` strings (`apex:api-football:match:1035089`). Services accept that string. The store maps to UUID at persistence time. UI routes can keep vendor ids in the URL during Match Center migration as long as `FixtureService.getById` resolves both.

---

## 5. Phase 3 — Collector

**Code:** `lib/data-platform/v1/collector.ts`  
**Port:** `FootballCollector.collect(job)`  
**Composition:** `MatchDataProvider` + `MatchDataNormalizer` + `CatalogueStore`

Responsibilities (job `resource`):

| Resource | v1 collector | Notes |
| --- | --- | --- |
| fixtures | **implemented** (mock path tested) | `fetchFixtures` → normalize → `upsertBundle` |
| odds | **implemented** via `fetchMatch` | snapshot quotes on the bundle |
| standings | unsupported until port grows | today only on `ApiFootballDataProvider.http` |
| team_statistics | unsupported | same |
| injuries | unsupported | same |
| lineups | unsupported | same (also optionally on `getMatch` enrich) |
| h2h | unsupported | derived from `fixtures` once history is stored |
| recent_form | unsupported | derived from `fixtures` once history is stored |

Unsupported is intentional. Lifting those HTTP helpers onto `MatchDataProvider` is Collector work. Calling `provider.http` from a page is how Match Center burns quota today.

**Never couple Collector to UI**

- No schedule inside `getMatchCenterData`.
- No “collect on cache miss” from RSC (that recreates today’s thundering herd).
- Run from a worker, cron, or admin script. Watermarks (`collector_watermarks` + `PLATFORM_CACHE_TTL_MS`) decide whether a job is a no-op.

H2H and recent form should eventually be **queries over `fixtures`**, not extra vendor products, once history is permanent.

---

## 6. Phase 4 — Normalizer

Already exists: `MatchDataNormalizer` + per-provider `ProviderMapper`.

v1 rule: **Collector is the only caller of `normalize()` in production.** Pages receive `ApexMatchBundle` from `FixtureService`, never from a mapper.

Still to lift into mappers (today they live in enrich adapters and leak vendor types into Match Center):

- team statistics
- standings rows
- injuries / suspensions
- lineups
- fixture statistics (Match Analysis)

Until those mappers exist, enrichment stays `instanceof ApiFootballDataProvider`. That is the largest remaining vendor leak after the catalogue.

React components already consume Match Center / Analysis view-models. Keep that. Stop feeding them API-Football `response[]` arrays.

---

## 7. Phase 5 — Cache

**Product policy** (`lib/data-platform/v1/cache-policy.ts`) — this is what the Collector/store must honor:

| Resource | TTL |
| --- | --- |
| Fixtures (upcoming lists) | 15 min |
| Odds | 2 min |
| Standings | 6 hours |
| Team stats | 24 hours |
| Injuries | 30 min |
| Lineups | 15 min |
| H2H window | 24 hours (or SQL over history) |
| Recent form | 6 hours (or SQL over history) |
| Historical matches / settled odds / events | **permanent** (`null` TTL) |

**Vendor HTTP cache** (`API_FOOTBALL_CACHE_TTL_MS`) stays until Collector owns ingestion. Do not “fix” product pages by retuning that object — that keeps the wrong architecture.

Duplicate-request prevention:

1. Watermark: skip collect if `now - last_collected_at < TTL` for `(resource, scope_key)`.
2. In-process: one in-flight promise per cache key (singleflight). Today’s TTL cache does not coalesce concurrent misses.
3. Cross-instance: Postgres row or Redis lock on `(resource, scope_key)`.
4. Historical: `status = finished` → never re-fetch fixture body; odds become read-only.

`react.cache` is not a platform cache. After migration it should wrap **service** calls, not vendor calls.

---

## 8. Phase 6 — Internal services

**Code:** `lib/data-platform/v1/services.ts`

| Service | v1 | Reads |
| --- | --- | --- |
| `FixtureService` | catalogue-backed | `getById`, `list` |
| `OddsService` | catalogue-backed | `listForFixture` |
| `StandingsService` | catalogue-backed | `getTable` |
| `RecommendationService` | interface only | must return stored `ApexDecision`, not re-score |
| `OpportunityService` | interface only | published `opportunities` rows |
| `PortfolioService` | interface only | snapshots + bets |
| `BankrollService` | interface only | `bankroll_accounts` + `bets` |

`createCataloguePlatformServices(store)` is the first implementation. It does not import React, API-Football, or Decision Engine.

**Request path (DAL v1):** `lib/repositories/` is the product API. UI pages and product loaders call fixture / team / odds / standings / statistics / match-analysis repositories. Those wrap the current `IDataProvider` (API-Football internally). Catalogue-backed v1 services remain the target once the Collector fills the store.

Name collision: `lib/intelligence/reasoning/recommendations` still has a **stub** `RecommendationService`. Product code must use `lib/data-platform/v1`. Do not revive the intelligence stub as a second recommendation path.

---

## 9. Phase 7 — Decision Engine (single writer)

### 9.1 What “one engine” means

| Output | Canonical writer | Module |
| --- | --- | --- |
| 1X2 probability | Probability Engine | `lib/intelligence/modules/probability` |
| PE confidence (entropy) | Probability Engine | `confidenceFromHybrid` |
| Expected value (pricing identity) | shared formula | should be one function |
| Kelly / quarter-Kelly | Decision Engine sizing | `lib/decision-engine/sizing.ts` |
| APEX score (product rec) | Decision Engine | `apexScoreFromDecision` |
| Recommendation / verdict / stake % | Decision Engine | `evaluateDecision` / `evaluateMatchDecision` |

Probability Engine **must not** emit Bet / Avoid. Decision Engine **must not** recompute Poisson/Elo.

### 9.2 What the repo does today (not unified)

Verified by inspection. **Do not merge these in this milestone** (would change product math).

| Surface | Probability | Rec / EV / Kelly / rating |
| --- | --- | --- |
| Match Center | PE | **DE and** `ratePreview` (Match Rating) |
| Match Analysis | PE | DE + Match Rating + Intelligence Report verdict |
| Opportunities | via Match Center | DE mapped to board |
| Portfolio | n/a | `lib/match-rating/pricing` EV + Kelly on mock bets |
| Copilot | mixed | `lib/copilot/pricing.expectedValue` |
| Intelligence reasoning | stubs | `StubRecommendationService` |

Match Rating is a **second score**. Intelligence Report is a **third verdict**. Portfolio and Copilot copy pricing instead of importing Decision Engine.

**v1 platform rule:** persist DE output on `recommendations`. Every module that needs a recommendation reads `RecommendationService`. Match Rating may still render as a diagnostic card, but it must not be “the” APEX recommendation. New code must not add a fourth evaluator.

---

## 10. Phase 8 — migration roadmap

Do not migrate everything. Do not change scoring. Do not redesign modules.

### Guardrails

- One module per PR.
- Feature flag or loader switch: `APEX_CATALOGUE_READ=1` reads `FixtureService`, else current path.
- Collector jobs stay off the request path.
- Delete `/api/test-football` or route it through the Collector in a dedicated PR (it is a quota leak).

### Step 0 — already done this milestone

- Catalogue store (in-memory)
- Collector fixtures + odds snapshot
- Service interfaces + catalogue fixture/odds/standings
- Cache policy constants
- Schema design file
- This document

### Step 1 — Match Center (priority 1)

1. Run Collector `fixtures` for “today” + league fallback into the catalogue (worker or boot script, not the page).
2. Point `listMatchCenterFixtureBundles` at `FixtureService.list`.
3. Point `getMatch` for the selected id at `FixtureService.getById`.
4. Keep enrichment on API-Football **temporarily** (still the leak).
5. Success: opening `/match-center` does not call `listFixtures` on the vendor.

### Step 2 — Match Analysis (priority 2)

1. Same fixture read path as Match Center (shared loader, not a second provider factory).
2. Stop a second standings HTTP call; read `StandingsService` once Collector persists tables.
3. Success: `/match-analysis/[id]` does not construct `createApiFootballDataProvider`.

### Step 3 — Opportunities (priority 3)

1. Worker: for each upcoming fixture in the catalogue, run **one** `evaluateMatchDecision`, insert `recommendations` + `opportunities`.
2. `OpportunityService.listPublished` returns those rows.
3. Feed and Lab **must** call that service, not `getApexOpportunities()` live.
4. Success: three pages, one scan, scan not on the request path.

### Step 4 — Dashboard (priority 4)

1. Date windows from `FixtureService.list({ date })`.
2. Featured card from the same Match Center service, not a second enrich.
3. Align no-key behavior with Match Center (recorded catalogue vs mock) so the desk does not lie.

### Step 5 — Portfolio (priority 5)

1. Persist bets (even if UI stays as-is).
2. `PortfolioService.getReport` reads bets; keep current metrics code.
3. Switch EV/Kelly imports from `match-rating/pricing` to Decision Engine pricing helpers **without changing formulas** (verify with existing tests).

### Step 6 — Feed (priority 6)

1. Materialize `feed_items` from opportunities + fixtures + bankroll.
2. Island loaders read services only.
3. Honest empty news island remains empty (no fake wire).

### Step 7 — Bankroll (priority 7)

1. Replace `getMockBankroll()` with `BankrollService`.
2. Fixture picker already shares Match Center catalogue — it should share `FixtureService` after Step 1.

### Explicitly later

- Postgres `CatalogueStore`
- Full Collector resources (standings, injuries, lineups, team stats)
- Redis
- Multi-region
- Second vendor (SportMonks) — mapper already exists as a stub; do not prioritize

---

## 11. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Quota death during migration | High | Collector + watermarks; kill `/api/test-football`; do not enrich on list pages |
| Dual `IDataProvider` + catalogue | High | Feature-flag read path; delete vendor calls from loaders module by module |
| Schema.sql vs v1 schema clash | High | Do not apply v1 SQL until unused tables are dropped |
| Re-scoring in workers | High | Persist DE JSON; services return stored rows; engines stay pure functions |
| Match Rating vs DE confusion | Medium | Document + persist both; UI copy already called out in RC1 — do not “fix” math here |
| `instanceof ApiFootballDataProvider` | Medium | Capability port on the provider, then Collector |
| In-memory catalogue in serverless | Medium | One Node process ≠ many Vercel isolates; Postgres is required before production traffic |
| News hallucination | Medium | Table exists; Collector forbidden to invent |
| Bankroll still mock | Medium | Users will treat UI numbers as real; persist before marketing |
| Elo still hashed from team id | Low for v1 | Real ratings table is a later Intelligence milestone |
| Intelligence stub services | Low | Do not implement them as a parallel platform |

---

## 12. Implementation phases (engineering)

| Phase | Outcome | Code volume |
| --- | --- | --- |
| **A — Contracts (this doc)** | Ports, in-memory store, fixture collector, schema design | Small — done |
| **B — Match Center read** | List + detail from catalogue | Small loader change |
| **C — Persist catalogue** | `PostgresCatalogueStore` + apply schema | Medium, ops-heavy |
| **D — Enrichment collector** | Standings/stats/injuries/lineups jobs | Medium |
| **E — Decision materialization** | Worker writes recommendations/opportunities | Medium; **no formula changes** |
| **F — User data** | Bankroll, bets, watchlist, portfolio snapshots | Medium |
| **G — Retire IDataProvider from app** | Vendor only behind Collector | Cleanup |

Phase B is the only phase that should start now.

---

## 13. Readiness score

Scored as a SaaS data plane, not as a demo that can render Arsenal–Chelsea.

| Dimension | Score | Why |
| --- | --- | --- |
| Architecture (contracts) | 72 | Pipeline, services, collector, Apex model exist |
| Persistence | 18 | Schema designed; football tables unused; store is memory |
| Collector completeness | 32 | Fixtures/odds snapshot only; 6 resources still HTTP-on-page |
| Cache | 38 | Policy written; live TTLs still 10m/30m vendor cache |
| Service adoption | 10 | Zero product loaders use v1 services |
| Decision uniqueness | 48 | DE exists and Opportunities use it; Match Rating + Report + Copilot still parallel |
| Operability (10k users) | 22 | Request-time vendor I/O will not scale |
| **Overall** | **38** | Contracts without a data plane |

Compared with RC1 production readiness (48): that score included UI completeness. This score is **data-plane** readiness. The product can demo; it cannot be a platform yet.

---

## 14. Next implementation step

**Do this next, before any large Collector or UI rewrite:**

> Switch Match Center’s **fixture catalogue read** (`listMatchCenterFixtureBundles`) to `FixtureService`, populated by `FootballCollector.collect({ resource: "fixtures" })` running **outside** the page (script or deferred worker). Keep enrichment and Decision Engine as they are. Feature-flag the loader. Add a test that the list path does not instantiate `ApiFootballDataProvider` when the catalogue is pre-filled.

That is the smallest cut that proves the architecture: vendor → collector → normalizer → store → service → module.

Do **not** do next:

- apply `schema-data-platform-v1.sql` without a migration review
- collect standings/injuries/lineups on a timer against the live API
- merge Match Rating into Decision Engine
- rewire Feed, Lab, and Opportunities in the same PR
- build new UI

---

## 15. File index

| Path | Role |
| --- | --- |
| `lib/data-platform/v1/cache-policy.ts` | Product TTLs |
| `lib/data-platform/v1/catalogue-store.ts` | `CatalogueStore` + in-memory impl |
| `lib/data-platform/v1/collector.ts` | `FootballCollector` |
| `lib/data-platform/v1/services.ts` | Internal service ports |
| `lib/repositories/` | DAL v1 — UI/product request path over the current provider |
| `lib/data-platform/v1/v1.test.ts` | Collector → store → FixtureService |
| `supabase/schema-data-platform-v1.sql` | Target schema (not applied) |
| `docs/DATA_PLATFORM.md` | Previous ingest/access notes (superseded for product direction by this file) |
