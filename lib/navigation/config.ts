/**
 * Product navigation — UX only (Release 0.1).
 */

export type NavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  keywords?: string[];
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export const PRIMARY_NAV: NavItem[] = [
  {
    id: "match-center",
    label: "Match Center",
    href: "/match-center",
    description: "Dashboard del partido",
    keywords: ["partido", "analisis", "preview", "ev"],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    description: "Partidos, ligas y estado del sistema",
    keywords: ["home", "inicio", "overview"],
  },
  {
    id: "copilot",
    label: "Copilot",
    href: "/copilot",
    description: "Asistente APEX (demo UI)",
    keywords: ["chat", "ia", "assistant"],
  },
  {
    id: "match-analysis",
    label: "Match Analysis",
    href: "/match-analysis",
    description: "Probabilidades y explicación",
    keywords: ["1x2", "markets", "score"],
  },
  {
    id: "match-live",
    label: "APEX Vision",
    href: "/match-live",
    description: "Campo en vivo y momentum",
    keywords: ["vision", "live", "pitch"],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    id: "showcase",
    label: "Showcase",
    href: "/apex-showcase",
    description: "Vista interna del sistema",
    keywords: ["demo", "roadmap"],
  },
  {
    id: "design-system",
    label: "Design System",
    href: "/design-system",
    description: "Tokens y componentes",
    keywords: ["ds", "ui", "tokens"],
  },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  "/dashboard": [{ label: "Dashboard" }],
  "/match-center": [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Match Center™" },
  ],
  "/copilot": [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Copilot" },
  ],
  "/match-analysis": [
    { label: "Match Center™", href: "/match-center" },
    { label: "Match Analysis" },
  ],
  "/match-live": [
    { label: "Match Center™", href: "/match-center" },
    { label: "APEX Vision" },
  ],
  "/apex-showcase": [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Showcase" },
  ],
  "/design-system": [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Design System" },
  ],
};

export function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith("/match-analysis/")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Match Analysis", href: "/match-analysis" },
      { label: "Partido" },
    ];
  }
  if (pathname.startsWith("/match-center/")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Match Center™", href: "/match-center" },
      { label: "Partido" },
    ];
  }
  if (pathname === "/match-center") {
    return BREADCRUMB_MAP["/match-center"]!;
  }
  const exact = BREADCRUMB_MAP[pathname];
  if (exact) return exact;
  const base = pathname.split("/").filter(Boolean)[0];
  if (!base) return [{ label: "APEX" }];
  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: base },
  ];
}

export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/match-center")) return "Match Center";
  if (pathname.startsWith("/match-analysis")) return "Match Analysis";
  const item = ALL_NAV.find((n) => n.href === pathname);
  return item?.label ?? "APEX";
}

export type CommandItem = {
  id: string;
  label: string;
  href?: string;
  hint?: string;
  group: "Navegación" | "Acciones" | "Búsqueda";
};

export function buildCommandItems(): CommandItem[] {
  return [
    ...ALL_NAV.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      href: item.href,
      hint: item.description,
      group: "Navegación" as const,
    })),
    {
      id: "action-new-analysis",
      label: "Nuevo análisis en Copilot",
      href: "/copilot",
      hint: "Abrir asistente",
      group: "Acciones",
    },
  ];
}
