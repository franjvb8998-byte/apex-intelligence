type SuggestedPromptsProps = {
  prompts: readonly string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function SuggestedPrompts({
  prompts,
  onSelect,
  disabled = false,
}: SuggestedPromptsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-[var(--apex-surface)] px-3.5 py-2.5 text-left text-sm text-[var(--apex-fg-muted)] transition-[border-color,color,background-color] duration-[var(--apex-duration-normal)] hover:border-[var(--apex-accent-border)] hover:bg-[var(--apex-accent-muted)] hover:text-[var(--apex-fg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
