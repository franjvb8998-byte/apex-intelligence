# AI Match Analysis — Sprint 8

**Código:** `lib/match-analysis/` · panel en Match Center  
**Estado:** Flujo completo con reglas (sin OpenAI)

No modifica Probability Engine, Learning Engine ni Data Platform.

---

## 1. Objetivo

Primer flujo de análisis de partido:

```text
Data Platform (ApexMatchBundle)
        +
Probability Engine (HybridProbabilityResult)
        +
Reasoning Layer contracts (reglas)
        │
        ▼
 MatchAnalysisService
        │
        ▼
   MatchAnalysis
        │
        ▼
 Match Center → AI Match Analysis panel
```

---

## 2. Servicio

```ts
import { createMatchAnalysisService } from "@/lib/match-analysis";

const service = createMatchAnalysisService();
const analysis = service.analyzeBundle(bundle);
```

### Entrada (`MatchAnalysisInput`)

- Match, teams, league
- Team stats (opcional)
- Probability result (PE)
- Confidence (opcional; se deriva de entropía)
- Timeline (eventos)
- Market odds (opcional, value bet)

### Salida (`MatchAnalysis`)

prediction · confidence · strengths · weaknesses · tacticalFactors · recentForm · keyPlayers · injuries · expectedGoals · riskLevel · recommendation · valueBet · explainability · **explainable** (Sprint 10)

---

## 3. Reasoning

`analyzeMatchWithRules` — sin LLM. Usa tipos del Reasoning Layer (`Recommendation`, `ValueOpportunity`, `Explanation`).

---

## 4. Match Center

Panel **AI Match Analysis** debajo de Preview / Live / Post:

- Prediction, Confidence, Risk
- Tactical Summary, Expected Goals, Key Factors
- Recommendation, Value Bet, Explainability

---

## 5. Tests

`lib/match-analysis/match-analysis-service.test.ts`
