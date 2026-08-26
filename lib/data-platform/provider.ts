/**
 * Data Platform v2 — provider port.
 * Swap implementations via ProviderFactory without touching PE / LE / UI.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  DataProviderFixturesQuery,
  DataProviderKind,
  DataProviderMatchQuery,
} from "@/lib/data-platform/types";

/**
 * Stable access contract for match data.
 * Implementations may use mocks, HTTP, or recorded fixtures — callers only see Apex*.
 */
export interface IDataProvider {
  readonly id: DataProviderKind;
  readonly displayName: string;

  /** Fetch one match as a canonical ApexMatchBundle. */
  getMatch(query: DataProviderMatchQuery): Promise<ApexMatchBundle>;

  /** Optional fixture list for ingestion jobs / catalogues. */
  listFixtures?(
    query?: DataProviderFixturesQuery,
  ): Promise<ApexMatchBundle[]>;
}
