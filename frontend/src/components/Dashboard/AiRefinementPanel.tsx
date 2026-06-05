import React, { FormEvent, useEffect, useState } from "react";

type AiRefinementPanelProps = {
  disabled: boolean;
  isExplaining: boolean;
  isRefining: boolean;
  lastSummary: string | null;
  clarifyingPrompt: string | null;
  onRefine: (message: string) => void;
};

const PLACEHOLDER =
  'e.g. "I prefer quieter neighborhoods and don\'t mind a longer transit commute"';

export default function AiRefinementPanel({
  disabled,
  isExplaining,
  isRefining,
  lastSummary,
  clarifyingPrompt,
  onRefine,
}: AiRefinementPanelProps) {
  const [message, setMessage] = useState("");
  const isBusy = isExplaining || isRefining;
  const canSubmit = !disabled && !isBusy && message.trim().length > 0;

  useEffect(() => {
    if (lastSummary) {
      setMessage("");
    }
  }, [lastSummary]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !canSubmit) return;
    onRefine(trimmed);
  }

  return (
    <section className="ai-refinement-panel" aria-label="AI preference refinement">
      <div className="ai-refinement-panel__head">
        <h2>Refine with AI</h2>
      </div>
      <p className="ai-refinement-panel__hint">
        Describe what matters to you in plain English and we&apos;ll re-rank
        neighborhoods to match.
      </p>

      {isExplaining && (
        <p className="ai-refinement-panel__status" role="status">
          Generating initial insights…
        </p>
      )}

      {lastSummary && (
        <p className="ai-refinement-panel__summary">{lastSummary}</p>
      )}

      {clarifyingPrompt && (
        <p className="ai-refinement-panel__clarify" role="alert">
          {clarifyingPrompt}
        </p>
      )}

      <form className="ai-refinement-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="ai-refinement-message">
          Describe your preferences
        </label>
        <textarea
          id="ai-refinement-message"
          className="ai-refinement-form__input"
          rows={3}
          placeholder={PLACEHOLDER}
          value={message}
          disabled={disabled || isBusy}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="ai-refinement-form__submit"
          type="submit"
          disabled={!canSubmit}
        >
          {isRefining ? "Updating rankings…" : "Update rankings"}
        </button>
      </form>

      {disabled && !isExplaining && (
        <p className="ai-refinement-panel__footnote">
          Run a search first — refinement unlocks after insights are ready.
        </p>
      )}
    </section>
  );
}
