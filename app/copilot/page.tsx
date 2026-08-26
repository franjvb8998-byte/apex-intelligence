import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { ChatWindow } from "@/components/copilot";
import { getShellUser } from "@/lib/auth/get-shell-user";

export const metadata: Metadata = {
  title: "APEX Copilot — APEX Intelligence",
  description:
    "Asistente visual de APEX. Demo con datos mock — sin OpenAI.",
};

export default async function CopilotPage() {
  const user = await getShellUser();

  return (
    <ProductShell user={user}>
      <ChatWindow embedded />
    </ProductShell>
  );
}
