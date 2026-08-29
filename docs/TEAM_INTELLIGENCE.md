# APEX Team Intelligence Engine

**Código:** `lib/team-intelligence/`

Club digital twin. Determinista. Sin LLM. Sin HTTP. Sin valores aleatorios.

Cada módulo de APEX consume `TeamIntelligence`. El motor no re-puntúa el Decision Engine ni inventa mercados.

```ts
import {
  createTeamIntelligenceEngine,
  teamIntelligenceInputFromMatchCenter,
} from "@/lib/team-intelligence";

const engine = createTeamIntelligenceEngine();
const twin = engine.evaluate(input);
```

---

## Salida

`Team Intelligence Score` 0–100 · cobertura 0–1 · pilares Attack / Defense / Momentum / Health / Tactical Identity / Motivation / Transfer Stability / Home / Away.

Capas: Identity · Tactical DNA · Current Form · Home DNA · Away DNA · Momentum · Squad Health · Transfer Intelligence · Motivation · Schedule · Environment.

Señal ausente = `n/d` (`available: false`). No se inventa derby, rivalidad, distancia de viaje, valor de mercado, presupuesto, set pieces, PPDA, ni /transfers.

---

## Score

Pilares (se renormalizan si faltan):

| Pilar | Peso |
| --- | --- |
| Attack | 16% |
| Defense | 16% |
| Momentum | 12% |
| Home | 11% |
| Away | 11% |
| Health | 10% |
| Tactical Identity | 10% |
| Motivation | 8% |
| Transfer Stability | 6% |

---

## Consumo

| Módulo | Cómo entra |
| --- | --- |
| Match Center | `teamIntelligenceInputFromMatchCenter` sobre form, standings, lineups, injuries, team statistics |
| Decision Engine | Puede leer pilares Attack / Defense / Health / Motivation **sin cambiar sus pesos** |
| Probability Engine | No se modifica. El twin no produce 1X2 |
| Football Graph | `styleAxes` opcionales (possession, pressing, tempo, width, directness) |
| Smart Combos / Scanner | Mismo snapshot de club si el scan ya tiene el contexto |

`evaluateMatchClubTwins(homeInput, awayInput)` arma el par de un partido.

---

## Honestidad

- Formación y banquillo: lineup publicado.
- Estilo: ejes del grafo o posesión en partidos con el stat.
- Motivación Europa / descenso / título: descripción de standings del vendor, no rumores.
- Traspasos: capa entera n/d hasta que un builder publique `transfers.published`.
- Superficie artificial: flag del venue, no un coeficiente de “experiencia”.
