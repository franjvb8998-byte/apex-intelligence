import type { ApexId, ExternalRef } from "@/lib/data-platform/types/ids";

export type ApexLeague = {
  id: ApexId;
  name: string;
  country: string | null;
  sport: string;
  season: string | null;
  externalRefs: ExternalRef[];
};

export type ApexTeam = {
  id: ApexId;
  leagueId: ApexId | null;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  externalRefs: ExternalRef[];
};

export type PlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

export type ApexPlayer = {
  id: ApexId;
  teamId: ApexId | null;
  name: string;
  shirtNumber: number | null;
  position: PlayerPosition;
  nationality: string | null;
  externalRefs: ExternalRef[];
};
