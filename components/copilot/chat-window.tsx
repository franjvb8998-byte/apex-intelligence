"use client";

import { useEffect, useRef, useState, useEffectEvent } from "react";
import { Message } from "@/components/copilot/message";
import { PromptBox } from "@/components/copilot/prompt-box";
import { SuggestedPrompts } from "@/components/copilot/suggested-prompts";
import { ThinkingIndicator } from "@/components/copilot/thinking-indicator";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import {
  COPILOT_SUGGESTED_PROMPTS,
  COPILOT_WELCOME,
  MOCK_CHAT_THREADS,
  MOCK_RECENT_CHATS,
  getMockCopilotReply,
  type CopilotChatSummary,
  type CopilotMessage,
} from "@/lib/copilot";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ChatWindowProps = {
  initialChats?: CopilotChatSummary[];
  /** Nested inside product AppShell (Release 0.1). */
  embedded?: boolean;
};

export function ChatWindow({
  initialChats = MOCK_RECENT_CHATS,
  embedded = false,
}: ChatWindowProps) {
  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const thinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useEffectEvent(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  useEffect(() => {
    return () => {
      if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
    };
  }, []);

  function startNewAnalysis() {
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
    setThinking(false);
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  function openChat(chatId: string) {
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
    setThinking(false);
    setActiveChatId(chatId);
    setMessages(MOCK_CHAT_THREADS[chatId] ?? []);
    setSidebarOpen(false);
  }

  function sendPrompt(prompt: string) {
    if (thinking) return;

    const userMessage: CopilotMessage = {
      id: createId("user"),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setThinking(true);

    const chatId = activeChatId ?? createId("chat");
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

    thinkTimerRef.current = setTimeout(() => {
      const reply = getMockCopilotReply(prompt);
      const assistantMessage: CopilotMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: reply.content,
        createdAt: new Date().toISOString(),
        card: reply.card,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setThinking(false);
    }, 900);
  }

  const showWelcome = messages.length === 0 && !thinking;

  return (
    <div
      className={cx(
        "flex overflow-hidden bg-[var(--apex-bg)] text-[var(--apex-fg)]",
        embedded
          ? "h-[calc(100dvh-4.75rem)] min-h-[32rem] rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)]"
          : "h-[100dvh]",
      )}
    >      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
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
            <span className="text-[var(--apex-accent)]">Chats</span>
          </p>
          <Badge tone="warning">Mock</Badge>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNewAnalysis}
            className="w-full rounded-[var(--apex-radius-lg)] border border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] px-3 py-2.5 text-sm font-medium text-[var(--apex-accent)] transition-colors hover:bg-[var(--apex-accent)] hover:text-[var(--apex-fg-inverse)]"
          >
            Nuevo análisis
          </button>
        </div>

        <div className="px-4 pb-2">
          <p className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            Chats recientes
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {chats.map((chat) => {
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
          })}
        </nav>

        <div className="border-t border-[var(--apex-border)] px-4 py-3 text-xs text-[var(--apex-fg-subtle)]">
          Respuestas simuladas · sin OpenAI
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--apex-border)] px-4 py-3 lg:px-6">
          <button
            type="button"
            className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-2.5 py-1.5 text-xs text-[var(--apex-fg-muted)] lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            Menú
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--apex-fg)]">
              {activeChatId
                ? (chats.find((c) => c.id === activeChatId)?.title ??
                  "Conversación")
                : "Nuevo análisis"}
            </p>
            <p className="truncate text-xs text-[var(--apex-fg-subtle)]">
              Experiencia visual · respuestas simuladas
            </p>
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
            {showWelcome ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
                <div>
                  <p className="text-sm text-[var(--apex-accent)]">APEX Copilot</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-4xl">
                    Hola, soy APEX Copilot.
                  </h1>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
                    {COPILOT_WELCOME}
                  </p>
                </div>
                <SuggestedPrompts
                  prompts={COPILOT_SUGGESTED_PROMPTS}
                  onSelect={sendPrompt}
                  disabled={thinking}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 pb-6">
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {thinking && <ThinkingIndicator />}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--apex-border)] bg-[var(--apex-bg)]/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            {!showWelcome && (
              <SuggestedPrompts
                prompts={COPILOT_SUGGESTED_PROMPTS}
                onSelect={sendPrompt}
                disabled={thinking}
              />
            )}
            <PromptBox onSubmit={sendPrompt} disabled={thinking} />
          </div>
        </div>
      </div>
    </div>
  );
}
