# APEX Copilot v1

**Ruta:** `/copilot`  
**Código:** `lib/copilot/` · `components/copilot/` · `app/api/copilot/`

Asistente de análisis de apuestas. Consume datos internos APEX. No es un chatbot genérico.

---

## Datos que consume

- Probabilidades 1X2 / O/U 2.5 / BTTS (Probability Engine)
- Estadísticas y forma (Match Center / Data Platform)
- Lesiones (si el proveedor las publica)
- Cuotas, cuota justa (`1 / P_modelo`), EV (`P × cuota − 1`), edge (`P − 1/cuota`)
- Confianza, value bet, recomendación (reglas Match Analysis)

Si un campo no está en el catálogo, el informe lo declara. **Nunca se inventa.**

---

## Informe (9 secciones)

Executive Summary · Strengths · Weaknesses · Tactical Context · Market Analysis · Value Analysis · Risk Analysis · Suggested Stake · Final Recommendation

Stake en **unidades** (1u = unidad de bankroll). 0u si la acción es `pass`.

---

## Arquitectura

```text
POST /api/copilot
        │
        ▼
 CopilotService.ask
        │  listFixtures + getMatchCenterData
        ▼
 CopilotMatchSnapshot  (hechos APEX)
        │
        ▼
 buildLocalBriefing    (analista local, determinista)
        │
        ▼
 CopilotAiClient       (opcional: reescribe SOLO el resumen)
```

### Interfaz AI (un solo puerto)

`CopilotAiClient.complete({ system, user })`

Proveedores registrados por id — el servicio no importa SDKs:

| id | Cuándo |
| --- | --- |
| `local` | Default. Sin red. |
| `openai` | `COPILOT_AI_PROVIDER=openai` + `OPENAI_API_KEY` |
| `claude` | `COPILOT_AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` |
| `gemini` | `COPILOT_AI_PROVIDER=gemini` + `GEMINI_API_KEY` |

Los vendors **no generan cifras**. Como mucho reescriben el executive summary. Si fallan o no hay clave, se usa el analista local.

Nuevo proveedor: `registerCopilotAiClient("id", factory)`.

Si API-Football agota la cuota, Copilot no inventa el partido: usa el catálogo recorded APEX (mismo dataset que tests / Bankroll) y lo declara en el informe. Si el fixture pedido no está en ese catálogo, lo dice y no sustituye otro.

---

## Tono

Analista de fútbol profesional. Cada conclusión cita el dato APEX (P_modelo, xG, cuota, forma).
