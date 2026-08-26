import { Badge } from "@/components/design-system/badge";
import { Card, CardHeader } from "@/components/design-system/card";
import type { DashboardSystemStatus } from "@/lib/dashboard/types";

function providerTone(
  system: DashboardSystemStatus,
): "accent" | "warning" | "info" {
  if (system.dataMode === "live") return "accent";
  if (system.provider === "mock") return "warning";
  return "info";
}

function providerLabel(system: DashboardSystemStatus): string {
  if (system.dataMode === "live") return "Live";
  if (system.provider === "mock") return "Mock";
  return "Recorded";
}

type DashboardSystemStatusProps = {
  system: DashboardSystemStatus;
};

export function DashboardSystemStatusCard({
  system,
}: DashboardSystemStatusProps) {
  return (
    <Card padding="md">
      <CardHeader
        title="Estado del sistema"
        description={system.message}
        action={
          <Badge tone={providerTone(system)}>{providerLabel(system)}</Badge>
        }
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatusStat label="Provider" value={system.displayName} />
        <StatusStat label="Hoy" value={String(system.todayCount)} />
        <StatusStat label="Próximos" value={String(system.upcomingCount)} />
        <StatusStat
          label="API key"
          value={system.hasApiKey ? "Configurada" : "Ausente"}
        />
      </dl>
      <p className="mt-4 text-xs text-[var(--apex-fg-subtle)]">
        Ligas {system.leagueCount} · Equipos {system.teamCount} · Revisado{" "}
        {new Date(system.checkedAt).toLocaleString("es-ES", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </p>
    </Card>
  );
}

function StatusStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--apex-fg)]">{value}</dd>
    </div>
  );
}
