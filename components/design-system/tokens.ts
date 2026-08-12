/**
 * Token reference for TypeScript consumers.
 * CSS variables in app/globals.css remain the runtime source of truth.
 */
export const apexTokens = {
  color: {
    bg: "var(--apex-bg)",
    surface: "var(--apex-surface)",
    accent: "var(--apex-accent)",
    danger: "var(--apex-danger)",
    warning: "var(--apex-warning)",
    fg: "var(--apex-fg)",
    fgMuted: "var(--apex-fg-muted)",
  },
  radius: {
    md: "var(--apex-radius-md)",
    xl: "var(--apex-radius-xl)",
    "2xl": "var(--apex-radius-2xl)",
  },
  duration: {
    fast: "var(--apex-duration-fast)",
    normal: "var(--apex-duration-normal)",
    slow: "var(--apex-duration-slow)",
    bar: "var(--apex-duration-bar)",
  },
} as const;

export type ApexTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
export type ApexSize = "sm" | "md" | "lg";
