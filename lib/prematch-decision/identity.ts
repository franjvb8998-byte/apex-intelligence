import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { PREMATCH_DECISION_TICKET_ID_PREFIX } from "@/lib/prematch-decision/ticket";

export function canonicalPrematchFixtureId(
  fixtureId: string | null | undefined,
): string | null {
  const canonical = vendorFixtureId(fixtureId);
  return canonical && canonical.length > 0 ? canonical : null;
}

export function prematchDecisionTicketId(
  fixtureId: string | null | undefined,
): string | null {
  const canonical = canonicalPrematchFixtureId(fixtureId);
  if (!canonical) return null;
  return `${PREMATCH_DECISION_TICKET_ID_PREFIX}:${canonical}`;
}
