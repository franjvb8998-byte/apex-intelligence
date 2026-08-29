export type {
  CopilotAnalysisCardData,
  CopilotAskInput,
  CopilotBriefing,
  CopilotBriefingCardData,
  CopilotBriefingSection,
  CopilotCall,
  CopilotCardData,
  CopilotChatSummary,
  CopilotEvTone,
  CopilotExplainableCardData,
  CopilotIntelligence,
  CopilotIntent,
  CopilotIntentKind,
  CopilotMarketVerdict,
  CopilotMatchSnapshot,
  CopilotMessage,
  CopilotPredictionCardData,
  CopilotReply,
  CopilotRole,
  CopilotSuggestedStake,
} from "@/lib/copilot/types";

export {
  COPILOT_WELCOME,
  copilotSuggestedPrompts,
} from "@/lib/copilot/prompts";

export { parseCopilotIntent, extractTeamQuery } from "@/lib/copilot/intent";
export { createCopilotService, CopilotService } from "@/lib/copilot/service";
export {
  createCopilotDataLoader,
  createRecordedCopilotProvider,
  RECORDED_CATALOGUE_NOTE,
} from "@/lib/copilot/load";
export {
  createCopilotAiClient,
  listCopilotAiProviderIds,
  registerCopilotAiClient,
  type CopilotAiClient,
} from "@/lib/copilot/ai";
export { buildLocalBriefing, briefingToChatText } from "@/lib/copilot/analyst";
export { buildCopilotIntelligence } from "@/lib/copilot/intelligence";
export { snapshotFromMatchCenter } from "@/lib/copilot/snapshot";
export { fairOdds, edgePp, expectedValue } from "@/lib/copilot/pricing";
export { suggestedStake } from "@/lib/copilot/stake";
