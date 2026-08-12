# Probability Engine — Elo × Poisson Hybrid (v0.1)

**Código:** `lib/intelligence/modules/probability/`  
**Estado:** Implementado (sin frontend / APIs externas)  
**Model version:** `elo-poisson-hybrid-0.1.0`

---

## 1. Objetivo

Calcular, a partir de ratings Elo de dos equipos:

1. Probabilidades **1X2** (home / draw / away)
2. Probabilidades **Over/Under 2.5**
3. Goles esperados `λ_home`, `λ_away`

El motor es **puro** (sin I/O): recibe Elo y config, devuelve distribuciones.

---

## 2. Arquitectura modular

```text
modules/probability/
├── math/
│   ├── elo.ts          # Expectancy Elo, Elo→λ, Elo→1X2
│   ├── poisson.ts      # PMF Poisson
│   └── normalize.ts    # Softmax, entropía, normalización
├── hybrid/
│   ├── config.ts       # Defaults / merge
│   ├── types.ts        # Contratos ProbabilityEngine, resultados
│   ├── score-matrix.ts # Marginalización del grid de marcadores
│   └── elo-poisson-engine.ts
└── index.ts            # ProbabilityService + exports del hybrid
```

---

## 3. Fórmulas

### 3.1 Elo — expected score (2-way)

\[
E_{\text{home}} = \frac{1}{1 + 10^{(R_{\text{away}} - (R_{\text{home}} + HFA))/F}}
\]

- \(R_{\text{home}}, R_{\text{away}}\): ratings Elo  
- \(HFA\): ventaja de local en puntos Elo (default `65`)  
- \(F\): escala Elo (default `400`)

Código: `eloWinExpectancy`.

### 3.2 Elo → 1X2 (puente)

1. \(p^{2}_{\text{home}} = E_{\text{home}}\), \(p^{2}_{\text{away}} = 1 - E_{\text{home}}\)
2. Masa de empate (máxima cuando los equipos están iguales):

\[
\Delta = R_{\text{home}} + HFA - R_{\text{away}}
\]

\[
P^{\text{raw}}_{\text{draw}} = D_{\text{base}} \cdot e^{-|\Delta| / D_{\text{decay}}}
\]

3. El resto de masa se reparte según el 2-way y se normaliza.

Código: `eloToOneXTwo`.

### 3.3 Elo → goles esperados (λ)

\[
\lambda_{\text{home}} = \mu_{\text{home}} \cdot 10^{(R_{\text{home}} - R_{\text{away}}) / S} \cdot \gamma
\]

\[
\lambda_{\text{away}} = \mu_{\text{away}} \cdot 10^{(R_{\text{away}} - R_{\text{home}}) / S}
\]

- \(\mu_{\text{home}}, \mu_{\text{away}}\): baselines de liga (defaults `1.45` / `1.15`)  
- \(S\): escala Elo→goles (default `400`)  
- \(\gamma\): boost multiplicativo local (default `1.0`)  
- λ se clampea a \([0.05, 6]\) por estabilidad numérica

Código: `eloToExpectedGoals`.

### 3.4 Poisson — marcador

Independencia condicional de goles:

\[
P(H=i, A=j) = e^{-\lambda_h}\frac{\lambda_h^i}{i!} \cdot e^{-\lambda_a}\frac{\lambda_a^j}{j!}
\]

Grid truncado: \(i,j \in \{0,\dots,M\}\) (default \(M=15\)).

Código: `poissonPmf`, `scorelineProbability`, `marginalizePoissonScoreGrid`.

### 3.5 Marginalización 1X2 (Poisson)

\[
P_{\text{home}} = \sum_{i>j} P(i,j),\quad
P_{\text{draw}} = \sum_{i=j} P(i,j),\quad
P_{\text{away}} = \sum_{i<j} P(i,j)
\]

Renormalizado por la masa cubierta del grid.

### 3.6 Over / Under 2.5 (Poisson)

\[
P_{\text{over}} = \sum_{i+j \ge 3} P(i,j),\quad
P_{\text{under}} = \sum_{i+j \le 2} P(i,j)
\]

Mercado **solo** desde el modelo de goles (no se mezcla con Elo 1X2).

### 3.7 Blend híbrido (1X2 final)

\[
P = w\, P^{\text{Poisson}} + (1-w)\, P^{\text{Elo}}
\]

luego normalización. Default \(w = 0.7\`.

Código: `blendOneXTwo`.

---

## 4. Uso

```ts
import { createEloPoissonHybridEngine } from "@/lib/intelligence";

const engine = createEloPoissonHybridEngine();
const result = engine.predict({
  homeElo: 1600,
  awayElo: 1500,
  matchId: "demo-match",
});

result.oneXTwo;       // { home, draw, away }
result.overUnder25;   // { line: 2.5, over, under }
result.expectedGoals; // { home, away, total }
```

---

## 5. Tests

```bash
npm test
```

Casos cubiertos:

- Equipos iguales → ligera ventaja local + empate material  
- Favorito local claro → \(P_{\text{home}}\) dominante  
- Favorito visitante → \(P_{\text{away}}\) dominante  
- Lambdas altas → Over 2.5 más probable  
- Utilidades: normalize, softmax, Poisson PMF, blend

---

## 6. TODOs (interfaces limpias)

| TODO | Dónde | Notas |
| --- | --- | --- |
| `TODO(elo-provider)` | `EloRatingProvider`, `StaticEloRatingProvider` | Ratings persistidos + update K-factor |
| `TODO(dixon-coles)` | `elo-poisson-engine.ts` | Correlación low-score (0-0, 1-0, 0-1) |
| `TODO(calibration)` | config / learning module | Fit \(\mu\), \(w\) por liga |
| `TODO(rating-history)` | `elo.ts` | Elo temporal / weighted |
| Wire a PredictionPipeline | `adapters/ai` | Cuando se active inference real |
| Frontend / APIs externas | — | **Fuera de alcance v0.1** |

---

## 7. Relación con el Intelligence Core

- `ProbabilityService` → utilidades genéricas (`ProbabilityModule`)
- `EloPoissonHybridEngine` → motor de mercados 1X2 / O/U
- El `PredictionPipeline` aún no llama a este motor (stubs de AI intactos)
