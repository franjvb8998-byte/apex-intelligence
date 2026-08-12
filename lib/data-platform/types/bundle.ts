import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { ApexLeague, ApexPlayer, ApexTeam } from "@/lib/data-platform/types/team";
import type { ApexMatch } from "@/lib/data-platform/types/match";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { DataTrustScore } from "@/lib/data-platform/types/quality";

/**
 * Full canonical snapshot for one match after normalization.
 * This is what the Intelligence Core should consume — never raw vendor JSON.
 */
export type ApexMatchBundle = {
  match: ApexMatch;
  league: ApexLeague | null;
  homeTeam: ApexTeam;
  awayTeam: ApexTeam;
  players: ApexPlayer[];
  events: ApexMatchEvent[];
  odds: ApexOddsQuote[];
  provenance: {
    primaryProvider: DataProviderId;
    providers: DataProviderId[];
    normalizedAt: string;
  };
  /** Filled by DataQuality module; optional until scored. */
  trustScore?: DataTrustScore;
};
