# Learning Engine

**Código:** `lib/learning-engine/`  
**Estado:** Arquitectura + evaluación heurística mock (sin APIs)

---

## 1. Objetivo

Permitir que APEX **aprenda automáticamente después de cada partido**:

1. Registrar predicción vs resultado
2. Evaluar precisión, calibración, sesgos y patrones
3. Generar recomendaciones de mejora
4. Acumular descubrimientos reutilizables (**Knowledge Accumulator**)

No modifica el Probability Engine. No toca UI, Supabase ni auth.

---

## 2. Qué se registra (`LearningCase`)

| Campo | Contenido |
| --- | --- |
| Predicción | outcome, probs, confianza, `modelVersion` |
| Resultado real | score, outcome, market results |
| Error | outcome error, Brier, residual |
| Variables | `FeatureVariable[]` usadas en la decisión |
| Mercados acertados / fallados | 1X2, O/U 2.5, BTTS |
| Factores explicativos | `ExplanatoryFactor[]` |

---

## 3. Evaluación

`DefaultLearningEvaluator` produce un `EvaluationReport` con:

- **Precisión** 1X2 y por mercado
- **Calibración** (ECE + bins)
- **Sesgos** detectados (heurísticos)
- **Patrones repetitivos**
- **Recomendaciones** (`calibration` / `features` / `markets` / `process` / `data`)

---

## 4. Knowledge Accumulator

Convierte sesgos, patrones, calibración y recomendaciones en `KnowledgeDiscovery` persistibles (store in-memory hoy).

Retrievables por `kind`, `tag`, `minConfidence`.

---

## 5. Flujo

```text
PredictionRecord + ActualMatchResult
            │
            ▼
   LearningCaseRegistrar  →  LearningCase
            │
            ▼
   LearningEvaluator      →  EvaluationReport
            │
            ▼
   KnowledgeAccumulator   →  KnowledgeDiscovery[]
```

```ts
import { createLearningEngineWithMocks } from "@/lib/learning-engine";

const { engine } = await createLearningEngineWithMocks();
const knowledge = await engine.listKnowledge();
```

O caso a caso:

```ts
const { engine } = createLearningEngine();
await engine.recordAndLearn({ prediction, actual });
```

---

## 6. Extensibilidad

| Port | Implementación actual | Futuro |
| --- | --- | --- |
| `LearningCaseRepository` | In-memory | Supabase / warehouse |
| `EvaluationReportRepository` | In-memory | Supabase |
| `KnowledgeStore` | In-memory | Vector/SQL store |
| Fixtures | `createMockLearningFixtures` | PredictionPipeline + resultados reales |

Bridge futuro (sin acoplar ahora): adaptar `SystemPrediction` → `PredictionRecord`.

---

## 7. Relación con Intelligence Core

| Módulo | Rol |
| --- | --- |
| `lib/intelligence/modules/learning` | Stub de contrato antiguo del core |
| `lib/learning-engine` | **Motor oficial de aprendizaje post-partido** |
| Probability Engine | Genera predicciones; no se modifica aquí |
| Intelligence Learning System | Recomendaciones Scoring Engine v2, ROI y calibración de apuesta. Ver [`docs/INTELLIGENCE_LEARNING.md`](./INTELLIGENCE_LEARNING.md) |
