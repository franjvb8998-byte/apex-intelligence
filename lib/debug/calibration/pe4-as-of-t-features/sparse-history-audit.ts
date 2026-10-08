/**
 * PE-4I.18 — Sparse-history depth audit.
 * NO_HISTORY / ONE / TWO / SUFFICIENT_3_PLUS vs window / venue / competition.
 */

export type Pe4I18HistoryDepthBucket =
  | "NO_HISTORY"
  | "ONE"
  | "TWO"
  | "SUFFICIENT_3_PLUS";

export type Pe4I18SparseHistoryCell = {
  key: string;
  NO_HISTORY: number;
  ONE: number;
  TWO: number;
  SUFFICIENT_3_PLUS: number;
  rows: number;
};

export type Pe4I18SparseHistoryAudit = {
  overall: Record<Pe4I18HistoryDepthBucket, number> & { rows: number };
  byWindow: Pe4I18SparseHistoryCell[];
  byVenue: Pe4I18SparseHistoryCell[];
  byCompetition: Pe4I18SparseHistoryCell[];
};

function bucket(obs: number): Pe4I18HistoryDepthBucket {
  if (!Number.isFinite(obs) || obs <= 0) return "NO_HISTORY";
  if (obs === 1) return "ONE";
  if (obs === 2) return "TWO";
  return "SUFFICIENT_3_PLUS";
}

type Cell = Record<Pe4I18HistoryDepthBucket, number> & { rows: number };

function emptyCell(): Cell {
  return {
    NO_HISTORY: 0,
    ONE: 0,
    TWO: 0,
    SUFFICIENT_3_PLUS: 0,
    rows: 0,
  };
}

export type Pe4I18SparseHistoryState = {
  overall: Cell;
  byWindow: Map<string, Cell>;
  byVenue: Map<string, Cell>;
  byCompetition: Map<string, Cell>;
};

export function createSparseHistoryState(): Pe4I18SparseHistoryState {
  return {
    overall: emptyCell(),
    byWindow: new Map(),
    byVenue: new Map(),
    byCompetition: new Map(),
  };
}

function bump(cell: Cell, b: Pe4I18HistoryDepthBucket): void {
  cell[b] += 1;
  cell.rows += 1;
}

export function accumulateSparseHistory(
  state: Pe4I18SparseHistoryState,
  meta: { windowId: string; venueMode: string; competition: string },
  observationCount: number,
): void {
  const b = bucket(observationCount);
  bump(state.overall, b);

  const ensure = (map: Map<string, Cell>, key: string) => {
    let c = map.get(key);
    if (!c) {
      c = emptyCell();
      map.set(key, c);
    }
    return c;
  };
  bump(ensure(state.byWindow, meta.windowId), b);
  bump(ensure(state.byVenue, meta.venueMode), b);
  bump(ensure(state.byCompetition, meta.competition), b);
}

function finalizeMap(map: Map<string, Cell>): Pe4I18SparseHistoryCell[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, c]) => ({
      key,
      NO_HISTORY: c.NO_HISTORY,
      ONE: c.ONE,
      TWO: c.TWO,
      SUFFICIENT_3_PLUS: c.SUFFICIENT_3_PLUS,
      rows: c.rows,
    }));
}

export function finalizeSparseHistory(
  state: Pe4I18SparseHistoryState,
): Pe4I18SparseHistoryAudit {
  return {
    overall: { ...state.overall },
    byWindow: finalizeMap(state.byWindow),
    byVenue: finalizeMap(state.byVenue),
    byCompetition: finalizeMap(state.byCompetition),
  };
}
