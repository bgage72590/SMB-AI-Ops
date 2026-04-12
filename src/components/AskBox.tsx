"use client";

import { useState, useRef } from "react";

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer("");
    setError("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setAnswer(data.answer);
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "What should I focus on this week?",
    "Which jobs are at risk?",
    "Draft a follow-up to my biggest deal",
    "Summarize my pipeline health",
  ];

  return (
    <div className="space-y-2.5">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your business..."
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              inputRef.current?.focus();
            }}
            className="text-[10px] px-2 py-0.5 rounded-full border border-border text-fg-subtle hover:text-fg hover:border-accent/40 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {answer && (
        <div className="rounded-lg border border-border bg-surface-2/60 p-4">
          <div className="prose prose-sm max-w-none text-fg whitespace-pre-wrap">
            {answer}
          </div>
        </div>
      )}
    </div>
  );
}
