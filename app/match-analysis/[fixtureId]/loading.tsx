import { LoadingState } from "@/components/app-shell/states";

export default function MatchAnalysisFixtureLoading() {
  return <LoadingState label="Cargando análisis del partido…" rows={4} />;
}
