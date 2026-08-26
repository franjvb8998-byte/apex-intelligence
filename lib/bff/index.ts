/**
 * APEX BFF — Backend for Frontend (Next.js Route Handlers).
 * Does not wire Match Center / PE / LE.
 */

export type * from "@/lib/bff/types";
export {
  BffError,
  badRequest,
  notFound,
  isBffError,
  type BffErrorCode,
} from "@/lib/bff/errors";
export { logBffEvent, type BffLogEvent } from "@/lib/bff/logging";
export { toBffError } from "@/lib/bff/map-error";
export {
  withApiHandler,
  type ApiHandlerContext,
  type ApiHandlerResult,
} from "@/lib/bff/handler";
export {
  getFixtures,
  getTeam,
  getStandings,
  getEvents,
  getLineups,
  getPlayer,
  getLeague,
  getTeamStatistics,
  type BffCatalogOptions,
  type GetFixturesInput,
} from "@/lib/bff/catalog";
