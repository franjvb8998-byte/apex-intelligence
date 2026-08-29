"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type {
  MatchCenterLineup,
  MatchCenterLineupPlayer,
} from "@/lib/match-center/types";

function PlayerRow({ player }: { player: MatchCenterLineupPlayer }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="min-w-0 truncate text-[var(--apex-fg)]">
        {player.number != null ? (
          <span className="mr-2 font-mono tabular-nums text-[var(--apex-fg-subtle)]">
            {player.number}
          </span>
        ) : null}
        {player.name}
      </span>
      {player.position ? (
        <span className="shrink-0 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {player.position}
        </span>
      ) : null}
    </li>
  );
}

function LineupSide({
  lineup,
  emptyLabel,
}: {
  lineup: MatchCenterLineup | null;
  emptyLabel: string;
}) {
  const t = useTranslations("matchCenter");
  if (!lineup || (lineup.startXI.length === 0 && lineup.substitutes.length === 0)) {
    return <p className="text-sm text-[var(--apex-fg-muted)]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--apex-fg)]">{lineup.teamName}</p>
        <p className="text-xs text-[var(--apex-fg-subtle)]">
          {lineup.formation ?? t("formationUnpublished")}
        </p>
      </div>
      {lineup.startXI.length > 0 ? (
        <ul className="divide-y divide-[var(--apex-border)]">
          {lineup.startXI.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--apex-fg-subtle)]">
          {t("startingXiUnpublished")}
        </p>
      )}
      {lineup.substitutes.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {t("substitutes")}
          </p>
          <ul>
            {lineup.substitutes.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type LineupsCardProps = {
  home: MatchCenterLineup | null;
  away: MatchCenterLineup | null;
};

export function LineupsCard({ home, away }: LineupsCardProps) {
  const t = useTranslations("matchCenter");
  return (
    <Card>
      <CardHeader
        title={t("lineups")}
        description={t("lineupsDescription")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <LineupSide
          lineup={home}
          emptyLabel={t("lineupHomeEmpty")}
        />
        <LineupSide
          lineup={away}
          emptyLabel={t("lineupAwayEmpty")}
        />
      </div>
    </Card>
  );
}

export function hasPublishedLineup(
  lineup: MatchCenterLineup | null | undefined,
): boolean {
  return Boolean(lineup && lineup.startXI.length > 0);
}
