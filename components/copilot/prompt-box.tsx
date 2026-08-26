"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { cx } from "@/components/design-system/utils";

type PromptBoxProps = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function PromptBox({
  onSubmit,
  disabled = false,
  placeholder = "Pregunta a APEX Copilot…",
}: PromptBoxProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border-strong)] bg-[var(--apex-bg-elevated)] p-2 shadow-[var(--apex-shadow-sm)]"
    >
      <label className="sr-only" htmlFor="apex-copilot-prompt">
        Mensaje
      </label>
      <textarea
        id="apex-copilot-prompt"
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cx(
          "block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-[var(--apex-fg)] outline-none placeholder:text-[var(--apex-fg-subtle)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
        <p className="text-[11px] text-[var(--apex-fg-subtle)]">
          Demo UI · sin OpenAI · Enter para enviar
        </p>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--apex-fg-inverse)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
        >
          Enviar
        </button>
      </div>
    </form>
  );
}
