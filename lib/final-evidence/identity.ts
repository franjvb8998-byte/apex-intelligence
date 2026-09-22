import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import { FINAL_FIXTURE_EVIDENCE_ID_PREFIX } from "@/lib/final-evidence/types";

export function finalFixtureEvidenceId(
  fixtureId: string | null | undefined,
  revision: number,
): string | null {
  const canonical = canonicalPrematchFixtureId(fixtureId);
  if (!canonical || !Number.isInteger(revision) || revision < 1) return null;
  return `${FINAL_FIXTURE_EVIDENCE_ID_PREFIX}:${canonical}:${revision}`;
}
