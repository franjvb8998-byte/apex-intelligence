import type {
  MatchDataNormalizer,
  ProviderMapper,
} from "@/lib/data-platform/contracts/normalizer";
import { createDefaultProviderMappers } from "@/lib/data-platform/normalization/mappers";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";

/**
 * Routes provider envelopes to registered mappers.
 * Adding a vendor = implement MatchDataProvider + ProviderMapper + register().
 */
export class DefaultMatchDataNormalizer implements MatchDataNormalizer {
  private readonly mappers = new Map<DataProviderId, ProviderMapper>();

  constructor(mappers: ProviderMapper[] = createDefaultProviderMappers()) {
    for (const mapper of mappers) {
      this.register(mapper);
    }
  }

  register(mapper: ProviderMapper): void {
    this.mappers.set(mapper.provider, mapper);
  }

  supports(provider: DataProviderId): boolean {
    return this.mappers.has(provider);
  }

  normalize(envelope: ProviderRawEnvelope): ApexMatchBundle {
    const mapper = this.mappers.get(envelope.provider);
    if (!mapper) {
      throw new Error(
        `No ProviderMapper registered for "${envelope.provider}". ` +
          `Register a mapper before normalizing — do not teach the Intelligence Core about vendors.`,
      );
    }
    return mapper.toApexBundle(envelope);
  }
}

export function createMatchDataNormalizer(
  mappers?: ProviderMapper[],
): MatchDataNormalizer {
  return new DefaultMatchDataNormalizer(mappers);
}
