/**
 * Default Copilot AI client — no network, no invented prose.
 * The domain analyst builds the briefing; this client only exists so the
 * registry always has a provider.
 */

import type {
  CopilotAiClient,
  CopilotAiCompleteInput,
  CopilotAiCompleteResult,
} from "@/lib/copilot/ai/types";

export const LOCAL_COPILOT_PROVIDER_ID = "local";

export class LocalCopilotAiClient implements CopilotAiClient {
  readonly id = LOCAL_COPILOT_PROVIDER_ID;
  readonly displayName = "APEX Local Analyst";

  isAvailable(): boolean {
    return true;
  }

  async complete(_input: CopilotAiCompleteInput): Promise<CopilotAiCompleteResult> {
    return {
      text: "",
      providerId: this.id,
    };
  }
}

export function createLocalCopilotAiClient(): CopilotAiClient {
  return new LocalCopilotAiClient();
}
