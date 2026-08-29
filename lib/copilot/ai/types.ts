/**
 * Single AI interface for Copilot.
 * Vendors (OpenAI, Claude, Gemini, local) implement this — the service never
 * imports a specific SDK.
 */

export type CopilotAiCompleteInput = {
  system: string;
  user: string;
};

export type CopilotAiCompleteResult = {
  text: string;
  providerId: string;
};

export interface CopilotAiClient {
  readonly id: string;
  readonly displayName: string;
  isAvailable(): boolean;
  complete(input: CopilotAiCompleteInput): Promise<CopilotAiCompleteResult>;
}

export type CopilotAiClientFactory = (
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
) => CopilotAiClient;
