/**
 * Evidence exclusion counts. Catalogue construction is delegated to frozen 5C.5B.1.
 */

import type { ProjectedPriorFixture, ProjectedTargetFixture } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

export function countSameKickoffExcluded(
  universe: readonly ProjectedPriorFixture[],
  target: ProjectedTargetFixture,
): number {
  return universe.filter(
    (row) => row.fixtureId !== target.fixtureId && row.kickoffUtc === target.kickoffUtc,
  ).length;
}

export function targetAppearsInUniverse(
  universe: readonly ProjectedPriorFixture[],
  target: ProjectedTargetFixture,
): boolean {
  return universe.some((row) => row.fixtureId === target.fixtureId);
}
