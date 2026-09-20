/**
 * Operational 5C.5A capture facts. Does not mutate frozen 5C.3 protocol config.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { liveProtocolCaptureWindow } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import { LIVE_PROTOCOL_FINGERPRINT } from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";
import { PROSPECTIVE_COMPETITION_ID } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import { ACCEPTED_PROSPECTIVE_SEASON } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";

export const LIVE_CAPTURE_DEFAULT_DRY_RUN = true;

export const LIVE_CAPTURE_OPERATIONAL_FACTS = {
  competitionId: PROSPECTIVE_COMPETITION_ID,
  acceptedProspectiveSeason: ACCEPTED_PROSPECTIVE_SEASON,
  candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
  protocolFingerprint: LIVE_PROTOCOL_FINGERPRINT,
  authorizedLiveCapture: false,
  defaultDryRun: LIVE_CAPTURE_DEFAULT_DRY_RUN,
} as const;

export function liveCaptureWindow() {
  return liveProtocolCaptureWindow();
}
