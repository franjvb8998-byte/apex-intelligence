"use client";

import { useEffect, useState } from "react";

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

export function FeedClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setNow(stamp(new Date()));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      suppressHydrationWarning
      className="font-mono text-[11px] tabular-nums text-[var(--apex-accent)]"
    >
      {now ?? "LIVE"}
    </p>
  );
}
