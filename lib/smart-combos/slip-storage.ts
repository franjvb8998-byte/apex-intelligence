/**
 * Persist a combo slip between the Opportunity Scanner and Smart Combos.
 */

export const COMBO_SLIP_STORAGE_KEY = "apex:combo-slip";

function unique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function parseComboSlip(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return unique(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return [];
  }
}

export function serializeComboSlip(ids: string[]): string {
  return JSON.stringify(unique(ids));
}

export function readComboSlip(): string[] {
  if (typeof window === "undefined") return [];
  return parseComboSlip(window.sessionStorage.getItem(COMBO_SLIP_STORAGE_KEY));
}

export function writeComboSlip(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(COMBO_SLIP_STORAGE_KEY, serializeComboSlip(ids));
}
