# APEX Decision Engine v1

**Código:** `lib/decision-engine/` · carta en `/match-analysis/[fixture]`

Motor propietario de recomendación. Determinista. Sin LLM. Sin valores aleatorios.

El UI consume `ApexDecision`. Un modelo ML futuro implementa `DecisionEnginePort.evaluate` con el mismo contrato.

```ts
import { createDeterministicDecisionEngine } from "@/lib/decision-engine";

const engine = createDeterministicDecisionEngine();
const decision = engine.evaluate(input);
```

---

## Salida

APEX Score 0–100 · Confidence 0–100 + High/Medium/Low · Risk 0–100 + Low/Medium/High · EV · Kelly % · Stake 0 / 0.5 / 1 / 2 / 3 / 5 % · Verdict (Elite Pick / Strong Bet / Lean Bet / Pass / Avoid)

Confidence **no** es la probabilidad 1X2. Mide fiabilidad (muestra, cobertura, lesiones, edge, entropía).

---

## APEX Score

Pilares positivos (se renormalizan si faltan):

| Pilar | Peso |
| --- | --- |
| Attack | 15% |
| Defense | 15% |
| Recent Form | 15% |
| xG Quality | 10% |
| Home Advantage | 8% |
| Rest Days | 5% |
| Motivation | 5% |
| Market Edge | 12% |
| Value | 10% |

Ajustes a la baja (solo con señal publicada):

- Injuries − hasta 8 puntos
- Risk Adjustment − hasta 7 puntos

Señal ausente = `n/d`. No se inventa derby, copa, rotación, nuevo entrenador ni distancia de viaje.

---

## Stake

¼ Kelly, recorte al escalón más cercano, techo **5%**. Avoid / Pass / EV ≤ 0 → 0%.
