import type { Metadata } from "next";
import { getMessages } from "next-intl/server";

function readMessage(messages: unknown, path: string): string | undefined {
  let current: unknown = messages;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

export async function localeMetadata(namespace: string): Promise<Metadata> {
  const messages = await getMessages();
  const title = readMessage(messages, `${namespace}.pageTitle`);
  const description = readMessage(messages, `${namespace}.pageDescription`);
  return {
    title: title ?? namespace,
    ...(description ? { description } : {}),
  };
}
