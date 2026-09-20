/**
 * Process-local live fixture store.
 *
 * LIMITATION (Phase 2A.1): this is in-process memory only. It is not a
 * cross-instance lock or shared cache. `singleFlightApiFootball` is also
 * process-local. Multiple server instances would each talk to API-Football
 * independently. Replace this implementation with a shared store / single-writer
 * later without changing VisionLiveTransport callers.
 */

import { shouldKeepLiveTracking } from "@/lib/apex-vision/live/status";
import type { LiveFixtureState } from "@/lib/apex-vision/live/types";

export type LiveStore = {
  readAll(): LiveFixtureState[];
  read(fixtureId: number): LiveFixtureState | null;
  writeMany(fixtures: LiveFixtureState[]): void;
  remove(fixtureId: number): void;
  dropTerminalAndNonLive(): LiveFixtureState[];
};

export function createProcessLiveStore(): LiveStore {
  const byId = new Map<number, LiveFixtureState>();
  return {
    readAll() {
      return [...byId.values()];
    },
    read(fixtureId) {
      return byId.get(fixtureId) ?? null;
    },
    writeMany(fixtures) {
      for (const fixture of fixtures) {
        if (fixture.fixtureId <= 0) continue;
        byId.set(fixture.fixtureId, fixture);
      }
    },
    remove(fixtureId) {
      byId.delete(fixtureId);
    },
    dropTerminalAndNonLive() {
      const dropped: LiveFixtureState[] = [];
      for (const [id, fixture] of byId) {
        if (!shouldKeepLiveTracking(fixture.statusShort)) {
          dropped.push(fixture);
          byId.delete(id);
        }
      }
      return dropped;
    },
  };
}
