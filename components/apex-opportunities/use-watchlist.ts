"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseWatchlist,
  serializeWatchlist,
  toggleWatchlistId,
  WATCHLIST_STORAGE_KEY,
} from "@/lib/apex-opportunities/watchlist";

export function useWatchlist() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(parseWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)));
  }, []);

  const has = useCallback((fixtureId: string) => ids.includes(fixtureId), [ids]);

  const toggle = useCallback((fixtureId: string) => {
    setIds((current) => {
      const next = toggleWatchlistId(current, fixtureId);
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, serializeWatchlist(next));
      return next;
    });
  }, []);

  return { ids, has, toggle };
}
