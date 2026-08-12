# Data Platform — APEX Intelligence

**Código:** `lib/data-platform/`  
**Estado:** Infraestructura (mocks + interfaces; **sin HTTP real**)  
**Principio:** desacoplar proveedores externos del Intelligence Core

---

## 1. Objetivo

Ingestar datos de fútbol desde múltiples vendors y exponer un **modelo interno único** (`Apex*`) con:

- normalización por proveedor
- **Data Trust Score** por partido
- **EventStore** cronológico de eventos

Agregar un proveedor nuevo **no** requiere cambiar el Probability Engine ni el resto del Intelligence Core.

---

## 2. Layout

```text
lib/data-platform/
├── types/              # Modelo canónico APEX
├── contracts/          # Ports (MatchDataProvider, Normalizer, …)
├── providers/
│   ├── api-football/   # Adapter (mock payload)
│   ├── sportmonks/
│   ├── football-data/
│   ├── mock/           # MockProvider
│   └── _shared/        # Fixtures de demo
├── normalization/      # Envelope → ApexMatchBundle
├── quality/            # Data Trust Score
├── event-store/        # Timeline append-only (in-memory)
├── platform.ts         # Composition root (ingestMatch)
└── index.ts
```

---

## 3. Modelo interno APEX

| Tipo | Contenido |
| --- | --- |
| `ApexMatch` | Kickoff, status, score, venue, refs externas |
| `ApexTeam` / `ApexLeague` / `ApexPlayer` | Identidad + `externalRefs` |
| `ApexMatchEvent` | Timeline ordenada (`sequence`, `occurredAt`, `minute`) |
| `ApexOddsQuote` | 1X2, O/U, etc. |
| `ApexMatchBundle` | Snapshot completo + `provenance` + `trustScore?` |

Los IDs canónicos son strings `apex:{provider}:{entity}:{externalId}` hasta persistir UUIDs en Supabase.

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

**Regla:** el provider solo devuelve `ProviderRawEnvelope` (payload opaco del vendor).  
**Nunca** construye tipos `Apex*` (eso es trabajo del mapper/normalizer).

### Adaptadores incluidos

| Adapter | `id` | Notas |
| --- | --- | --- |
| `ApiFootballProvider` | `api-football` | Mock anidado tipo `response[]` |
| `SportMonksProvider` | `sportmonks` | Mock `{ data }` |
| `FootballDataProvider` | `football-data` | Mock más pobre (sin odds) → trust más bajo |
| `MockProvider` | `mock` | Fixture canónico in-memory |

Todos marcan `capabilities().mockOnly = true`.  
`TODO(http):` clientes REST reales por adapter.

---

## 5. Normalización

```text
ProviderRawEnvelope
        │
        ▼
 ProviderMapper (por DataProviderId)
        │
        ▼
 ApexMatchBundle
```

- `DefaultMatchDataNormalizer` registra un `ProviderMapper` por vendor.
- Extender: implementar mapper + `normalizer.register(mapper)`.

---

## 6. Data Quality — Data Trust Score

`DefaultDataQualityModule.score(bundle)` → `DataTrustScore` ∈ `[0, 1]`

Dimensiones ponderadas:

| Dimensión | Peso | Señales |
| --- | --- | --- |
| identity | 0.20 | teams, league, external refs |
| schedule | 0.15 | kickoff válido, status |
| score | 0.10 | coherencia status/marcador |
| lineups | 0.15 | nº de jugadores |
| events | 0.15 | timeline vs status |
| odds | 0.15 | presencia 1X2 / O/U |
| freshness | 0.10 | antigüedad de `ingestedAt` |

Bandas: `high` ≥ 0.75, `medium` ≥ 0.45, else `low`.

---

## 7. EventStore

Port `EventStore`:

- `append` — append-only
- `list` — orden cronológico (`sequence`, luego `occurredAt`)
- `replaceTimeline` — re-ingest / corrección

Implementación actual: `InMemoryEventStore`.  
`TODO(persistence): SupabaseEventStore` sin cambiar el port.

---

## 8. Flujo completo de datos

```text
┌─────────────────────────────────────────────────────────────┐
│ Ingestion job / script / future API                         │
│ createDataPlatform({ providers: [apiFootball, mock, …] })   │
└──────────────────────────────┬──────────────────────────────┘
                               │ ingestMatch({ providerId, externalMatchId })
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ MatchDataProvider.fetchMatch                                │
│ → ProviderRawEnvelope (vendor JSON / mock)                  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ MatchDataNormalizer.normalize                               │
│ → ApexMatchBundle (modelo interno)                          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ DataQualityModule.score                                     │
│ → bundle.trustScore                                         │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ EventStore.append(events)                                   │
│ → timeline por matchId                                      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Consumers                                                   │
│ • Intelligence Core (MatchContext / features) — futuro      │
│ • Persistencia Supabase — futuro                            │
│ • UI — fuera de alcance de esta infra                       │
└─────────────────────────────────────────────────────────────┘
```

### Ejemplo de wiring (mock)

```ts
import {
  createDataPlatform,
  createMockProvider,
  createApiFootballProvider,
  DEMO_MATCH_EXTERNAL_ID,
} from "@/lib/data-platform";

const platform = createDataPlatform({
  providers: [createMockProvider(), createApiFootballProvider()],
});

const { bundle } = await platform.ingestMatch({
  providerId: "mock",
  externalMatchId: DEMO_MATCH_EXTERNAL_ID,
});

bundle.match;
bundle.trustScore?.value;
```

---

## 9. Extensibilidad — nuevo proveedor

1. Añadir literal a `DataProviderId` (si quieres tipado cerrado).
2. Crear `providers/my-vendor/` implementando `MatchDataProvider` (mock primero).
3. Crear `ProviderMapper` que traduzca el envelope → `ApexMatchBundle`.
4. `normalizer.register(mapper)` o incluirlo en `createDefaultProviderMappers()`.
5. Registrar el provider en `createDataPlatform({ providers })`.

**No modificar** `lib/intelligence/**` para soportar el vendor.

---

## 10. Separación respecto al Intelligence Core

| Capa | Conoce vendors? | Consume |
| --- | --- | --- |
| Data Platform | Sí (adapters) | Raw envelopes |
| Normalizer | Sí (mappers) | → Apex model |
| Intelligence Core | **No** | `ApexMatchBundle` / proyección a `MatchContext` |
| Frontend / Auth | No en este diseño | — |

Bridge futuro sugerido (no implementado):  
`toMatchContext(bundle: ApexMatchBundle): MatchContext` en un adapter fino, sin filtrar JSON de API-Football/SportMonks al motor Elo-Poisson.

---

## 11. TODOs

| ID | Descripción |
| --- | --- |
| `TODO(http)` | Clientes HTTP reales por adapter |
| `TODO(persistence)` | `SupabaseEventStore` + tablas de catálogo |
| `TODO(calibration)` | Pesos del Data Trust Score |
| `TODO(identity-resolve)` | Merge de `externalRefs` → UUID estable cross-provider |
| Bridge a Intelligence Core | Proyección `ApexMatchBundle` → features / Elo inputs |

---

## 12. Relación con otros docs

| Doc | Rol |
| --- | --- |
| `AI_ENGINE.md` | Consume datos ya normalizados |
| `PROBABILITY_ENGINE.md` | No conoce providers |
| `DATABASE_DESIGN.md` | Persistencia futura del modelo Apex |
| `API_STRATEGY.md` | Exponer ingest/read cuando exista HTTP boundary |
