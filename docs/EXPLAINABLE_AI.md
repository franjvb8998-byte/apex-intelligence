# Explainable AI — Sprint 10

**Código:** `lib/explainable-ai/` · UI `components/explainable-ai/`  
**Estado:** Motor de explicaciones v1 por reglas (sin OpenAI)

No modifica Probability Engine, Learning Engine ni Data Platform.

---

## 1. Objetivo

Generar explicaciones estructuradas de cada predicción a partir de señales ya disponibles:

```text
HybridProbabilityResult (+ strengths/weaknesses/form opcionales)
        │
        ▼
 explainPrediction()
        │
        ▼
 ExplainablePrediction
   · positiveFactors
   · negativeFactors
   · confidence
   · summary
   · evidence
   · qualityScore
        │
        ├── Match Analysis (`analysis.explainable`)
        ├── Match Center → AI panel
        └── Copilot (tarjeta `explainable`)
```

---

## 2. API

```ts
import {
  explainPrediction,
  createExplainableAiEngine,
  getMockExplainablePrediction,
} from "@/lib/explainable-ai";

const report = explainPrediction({
  matchId,
  homeTeamName,
  awayTeamName,
  probability, // HybridProbabilityResult
  strengths,   // opcional (Match Analysis)
  weaknesses,
  homeForm,
  awayForm,
});
```

`method` es siempre `"rules"`.

---

## 3. Integraciones

| Superficie | Cómo |
|---|---|
| Match Analysis rules | `analyzeMatchWithRules` adjunta `explainable` |
| Match Center | `AiMatchAnalysisPanel` renderiza `ExplainablePredictionPanel` |
| Página `/match-analysis` | mock incluye `explainable` |
| Copilot | prompt “Explícame…” → card `kind: "explainable"` |

---

## 4. UI

Componentes en `components/explainable-ai/`:

- `PositiveFactors` / `NegativeFactors`
- `ConfidenceBlock`
- `SummaryBlock`
- `EvidenceList`
- `QualityScore`
- `ExplainablePredictionPanel` (composición)

---

## 5. Fuera de alcance

- OpenAI / LLM
- Cambios en PE, LE o Data Platform
- Reescritura del stub `ExplainabilityService` del Intelligence Core
