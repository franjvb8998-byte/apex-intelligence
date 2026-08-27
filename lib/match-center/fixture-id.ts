/**
 * Fixture ids in URLs and Data Platform queries.
 * Accepts API-Football numeric ids and Apex ids (`apex:api-football:match:123`).
 */

export function vendorFixtureId(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const colon = trimmed.lastIndexOf(":");
  if (colon >= 0) {
    const tail = trimmed.slice(colon + 1).trim();
    if (tail) return tail;
  }
  return trimmed;
}

export function fixtureIdFromMatch(match: {
  id: string;
  externalId?: string | null;
}): string | null {
  return vendorFixtureId(match.externalId) ?? vendorFixtureId(match.id);
}

export function matchCenterHref(fixtureId: string): string {
  const id = vendorFixtureId(fixtureId) ?? fixtureId.trim();
  return `/match-center/${encodeURIComponent(id)}`;
}

export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function matchesFixtureId(
  match: { id: string; externalId?: string | null },
  selected: string | null | undefined,
): boolean {
  const want = vendorFixtureId(selected);
  if (!want) return false;
  const ids = [match.externalId, match.id]
    .map(vendorFixtureId)
    .filter((id): id is string => Boolean(id));
  return ids.includes(want);
}
