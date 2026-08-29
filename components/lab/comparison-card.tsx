import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { LabPanel } from "@/components/lab/lab-panel";
import { LabTable } from "@/components/lab/lab-table";
import type { LabEngineCompareRow, LabTableRow } from "@/lib/lab/types";

export async function ModelComparisonCard({
  rows,
  scanOk,
}: {
  rows: LabEngineCompareRow[];
  scanOk: boolean;
}) {
  const t = await getTranslations("lab");
  const paired = rows.filter((row) => row.paired);
  const research = rows.filter((row) => !row.paired);

  const toTable = (source: LabEngineCompareRow[]): LabTableRow[] =>
    source.map((row) => ({
      id: row.id,
      href: row.href,
      tone: row.tone,
      badge: {
        label: row.paired ? t("paired") : t("samples"),
        tone: row.paired ? "info" : "neutral",
      },
      cells: {
        name: row.name,
        version: row.version,
        sample: row.sample,
        primary: `${row.primaryLabel} ${row.primary}`,
        secondary: `${row.secondaryLabel} ${row.secondary}`,
        badge: row.paired ? "Paired" : "Sample",
      },
    }));

  return (
    <LabPanel
      id="compare"
      eyebrow={t("desk")}
      title={t("comparison")}
      badge={<Badge tone="info">{t("noRescore")}</Badge>}
      kpis={[
        { label: t("paired"), value: String(paired.length), tone: "info" },
        { label: t("samples"), value: String(research.length) },
        {
          label: "Scan",
          value: scanOk ? t("scanLive") : t("scanOfflineShort"),
          tone: scanOk ? "accent" : "warning",
        },
      ]}
      status={rows.length === 0 ? "empty" : "ready"}
      emptyTitle={t("nothingToCompare")}
      emptyDescription={t("nothingToCompareDescription")}
      footerHref="/match-analysis"
      footerLabel={t("inspectFeatured")}
    >
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--apex-fg-muted)]">
        {t("compareNote")}
      </p>
      <LabTable
        columns={[
          { key: "name", label: t("colEngine") },
          { key: "version", label: t("colVersion") },
          { key: "sample", label: t("colSample") },
          { key: "primary", label: t("colPrimary"), align: "right" },
          { key: "secondary", label: t("colSecondary"), align: "right" },
          { key: "badge", label: t("colKind") },
        ]}
        rows={[...toTable(paired), ...toTable(research)]}
        empty={t("noComparisonRows")}
      />
    </LabPanel>
  );
}
