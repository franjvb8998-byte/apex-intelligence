/**
 * Mock notifications for product shell (UX only).
 */

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Partido destacado listo",
    body: "Match Center actualizó el partido del día vía Data Platform.",
    createdAt: "2026-08-12T15:00:00.000Z",
    read: false,
    href: "/match-center",
  },
  {
    id: "n2",
    title: "Copilot demo",
    body: "La UI del asistente está disponible en /copilot (sin OpenAI).",
    createdAt: "2026-08-12T14:20:00.000Z",
    read: false,
    href: "/copilot",
  },
  {
    id: "n3",
    title: "Sistema en mock",
    body: "Sin API_FOOTBALL_KEY el Dashboard usa el provider mock.",
    createdAt: "2026-08-12T10:05:00.000Z",
    read: true,
    href: "/dashboard",
  },
];
