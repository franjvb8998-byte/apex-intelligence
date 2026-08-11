import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";

const features = [
  {
    icon: "📊",
    title: "Dashboard Inteligente",
    description:
      "Visualiza tu rendimiento en tiempo real con métricas claras y accionables.",
  },
  {
    icon: "🤖",
    title: "IA Predictiva",
    description:
      "Modelos de inteligencia artificial que anticipan tendencias y oportunidades.",
  },
  {
    icon: "📈",
    title: "Estadísticas Avanzadas",
    description:
      "Análisis profundo de patrones, ROI y desempeño histórico de tus apuestas.",
  },
  {
    icon: "🛡",
    title: "Auditoría de Apuestas",
    description:
      "Revisa y valida cada decisión con trazabilidad completa de tu historial.",
  },
];

export default function Home() {
  return (
    <PageShell>
      <div className="w-full">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-[#00D4AA]/20 bg-[#00D4AA]/10 px-4 py-1.5 text-sm text-[#00D4AA]">
            Plataforma de análisis deportivo
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            La inteligencia que{" "}
            <span className="bg-gradient-to-r from-[#00D4AA] to-[#00a888] bg-clip-text text-transparent">
              transforma
            </span>{" "}
            tus apuestas.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Analiza tu historial, mide tu rendimiento y toma decisiones basadas
            en datos.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink href="/register" fullWidth className="sm:w-auto">
              Comenzar
            </ButtonLink>
            <ButtonLink
              href="/login"
              variant="secondary"
              fullWidth
              className="sm:w-auto"
            >
              Iniciar sesión
            </ButtonLink>
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[#00D4AA]/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-[#00D4AA]/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00D4AA]/10 text-2xl transition-colors group-hover:bg-[#00D4AA]/20">
                  {feature.icon}
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </p>
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA]/0 to-transparent transition-all group-hover:via-[#00D4AA]/50"
                />
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
