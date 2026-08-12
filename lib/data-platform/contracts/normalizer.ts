import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";

/**
 * Provider-specific mapper: raw envelope → canonical ApexMatchBundle.
 * Register one mapper per DataProviderId.
 */
export interface ProviderMapper {
  readonly provider: DataProviderId;
  toApexBundle(envelope: ProviderRawEnvelope): ApexMatchBundle;
}

/**
 * Registry + façade that routes envelopes to the correct mapper.
 */
export interface MatchDataNormalizer {
  register(mapper: ProviderMapper): void;
  normalize(envelope: ProviderRawEnvelope): ApexMatchBundle;
  supports(provider: DataProviderId): boolean;
}
