import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { getShellUser } from "@/lib/auth/get-shell-user";

export default async function Home() {
  const user = await getShellUser();
  if (user?.id) {
    redirect("/scanner");
  }

  const t = await getTranslations("home");
  const features = [
    {
      icon: "◎",
      title: t("features.scannerTitle"),
      description: t("features.scannerDescription"),
    },
    {
      icon: "🤖",
      title: t("features.copilotTitle"),
      description: t("features.copilotDescription"),
    },
    {
      icon: "📈",
      title: t("features.matchCenterTitle"),
      description: t("features.matchCenterDescription"),
    },
    {
      icon: "🛡",
      title: t("features.portfolioTitle"),
      description: t("features.portfolioDescription"),
    },
  ];

  return (
    <PageShell>
      <div className="w-full">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-[#00D4AA]/20 bg-[#00D4AA]/10 px-4 py-1.5 text-sm text-[#00D4AA]">
            {t("badge")}
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("headlineBefore")}{" "}
            <span className="bg-gradient-to-r from-[#00D4AA] to-[#00a888] bg-clip-text text-transparent">
              {t("headlineHighlight")}
            </span>{" "}
            {t("headlineAfter")}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            {t("subheadline")}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink href="/register" fullWidth className="sm:w-auto">
              {t("ctaStart")}
            </ButtonLink>
            <ButtonLink
              href="/login"
              variant="secondary"
              fullWidth
              className="sm:w-auto"
            >
              {t("ctaSignIn")}
            </ButtonLink>
            <ButtonLink
              href="/scanner"
              variant="secondary"
              fullWidth
              className="sm:w-auto"
            >
              {t("ctaOpenProduct")}
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
