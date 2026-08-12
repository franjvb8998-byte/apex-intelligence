# Design System — APEX Intelligence

**Código:** `components/design-system/` · tokens en `app/globals.css`  
**Showcase:** `/design-system`  
**Regla:** solo presentación. Sin lógica de negocio ni APIs.

---

## 1. Brand

- **Nombre:** APEX Intelligence  
- **Personalidad:** precisa, calmada, analítica — confianza sin “hype”  
- **Acento:** verde menta `#00D4AA` sobre navy `#0B1220`  
- **Principio visual:** una composición clara por sección; el acento marca señal, no decoración

---

## 2. Color Palette

| Token | Valor | Uso |
| --- | --- | --- |
| `--apex-bg` | `#0B1220` | Fondo de página |
| `--apex-surface` | slate / 50% | Cards |
| `--apex-fg` | `#F1F5F9` | Texto principal |
| `--apex-fg-muted` | `#94A3B8` | Texto secundario |
| `--apex-fg-subtle` | `#64748B` | Labels / meta |
| `--apex-accent` | `#00D4AA` | CTA, scores, leads |
| `--apex-accent-muted` | accent @ 12% | Fondos suaves |
| `--apex-border` | `#1E293B` | Bordes de card |
| `--apex-warning` | `#FBBF24` | Riesgo medio / confianza media |
| `--apex-danger` | `#F87171` | Riesgo alto / contra |
| `--apex-info` | `#38BDF8` | Informativo |

Semántica: `neutral` · `accent` · `success` · `warning` · `danger` · `info`.

---

## 3. Typography

| Rol | Spec |
| --- | --- |
| Sans | Geist Sans (`--apex-font-sans`) |
| Mono | Geist Mono — scores, %, cuotas |
| Labels de sección | `text-sm`, uppercase, `tracking-wider`, color subtle |
| Títulos | `text-xl`–`text-3xl`, semibold/bold, blanco |
| Cuerpo | `text-sm`–`text-base`, leading relaxed |

---

## 4. Spacing

Escala 4px: `--apex-space-1` … `--apex-space-16`  
Cards: padding `md` = 20–24px; gaps de grid 24px (`gap-6`).

---

## 5. Shadows & radius

| Token | Uso |
| --- | --- |
| `--apex-shadow-sm` | Cards en reposo |
| `--apex-shadow-accent` | CTA primary |
| `--apex-radius-xl` | Chips / paneles internos |
| `--apex-radius-2xl` | Cards |

---

## 6. Motion

| Token | Valor | Uso |
| --- | --- | --- |
| `--apex-duration-fast` | 150ms | Hover micro |
| `--apex-duration-normal` | 250ms | Chips, expand chevron |
| `--apex-duration-slow` | 500ms | Paneles expandibles |
| `--apex-duration-bar` | 700ms | Barras / gauges |

`prefers-reduced-motion: reduce` desactiva animaciones en `globals.css`.

---

## 7. Components

Importa desde `@/components/design-system`.

| Componente | Propósito |
| --- | --- |
| `Card` / `CardHeader` | Contenedor de superficie |
| `Badge` | Meta / severidad / estado |
| `ScoreGauge` | Score 0–100 circular (SVG) |
| `ProbabilityBars` | Barras [0,1] con `role="meter"` |
| `ConfidenceIndicator` | Banda low/medium/high + % |
| `Timeline` | Cronología vertical |
| `HeatmapPlaceholder` | Skeleton de heatmap (sin datos) |
| `MarketChip` | Chip de mercado (pressed state) |
| `ExplanationPanel` | Resumen + detalle expandible |

### Accesibilidad (baseline)

- Focus visible: clase `.apex-focusable` + `--apex-focus-ring`
- Meters con `aria-valuemin/max/now`
- Paneles expandibles: `aria-expanded` / `aria-controls`
- Heatmap: `role="img"` + `aria-label` descriptivo
- Contraste: texto muted sobre navy; acento solo para señal

### Responsive

- Grids `1 → 2/3` columnas con breakpoints `sm` / `lg`
- Touch targets ≥ 44px en chips/botones interactivos
- Tipografía y padding fluidos (`sm:` variants)

---

## 8. Layout Patterns

1. **Page shell** existente (`PageShell`) — hero no aplica en pantallas de producto.  
2. **Analysis layout:** columna principal (probs + markets + explicación) + rail (score + factors).  
3. **Card stack:** una idea por card; título uppercase sutil.

---

## 9. Cómo extender

1. Añade tokens en `app/globals.css` antes de hardcodear colores.  
2. Nuevos componentes viven en `components/design-system/` y se exportan en `index.ts`.  
3. No importes Supabase, Intelligence Core ni Data Platform dentro del DS.  
4. Documenta el componente en este archivo y muéstralo en `/design-system`.

---

## 10. Relación con pantallas

| Pantalla | Notas |
| --- | --- |
| Match Analysis | Puede migrar a estos primitives de forma incremental |
| Auth | Conserva `Button` / `AuthCard` actuales; alinear tokens gradualmente |
| Showcase | `/design-system` — catálogo vivo |
