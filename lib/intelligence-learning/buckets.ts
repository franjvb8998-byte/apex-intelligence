export type NamedBucket = {
  key: string;
  min: number;
  max: number;
};

export const APEX_SCORE_BUCKETS: NamedBucket[] = [
  { key: "0-49", min: 0, max: 50 },
  { key: "50-59", min: 50, max: 60 },
  { key: "60-69", min: 60, max: 70 },
  { key: "70-79", min: 70, max: 80 },
  { key: "80-89", min: 80, max: 90 },
  { key: "90-100", min: 90, max: 101 },
];

export const CONFIDENCE_BUCKETS: NamedBucket[] = [
  { key: "0-39", min: 0, max: 40 },
  { key: "40-59", min: 40, max: 60 },
  { key: "60-69", min: 60, max: 70 },
  { key: "70-79", min: 70, max: 80 },
  { key: "80-89", min: 80, max: 90 },
  { key: "90-100", min: 90, max: 101 },
];

export function bucketKey(
  value: number | null,
  buckets: NamedBucket[],
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const hit = buckets.find((row) => value >= row.min && value < row.max);
  return hit?.key ?? buckets[buckets.length - 1]?.key ?? null;
}
