# APEX Intelligence Report v2

**Código:** `lib/intelligence-report/` · UI en `/match-analysis/[fixture]`

Informe de analista para cada partido. No usa LLM. No inventa señales que API-Football no publique.

---

## Por qué existe la recomendación

El informe no lista estadísticas en crudo. Cada sección deriva de Probability Engine + catálogo publicado + Match Rating:

| Sección | Origen |
| --- | --- |
| Verdict (Strong / Lean / Avoid) | Skip, EV, confianza ajustada, banda de riesgo |
| Confidence 0–100 | `rating.confidencePct` menos penalizaciones de riesgos publicados |
| Key Reasons | Solo si el umbral del catálogo se cumple (xG, forma, H2H, descanso, bajas rivales, factor local) |
| Risk Factors | Varianza, lluvia publicada, bajas propias, forma visitante, congestión. **No** derby / rotación / copa |
| Market | Cuota, fair odds (`1/P`), EV, Kelly, implícita, edge |
| Recommendation | PASS / SMALL / MEDIUM / STRONG + exposición 0 / 0.5 / 1 / 2 / 3 / 5 % |
| Narrative | Plantillas deterministas a partir de los hechos anteriores |
| Score Breakdown | Attack, Defense, Momentum, Form, Value, Market, Risk, Discipline, Fitness |

Señales ausentes = `n/d`. El peso no se finge.

---

## Confianza

```
adjusted = clamp(PE confidence % − Σ risk.penalty, 0, 100)
```

Alta ≥ 75 · Media ≥ 45 · Baja < 45.

---

## Veredicto

- **Avoid** (★★☆☆☆): Skip, EV < 0, o confianza ajustada < 40
- **Strong Bet** (★★★★★): Bet + EV ≥ 4% (o sin cuota) + confianza ≥ 70 + riesgo ≠ high
- **Lean Bet** (★★★★☆): Bet/Watch + EV ≥ 0 (o sin cuota) + confianza ≥ 50
