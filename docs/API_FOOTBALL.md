# Sprint 6 — API-Football Integration (Real Data v1)

**Código:** `lib/data-platform/providers/api-football/`  
**BFF:** `app/api/*` + `lib/bff/`  
**Estado:** Primera fuente de datos reales conectada (con fallback offline)

No modifica Probability Engine, Learning Engine, Intelligence Layer ni Knowledge Graph.

---

## 1. Objetivo

Conectar API-Football (api-sports.io v3) a la arquitectura existente de Data Platform:

- Cliente HTTP reutilizable (auth, retry, rate limit, errores)
- Adaptadores vendor → modelo Apex
- Provider `IDataProvider` + BFF endpoints
- Cache TTL en memoria
- Fixtures grabados si no hay `API_KEY`

---

## 2. Layout

```text
lib/data-platform/providers/api-football/
  client.ts              # HTTP + withApiFootballClientCache
  fixture-client.ts      # Cliente offline (recorded)
  fixtures.ts            # Payloads grabados
  adapters/              # Team / Player / League / TeamStatistics → Apex
  mapper.ts              # Fixture → ApexMatchBundle
  api-football-provider.ts
  config.ts / errors.ts / retry.ts / rate-limiter.ts
```

---

## 3. Endpoints (cliente + BFF)

| Capacidad | Cliente | BFF |
| --- | --- | --- |
| Today's Matches | `getFixturesByDate(date)` | `GET /api/fixtures?date=` |
| Match Details | `getFixture(id)` | `GET /api/fixtures?id=` |
| Team | `getTeam(id)` | `GET /api/teams?id=` |
| Team Statistics | `getTeamStatistics(team, league, season)` | `GET /api/team-statistics?team=&league=&season=` |
| Player | `getPlayer(id, season?)` | `GET /api/players?id=&season=` |
| League | `getLeague(id)` | `GET /api/leagues?id=` |
| Standings | `getStandings(league, season)` | `GET /api/standings?league=&season=` |

Extras (ya existentes): `/api/events`, `/api/lineups`.

---

## 4. Variables de entorno

```bash
# Provider selection (default mock — no rompe la app)
APEX_DATA_PROVIDER=mock

# API key (cualquiera de estas)
API_FOOTBALL_KEY=
# alias:
APISPORTS_KEY=
API_KEY=

API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_DEFAULT_FIXTURE_ID=1035089

# Opcionales
API_FOOTBALL_RETRY_MAX_ATTEMPTS=3
API_FOOTBALL_RETRY_BASE_DELAY_MS=250
API_FOOTBALL_RATE_LIMIT_MAX=10
API_FOOTBALL_RATE_LIMIT_WINDOW_MS=10000
API_FOOTBALL_TIMEOUT_MS=12000
```

Sin key + `APEX_DATA_PROVIDER=api-football` → **recorded fixtures** (Arsenal–Chelsea sample).  
Default de producto sigue siendo **`mock`**.

Nunca exponer la key como `NEXT_PUBLIC_*`.

---

## 5. Fallback y cache

| Pieza | Comportamiento |
| --- | --- |
| Sin API key | `createFixtureApiFootballClient()` + `dataMode: "recorded"` |
| `fallback: "error"` | Lanza `missing_api_key` (tests / strict) |
| Cache | `withApiFootballClientCache` (TTL 60s por defecto) |
| Retry | `withRetry` en llamadas live |
| Errores | `ApiFootballError` tipado |

---

## 6. Adaptadores

`adapters/` convierte DTOs de API-Football a:

- `ApexTeam`, `ApexPlayer`, `ApexLeague`
- `ApexTeamStatistics` (forma Apex-facing)
- Bundle de partido vía `mapper.ts` (sin cambios de contrato)

---

## 7. Activar datos reales

1. Copiar `.env.example` → `.env.local`
2. Poner `API_FOOTBALL_KEY=…`
3. `APEX_DATA_PROVIDER=api-football`
4. Reiniciar `next dev`

---

## 8. Pruebas

- `lib/data-platform/providers/api-football/sprint6.test.ts`
- `http-integration.test.ts`, `provider-factory.test.ts`, `bff.test.ts`
