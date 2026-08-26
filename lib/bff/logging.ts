/**
 * Structured logging for BFF route handlers.
 */

export type BffLogLevel = "info" | "warn" | "error";

export type BffLogEvent = {
  level: BffLogLevel;
  message: string;
  requestId: string;
  path?: string;
  method?: string;
  status?: number;
  provider?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
};

export function logBffEvent(event: BffLogEvent): void {
  const line = JSON.stringify({
    scope: "bff",
    ts: new Date().toISOString(),
    ...event,
  });

  if (event.level === "error") {
    console.error(line);
    return;
  }
  if (event.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}
