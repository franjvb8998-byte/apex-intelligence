import { LoadingState } from "@/components/app-shell/states";

export default function BankrollLoading() {
  return <LoadingState label="Cargando bankroll…" rows={4} />;
}
