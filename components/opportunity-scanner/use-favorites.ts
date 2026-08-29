"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseScannerFavorites,
  SCANNER_FAVORITES_KEY,
  serializeScannerFavorites,
  toggleFavoriteName,
  type ScannerFavorites,
} from "@/lib/opportunity-scanner/favorites";

export function useScannerFavorites() {
  const [favorites, setFavorites] = useState<ScannerFavorites>({
    leagues: [],
    teams: [],
  });

  useEffect(() => {
    // Client-only store; empty on the server so the first paint matches SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydrate
    setFavorites(
      parseScannerFavorites(window.localStorage.getItem(SCANNER_FAVORITES_KEY)),
    );
  }, []);

  const toggleLeague = useCallback((name: string) => {
    setFavorites((current) => {
      const next = {
        ...current,
        leagues: toggleFavoriteName(current.leagues, name),
      };
      window.localStorage.setItem(
        SCANNER_FAVORITES_KEY,
        serializeScannerFavorites(next),
      );
      return next;
    });
  }, []);

  const toggleTeam = useCallback((name: string) => {
    setFavorites((current) => {
      const next = {
        ...current,
        teams: toggleFavoriteName(current.teams, name),
      };
      window.localStorage.setItem(
        SCANNER_FAVORITES_KEY,
        serializeScannerFavorites(next),
      );
      return next;
    });
  }, []);

  return {
    leagues: favorites.leagues,
    teams: favorites.teams,
    hasLeague: useCallback(
      (name: string) => favorites.leagues.includes(name),
      [favorites.leagues],
    ),
    hasTeam: useCallback(
      (name: string) => favorites.teams.includes(name),
      [favorites.teams],
    ),
    toggleLeague,
    toggleTeam,
  };
}
