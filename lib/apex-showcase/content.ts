/**
 * Static showcase content — presentation only, no business logic.
 */

export type SystemHealthStatus = "running" | "mock" | "pending";

export type SystemHealthItem = {
  id: string;
  name: string;
  status: SystemHealthStatus;
  detail: string;
};

export const SYSTEM_HEALTH: SystemHealthItem[] = [
  {
    id: "probability",
    name: "Probability Engine",
    status: "running",
    detail: "Elo × Poisson hybrid",
  },
  {
    id: "learning",
    name: "Learning Engine",
    status: "running",
    detail: "Post-match evaluation loop",
  },
  {
    id: "data-platform",
    name: "Data Platform",
    status: "running",
    detail: "IDataProvider + factory",
  },
  {
    id: "bff",
    name: "Backend for Frontend",
    status: "running",
    detail: "/api fixtures · teams · …",
  },
  {
    id: "providers",
    name: "API Providers",
    status: "mock",
    detail: "Mock default · API-Football ready",
  },
  {
    id: "graph",
    name: "Knowledge Graph",
    status: "pending",
    detail: "Offline analytics layer",
  },
  {
    id: "match-center",
    name: "Match Center",
    status: "running",
    detail: "Preview · Live · Post",
  },
  {
    id: "vision",
    name: "Vision",
    status: "mock",
    detail: "Pitch + momentum simulation",
  },
  {
    id: "timeline",
    name: "Timeline",
    status: "running",
    detail: "DS + Vision chronology",
  },
];

export const ARCHITECTURE_FLOW = [
  "Frontend",
  "Match Center",
  "BFF",
  "Data Platform",
  "Provider Factory",
  "Probability Engine",
  "Learning Engine",
  "Knowledge Graph",
] as const;

export type RoadmapStatus = "done" | "active" | "todo";

export type RoadmapItem = {
  id: string;
  label: string;
  status: RoadmapStatus;
};

export const ROADMAP: RoadmapItem[] = [
  { id: "login", label: "Login", status: "done" },
  { id: "dashboard", label: "Dashboard", status: "done" },
  { id: "match-center", label: "Match Center", status: "done" },
  { id: "probability", label: "Probability Engine", status: "done" },
  { id: "data-platform", label: "Data Platform", status: "done" },
  { id: "bff", label: "BFF", status: "done" },
  { id: "api-integration", label: "API Integration", status: "active" },
  { id: "real-data", label: "Real Data", status: "todo" },
  { id: "explainability", label: "Explainability", status: "todo" },
  { id: "mission-control", label: "Mission Control", status: "todo" },
  { id: "ai-copilot", label: "AI Copilot", status: "todo" },
];

/** Mock platform metrics for internal visibility. */
export const SHOWCASE_STATS = [
  { id: "modules", label: "Módulos", value: 14 },
  { id: "components", label: "Componentes", value: 42 },
  { id: "providers", label: "Providers", value: 4 },
  { id: "endpoints", label: "Endpoints", value: 5 },
  { id: "tests", label: "Tests", value: 62 },
  { id: "pages", label: "Páginas", value: 10 },
] as const;

export const SHOWCASE_VERSION = "Alpha";
