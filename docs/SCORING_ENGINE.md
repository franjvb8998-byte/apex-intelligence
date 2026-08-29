# APEX Scoring Engine v2

**Código:** `lib/scoring-engine/`

Modelo oficial de scoring de plataforma. Determinista. Sin LLM. Sin HTTP.

Cada recomendación futura debe llamar `evaluateScoring`. El Decision Engine v1 sigue siendo la fuente de stake / Kelly; este motor no cambia sus pesos.

```ts
import { createScoringEngine, scoringInputFromEngines } from "@/lib/scoring-engine";

const engine = createScoringEngine();
const scored = engine.evaluate(input);
```

---

## Salida

Overall APEX Score 0–100 · cobertura 0–1 · breakdown de 9 pilares · `ScoringExplanation` · tier **Elite / Strong Bet / Value Bet / Watch / Avoid**.

Señal ausente = `n/d`. El blend renormaliza sobre pilares publicados. Recalibrar solo `weights.ts`.

---

## Pesos

| Pilar | Peso |
| --- | --- |
| Probability Score | 14% |
| Expected Value Score | 16% |
| Market Value Score | 12% |
| Team Intelligence Score | 14% |
| Confidence Score | 12% |
| Momentum Score | 8% |
| Tactical Score | 8% |
| Risk Score (safety = 100 − raw risk) | 8% |
| Data Quality Score | 8% |

---

## Consumo

`scoringInputFromEngines({ decision, decisionInput, team })` arma el snapshot desde Decision Engine + Team Intelligence. Probability Engine entra como `modelProbability` / `oneXTwo` ya publicados. No se re-entrenan esos motores aquí.

Cada `scoreX()` es testeable por separado en `lib/scoring-engine/scores/`.
