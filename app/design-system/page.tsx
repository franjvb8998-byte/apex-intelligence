import type { Metadata } from "next";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  ExplanationPanel,
  HeatmapPlaceholder,
  MarketChip,
  ProbabilityBars,
  ScoreGauge,
  Timeline,
} from "@/components/design-system";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/app-shell/states";
import { ProductShell } from "@/components/app-shell/product-shell";
import { getShellUser } from "@/lib/auth/get-shell-user";

export const metadata: Metadata = {
  title: "Design System — APEX Intelligence",
  description: "Biblioteca oficial de componentes y tokens visuales de APEX.",
};

export default async function DesignSystemPage() {
  const user = await getShellUser();

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-10">
        <header className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Design System
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)] sm:text-base">
            Componentes reutilizables y tokens oficiales. Sin lógica de negocio
            ni APIs — solo presentación accesible para escritorio y móvil.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Badges</h2>
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="info">Info</Badge>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Estados de producto
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <LoadingState label="Loading" rows={2} />
            <EmptyState
              title="Empty"
              description="No hay elementos que mostrar en esta sección."
            />
            <ErrorState
              title="Error"
              description="Ejemplo de fallo recuperable."
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Score gauge" description="0–100 SVG meter" />
            <ScoreGauge
              value={71}
              label="APEX"
              caption="Señal moderada — solo visual de ejemplo"
            />
          </Card>
          <Card>
            <CardHeader
              title="Confidence indicator"
              description="Bandas low / medium / high"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ConfidenceIndicator value={0.62} band="medium" />
              <ConfidenceIndicator value={0.82} band="high" layout="badge" />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Probability bars" />
            <ProbabilityBars
              aria-label="Ejemplo 1X2"
              items={[
                { id: "h", label: "Local", value: 0.48 },
                { id: "d", label: "Empate", value: 0.27 },
                { id: "a", label: "Visitante", value: 0.25 },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Market chips" />
            <div className="grid gap-2 sm:grid-cols-3">
              <MarketChip label="Local" value="48%" selected hint="Cuota 2.05" />
              <MarketChip label="Empate" value="27%" hint="Cuota 3.40" />
              <MarketChip label="Visitante" value="25%" hint="Cuota 3.60" />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Timeline" />
            <Timeline
              items={[
                {
                  id: "1",
                  timeLabel: "1'",
                  title: "Inicio",
                  description: "Saque inicial.",
                },
                {
                  id: "2",
                  timeLabel: "23'",
                  title: "Gol",
                  description: "Remate desde el área.",
                  tone: "accent",
                },
                {
                  id: "3",
                  timeLabel: "67'",
                  title: "Tarjeta",
                  description: "Falta táctica.",
                  tone: "warning",
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Heatmap placeholder" />
            <HeatmapPlaceholder title="Presión ofensiva (demo)" />
          </Card>
        </section>

        <section>
          <ExplanationPanel
            title="Explanation panel"
            summary="Resumen visible siempre. El detalle se revela al expandir."
            footnotes={[
              "Componente presentacional — el contenido lo inyecta la pantalla.",
              "Respeta prefers-reduced-motion a nivel global.",
            ]}
          >
            <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
              Aquí vive la narrativa extendida, factores o notas técnicas. El
              Design System no calcula scores ni llama a proveedores.
            </p>
          </ExplanationPanel>
        </section>
      </div>
    </ProductShell>
  );
}
