# Football Intelligence Graph

**Código:** `lib/football-graph/`  
**Estado:** Dominio + repos mock + motor de consultas (sin HTTP/DB reales)

---

## 1. Objetivo

Representar el fútbol como un **grafo de entidades y relaciones** para:

1. Navegar vecindarios de un partido (equipos, eventos, estilos, métricas)
2. Buscar **partidos similares**
3. Descubrir **patrones** recurrentes

Desacoplado del Probability Engine, del Data Platform HTTP y de Supabase.

---

## 2. Entidades (`types/entities.ts`)

| Nodo | Descripción |
| --- | --- |
| `TeamNode` | Equipo |
| `PlayerNode` | Jugador |
| `CoachNode` | Entrenador |
| `RefereeNode` | Árbitro |
| `CompetitionNode` | Competición / temporada |
| `StadiumNode` | Estadio |
| `MatchNode` | Partido |
| `EventNode` | Evento de partido |
| `PlayingStyleNode` | Estilo (ejes: possession, pressing, …) |
| `MetricNode` | Métrica avanzada (xG, PPDA, …) |

---

## 3. Relaciones (`types/relations.ts`)

`plays_in` · `belongs_to` · `coaches` · `hosts` · `referees` · `home_team` · `away_team` · `occurred_in` · `performed_by` · `for_team` · `has_style` · `has_metric` · `similar_to` · `pattern_of`

Cada arista es un `GraphEdge` tipado con `fromId/toId`, `weight` opcional y `properties`.

---

## 4. Arquitectura

```text
SourceAdapter (mock)
        │
        ▼
 InMemoryGraphStore
        │
   ┌────┴────┐
 NodeRepo  EdgeRepo  MatchRepo
        │
        ▼
 FootballGraphQueryEngine
   · findSimilarMatches
   · discoverPatterns
   · getNeighborhood
```

**Extender a datos reales:** implementar los mismos ports (`GraphNodeRepository`, `GraphEdgeRepository`, `MatchGraphRepository`, `FootballGraphSourceAdapter`) sobre Postgres/Neo4j/Data Platform — sin cambiar el motor de consultas.

---

## 5. Motor de consultas

### Similitud de partidos

Dimensiones ponderadas:

- scoreline
- competition
- style
- tempo
- xg_profile
- events

```ts
const graph = createFootballIntelligenceGraph();
const similar = await graph.query.findSimilarMatches({
  matchId: "match-a",
  limit: 3,
});
```

### Patrones (heurísticas mock)

- `late_equalizer` — gol ≥ 80'
- `dominance_without_goals` — xG alto / goles bajos
- `high_press_collapse` — pressing axis ≥ 0.75

```ts
const patterns = await graph.query.discoverPatterns({
  minConfidence: 0.5,
});
```

---

## 6. Wiring

```ts
import { createFootballIntelligenceGraph } from "@/lib/football-graph";

const graph = createFootballIntelligenceGraph();
const neighborhood = await graph.query.getNeighborhood("match-a");
```

---

## 7. TODOs

| ID | Descripción |
| --- | --- |
| `TODO(ml)` | Embeddings / similitud aprendida |
| `TODO(persistence)` | Store Postgres/Neo4j |
| `TODO(source)` | Adapter desde Data Platform / vendors |
| Bridge Vision / Probability | Proyectar nodos a features de modelo |

---

## 8. Relación con otros módulos

| Módulo | Relación |
| --- | --- |
| Data Platform | Futuro source de nodos/edges |
| Probability Engine | Consume features; **no** conoce el grafo |
| APEX Vision | UI live; el grafo es analítica offline/batch |
