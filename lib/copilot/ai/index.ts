export type { CopilotAiClient, CopilotAiCompleteInput } from "@/lib/copilot/ai/types";
export { createLocalCopilotAiClient, LOCAL_COPILOT_PROVIDER_ID } from "@/lib/copilot/ai/local-client";
export {
  createCopilotAiClient,
  listCopilotAiProviderIds,
  registerCopilotAiClient,
} from "@/lib/copilot/ai/registry";
