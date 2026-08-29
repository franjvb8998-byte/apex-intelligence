import { ProductLinkRow, type ProductLink } from "@/components/app-shell/product-link-row";
import {
  opportunityBankrollHref,
  opportunityCopilotHref,
} from "@/lib/apex-opportunities/hrefs";
import {
  fixtureIdFromMatch,
  matchAnalysisHref,
  matchCenterHref,
} from "@/lib/match-center/fixture-id";

type MatchProductLinksProps = {
  matchId: string;
  externalId?: string | null;
  homeName: string;
  awayName: string;
  current?: "center" | "analysis" | "live";
};

export function MatchProductLinks({
  matchId,
  externalId,
  homeName,
  awayName,
  current,
}: MatchProductLinksProps) {
  const fixtureId = fixtureIdFromMatch({ id: matchId, externalId });
  const links: ProductLink[] = [];

  if (fixtureId && current !== "center") {
    links.push({ href: matchCenterHref(fixtureId), label: "Match Center" });
  }
  if (fixtureId && current !== "analysis") {
    links.push({ href: matchAnalysisHref(fixtureId), label: "Match Analysis" });
  }
  if (fixtureId) {
    links.push({ href: opportunityBankrollHref(fixtureId), label: "Bankroll" });
    links.push({
      href: opportunityCopilotHref(homeName, awayName, fixtureId),
      label: "Copilot",
    });
  }
  links.push({ href: "/opportunities", label: "APEX Opportunities" });
  if (current !== "live") {
    links.push({ href: "/match-live", label: "APEX Vision" });
  }

  return <ProductLinkRow links={links} />;
}
