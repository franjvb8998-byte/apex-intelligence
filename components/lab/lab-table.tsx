import Link from "next/link";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { LabTableColumn, LabTableRow } from "@/lib/lab/types";

export function LabTable({
  columns,
  rows,
  empty = "No rows.",
}: {
  columns: LabTableColumn[];
  rows: LabTableRow[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--apex-fg-muted)]">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--apex-border)]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cx(
                  "pb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]",
                  column.align === "right" && "text-right",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--apex-border)]/70 hover:bg-slate-950/40"
            >
              {columns.map((column) => {
                const raw =
                  column.key === "badge" && row.badge ? (
                    <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                  ) : (
                    (row.cells[column.key] ?? "—")
                  );
                const className = cx(
                  "py-2 pr-3 text-[12px] text-[var(--apex-fg)]",
                  column.align === "right" && "text-right font-mono tabular-nums",
                );
                if (!row.href) {
                  return (
                    <td key={column.key} className={className}>
                      {raw}
                    </td>
                  );
                }
                return (
                  <td key={column.key} className={className}>
                    <Link href={row.href} className="apex-focusable block">
                      {raw}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
