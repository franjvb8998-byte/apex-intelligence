"use client";

import Image from "next/image";
import { useState } from "react";
import { cx } from "@/components/design-system/utils";

const SIZE_PX = {
  sm: 24,
  md: 32,
  lg: 72,
} as const;

export type TeamLogoSize = keyof typeof SIZE_PX;

export function teamLogoSrc(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

type TeamLogoProps = {
  src: string | null | undefined;
  name: string;
  shortName?: string | null;
  size?: TeamLogoSize;
  rounded?: "lg" | "full";
  className?: string;
};

function initials(name: string, shortName?: string | null): string {
  const fromShort = shortName?.trim();
  if (fromShort) return fromShort.slice(0, 3).toUpperCase();
  return name.trim().slice(0, 3).toUpperCase() || "?";
}

/**
 * Team crest from API-Football (`teams.home.logo` / `teams.away.logo`).
 * Falls back to initials when the URL is missing or fails to load.
 */
export function TeamLogo({
  src,
  name,
  shortName,
  size = "md",
  rounded = "lg",
  className,
}: TeamLogoProps) {
  const resolved = teamLogoSrc(src);
  const [failed, setFailed] = useState(false);
  const px = SIZE_PX[size];
  const showImage = Boolean(resolved) && !failed;

  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-[var(--apex-border)] bg-slate-950/60",
        rounded === "full"
          ? "rounded-full"
          : "rounded-[var(--apex-radius-lg)]",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {showImage ? (
        <Image
          src={resolved!}
          alt={`Escudo de ${name}`}
          width={px}
          height={px}
          loading="lazy"
          sizes={`${px}px`}
          className="object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="px-0.5 text-center font-mono font-bold leading-none text-[var(--apex-accent)]"
          style={{ fontSize: Math.max(9, Math.round(px * 0.32)) }}
          aria-hidden
        >
          {initials(name, shortName)}
        </span>
      )}
    </span>
  );
}
