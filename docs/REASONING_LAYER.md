# Reasoning Layer — APEX Intelligence

**Código:** `lib/intelligence/reasoning/`  
**Estado:** Arquitectura (stubs · **sin OpenAI**)  
**Principio:** razonar sobre señales ya normalizadas sin acoplarse a vendors ni mutar el Probability / Learning Engine.

---

## 1. Objetivo

Preparar la **capa de razonamiento** de APEX:

- explicar predicciones
- calibrar confianza
- emitir recomendaciones
- detectar value bets
- generar reportes

Este sprint **solo** define contratos, stubs y composición. No conecta LLMs ni cambia PE / LE / Data Platform / APIs.

---

## 2. Layout

```text
lib/intelligence/reasoning/
├── contracts/          # Types + ports
│   ├── types.ts
│   ├── ports.ts
│   └── index.ts
├── adapters/           # Stub LLM adapter
├── services/           # Orchestrator + risk stubs + createReasoningLayer()
├── prompts/            # Prompt ids + StubPromptCatalog
├── explainability/
├── confidence/
├── recommendations/
├── value-bet/
├── reports/
├── not-implemented.ts
├── index.ts
└── README.md
```

---

## 3. Tipos de contrato

| Tipo | Rol |
| --- | --- |
| `ReasoningInput` | Entrada del pipeline (match + probs opcionales + markets) |
| `ReasoningOutput` | Salida agregada |
| `Recommendation` | Acción sugerida |
| `RiskAnalysis` | Perfil de riesgo |
| `ConfidenceScore` | Confianza calibrada (scope reasoning) |
| `Explanation` | Narrativa + factores |
| `ValueOpportunity` | Edge vs mercado |
| `PredictionReport` | Informe durable |

> `ConfidenceScore` del Reasoning Layer es **local** a este módulo. El Core domain (`lib/intelligence/types`) conserva su propio `ConfidenceScore` — no se reexporta el de reasoning desde el barrel raíz para evitar colisiones.

---

## 4. Puertos (servicios)

| Puerto | Stub |
| --- | --- |
| `ReasoningService` | `StubReasoningService` |
| `ExplainabilityService` | `StubExplainabilityService` |
| `ConfidenceService` | `StubConfidenceService` |
| `RecommendationService` | `StubRecommendationService` |
| `ValueBetService` | `StubValueBetService` |
| `ReportService` | `StubReportService` |
| `RiskAnalysisService` | `StubRiskAnalysisService` |
| `PromptCatalog` | `StubPromptCatalog` |
| `ReasoningLlmAdapter` | `StubReasoningLlmAdapter` |

Todos lanzan: `Error("Not implemented: …")`.

---

## 5. Composición

```ts
import { createReasoningLayer } from "@/lib/intelligence/reasoning";

const layer = createReasoningLayer();
// layer.reasoning.reason(input) → throws Not implemented
```

```text
ReasoningInput
      │
      ▼
ReasoningService (orchestrator)
      ├── ExplainabilityService
      ├── ConfidenceService
      ├── RecommendationService
      ├── RiskAnalysisService
      ├── ValueBetService
      └── ReportService
      │
      ▼
ReasoningOutput (+ PredictionReport)
```

Dependencies **hacia abajo**: Reasoning puede *consumir* salidas del Probability Engine en el futuro vía `ReasoningInput.oneXTwo`, sin modificar el motor.

---

## 6. Boundaries

| Capa | ¿Modificada en este sprint? |
| --- | --- |
| Probability Engine | No |
| Learning Engine | No |
| Data Platform | No |
| BFF / `app/api` | No |
| Frontend | No |
| OpenAI / LLM real | No (solo stub adapter) |

---

## 7. Próximos pasos (fuera de alcance)

1. Implementar `ConfidenceService` / `ValueBetService` con matemática pura.
2. Cablear `ReasoningLlmAdapter` a un provider (OpenAI u otro) detrás del puerto.
3. Conectar `ReasoningInput` desde BFF / Match Center.
4. Persistir `PredictionReport`.

---

## 8. Pruebas

`lib/intelligence/reasoning/reasoning.test.ts` — compilación de tipos + stubs lanzan `Not implemented`.
