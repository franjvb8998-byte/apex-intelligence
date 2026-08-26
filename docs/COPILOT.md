# APEX Copilot UI — Sprint 9

**Ruta:** `/copilot`  
**Código:** `components/copilot/` · `lib/copilot/`

Solo experiencia visual. **Sin OpenAI.** No modifica Intelligence Layer, Probability Engine ni Learning Engine.

---

## Layout

- Sidebar: chats recientes + Nuevo análisis
- Panel: mensaje de bienvenida + prompts sugeridos + chat
- Respuestas mock con `analysis-card` / `prediction-card` / `explainable-card` (Sprint 10)

## Componentes

| Componente | Rol |
| --- | --- |
| `chat-window` | Shell + estado de conversación |
| `message` | Burbujas user / assistant |
| `prompt-box` | Input |
| `suggested-prompts` | Ejemplos |
| `thinking-indicator` | Estado “pensando” |
| `analysis-card` | Tarjeta de análisis mock |
| `prediction-card` | Tarjeta de predicción mock |
| `explainable-card` | Tarjeta Explainable AI (reglas) |

## Prompts sugeridos

- ¿Quién tiene más valor hoy?
- Analiza Real Madrid vs Barcelona.
- ¿Por qué bajó la probabilidad?
- Resume este partido.
- Explícame esta predicción.
