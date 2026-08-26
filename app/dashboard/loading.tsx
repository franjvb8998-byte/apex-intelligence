import { LoadingState } from "@/components/app-shell/states";

export default function DashboardLoading() {
  return <LoadingState label="Cargando Dashboard…" rows={4} />;
}
