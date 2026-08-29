import type { PredictionId } from "@/lib/prediction-journal/types";

function slug(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return trimmed.replace(/^-|-$/g, "") || "selection";
}

export function predictionIdFromParts(input: {
  fixtureId: string;
  market: string;
  selectionLabel: string;
}): PredictionId {
  return [
    "pred",
    input.fixtureId,
    input.market,
    slug(input.selectionLabel),
  ].join(":");
}
