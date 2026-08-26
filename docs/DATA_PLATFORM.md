# Data Platform — APEX Intelligence

**Código:** `lib/data-platform/`  
**Estado:** Infraestructura + **API-Football v1 (HTTP real)**  
**Principio:** desacoplar proveedores externos del Intelligence Core

---

## 1. Objetivo

Ingestar datos de fútbol desde múltiples vendors y exponer un **modelo interno único** (`Apex*`) con:

- normalización por proveedor
- **Data Trust Score** por partido
- **EventStore** cronológico de eventos
- cliente HTTP + caché TTL (API-Football)

Agregar un proveedor nuevo **no** requiere cambiar el Probability Engine ni el Learning Engine.

---

## 2. Layout

```text
lib/data-platform/
├── types/              # Modelo canónico APEX
├── contracts/          # Ports (MatchDataProvider, Normalizer, …)
├── http/               # Cliente fetch + errores
├── cache/              # TTL cache in-memory
├── providers/
│   ├── api-football/   # Adapter HTTP + mapper + recorded fixture
│   ├── sportmonks/
│   ├── football-data/
│   ├── mock/
│   └── _shared/
├── normalization/
├── quality/
├── event-store/
├── platform.ts
└── index.ts
```

---

## 3. Modelo interno APEX

| Tipo | Contenido |
| --- | --- |
| `ApexMatch` | Kickoff, status, score, venue, refs externas |
| `ApexTeam` / `ApexLeague` / `ApexPlayer` | Identidad + `externalRefs` |
| `ApexMatchEvent` | Timeline ordenada |
| `ApexOddsQuote` | 1X2, O/U, etc. |
| `ApexMatchBundle` | Snapshot + `provenance` + `trustScore?` |

IDs: `apex:{provider}:{entity}:{externalId}`.

---

## 4. Contrato `MatchDataProvider`

```ts
interface MatchDataProvider {
  readonly id: DataProviderId;
  fetchMatch({ externalMatchId }): Promise<ProviderRawEnvelope>;
  fetchFixtures?(query): Promise<ProviderRawEnvelope[]>;
  capabilities(): ProviderCapabilities;
}
```

**Regla:** el provider solo devuelve `ProviderRawEnvelope`.  
**Nunca** construye tipos `Apex*` (mapper/normalizer).

### Adaptadores

| Adapter | `id` | Notas |
| --- | --- | --- |
| `ApiFootballProvider` | `api-football` | **HTTP real** + fallback recorded |
| `SportMonksProvider` | `sportmonks` | Mock `{ data }` |
| `FootballDataProvider` | `football-data` | Mock sin odds |
| `MockProvider` | `mock` | Fixture canónico in-memory |

---

## 5. API-Football (v1)

### Variables de entorno

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `API_FOOTBALL_KEY` | Para live | API key (api-sports.io). Alias: `APISPORTS_KEY` |
| `API_FOOTBALL_BASE_URL` | No | Default `https://v3.football.api-sports.io` |
| `API_FOOTBALL_DEFAULT_FIXTURE_ID` | No | Fixture para Match Center |

Plantilla: [`.env.example`](../.env.example).

### Modos

1. **Live** — si hay API key: `GET /fixtures?id=` (+ eventos opcionales).
2. **Recorded** — sin key: payload real-shaped Arsenal–Chelsea (`RECORDED_API_FOOTBALL_FIXTURE_ID`).

```ts
import {
  createDataPlatform,
  createApiFootballProvider,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform";

const platform = createDataPlatform({
  providers: [createApiFootballProvider()],
});

const { bundle } = await platform.ingestMatch({
  providerId: "api-football",
  externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
});
```

### Piezas

| Módulo | Rol |
| --- | --- |
| `http/createHttpClient` | Fetch + timeouts + `DataPlatformHttpError` |
| `cache/createTtlCache` | Caché TTL in-process |
| `providers/api-football/client` | Endpoints fixtures / events / odds |
| `providers/api-football/mapper` | DTO vendor → `ApexMatchBundle` |
| `providers/api-football` | `MatchDataProvider` |

### Errores

`DataPlatformHttpError` con `code`: `network` | `timeout` | `unauthorized` | `not_found` | `rate_limited` | `invalid_json` | `http_status` | `provider`.

---

## 6. Normalización

```text
ProviderRawEnvelope
        │
        ▼
 ProviderMapper (por DataProviderId)
        │
        ▼
 ApexMatchBundle
```

El mapper de `api-football` detecta DTOs reales (`fixture` / `teams` / `goals`) y, si no, acepta el nesting legacy de demo.

---

## 7. Data Quality — Data Trust Score

Sin cambios de contrato. `DefaultDataQualityModule.score(bundle)`.

---

## 8. EventStore

`InMemoryEventStore` — sin cambios de port.

---

## 9. Flujo

```text
API_FOOTBALL_KEY? ──yes──▶ HttpClient ──▶ ApiFootballProvider.fetchMatch
         │                                         │
         no                                        ▼
         └──▶ recorded fixture ────────▶ ProviderRawEnvelope
                                                  │
                                                  ▼
                                         Normalizer + Trust + EventStore
                                                  │
                                                  ▼
                                         ApexMatchBundle → Match Center
```

### Match Center

`getMatchCenterData()` / `loadMatchCenterFromApiFootball()` en `lib/match-center` consumen el bundle (PE solo para probs 1X2; Learning Engine intacto).

---

## 10. Extensibilidad — nuevo proveedor

1. Literal en `DataProviderId` (opcional).
2. `providers/my-vendor/` → `MatchDataProvider`.
3. `ProviderMapper` → `ApexMatchBundle`.
4. Registrar en `createDefaultProviderMappers()` + `createDataPlatform`.

**No modificar** `lib/intelligence/**` ni `lib/learning-engine/**`.

---

## 11. TODOs

| ID | Descripción |
| --- | --- |
| `TODO(persistence)` | `SupabaseEventStore` + catálogo |
| `TODO(calibration)` | Pesos del Trust Score |
| `TODO(identity-resolve)` | Merge cross-provider → UUID |
| `TODO(elo-provider)` | Ratings reales para Match Center |
| Odds live | Cablear `getFixtureOdds` en el ingest |

---

## 12. Relación con otros docs

| Doc | Rol |
| --- | --- |
| `AI_ENGINE.md` | Consume datos ya normalizados |
| `PROBABILITY_ENGINE.md` | No conoce providers |
| `DATABASE_DESIGN.md` | Persistencia futura |
| `API_STRATEGY.md` | Boundary HTTP de producto |
