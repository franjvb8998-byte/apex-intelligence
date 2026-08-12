# AI Engine — Intelligence Core

**Documento técnico oficial** del motor de inteligencia de APEX.  
**Código:** `lib/intelligence/`  
**Estado:** Arquitectura + Probability Engine v0.1 (Elo × Poisson)  
**Detalle del motor de probabilidades:** [`PROBABILITY_ENGINE.md`](./PROBABILITY_ENGINE.md)  
**Ingestión de datos (desacoplada):** [`DATA_PLATFORM.md`](./DATA_PLATFORM.md)

---

## 1. Purpose

El **Intelligence Core** convierte contexto de partido (liga, equipos, estado) en:

- una **predicción del sistema** (outcome + probabilidades + confianza),
- opcionalmente **explicación**, **señales de valor de mercado** y **actualizaciones live**,
- y **señales de aprendizaje** cuando el partido cierra.

No incluye autenticación ni UI. Esas capas consumen el core a través de APIs / jobs.

---

## 2. Package layout

```text
lib/intelligence/
├── index.ts                 # Entrypoint público
├── types/                   # Tipos compartidos (domain + engine)
├── contracts/               # Interfaces TypeScript (ports)
├── modules/
│   ├── probability/
│   ├── markets/
│   ├── simulation/
│   ├── learning/
│   ├── explainability/
│   └── live/
├── engine/                  # Pipeline + composition root
└── adapters/
    ├── api/                 # Fachada HTTP/jobs
    ├── supabase/            # Repositorios hacia tablas
    └── ai/                  # Feature builder + modelo + calibrador (stubs)
```

**Regla:** los algoritmos viven dentro de `modules/` y `adapters/ai/`.  
Los contratos en `contracts/` no deben acoplarse a Next.js, React ni Supabase Auth.

---

## 3. Modules

| Módulo | Responsabilidad | Contrato |
| --- | --- | --- |
| **probability** | Utilidades + motor híbrido Elo×Poisson (1X2, O/U 2.5) | `ProbabilityModule`, `ProbabilityEngine` |
| **markets** | Cuotas → implied probs, overround, value vs modelo | `MarketsModule` |
| **simulation** | Escenarios / exploración de distribuciones | `SimulationModule` |
| **learning** | Señales post-partido, evaluación, feedback | `LearningModule` |
| **explainability** | Factores legibles y caveats | `ExplainabilityModule` |
| **live** | Eventos in-play → updates incrementales | `LiveModule` |

El **Prediction Engine** orquesta features → inference → probability → confidence → (markets/explain) → persist.

---

## 4. Shared types (resumen)

### Domain (`types/domain.ts`)

- `Match`, `Team`, `League`, `MatchContext`
- `MatchOutcome` (`home` \| `draw` \| `away`)
- `OutcomeProbability`, `ConfidenceScore`
- `SystemPrediction`, `UserPrediction`

### Engine (`types/engine.ts`)

- `FeatureVector`, `ModelInferenceResult`
- `PredictionExplanation`, `ValueSignal`, `MarketQuote`
- `SimulationScenario` / `SimulationResult`
- `LearningSignal`, `ModelEvaluationSnapshot`
- `LiveMatchEvent`, `LivePredictionUpdate`
- `PredictionPipelineInput` / `PredictionPipelineResult`

---

## 5. Interfaces principales

### Core modules

```ts
ProbabilityModule
MarketsModule
SimulationModule
LearningModule
ExplainabilityModule
LiveModule
```

### Engine ports

```ts
FeatureBuilder
InferenceModel
ConfidenceCalibrator
PredictionEngine
```

### Data ports (Supabase)

```ts
MatchContextRepository
PredictionRepository
UserPredictionRepository
LearningRepository
```

Implementaciones stub en `adapters/supabase` y `adapters/ai`.  
Composition root: `createIntelligenceCore()` en `engine/`.

---

## 6. Data flow

### 6.1 Predicción pre-partido (happy path)

```text
[Job / API Route]
        │
        ▼
 IntelligenceApi.predictMatch({ matchId })
        │
        ▼
 PredictionPipeline.run
        │
        ├─► MatchContextRepository.getByMatchId  ──► Supabase (leagues, teams, matches)
        │
        ├─► FeatureBuilder.build                 ──► AI adapter (features)
        │
        ├─► InferenceModel.infer                 ──► AI adapter (modelo)
        │
        ├─► ProbabilityModule.normalize
        ├─► ConfidenceCalibrator.calibrate
        │
        ├─► (opt) MarketsModule.getQuotes + detectValue
        ├─► (opt) ExplainabilityModule.explain
        │
        └─► (opt) PredictionRepository.save      ──► Supabase (predictions)
                │
                ▼
        PredictionPipelineResult
```

### 6.2 Capas del sistema

