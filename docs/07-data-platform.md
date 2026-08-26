# 07 — Data platform

## Table of contents

1. [Overview](#overview)
2. [Canonical model](#canonical-model)
3. [Providers](#providers)
4. [Ingestion flow](#ingestion-flow)
5. [Normalization](#normalization)
6. [Quality and trust](#quality-and-trust)
7. [Caching and errors](#caching-and-errors)
8. [Environment and secrets](#environment-and-secrets)
9. [Open questions](#open-questions)

---

## Overview

La Data Platform desacopla vendors externos del resto de APEX.

- Acceso estable: `IDataProvider` + `ProviderFactory`
- Default de aplicación: **`MockDataProvider`** (`APEX_DATA_PROVIDER=mock`)
- HTTP real (Sprint 2): **`ApiFootballDataProvider`** bajo `providers/api-football/`

Probability Engine, Learning Engine y UI **no** importan SDKs de vendors.

---

## Canonical model

Consumidores reciben `ApexMatchBundle` (match, teams, league, events, players, odds, provenance, trustScore).

IDs: `apex:{provider}:{entity}:{externalId}`.

---

## Providers

### Selección

| `APEX_DATA_PROVIDER` | Implementación |
| --- | --- |
| `mock` (default) | `MockDataProvider` |
| `api-football` | `ApiFootballDataProvider` (HTTP) |

Cambio de proveedor: solo variable de entorno — sin tocar código de producto.

### API-Football (HTTP v1)

Ubicación:

```text
lib/data-platform/providers/api-football/
  client.ts
  config.ts
  errors.ts
  mapper.ts
  rate-limiter.ts
  retry.ts
  api-football-provider.ts
  match-data-adapter.ts   # legacy MatchDataProvider (recorded/ingest)
  index.ts
```

#### Cliente HTTP — endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| `getFixturesByDate(date)` | `GET /fixtures?date=` | Today's Matches |
| `getFixture(id)` | `GET /fixtures?id=` | Match Details |
| `getTeam(id)` | `GET /teams?id=` | Team |
| `getTeamStatistics(team, league, season)` | `GET /teams/statistics` | Team Statistics |
| `getPlayer(id, season?)` | `GET /players` | Player |
| `getLeague(id)` | `GET /leagues?id=` | League |
| `getStandings(league, season)` | `GET /standings` | Standings |
| `getLineups(fixture)` | `GET /fixtures/lineups` | (extra) |
| `getEvents(fixture)` | `GET /fixtures/events` | (extra) |

Sin `API_FOOTBALL_KEY` / `API_KEY`: el provider usa **recorded fixtures** (`fixture-client.ts`) y no rompe la app.

Doc Sprint 6: [`docs/API_FOOTBALL.md`](./API_FOOTBALL.md)

#### Capacidades del cliente

- Auth: header `x-apisports-key` (`API_FOOTBALL_KEY`)
- Retry con backoff (`withRetry`)
- Rate limiter sliding-window (`createRateLimiter`)
- Errores tipados (`ApiFootballError`)

`ApiFootballDataProvider.getMatch` usa fixture (+ events/lineups opcionales) y el mapper → `ApexMatchBundle`.

---

## Ingestion flow

```text
APEX_DATA_PROVIDER
        │
        ▼
 ProviderFactory.create()
        │
   ┌────┴────┐
   ▼         ▼
 MockDataProvider    ApiFootballDataProvider
   │                      │
   └──────────┬───────────┘
              ▼
        ApexMatchBundle
```

Legacy (opcional): `createApiFootballProvider()` (`MatchDataProvider`) sigue disponible para ingest/recorded sin cambiar el default de la app.

---

## Normalization

`mapApiFootballEnvelopeToApexBundle` traduce DTOs de API-Football al modelo Apex.

El normalizer legacy (`ProviderRawEnvelope` → mapper registry) permanece para adapters `MatchDataProvider`.

---

## Quality and trust

`DataQualityModule.score(bundle)` adjunta `trustScore` en los providers v2 tras mapear.

---

## Caching and errors

| Pieza | Rol |
| --- | --- |
| Retry | Reintenta timeout / network / 5xx / 429 |
| Rate limiter | Limita ráfagas hacia api-sports.io |
| TTL cache | `withApiFootballClientCache` en el provider v2 |
| `ApiFootballError` | Códigos: missing_api_key, empty_response, vendor_error, … |
| Fixtures fallback | Sin key → Arsenal–Chelsea recorded sample |
| Legacy TTL cache | En `match-data-adapter` (recorded/ingest) |

---

## Environment and secrets

```bash
APEX_DATA_PROVIDER=mock
API_FOOTBALL_KEY=
# aliases: APISPORTS_KEY, API_KEY
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

Plantilla: [`.env.example`](../.env.example).

Opcionales: `API_FOOTBALL_RETRY_*`, `API_FOOTBALL_RATE_LIMIT_*`, `API_FOOTBALL_TIMEOUT_MS`, `API_FOOTBALL_DEFAULT_FIXTURE_ID`.

Nunca exponer la key como `NEXT_PUBLIC_*`.

---

## Open questions

- ¿Persistir rate-limit / cache fuera de proceso (Redis)?
- ¿Cuándo retirar el `match-data-adapter` legacy a favor solo de `IDataProvider`?
- ¿Calibrar límites free-tier de api-sports por plan?
