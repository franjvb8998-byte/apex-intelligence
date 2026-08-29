/**
 * Copilot AI registry — providers are registered by id, never hardcoded in the service.
 */

import { createLocalCopilotAiClient } from "@/lib/copilot/ai/local-client";
import type { CopilotAiClient, CopilotAiClientFactory } from "@/lib/copilot/ai/types";
import {
  createClaudeCopilotClient,
  createGeminiCopilotClient,
  createOpenAiCopilotClient,
} from "@/lib/copilot/ai/vendors";

const factories = new Map<string, CopilotAiClientFactory>();

export function registerCopilotAiClient(
  id: string,
  factory: CopilotAiClientFactory,
): void {
  factories.set(id.trim().toLowerCase(), factory);
}

registerCopilotAiClient("local", () => createLocalCopilotAiClient());
registerCopilotAiClient("openai", (env) => createOpenAiCopilotClient(env));
registerCopilotAiClient("claude", (env) => createClaudeCopilotClient(env));
registerCopilotAiClient("gemini", (env) => createGeminiCopilotClient(env));

export function listCopilotAiProviderIds(): string[] {
  return [...factories.keys()];
}

export function createCopilotAiClient(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): CopilotAiClient {
  const requested = (env.COPILOT_AI_PROVIDER ?? "local").trim().toLowerCase();
  const factory = factories.get(requested) ?? factories.get("local");
  const client = (factory ?? (() => createLocalCopilotAiClient()))(env);
  if (!client.isAvailable()) {
    return createLocalCopilotAiClient();
  }
  return client;
}
