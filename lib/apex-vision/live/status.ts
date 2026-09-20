/**
 * Honest classification of API-Football status.short values.
 * Does not treat postponed / cancelled / abandoned / suspended as scheduled.
 */

export type LiveStatusKind =
  | "live"
  | "halftime"
  | "terminal"
  | "scheduled"
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "suspended"
  | "interrupted"
  | "other";

export type LiveStatusCopyKey =
  | "status1H"
  | "statusHT"
  | "status2H"
  | "statusET"
  | "statusBT"
  | "statusP"
  | "statusLIVE"
  | "statusFT"
  | "statusAET"
  | "statusPEN"
  | "statusPST"
  | "statusCANC"
  | "statusABD"
  | "statusSUSP"
  | "statusNS"
  | "statusTBD"
  | "statusINT"
  | "statusOther";

const LIVE_SHORT = new Set(["1H", "2H", "ET", "BT", "P", "LIVE"]);
const TERMINAL_SHORT = new Set(["FT", "AET", "PEN"]);
const CANCELLED_SHORT = new Set(["CANC", "AWD", "WO"]);

const COPY_BY_SHORT: Record<string, LiveStatusCopyKey> = {
  "1H": "status1H",
  HT: "statusHT",
  "2H": "status2H",
  ET: "statusET",
  BT: "statusBT",
  P: "statusP",
  LIVE: "statusLIVE",
  FT: "statusFT",
  AET: "statusAET",
  PEN: "statusPEN",
  PST: "statusPST",
  CANC: "statusCANC",
  ABD: "statusABD",
  SUSP: "statusSUSP",
  NS: "statusNS",
  TBD: "statusTBD",
  INT: "statusINT",
};

export function classifyLiveStatus(statusShort: string | null | undefined): LiveStatusKind {
  if (statusShort == null || statusShort === "") return "other";
  const short = statusShort.trim().toUpperCase();
  if (LIVE_SHORT.has(short)) return "live";
  if (short === "HT") return "halftime";
  if (TERMINAL_SHORT.has(short)) return "terminal";
  if (short === "NS" || short === "TBD") return "scheduled";
  if (short === "PST") return "postponed";
  if (short === "ABD") return "abandoned";
  if (CANCELLED_SHORT.has(short)) return "cancelled";
  if (short === "SUSP") return "suspended";
  if (short === "INT") return "interrupted";
  return "other";
}

/** User-facing copy key. 1H and 2H stay distinct even though both kind=live. */
export function liveStatusCopyKey(
  statusShort: string | null | undefined,
): LiveStatusCopyKey {
  if (statusShort == null || statusShort === "") return "statusOther";
  return COPY_BY_SHORT[statusShort.trim().toUpperCase()] ?? "statusOther";
}

export function isOrdinaryScheduledStatus(
  statusShort: string | null | undefined,
): boolean {
  return classifyLiveStatus(statusShort) === "scheduled";
}

export function isLiveStatus(statusShort: string | null | undefined): boolean {
  return classifyLiveStatus(statusShort) === "live";
}

export function isHalftimeStatus(statusShort: string | null | undefined): boolean {
  return classifyLiveStatus(statusShort) === "halftime";
}

export function isTerminalStatus(statusShort: string | null | undefined): boolean {
  return classifyLiveStatus(statusShort) === "terminal";
}

/**
 * Recurring live tracking is only for in-play and HT.
 * Terminal fixtures must be dropped. PST/CANC/ABD/SUSP are not scheduled matches.
 */
export function shouldKeepLiveTracking(
  statusShort: string | null | undefined,
): boolean {
  const kind = classifyLiveStatus(statusShort);
  return kind === "live" || kind === "halftime";
}
