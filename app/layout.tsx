import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { PasswordRecoveryRedirect } from "@/components/auth/password-recovery-redirect";
import { PASSWORD_RECOVERY_BOOTSTRAP_SCRIPT } from "@/lib/auth/password-recovery";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APEX Intelligence — La inteligencia que transforma tus apuestas",
  description:
    "Analiza tu historial, mide tu rendimiento y toma decisiones basadas en datos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="password-recovery-redirect" strategy="beforeInteractive">
          {PASSWORD_RECOVERY_BOOTSTRAP_SCRIPT}
        </Script>
        <PasswordRecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
