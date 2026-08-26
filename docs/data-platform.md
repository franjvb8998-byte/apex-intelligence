# Data Platform — APEX Intelligence

**Código:** `lib/data-platform/`  
**Versión de acceso:** v2 (`IDataProvider` + `ProviderFactory`)  
**Principio:** cambiar de proveedor sin afectar Probability Engine, Learning Engine ni UI.

---

## 1. Objetivo

Exponer un contrato estable de acceso a datos de partidos para que APEX pueda:

- desarrollar con **MockDataProvider** por defecto
- usar **API-Football** (HTTP real + fixtures offline) sin reescribir consumidores
- seleccionar el proveedor por **variables de entorno**

---

## 2. Arquitectura v2

```text
App / Match Center / BFF
        │
        ▼
 ProviderFactory  ◀── APEX_DATA_PROVIDER (mock | api-football)
        │
        ▼
   IDataProvider
        │
   ┌────┴────┐
   ▼         ▼
 MockDataProvider    ApiFootballDataProvider
   │                      │
   │                 live HTTP ──o── recorded fixtures
   └──────────┬───────────┘
              ▼
        ApexMatchBundle
```

| Pieza | Archivo | Rol |
| --- | --- | --- |
| Tipos v2 | `types.ts` | `DataProviderKind`, queries, config |
| Puerto | `provider.ts` | `IDataProvider` |
| Mock | `mock-provider.ts` | Demo fixture |
| API-Football | `providers/api-football/` | HTTP + adapters + fixtures |
| Factory | `provider-factory.ts` | Selección por env / options |

Doc detallada: [`docs/API_FOOTBALL.md`](./API_FOOTBALL.md) · [`docs/07-data-platform.md`](./07-data-platform.md)

---

## 3. Contrato `IDataProvider`

```ts
interface IDataProvider {
  readonly id: "mock" | "api-football";
  readonly displayName: string;
  getMatch({ matchId }): Promise<ApexMatchBundle>;
  listFixtures?(query?): Promise<ApexMatchBundle[]>;
}
```

`ApiFootballDataProvider.http` expone Team / Player / League / Standings / Team Statistics.

---

## 4. Configuración (env)

Ver [`.env.example`](../.env.example).

| Variable | Default | Valores |
| --- | --- | --- |
| `APEX_DATA_PROVIDER` | `mock` | `mock` \| `api-football` |
| `API_FOOTBALL_KEY` / `API_KEY` | — | key live; sin key → fixtures |

---

## 5. Boundaries

- Probability Engine / Learning Engine / Intelligence Layer / Knowledge Graph **no** se modifican aquí.
- El Intelligence Core solo consume `Apex*`, nunca JSON de vendors.
