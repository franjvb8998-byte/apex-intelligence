"use client";

import { useEffect, useRef, useState, useEffectEvent } from "react";
import { Message } from "@/components/copilot/message";
import { PromptBox } from "@/components/copilot/prompt-box";
import { SuggestedPrompts } from "@/components/copilot/suggested-prompts";
import { ThinkingIndicator } from "@/components/copilot/thinking-indicator";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { type CopilotChatSummary, type CopilotMessage, type CopilotReply } from "@/lib/copilot";
import { useTranslations } from "next-intl";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ChatWindowProps = {
  prompts: readonly string[];
  initialChats?: CopilotChatSummary[];
  /** Nested inside product AppShell (Release 0.1). */
  embedded?: boolean;
  /** Auto-send on first paint (Opportunities → Copilot). */
  initialPrompt?: string;
};

function humanizeCopilotError(
  t: ReturnType<typeof useTranslations<"copilot">>,
  message?: string,
): string {
  const raw = message?.trim() ?? "";
  if (/request limit|rate limit|\bquota\b/i.test(raw)) {
    return t("quotaError");
  }
  return raw || t("genericError");
}

async function askCopilot(prompt: string): Promise<CopilotReply> {
  const response = await fetch("/api/copilot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    data?: CopilotReply;
    error?: { message?: string };
  };
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "");
  }
  return payload.data;
}

export function ChatWindow({
  prompts,
  initialChats = [],
  embedded = false,
  initialPrompt,
}: ChatWindowProps) {
  const t = useTranslations("copilot");
  const chrome = useTranslations("chrome");
  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const threadsRef = useRef<Record<string, CopilotMessage[]>>({});
  const initialPromptSent = useRef(false);

  const scrollToBottom = useEffectEvent(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  function persistThread(chatId: string, next: CopilotMessage[]) {
    threadsRef.current[chatId] = next;
    setMessages(next);
  }

  function startNewAnalysis() {
    setThinking(false);
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  function openChat(chatId: string) {
    setThinking(false);
    setActiveChatId(chatId);
    setMessages(threadsRef.current[chatId] ?? []);
    setSidebarOpen(false);
  }

  async function sendPrompt(prompt: string) {
    if (thinking) return;

    const userMessage: CopilotMessage = {
      id: createId("user"),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    const chatId = activeChatId ?? createId("chat");
    const prior = activeChatId ? (threadsRef.current[chatId] ?? messages) : [];
    const withUser = [...prior, userMessage];
    persistThread(chatId, withUser);
    setThinking(true);

    if (!activeChatId) {
      setActiveChatId(chatId);
      setChats((prev) => [
        {
          id: chatId,
          title: prompt.slice(0, 42),
          preview: prompt,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } else {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, preview: prompt, updatedAt: new Date().toISOString() }
            : chat,
        ),
      );
    }

    try {
      const reply = await askCopilot(prompt);
      const assistantMessage: CopilotMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: reply.content,
        createdAt: new Date().toISOString(),
        card: reply.card,
      };
      persistThread(chatId, [...withUser, assistantMessage]);
    } catch (error) {
      persistThread(chatId, [
        ...withUser,
        {
          id: createId("assistant"),
          role: "assistant",
          content: humanizeCopilotError(
            t,
            error instanceof Error ? error.message : undefined,
          ),
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    void sendPrompt(prompt);
  }, [initialPrompt]);

  const showWelcome = messages.length === 0 && !thinking;

  return (
    <div
      className={cx(
        "flex overflow-hidden bg-[var(--apex-bg)] text-[var(--apex-fg)]",
        embedded
          ? "h-[calc(100dvh-4.75rem)] min-h-[32rem] rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)]"
          : "h-[100dvh]",
      )}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t("closeMenu")}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-[17.5rem] flex-col border-r border-[var(--apex-border)] bg-[var(--apex-bg-elevated)] transition-transform duration-[var(--apex-duration-normal)] lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--apex-border)] px-4 py-4">
          <p className="text-sm font-semibold tracking-tight">
            <span className="text-[var(--apex-accent)]">{t("chats")}</span>
          </p>
          <Badge tone="accent">APEX data</Badge>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNewAnalysis}
            className="w-full rounded-[var(--apex-radius-lg)] border border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] px-3 py-2.5 text-sm font-medium text-[var(--apex-accent)] transition-colors hover:bg-[var(--apex-accent)] hover:text-[var(--apex-fg-inverse)]"
          >
            {t("newAnalysis")}
          </button>
        </div>

        <div className="px-4 pb-2">
          <p className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {t("sessionChats")}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {chats.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--apex-fg-subtle)]">
              {t("noConversations")}
            </p>
          ) : (
            chats.map((chat) => {
              const active = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => openChat(chat.id)}
                  className={cx(
                    "w-full rounded-[var(--apex-radius-md)] px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-[var(--apex-accent-muted)] text-[var(--apex-fg)]"
                      : "text-[var(--apex-fg-muted)] hover:bg-slate-800/60 hover:text-[var(--apex-fg)]",
                  )}
                >
                  <span className="block truncate text-sm font-medium">
                    {chat.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--apex-fg-subtle)]">
                    {chat.preview}
                  </span>
                </button>
              );
            })
          )}
        </nav>

        <div className="border-t border-[var(--apex-border)] px-4 py-3 text-xs text-[var(--apex-fg-subtle)]">
          {t("localEngine")}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--apex-border)] px-4 py-3 lg:px-6">
          <button
            type="button"
            className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-2.5 py-1.5 text-xs text-[var(--apex-fg-muted)] lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            {chrome("menu")}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--apex-fg)]">
              {activeChatId
                ? (chats.find((c) => c.id === activeChatId)?.title ??
                  t("conversation"))
                : t("newAnalysis")}
            </p>
            <p className="truncate text-xs text-[var(--apex-fg-subtle)]">
              {t("analystHint")}
            </p>
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10"
        >
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
            {showWelcome ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
                <div>
                  <p className="text-sm text-[var(--apex-accent)]">{t("eyebrow")}</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-4xl">
                    {t("title")}
                  </h1>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
                    {t("welcome")}
                  </p>
                </div>
                <SuggestedPrompts
                  prompts={prompts}
                  onSelect={(value) => void sendPrompt(value)}
                  disabled={thinking}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 pb-6">
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {thinking && (
                  <ThinkingIndicator label={t("thinking")} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--apex-border)] bg-[var(--apex-bg)]/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-4xl space-y-3">
            {!showWelcome && (
              <SuggestedPrompts
                prompts={prompts}
                onSelect={(value) => void sendPrompt(value)}
                disabled={thinking}
              />
            )}
            <PromptBox
              onSubmit={(value) => void sendPrompt(value)}
              disabled={thinking}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
