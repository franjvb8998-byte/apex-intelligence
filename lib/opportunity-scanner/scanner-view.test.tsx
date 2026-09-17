import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { ScannerView } from "@/components/opportunity-scanner/scanner-view";
import { opportunityFixture } from "@/lib/apex-opportunities/fixture";
import { buildScannerRankings } from "@/lib/opportunity-scanner/ranking";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    prefetch: () => undefined,
  }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) {
    return createElement("a", { href, ...props }, children);
  },
}));

function renderScanner(
  analyzed: ReturnType<typeof opportunityFixture>[],
  quotaExhausted: boolean,
) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <ScannerView
        analyzed={analyzed}
        generatedAt="2026-08-28T15:00:00.000Z"
        leagues={["Premier League"]}
        countries={["England"]}
        rankings={buildScannerRankings(analyzed)}
        quotaExhausted={quotaExhausted}
      />
    </NextIntlClientProvider>,
  );
}

describe("ScannerView quota render states", () => {
  it("keeps the results table visible on a partial quota board", () => {
    const analyzed = [opportunityFixture()];
    const html = renderScanner(analyzed, true);

    expect(html).toContain("Arsenal");
    expect(html).toContain(
      "This board is partial. APEX kept every fixture that already finished scoring",
    );
    expect(html).not.toContain("Scanner standby");
    expect(html).not.toContain("Live odds feed paused");
    expect(html).not.toContain('aria-label="Scanner standby"');
  });

  it("renders standby when quota is exhausted before any fixture is scored", () => {
    const html = renderScanner([], true);

    expect(html).toContain("Scanner standby");
    expect(html).toContain("Live odds feed paused");
    expect(html).not.toContain("Arsenal");
    expect(html).not.toContain(
      "This board is partial. APEX kept every fixture that already finished scoring",
    );
  });
});
