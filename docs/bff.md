# BFF — Backend for Frontend

**Código:** `lib/bff/` · rutas `app/api/*`  
**Estado:** Infraestructura (Sprint 3)  
**Nota:** Match Center **no** está cableado a estos endpoints todavía.

---

## 1. Objetivo

Exponer una capa HTTP estable para el frontend futuro, encima de `ProviderFactory` / `IDataProvider`, con:

- JSON normalizado (independiente del vendor)
- códigos HTTP correctos
- logging estructurado
- envelope uniforme de éxito / error

---

## 2. Endpoints

| Método | Ruta | Query | Datos |
| --- | --- | --- | --- |
| `GET` | `/api/fixtures` | `id?`, `date?`, `leagueId?`, `limit?` | Today's Matches / Match Details |
| `GET` | `/api/teams` | `id` | Team |
| `GET` | `/api/team-statistics` | `team`, `league`, `season` | Team Statistics |
| `GET` | `/api/players` | `id`, `season?` | Player |
| `GET` | `/api/leagues` | `id` | League |
| `GET` | `/api/standings` | `league`, `season` | Standings |
| `GET` | `/api/events` | `fixture` | eventos |
| `GET` | `/api/lineups` | `fixture` | alineaciones |

Todos usan `ProviderFactory` (`APEX_DATA_PROVIDER`, default `mock`). Con `api-football` sin key se sirven fixtures grabados.

---

## 3. Envelope

### Éxito (`2xx`)

```json
{
  "ok": true,
  "data": { },
  "meta": {
    "requestId": "uuid",
    "provider": "mock",
    "timestamp": "ISO-8601"
  }
}
```

### Error

```json
{
  "ok": false,
  "error": {
    "code": "bad_request | not_found | unauthorized | provider_error | rate_limited | internal_error",
    "message": "…",
    "details": null
  },
  "meta": { "requestId": "…", "provider": "…", "timestamp": "…" }
}
```

---

## 4. Middleware común (`withApiHandler`)

Archivo: `lib/bff/handler.ts`

- Genera `requestId`
- Ejecuta el handler de negocio
- Serializa éxito / captura errores (`toBffError`)
- Registra logs JSON (`logBffEvent`) en `console`

No usa `middleware.ts` global de Next (evita afectar páginas).

---

## 5. Layout

```text
lib/bff/
  types.ts
  errors.ts
  logging.ts
  map-error.ts
  handler.ts
  normalize.ts
  catalog.ts
  index.ts

app/api/
  fixtures/route.ts
  teams/route.ts
  standings/route.ts
  events/route.ts
  lineups/route.ts
```

---

## 6. Proveedores

| Provider | Comportamiento BFF |
| --- | --- |
| `mock` | DTOs desde `MockDataProvider` / demo fixture |
| `api-football` | `ApiFootballDataProvider.http` + normalización |

---

## 7. Fuera de alcance (este sprint)

- Conectar Match Center / Dashboard
- Probability Engine / Learning Engine
- Auth de sesión en las rutas API
- Mutaciones (`POST`/`PATCH`)

---

## 8. Pruebas

`lib/bff/bff.test.ts` — catálogo mock + envelope `withApiHandler`.
