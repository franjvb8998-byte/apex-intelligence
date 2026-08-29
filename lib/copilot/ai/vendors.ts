/**
 * Optional HTTP adapters. The Copilot service never imports these directly.
 * Activate with COPILOT_AI_PROVIDER=openai|claude|gemini and the matching key.
 * Narrative only — match numbers still come from the local analyst.
 */

import type {
  CopilotAiClient,
  CopilotAiCompleteInput,
  CopilotAiCompleteResult,
} from "@/lib/copilot/ai/types";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

function envGet(env: Env, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`Copilot AI HTTP ${response.status}`);
  }
  return payload;
}

export class OpenAiCopilotClient implements CopilotAiClient {
  readonly id = "openai";
  readonly displayName = "OpenAI";
  constructor(private readonly apiKey: string | undefined, private readonly model: string) {}
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }
  async complete(input: CopilotAiCompleteInput): Promise<CopilotAiCompleteResult> {
    if (!this.apiKey) throw new Error("OpenAI is not configured");
    const payload = (await postJson(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      },
    )) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      text: payload.choices?.[0]?.message?.content ?? "",
      providerId: this.id,
    };
  }
}

export class ClaudeCopilotClient implements CopilotAiClient {
  readonly id = "claude";
  readonly displayName = "Claude";
  constructor(private readonly apiKey: string | undefined, private readonly model: string) {}
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }
  async complete(input: CopilotAiCompleteInput): Promise<CopilotAiCompleteResult> {
    if (!this.apiKey) throw new Error("Claude is not configured");
    const payload = (await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model: this.model,
        max_tokens: 1200,
        temperature: 0.2,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      },
    )) as { content?: Array<{ type?: string; text?: string }> };
    const text =
      payload.content?.find((block) => block.type === "text")?.text ?? "";
    return { text, providerId: this.id };
  }
}

export class GeminiCopilotClient implements CopilotAiClient {
  readonly id = "gemini";
  readonly displayName = "Gemini";
  constructor(private readonly apiKey: string | undefined, private readonly model: string) {}
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }
  async complete(input: CopilotAiCompleteInput): Promise<CopilotAiCompleteResult> {
    if (!this.apiKey) throw new Error("Gemini is not configured");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = (await postJson(url, {}, {
      contents: [
        {
          role: "user",
          parts: [{ text: `${input.system}\n\n${input.user}` }],
        },
      ],
      generationConfig: { temperature: 0.2 },
    })) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, providerId: this.id };
  }
}

export function createOpenAiCopilotClient(env: Env = process.env): CopilotAiClient {
  return new OpenAiCopilotClient(
    envGet(env, "OPENAI_API_KEY"),
    envGet(env, "OPENAI_MODEL") ?? "gpt-4o-mini",
  );
}

export function createClaudeCopilotClient(env: Env = process.env): CopilotAiClient {
  return new ClaudeCopilotClient(
    envGet(env, "ANTHROPIC_API_KEY"),
    envGet(env, "ANTHROPIC_MODEL") ?? "claude-sonnet-4-0",
  );
}

export function createGeminiCopilotClient(env: Env = process.env): CopilotAiClient {
  return new GeminiCopilotClient(
    envGet(env, "GEMINI_API_KEY") ?? envGet(env, "GOOGLE_API_KEY"),
    envGet(env, "GEMINI_MODEL") ?? "gemini-2.0-flash",
  );
}
