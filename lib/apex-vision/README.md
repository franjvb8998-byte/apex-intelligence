# APEX Vision

Experiencia inmersiva de seguimiento en vivo (mock-first).

- Ruta: `/match-live`
- Estado + simulación: `lib/apex-vision/`
- UI: `components/apex-vision/` (Design System + Framer Motion)

**No** llama APIs, Supabase ni el Probability Engine.
`simulateVisionTick()` es el punto de reemplazo para datos reales.
La **Intelligence Timeline™** enriquece cada evento con impacto 1X2, momentum, explicación IA y factores “¿Por qué cambió?” (`timeline-intelligence.ts`).
