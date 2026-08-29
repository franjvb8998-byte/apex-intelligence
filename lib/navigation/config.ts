/**
 * Product navigation — ids and hrefs only. Visible labels live in locale files.
 */

export const NAV_IDS = [
  "scanner",
  "feed",
  "smart-combos",
  "match-center",
  "dashboard",
  "bankroll",
  "portfolio",
  "lab",
  "copilot",
  "match-analysis",
  "match-live",
  "showcase",
  "design-system",
] as const;

export type NavId = (typeof NAV_IDS)[number];

export const PLAIN_NAV_KEYS = ["apex", "match", "matchCenterTm"] as const;

export type PlainNavKey = (typeof PLAIN_NAV_KEYS)[number];

export type NavLabelKey = NavId | PlainNavKey;

export type CommandActionKey =
  | "openScanner"
  | "openFeed"
  | "openLab"
  | "openCombos"
  | "newCopilot";

export type NavItem = {
  id: NavId;
  href: string;
  keywords?: string[];
};

export type BreadcrumbItem = {
  key: string;
  href?: string;
};

export function isNavId(value: string): value is NavId {
  return (NAV_IDS as readonly string[]).includes(value);
}

export function isPlainNavKey(value: string): value is PlainNavKey {
  return (PLAIN_NAV_KEYS as readonly string[]).includes(value);
}

export const PRIMARY_NAV: NavItem[] = [
  {
    id: "scanner",
    href: "/scanner",
    keywords: ["scanner", "home", "opportunities", "value", "ev", "apex", "picks", "desk"],
  },
  {
    id: "feed",
    href: "/feed",
    keywords: ["feed", "terminal", "bloomberg"],
  },
  {
    id: "smart-combos",
    href: "/smart-combos",
    keywords: ["combo", "accumulator", "acca", "builder", "kelly", "monte carlo"],
  },
  {
    id: "match-center",
    href: "/match-center",
    keywords: ["match", "analysis", "preview", "ev"],
  },
  {
    id: "dashboard",
    href: "/dashboard",
    keywords: ["home", "overview"],
  },
  {
    id: "bankroll",
    href: "/bankroll",
    keywords: ["bankroll", "stakes", "roi", "yield"],
  },
  {
    id: "portfolio",
    href: "/portfolio",
    keywords: ["portfolio", "exposure", "risk", "kelly", "diversification"],
  },
  {
    id: "lab",
    href: "/lab",
    keywords: ["lab", "research", "backtest", "models", "quant", "explainability"],
  },
  {
    id: "copilot",
    href: "/copilot",
    keywords: ["chat", "assistant"],
  },
  {
    id: "match-analysis",
    href: "/match-analysis",
    keywords: ["1x2", "markets", "score"],
  },
  {
    id: "match-live",
    href: "/match-live",
    keywords: ["vision", "live", "pitch"],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    id: "showcase",
    href: "/apex-showcase",
    keywords: ["demo", "roadmap"],
  },
  {
    id: "design-system",
    href: "/design-system",
    keywords: ["ds", "ui", "tokens"],
  },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  "/scanner": [{ key: "scanner" }],
  "/feed": [{ key: "feed" }],
  "/dashboard": [{ key: "dashboard" }],
  "/opportunities": [{ key: "scanner" }],
  "/smart-combos": [
    { key: "dashboard", href: "/dashboard" },
    { key: "smart-combos" },
  ],
  "/apex-opportunities": [{ key: "scanner" }],
  "/match-center": [
    { key: "dashboard", href: "/dashboard" },
    { key: "matchCenterTm" },
  ],
  "/copilot": [
    { key: "dashboard", href: "/dashboard" },
    { key: "copilot" },
  ],
  "/bankroll": [
    { key: "dashboard", href: "/dashboard" },
    { key: "bankroll" },
  ],
  "/portfolio": [
    { key: "dashboard", href: "/dashboard" },
    { key: "portfolio" },
  ],
  "/lab": [
    { key: "dashboard", href: "/dashboard" },
    { key: "lab" },
  ],
  "/match-analysis": [
    { key: "matchCenterTm", href: "/match-center" },
    { key: "match-analysis" },
  ],
  "/match-live": [
    { key: "matchCenterTm", href: "/match-center" },
    { key: "match-live" },
  ],
  "/apex-showcase": [
    { key: "dashboard", href: "/dashboard" },
    { key: "showcase" },
  ],
  "/design-system": [
    { key: "dashboard", href: "/dashboard" },
    { key: "design-system" },
  ],
};

export function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith("/match-analysis/")) {
    return [
      { key: "dashboard", href: "/dashboard" },
      { key: "match-analysis", href: "/match-analysis" },
      { key: "match" },
    ];
  }
  if (pathname.startsWith("/match-center/")) {
    return [
      { key: "dashboard", href: "/dashboard" },
      { key: "matchCenterTm", href: "/match-center" },
      { key: "match" },
    ];
  }
  if (pathname === "/match-center") {
    return BREADCRUMB_MAP["/match-center"]!;
  }
  const exact = BREADCRUMB_MAP[pathname];
  if (exact) return exact;
  const base = pathname.split("/").filter(Boolean)[0];
  if (!base) return [{ key: "apex" }];
  return [{ key: "dashboard", href: "/dashboard" }, { key: base }];
}

export function titleKeyForPath(pathname: string): NavId | "apex" {
  if (pathname.startsWith("/scanner")) return "scanner";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/opportunities")) return "scanner";
  if (pathname.startsWith("/smart-combos")) return "smart-combos";
  if (pathname.startsWith("/apex-opportunities")) return "scanner";
  if (pathname.startsWith("/match-center")) return "match-center";
  if (pathname.startsWith("/match-analysis")) return "match-analysis";
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (pathname.startsWith("/lab")) return "lab";
  const item = ALL_NAV.find((n) => n.href === pathname);
  return item?.id ?? "apex";
}

/** @deprecated Use titleKeyForPath — kept for call sites that still expect a key. */
export function titleForPath(pathname: string): string {
  return titleKeyForPath(pathname);
}

export type CommandItem = {
  id: string;
  href?: string;
  group: "navigation" | "actions" | "search";
  navId?: NavId;
  actionKey?: CommandActionKey;
};

export function buildCommandItems(): CommandItem[] {
  return [
    ...ALL_NAV.map((item) => ({
      id: `nav-${item.id}`,
      href: item.href,
      group: "navigation" as const,
      navId: item.id,
    })),
    {
      id: "action-open-scanner",
      href: "/scanner",
      group: "actions",
      actionKey: "openScanner",
    },
    {
      id: "action-open-feed",
      href: "/feed",
      group: "actions",
      actionKey: "openFeed",
    },
    {
      id: "action-open-lab",
      href: "/lab",
      group: "actions",
      actionKey: "openLab",
    },
    {
      id: "action-open-combos",
      href: "/smart-combos",
      group: "actions",
      actionKey: "openCombos",
    },
    {
      id: "action-new-analysis",
      href: "/copilot",
      group: "actions",
      actionKey: "newCopilot",
    },
  ];
}
