"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("matchCenter");
  return (
    <AbsenceCard
      title={t("injuries")}
      description={t("injuriesDescription")}
      empty={t("noInjuries")}
      items={injuries}
    />
  );
}

export function SuspensionsCard({
  suspensions,
}: {
  suspensions: MatchCenterAbsence[];
}) {
  const t = useTranslations("matchCenter");
  return (
    <AbsenceCard
      title={t("suspensions")}
      description={t("suspensionsDescription")}
      empty={t("noSuspensions")}
      items={suspensions}
    />
  );
}
