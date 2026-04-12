"use client";

import { useState, useEffect, useRef } from "react";

interface SmsMessage {
  id: string;
  direction: string;
  body: string;
  status: string;
  createdAt: string;
}

interface Props {
  contactId: string;
  configured: boolean;
}

export function SmsConversationView({ contactId, configured }: Props) {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sms?contactId=${contactId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [contactId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId, body: draft.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center text-xs text-fg-subtle py-8">
            No messages yet. Send the first text below.
          </div>
        )}
        {messages.map((msg) => {
          const isOutbound = msg.direction === "outbound";
          return (
            <div
              key={msg.id}
              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                  isOutbound
                    ? "bg-accent text-accent-fg rounded-br-md"
                    : "bg-surface-2 text-fg rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                <div
                  className={`text-[10px] mt-1 ${
                    isOutbound ? "text-accent-fg/60" : "text-fg-subtle"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="border-t border-border px-4 py-3 flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            configured ? "Type a message..." : "Configure Twilio to send SMS"
          }
          disabled={!configured}
          className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!configured || !draft.trim() || sending}
          className="h-9 px-4 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Send
        </button>
      </form>
    </>
  );
}
