import type { Metadata } from "next";
import { GuestShell } from "@/components/app-shell/guest-shell";
import { ApexShowcaseView } from "@/components/apex-showcase";
import { Badge } from "@/components/design-system";

export const metadata: Metadata = {
  title: "APEX Showcase — Internal",
  description:
    "Internal development showcase for the APEX Intelligence platform.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Internal platform showcase — UI only.
 * No Supabase server / next/headers imports.
 */
export default function ApexShowcasePage() {
  return (
    <GuestShell>
      <div className="w-full space-y-6">
        <Badge tone="accent">Internal only</Badge>
        <ApexShowcaseView />
      </div>
    </GuestShell>
  );
}
