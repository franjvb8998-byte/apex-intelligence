/**
 * GOALS-1D — Leakage-safe attack/defense strengths with EB shrinkage.
 *
 * Defense orientation: strength > 1 means concedes more than league average.
 */

export function shrunkRate(n: number, observedRate: number, k: number, L: number): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid n: ${n}`);
  }
  if (!Number.isFinite(k) || k < 0) {
    throw new Error(`Invalid k: ${k}`);
  }
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error(`Invalid league baseline L: ${L}`);
  }
  if (n === 0) {
    // Posterior equals league prior; never invent an observed rate.
    return L;
  }
  if (!Number.isFinite(observedRate) || observedRate < 0) {
    throw new Error(`Invalid observed rate: ${observedRate}`);
  }
  return (n * observedRate + k * L) / (n + k);
}

/**
 * strength = shrunkRate / L.
 * When n=0, strength = 1 (BASE_PRIOR).
 */
export function shrunkStrength(
  n: number,
  observedRate: number | null,
  k: number,
  L: number,
): { strength: number; rate: number; usedBasePrior: boolean } {
  if (n === 0) {
    return { strength: 1, rate: L, usedBasePrior: true };
  }
  if (observedRate == null) {
    throw new Error("observedRate required when n > 0");
  }
  const rate = shrunkRate(n, observedRate, k, L);
  return { strength: rate / L, rate, usedBasePrior: false };
}

export type AttackDefenseComponents = {
  leagueHomeRate: number;
  leagueAwayRate: number;
  homeAttackPlayed: number;
  homeDefensePlayed: number;
  awayAttackPlayed: number;
  awayDefensePlayed: number;
  homeAttackObserved: number | null;
  homeDefenseObserved: number | null;
  awayAttackObserved: number | null;
  awayDefenseObserved: number | null;
  homeAttackStrength: number;
  homeDefenseStrength: number;
  awayAttackStrength: number;
  awayDefenseStrength: number;
  muHome: number;
  muAway: number;
  lowInformationFallbackUsed: boolean;
  teamEvidenceQuality: "BASE_PRIOR" | "OBSERVED_SHRUNK";
};

/**
 * Canonical multiplicative G1 expected goals.
 *
 * homeDefenseStrength uses leagueAwayRate as denominator (home concedes ≈
 * away scoring environment). awayDefenseStrength uses leagueHomeRate.
 */
export function computeAttackDefenseMus(input: {
  leagueHomeRate: number;
  leagueAwayRate: number;
  homeAttackPlayed: number;
  homeAttackObserved: number | null;
  homeDefensePlayed: number;
  homeDefenseObserved: number | null;
  awayAttackPlayed: number;
  awayAttackObserved: number | null;
  awayDefensePlayed: number;
  awayDefenseObserved: number | null;
  shrinkageK: number;
}): AttackDefenseComponents {
  const {
    leagueHomeRate: Lh,
    leagueAwayRate: La,
    shrinkageK: k,
  } = input;

  const ha = shrunkStrength(
    input.homeAttackPlayed,
    input.homeAttackObserved,
    k,
    Lh,
  );
  // Home defense: goals conceded at home vs league away scoring rate.
  const hd = shrunkStrength(
    input.homeDefensePlayed,
    input.homeDefenseObserved,
    k,
    La,
  );
  const aa = shrunkStrength(
    input.awayAttackPlayed,
    input.awayAttackObserved,
    k,
    La,
  );
  // Away defense: goals conceded away vs league home scoring rate.
  const ad = shrunkStrength(
    input.awayDefensePlayed,
    input.awayDefenseObserved,
    k,
    Lh,
  );

  const muHome = Lh * ha.strength * ad.strength;
  const muAway = La * aa.strength * hd.strength;

  const anyBasePrior =
    ha.usedBasePrior ||
    hd.usedBasePrior ||
    aa.usedBasePrior ||
    ad.usedBasePrior;

  return {
    leagueHomeRate: Lh,
    leagueAwayRate: La,
    homeAttackPlayed: input.homeAttackPlayed,
    homeDefensePlayed: input.homeDefensePlayed,
    awayAttackPlayed: input.awayAttackPlayed,
    awayDefensePlayed: input.awayDefensePlayed,
    homeAttackObserved: input.homeAttackObserved,
    homeDefenseObserved: input.homeDefenseObserved,
    awayAttackObserved: input.awayAttackObserved,
    awayDefenseObserved: input.awayDefenseObserved,
    homeAttackStrength: ha.strength,
    homeDefenseStrength: hd.strength,
    awayAttackStrength: aa.strength,
    awayDefenseStrength: ad.strength,
    muHome,
    muAway,
    lowInformationFallbackUsed: anyBasePrior,
    teamEvidenceQuality: anyBasePrior ? "BASE_PRIOR" : "OBSERVED_SHRUNK",
  };
}

/** Min played across the four venue-role counts used in G1. */
export function minRelevantPlayed(c: {
  homeAttackPlayed: number;
  homeDefensePlayed: number;
  awayAttackPlayed: number;
  awayDefensePlayed: number;
}): number {
  return Math.min(
    c.homeAttackPlayed,
    c.homeDefensePlayed,
    c.awayAttackPlayed,
    c.awayDefensePlayed,
  );
}

export function evidenceSupportBucket(
  minPlayed: number,
  lowInformationFallbackUsed: boolean,
): "BASE_PRIOR" | "THIN" | "DEVELOPING" | "ESTABLISHED" {
  if (lowInformationFallbackUsed || minPlayed === 0) return "BASE_PRIOR";
  if (minPlayed <= 2) return "THIN";
  if (minPlayed <= 5) return "DEVELOPING";
  return "ESTABLISHED";
}
