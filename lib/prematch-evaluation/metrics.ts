/**
 * Product-pure scoring metrics for historical evaluation.
 * Do not import lib/debug/calibration.
 */

export const LOG_LOSS_EPS = 1e-15;

export type OneXTwoVector = {
  home: number;
  draw: number;
  away: number;
};

export type OneXTwoOutcome = "home" | "draw" | "away";

export function clampProbability(value: number, eps = LOG_LOSS_EPS): number {
  if (!Number.isFinite(value)) return eps;
  return Math.min(1, Math.max(eps, value));
}

export function probabilityOnOutcome<T extends string>(
  predicted: Record<T, number>,
  actual: T,
): number {
  return predicted[actual];
}

export function logLoss(probability: number, eps = LOG_LOSS_EPS): number {
  return -Math.log(clampProbability(probability, eps));
}

export function binaryBrier(probability: number, realized: boolean): number {
  const y = realized ? 1 : 0;
  return (probability - y) ** 2;
}

export function twoClassBrier(
  probabilityOfFirst: number,
  firstRealized: boolean,
): number {
  const p1 = probabilityOfFirst;
  const p0 = 1 - probabilityOfFirst;
  const y1 = firstRealized ? 1 : 0;
  const y0 = firstRealized ? 0 : 1;
  return (p1 - y1) ** 2 + (p0 - y0) ** 2;
}

export function logLossOneXTwo(
  predicted: OneXTwoVector,
  actual: OneXTwoOutcome,
  eps = LOG_LOSS_EPS,
): number {
  return logLoss(probabilityOnOutcome(predicted, actual), eps);
}

export function brierOneXTwo(
  predicted: OneXTwoVector,
  actual: OneXTwoOutcome,
): number {
  const y = {
    home: actual === "home" ? 1 : 0,
    draw: actual === "draw" ? 1 : 0,
    away: actual === "away" ? 1 : 0,
  };
  return (
    (predicted.home - y.home) ** 2 +
    (predicted.draw - y.draw) ** 2 +
    (predicted.away - y.away) ** 2
  );
}

export function oneXTwoAccuracy(
  predicted: OneXTwoVector,
  actual: OneXTwoOutcome,
): boolean {
  const label =
    predicted.home >= predicted.draw && predicted.home >= predicted.away
      ? "home"
      : predicted.away >= predicted.draw
        ? "away"
        : "draw";
  return label === actual;
}
