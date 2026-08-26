import type { DataProviderId } from "@/lib/data-platform/types/ids";

/**
 * Opaque envelope returned by every MatchDataProvider.
 * The `payload` shape is provider-specific; only that provider's mapper may read it.
 */
export type ProviderRawEnvelope<TPayload = unknown> = {
  provider: DataProviderId;
  /** Vendor match id (stringified). */
  externalMatchId: string;
  fetchedAt: string;
  /** Untyped vendor payload — never leak into Intelligence Core. */
  payload: TPayload;
  /** Optional request metadata for debugging / quality. */
  meta?: {
    endpoint?: string;
    notes?: string[];
    /** live | recorded | etc. */
    mode?: string;
    cacheHit?: boolean;
    includeEvents?: boolean;
    date?: string;
    latencyMs?: number;
    httpStatus?: number;
    [key: string]: unknown;
  };
};
