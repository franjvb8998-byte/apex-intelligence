/**
 * Vendor-neutral quota helpers for UI and product loaders.
 * Detection still lives next to the current provider.
 */

export {
  ignoreNonQuotaErrors,
  isApiFootballQuotaError,
  loadUnlessQuota,
  type QuotaLoadResult,
} from "@/lib/data-platform/providers/api-football/quota";

import { isApiFootballQuotaError as detectQuotaError } from "@/lib/data-platform/providers/api-football/quota";

/** Alias so UI never names the vendor. */
export const isQuotaError = detectQuotaError;
