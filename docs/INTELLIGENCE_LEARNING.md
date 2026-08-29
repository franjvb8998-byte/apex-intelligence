# APEX Intelligence Learning System

**Código:** `lib/intelligence-learning/`  
**Estado:** Infraestructura (sin UI, sin rutas, sin entrenamiento)

Sistema de aprendizaje sobre **recomendaciones publicadas** de Scoring Engine v2. Complementa el [Learning Engine](./LEARNING_ENGINE.md) de predicción 1X2 (Brier / accuracy). Este paquete mide **si APEX debió apostar**, no solo si acertó el marcador.

No modifica Probability Engine, Decision Engine weights, Scoring Engine weights, HTTP, ni APIs públicas.

---

## 1. Objetivo

Persistir cada recomendación que genera la plataforma, liquidarla cuando el mercado cierra, y calcular rendimiento, calibración y métricas reutilizables.

Un modelo futuro puede consumir `LearningFeatureRow`. **No se entrena nada aquí.**

---

## 2. Arquitectura

```text
Scanner / Match Analysis / Smart Combo
            │  capture* (sync, never throws)
            ▼
   Recommendation Registry  →  RecommendationRecord (pending)
            │  settle({ marketOutcome, score })
            ▼
   Result Registry          →  ResultRecord
            │
            ├─ Performance Engine   → ROI / win rate / Kelly efficiency
            ├─ Calibration Engine   → confidence vs hit rate + ECE
            ├─ Learning Metrics     → best/worst markets & leagues
            └─ Dataset export       → LearningFeatureRow[]  (labels null until settled)
```

Puertos intercambiables:

| Port | Hoy | Futuro |
| --- | --- | --- |
| `IntelligenceLearningStore` | In-memory | Supabase / warehouse |
| Writers | `mapOpportunityFromDecision`, `scoreMatchSelection`, `analyzeCombo` | mismos, sin cambiar el contrato de esos módulos |

```ts
import { createIntelligenceLearningSystem } from "@/lib/intelligence-learning";

const learning = createIntelligenceLearningSystem();
const rec = learning.register(draft);
learning.settle({
  recommendationId: rec.id,
  settlementDate: "2026-08-29T21:00:00.000Z",
  homeScore: 2,
  awayScore: 1,
  marketOutcome: "home",
});
const performance = learning.performance();
const calibration = learning.calibration();
const metrics = learning.metrics();
const rows = learning.dataset();
```

El singleton `getIntelligenceLearningSystem()` es el sink de captura en proceso. En tests: `resetIntelligenceLearningSystem()`.

---

## 3. Recommendation Registry

Cada fila tiene un **Recommendation ID** estable (`rec:{source}:{fixtureId}:{market}:{selection}`).

Re-publicar el mismo pending key **actualiza** el snapshot (último Scoring Engine gana). Un registro ya **settled** no se muta; una re-publicación crea un id nuevo.

Campos: timestamp, fixtureId, competition, teams, market, odds, recommendation (tier), APEX Score, confidence, risk, EV, Kelly stake, Team Intelligence, momentum, tactical, market score, data quality, `reasoning`, `engineVersion`.

`reasoning` copia explicación Scoring Engine + reasons Decision Engine. Señales ausentes = `null` (`n/d`). No se inventan cuotas.

---

## 4. Result Registry

Liquidación posterior:

| Campo | Significado |
| --- | --- |
| final score | `homeScore` / `awayScore` |
| market outcome | lado 1X2 ganador, o `hit` / `miss` en combo |
| win / loss | la selección publicada acierta el mercado |
| payout / ROI | unidad de stake 1; ROI = payout − 1 |
| EV realized | retorno por unidad (igual a ROI paper) |
| recommendation correct? | Elite/Strong/Value → hit; Watch/Avoid → miss (pasar fue correcto) |
| settlement date | ISO |

Stake sized (`stakePct`) se guarda aparte para ROI de bankroll.

---

## 5. Performance Engine

Sobre casos settled:

- ROI global
- ROI por tier, mercado, liga
- ROI por bucket de confianza y de APEX Score
- Win rate, average odds, average EV, average stake
- **Kelly efficiency** = Σ profit Kelly / Σ fracción Kelly

---

## 6. Calibration Engine

Compara `confidence / 100` con la hit rate observada en bins de 10 puntos.

Ejemplo: confianza media 90% en el bin, hit rate 80% → **calibration error 10%**. ECE = error absoluto ponderado por muestra.

---

## 7. Learning Metrics

Rankings (top 5):

- Mercados / ligas más y menos rentables
- Mercados de mayor confianza, mayor varianza de ROI, mayor EV medio

---

## 8. Dataset para ML (future-ready)

`exportLearningDataset()` emite filas planas. Labels (`labelHit`, `labelRoi`, `labelCorrect`) son `null` hasta liquidar. No hay fit, no hay pesos nuevos, no hay HTTP.

---

## 9. Relación con otros motores

| Módulo | Rol |
| --- | --- |
| Scoring Engine v2 | Score + tier persistidos |
| Decision Engine v1 | Confidence, risk, EV, Kelly, stake (sin cambiar pesos) |
| Team Intelligence | Pilares TI / momentum / táctico vía Scoring |
| `lib/learning-engine` | Aprendizaje PE (Brier / 1X2). Lab sigue usando ese paquete |
| Este sistema | Aprendizaje de **recomendaciones de apuesta** |
