/**
 * PE-4I.18 — Presence / missing / ambiguous audit by field + breakdowns.
 * Structural only — no feature-vs-outcome association.
 */

export type Pe4I18PresenceFieldStats = {
  field: string;
  rows: number;
  presentFinite: number;
  missingOrNull: number;
  nonFinite: number;
  presentShare: number;
};

export type Pe4I18PresenceBreakdownCell = {
  key: string;
  rows: number;
  meanPresentShare: number;
  fieldsWithPresentShareGe50: number;
  fieldsWithPresentShareLt10: number;
};

export type Pe4I18PresenceAudit = {
  rowCount: number;
  fieldCount: number;
  fields: Pe4I18PresenceFieldStats[];
  byCompetition: Pe4I18PresenceBreakdownCell[];
  bySeason: Pe4I18PresenceBreakdownCell[];
  byYear: Pe4I18PresenceBreakdownCell[];
  byWindow: Pe4I18PresenceBreakdownCell[];
  byVenue: Pe4I18PresenceBreakdownCell[];
  summary: {
    fieldsFullyPresent: number;
    fieldsSparsePresentShareLt10: number;
    fieldsPartial: number;
    meanPresentShareAcrossFields: number;
  };
};

type Acc = {
  present: number;
  missing: number;
  nonFinite: number;
  rows: number;
};

function emptyAcc(): Acc {
  return { present: 0, missing: 0, nonFinite: 0, rows: 0 };
}

function noteValue(acc: Acc, v: number): void {
  acc.rows += 1;
  if (Number.isFinite(v)) acc.present += 1;
  else if (Number.isNaN(v)) acc.missing += 1;
  else acc.nonFinite += 1;
}

/**
 * Accumulate presence for one row's allowlisted numerics.
 */
export function accumulatePresenceRow(
  state: {
    global: Map<string, Acc>;
    byCompetition: Map<string, Map<string, Acc>>;
    bySeason: Map<string, Map<string, Acc>>;
    byYear: Map<string, Map<string, Acc>>;
    byWindow: Map<string, Map<string, Acc>>;
    byVenue: Map<string, Map<string, Acc>>;
  },
  meta: {
    competition: string;
    providerSeason: string;
    kickoffUtc: string;
    windowId: string;
    venueMode: string;
  },
  numerics: Record<string, number>,
): void {
  const year =
    typeof meta.kickoffUtc === "string" && meta.kickoffUtc.length >= 4
      ? meta.kickoffUtc.slice(0, 4)
      : "unknown";

  const ensure = (
    map: Map<string, Map<string, Acc>>,
    key: string,
  ): Map<string, Acc> => {
    let inner = map.get(key);
    if (!inner) {
      inner = new Map();
      map.set(key, inner);
    }
    return inner;
  };

  const bump = (accMap: Map<string, Acc>, field: string, v: number) => {
    let a = accMap.get(field);
    if (!a) {
      a = emptyAcc();
      accMap.set(field, a);
    }
    noteValue(a, v);
  };

  for (const [field, v] of Object.entries(numerics)) {
    bump(state.global, field, v);
    bump(ensure(state.byCompetition, meta.competition), field, v);
    bump(ensure(state.bySeason, meta.providerSeason), field, v);
    bump(ensure(state.byYear, year), field, v);
    bump(ensure(state.byWindow, meta.windowId), field, v);
    bump(ensure(state.byVenue, meta.venueMode), field, v);
  }
}

export function createPresenceAccumulator(): {
  global: Map<string, Acc>;
  byCompetition: Map<string, Map<string, Acc>>;
  bySeason: Map<string, Map<string, Acc>>;
  byYear: Map<string, Map<string, Acc>>;
  byWindow: Map<string, Map<string, Acc>>;
  byVenue: Map<string, Map<string, Acc>>;
  rowCount: number;
} {
  return {
    global: new Map(),
    byCompetition: new Map(),
    bySeason: new Map(),
    byYear: new Map(),
    byWindow: new Map(),
    byVenue: new Map(),
    rowCount: 0,
  };
}

function finalizeField(field: string, a: Acc): Pe4I18PresenceFieldStats {
  const presentShare = a.rows === 0 ? 0 : a.present / a.rows;
  return {
    field,
    rows: a.rows,
    presentFinite: a.present,
    missingOrNull: a.missing,
    nonFinite: a.nonFinite,
    presentShare,
  };
}

function finalizeBreakdown(
  map: Map<string, Map<string, Acc>>,
): Pe4I18PresenceBreakdownCell[] {
  const cells: Pe4I18PresenceBreakdownCell[] = [];
  for (const [key, fields] of [...map.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const stats = [...fields.values()];
    const rows = stats[0]?.rows ?? 0;
    const shares = [...fields.values()].map((a) =>
      a.rows === 0 ? 0 : a.present / a.rows,
    );
    const meanPresentShare =
      shares.length === 0
        ? 0
        : shares.reduce((s, x) => s + x, 0) / shares.length;
    cells.push({
      key,
      rows,
      meanPresentShare,
      fieldsWithPresentShareGe50: shares.filter((s) => s >= 0.5).length,
      fieldsWithPresentShareLt10: shares.filter((s) => s < 0.1).length,
    });
  }
  return cells;
}

export function finalizePresenceAudit(state: {
  global: Map<string, Acc>;
  byCompetition: Map<string, Map<string, Acc>>;
  bySeason: Map<string, Map<string, Acc>>;
  byYear: Map<string, Map<string, Acc>>;
  byWindow: Map<string, Map<string, Acc>>;
  byVenue: Map<string, Map<string, Acc>>;
  rowCount: number;
}): Pe4I18PresenceAudit {
  const fields = [...state.global.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([field, a]) => finalizeField(field, a));

  const meanPresentShareAcrossFields =
    fields.length === 0
      ? 0
      : fields.reduce((s, f) => s + f.presentShare, 0) / fields.length;

  return {
    rowCount: state.rowCount,
    fieldCount: fields.length,
    fields,
    byCompetition: finalizeBreakdown(state.byCompetition),
    bySeason: finalizeBreakdown(state.bySeason),
    byYear: finalizeBreakdown(state.byYear),
    byWindow: finalizeBreakdown(state.byWindow),
    byVenue: finalizeBreakdown(state.byVenue),
    summary: {
      fieldsFullyPresent: fields.filter((f) => f.presentShare >= 0.999)
        .length,
      fieldsSparsePresentShareLt10: fields.filter((f) => f.presentShare < 0.1)
        .length,
      fieldsPartial: fields.filter(
        (f) => f.presentShare >= 0.1 && f.presentShare < 0.999,
      ).length,
      meanPresentShareAcrossFields,
    },
  };
}
