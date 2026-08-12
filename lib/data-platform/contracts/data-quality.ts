import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { DataTrustScore } from "@/lib/data-platform/types/quality";

/**
 * Scores completeness / freshness / structural quality of a normalized bundle.
 */
export interface DataQualityModule {
  score(bundle: ApexMatchBundle): DataTrustScore;
}
