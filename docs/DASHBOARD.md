# Dashboard — Real Data (Sprint 7)

**Ruta:** `/dashboard`  
**Código:** `lib/dashboard/` · `components/dashboard/`  
**Fuente:** Data Platform (`IDataProvider`) únicamente

No modifica Probability Engine, Learning Engine ni Intelligence Layer.

---

## 1. Objetivo

Conectar el Dashboard autenticado a la Data Platform con la misma UI para mock y datos reales.

Secciones:

- Partidos del día
- Próximos partidos
- Ligas
- Equipos destacados
- Estado del sistema
- Partido destacado (Match Center™ existente)

---

## 2. Selección de provider

```text
API_FOOTBALL_KEY | APISPORTS_KEY | API_KEY
        │
   ¿presente?
    │         │
   sí        no
    │         │
    ▼         ▼
 api-football   mock
```

Implementación: `resolveDashboardProvider()` en `lib/dashboard/resolve-provider.ts`.

- Con key → `ApiFootballDataProvider` (live)
- Sin key → `MockDataProvider` (automático)
- Tests pueden inyectar `provider`

---

## 3. Layout de código

```text
lib/dashboard/
  types.ts
  resolve-provider.ts
  map.ts
  load.ts
  index.ts
  dashboard.test.ts

components/dashboard/
  dashboard-overview.tsx
  system-status.tsx
  match-list.tsx
  leagues-teams.tsx
  index.ts
```

---

## 4. Comportamiento

| Escenario | Resultado |
| --- | --- |
| Sin API key | Mock · mensaje de estado claro |
| Con API key | Live fixtures / teams / leagues desde API-Football |
| Día vacío (live) | Secciones vacías + seed para partido destacado / ligas / equipos |
| Match Center | Mismo provider que el Dashboard |

La UI no cambia de estructura entre mock y real — solo el contenido.

---

## 5. Boundaries

- No toca PE / LE / Intelligence Layer
- No nuevas dependencias
- Match Center UI se conserva bajo “Partido destacado”
