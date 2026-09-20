/**
 * Mechanical live-capture readiness. No ranking, odds selection, or probability selection.
 */

import { assessLiveCaptureReadiness } from "@/lib/debug/calibration/prospective/live-capture/live-capture-eligibility";
import type { LiveCaptureReadinessRow, LiveCaptureRequest } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";

export function reportLiveCaptureReadiness(request: LiveCaptureRequest): LiveCaptureReadinessRow[] {
  return assessLiveCaptureReadiness(request);
}
