# APEX Match Rating

**Código:** `lib/match-rating/` · tarjeta en `/match-analysis/[fixture]`

Score 0–100 por fixture. Cálculo aislado del UI. No inventa señales ausentes.

---

## Fórmula

Media ponderada de métricas **disponibles** (el peso de las ausentes se renormaliza):

| Métrica | Peso | Fuente |
| --- | --- | --- |
| Forma | 12% | Últimos resultados / string de forma |
| Ataque | 12% | xG PE + goles a favor |
| Defensa | 12% | xG en contra + goles en contra |
| Lesiones | 8% | Bajas publicadas (0 = sin bajas listadas, no un XI inventado) |
| Clasificación | 10% | Rank / puntos |
| Cuotas | 8% | Profundidad del tablero |
| Prob. implícita | 8% | Acuerdo P_modelo vs 1/cuota |
| Value | 14% | EV = P × cuota − 1 |
| Factor local | 8% | 1X2 + Elo home expectancy |
| Momentum | 8% | Últimos 3 o APEX Vision si existe |

---

## Tarjeta

Overall · Confidence % · Risk · Value 0–10 · Stake (¼ Kelly) · Fair odds (`1/P`) · EV · Recommendation (Bet / Watch / Skip)

Skip fuerza stake Kelly 0%. Sin cuota: EV, value rating y Kelly = `n/d`.

La página de Match Analysis muestra el **APEX Intelligence Report** (`docs/INTELLIGENCE_REPORT.md`) encima de los gráficos. El rating sigue alimentando veredicto, mercado y barras.
