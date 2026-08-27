import { LoadingState } from "@/components/app-shell/states";

export default function MatchAnalysisLoading() {
  return <LoadingState label="Cargando Match Analysis…" rows={4} />;
}