```text
┌──────────────────────────────────────────────────────────┐
│  Frontend (sin cambios en este diseño)                   │
│  Dashboard / futuros paneles de predicción               │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼─────────────────────────────┐
│  API boundary (futuro: app/api/intelligence/*)           │
│  Auth check aquí — no dentro del core                    │
│  → createIntelligenceApi(core)                           │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Intelligence Core                                       │
│  engine + modules (probability…live)                     │
└───────┬─────────────────────────────┬────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────────┐     ┌───────────────────────────────┐
│ adapters/ai       │     │ adapters/supabase             │
│ features / model  │     │ matches → predictions         │
│ calibrator        │     │ user_predictions / learning   │
└───────────────────┘     └───────────────┬───────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │ Supabase Postgres   │
                              │ + Auth (fuera core) │
                              └─────────────────────┘
```

### 6.3 Cierre de ciclo (learning)

```text
Match status → finished
        │
        ▼
LearningModule.buildSignals({ actualOutcome, systemPrediction, userPrediction? })
        │
        ├─► LearningModule.evaluateModel
        └─► LearningRepository.saveSignals → Supabase
```

### 6.4 Live

```text
Feed de eventos → LiveModule.applyEvent(currentPrediction, event)
        │
        └─► LivePredictionUpdate (probabilidades/confianza actualizadas)
              (persistencia / broadcast: responsabilidad de API/jobs)
```

---

## 7. Inputs

| Input | Origen | Usado por |
| --- | --- | --- |
| `matchId` / `MatchContext` | Supabase | Pipeline, simulation, live |
| Features numéricas | `FeatureBuilder` | Inference, explainability |
| Cuotas de mercado | Proveedor externo via `MarketsModule` | Value signals |
| Eventos live | Feed / webhook | `LiveModule` |
| Resultado real + predicciones | Supabase | `LearningModule` |

---

## 8. Outputs

| Output | Destino |
| --- | --- |
| `SystemPrediction` | Tabla `predictions` + API |
| `PredictionExplanation` | API / UI futura |
| `ValueSignal[]` | API / alertas futuras |
| `LearningSignal[]` | Store de evaluación / métricas |
| `LivePredictionUpdate` | Clientes suscritos / jobs |

---

## 9. Prediction model (contrato, no implementación)

1. **FeatureBuilder** produce `FeatureVector` estable y versionable.
2. **InferenceModel** expone `modelVersion` y devuelve `ModelInferenceResult`.
3. **ProbabilityModule** garantiza distribución válida.
4. **ConfidenceCalibrator** mapea scores → `ConfidenceScore` calibrado.
5. Persistencia opcional en `predictions` con `model_version`.

Hasta congelar el contrato de features, los stubs lanzan `Error("… is not implemented")`.

---

## 10. Confidence scoring

- Rango: `[0, 1]`
- Bandas: `low` \| `medium` \| `high` (umbrales TBD)
- Principio de producto: baja confianza debe ser visible; abstención es un outcome válido de producto (ver `PRODUCT_BLUEPRINT.md`)

---

## 11. Feature pipeline

Responsabilidad exclusiva de `adapters/ai` (`FeatureBuilder`), no de la UI.

Fases previstas:

1. Snapshot de contexto (equipos, liga, kickoff).
2. Features históricas (forma, H2H, etc.) — TBD.
3. Validación / defaults.
4. Emisión de `FeatureVector` con `generatedAt` y `metadata`.

---

## 12. Evaluation metrics

Producidas por `LearningModule.evaluateModel` → `ModelEvaluationSnapshot`:

- `accuracy`
- `logLoss`
- `calibrationError`
- `sampleSize` + `modelVersion` + `evaluatedAt`

---

## 13. Safety & guardrails

- El core **no** autentica usuarios; la API boundary valida sesión.
- No persistir predicciones sin `modelVersion`.
- No exponer raw scores al cliente sin pasar por explainability / confidence.
- Markets/live son opcionales: el pipeline pre-partido debe funcionar sin ellos.
- Stubs fallan ruidoso (`throw`) para evitar “predicciones fantasma” en producción.

---

## 14. Wiring guide (para implementación futura)

```ts
import {
  createIntelligenceCore,
  createIntelligenceApi,
  createSupabaseIntelligenceAdapters,
  createStubAiAdapters,
} from "@/lib/intelligence";

const supabase = createSupabaseIntelligenceAdapters();
const ai = createStubAiAdapters();

const core = createIntelligenceCore({
  matchContexts: supabase.matchContexts,
  predictions: supabase.predictions,
  features: ai.features,
  model: ai.model,
  calibrator: ai.calibrator,
});

const api = createIntelligenceApi(core);
// await api.predictMatch({ matchId })
```

Rutas HTTP sugeridas (aún no registradas): ver comentario en `adapters/api/index.ts`.

---

## 15. Future extensions

- Persistencia de features y evaluaciones en tablas dedicadas.
- Provider real de cuotas detrás de `MarketsModule`.
- Worker/queue para `runBatch` y cierre de learning.
- Streaming live (Realtime / SSE) fuera del core.
- Sustituir stubs de AI por runtime de modelo sin cambiar contratos.

---

## 16. Relación con otros docs

| Doc | Rol |
| --- | --- |
| `PRODUCT_BLUEPRINT.md` | Por qué existe el motor y métricas de éxito |
| `DATABASE_DESIGN.md` | Tablas (`predictions`, `matches`, …) |
| `API_STRATEGY.md` | Superficie HTTP y versionado (cuando se active) |
| `DECISIONS.md` | Decisiones que cambien contratos del core |
