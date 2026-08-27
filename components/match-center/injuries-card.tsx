import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterAbsence } from "@/lib/match-center/types";

type AbsenceCardProps = {
  title: string;
  description: string;
  empty: string;
  items: MatchCenterAbsence[];
};

function AbsenceCard({ title, description, empty, items }: AbsenceCardProps) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {items.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium text-[var(--apex-warning)]">
                {item.playerName}
              </span>
              {item.teamName ? (
                <span className="text-[var(--apex-fg-subtle)]">
                  {" "}
                  · {item.teamName}
                </span>
              ) : null}
              <span className="text-[var(--apex-fg-muted)]">
                {" "}
                · {item.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function InjuriesCard({ injuries }: { injuries: MatchCenterAbsence[] }) {
  return (
    <AbsenceCard
      title="Lesiones"
      description="Bajas reportadas por el catálogo, si existen"
      empty="Sin lesiones reportadas para este partido."
      items={injuries}
    />
  );
}

export function SuspensionsCard({
  suspensions,
}: {
  suspensions: MatchCenterAbsence[];
}) {
  return (
    <AbsenceCard
      title="Suspensiones"
      description="Sanciones y bajas disciplinarias del catálogo"
      empty="Sin suspensiones reportadas para este partido."
      items={suspensions}
    />
  );
}
