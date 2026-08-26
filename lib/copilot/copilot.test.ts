import { describe, expect, it } from "vitest";
import {
  COPILOT_SUGGESTED_PROMPTS,
  COPILOT_WELCOME,
  MOCK_RECENT_CHATS,
  getMockCopilotReply,
} from "@/lib/copilot";

describe("APEX Copilot mock layer", () => {
  it("exposes welcome + suggested prompts", () => {
    expect(COPILOT_WELCOME).toContain("APEX Copilot");
    expect(COPILOT_SUGGESTED_PROMPTS).toHaveLength(4);
    expect(MOCK_RECENT_CHATS.length).toBeGreaterThan(0);
  });

  it("returns mock analysis for Clasico prompt", () => {
    const reply = getMockCopilotReply("Analiza Real Madrid vs Barcelona.");
    expect(reply.content.toLowerCase()).toContain("mock");
    expect(reply.card?.kind).toBe("analysis");
  });

  it("returns mock prediction for value prompt", () => {
    const reply = getMockCopilotReply("¿Quién tiene más valor hoy?");
    expect(reply.card?.kind).toBe("prediction");
  });

  it("never claims live OpenAI", () => {
    const reply = getMockCopilotReply("hola");
    expect(reply.content.toLowerCase()).not.toContain("openai api");
  });
});
