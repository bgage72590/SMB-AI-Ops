import { requireUser } from "@/lib/auth";
import { listSmsConversations, listContacts } from "@/lib/store";
import { canSendSms, smsUnavailableReason } from "@/lib/twilio";
import { SmsConversationView } from "@/components/SmsConversationView";
import { formatRelative } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS | SMB AI Ops",
  description: "Two-way SMS conversations with your clients.",
};

export const dynamic = "force-dynamic";

export default async function SmsPage(props: {
  searchParams?: Promise<{ contactId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const configured = canSendSms(user);
  const conversations = listSmsConversations(user.id);
  const contacts = listContacts(user.id).filter((c) => c.phone);
  const activeContactId = searchParams?.contactId;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-fg">SMS</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Two-way text messaging with your clients
        </p>
      </div>

      {!configured && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-fg-muted">
          <strong className="text-fg">Texting is off.</strong>{" "}
          {smsUnavailableReason(user)}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px,1fr] gap-4 min-h-[500px]">
        {/* Conversation list */}
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
              Conversations
            </div>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {conversations.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-fg-subtle">
                No SMS conversations yet.
                {contacts.length > 0 && (
                  <> Select a client to start.</>
                )}
              </div>
            )}
            {conversations.map((conv) => (
              <Link
                key={conv.contactId}
                href={`/sms?contactId=${conv.contactId}`}
                className={`block px-3 py-2.5 hover:bg-surface-2/50 transition-colors ${
                  activeContactId === conv.contactId ? "bg-accent/5" : ""
                }`}
              >
                <div className="text-sm font-medium text-fg truncate">
                  {conv.contactName}
                </div>
                <div className="text-xs text-fg-muted truncate mt-0.5">
                  {conv.lastMessage}
                </div>
                <div className="text-[10px] text-fg-subtle mt-0.5">
                  {formatRelative(conv.lastAt)}
                </div>
              </Link>
            ))}

            {/* Quick start with contacts that have phone numbers */}
            {conversations.length === 0 && contacts.length > 0 && (
              <div className="px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-semibold mb-1">
                  Clients with phone
                </div>
                {contacts.slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/sms?contactId=${c.id}`}
                    className="block py-1 text-xs text-fg-muted hover:text-accent transition-colors"
                  >
                    {c.name} &middot; {c.phone}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
          {activeContactId ? (
            <SmsConversationView
              contactId={activeContactId}
              configured={configured}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle">
              Select a conversation or client to start messaging.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
