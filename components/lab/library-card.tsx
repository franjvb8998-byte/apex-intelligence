import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/design-system";
import { LabPanel } from "@/components/lab/lab-panel";
import { LabTable } from "@/components/lab/lab-table";
import type { LabModelRecord, LabTableRow } from "@/lib/lab/types";

function statusTone(status: LabModelRecord["status"]) {
  if (status === "production") return "accent" as const;
  if (status === "research") return "info" as const;
  return "warning" as const;
}

function toRows(models: LabModelRecord[]): LabTableRow[] {
  return models.map((model) => ({
    id: model.id,
    href: model.href,
    badge: { label: model.status, tone: statusTone(model.status) },
    cells: {
      name: model.name,
      version: model.version,
      role: model.role,
      method: model.method,
      sample: model.sample,
      badge: model.status,
    },
  }));
}

export async function ModelLibraryCard({ models }: { models: LabModelRecord[] }) {
  const t = await getTranslations("lab");
  return (
    <LabPanel
      id="library"
      eyebrow={t("registry")}
      title={t("library")}
      badge={<Badge tone="accent">{t("liveEngines")}</Badge>}
      kpis={[
        { label: t("engines"), value: String(models.length), tone: "accent" },
        {
          label: t("prod"),
          value: String(models.filter((m) => m.status === "production").length),
        },
        {
          label: t("researchKpi"),
          value: String(models.filter((m) => m.status === "research").length),
          tone: "info",
        },
        {
          label: t("stubs"),
          value: String(models.filter((m) => m.status === "stub").length),
        },
      ]}
      status={models.length === 0 ? "empty" : "ready"}
      emptyTitle={t("noModels")}
      emptyDescription={t("noModelsDescription")}
      footerHref="/opportunities"
      footerLabel={t("openScan")}
    >
      <LabTable
        columns={[
          { key: "name", label: t("colEngine") },
          { key: "version", label: t("colVersion") },
          { key: "role", label: t("colRole") },
          { key: "method", label: t("colMethod") },
          { key: "sample", label: t("colSample") },
          { key: "badge", label: t("colStatus") },
        ]}
        rows={toRows(models)}
      />
      <ul className="mt-4 space-y-1.5">
        {models.map((model) => (
          <li
            key={`${model.id}-note`}
            className="text-[11px] leading-snug text-[var(--apex-fg-subtle)]"
          >
            <span className="font-mono text-[var(--apex-fg-muted)]">
              {model.version}
            </span>
            {" · "}
            {model.notes}
          </li>
        ))}
      </ul>
    </LabPanel>
  );
}

export async function ModelVersionsCard({ models }: { models: LabModelRecord[] }) {
  const t = await getTranslations("lab");
  return (
    <LabPanel
      id="versions"
      eyebrow={t("release")}
      title={t("versions")}
      badge={<Badge>Pinned</Badge>}
      kpis={[
        { label: "Pins", value: String(models.length) },
        { label: "DE", value: "v1", tone: "accent" },
        { label: "PE", value: "0.1.0", tone: "info" },
      ]}
      footerHref="/match-analysis"
      footerLabel={t("openMatchAnalysis")}
    >
      <ul className="space-y-2">
        {models.map((model) => (
          <li key={model.id}>
            <Link
              href={model.href}
              className="apex-focusable flex items-start justify-between gap-3 rounded-[var(--apex-radius-md)] border border-transparent px-1 py-1.5 hover:border-[var(--apex-accent-border)] hover:bg-slate-950/40"
            >
              <span>
                <span className="block text-[12px] font-medium text-[var(--apex-fg)]">
                  {model.name}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--apex-fg-subtle)]">
                  {model.surfaces.join(" · ")}
                </span>
              </span>
              <Badge tone={statusTone(model.status)} className="shrink-0 font-mono">
                {model.version}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </LabPanel>
  );
}
