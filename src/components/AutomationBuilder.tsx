"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
}

const TRIGGERS = [
  { value: "no_reply", label: "No reply received", description: "Fires when a contact hasn't replied within a time window" },
  { value: "stale_deal", label: "Stale job", description: "Fires when a job has no activity for a set number of days" },
  { value: "email_received", label: "Email received", description: "Fires when a new email arrives from a contact" },
  { value: "deal_stage_change", label: "Job stage change", description: "Fires when a job moves to a specific stage" },
];

const ACTIONS = [
  { value: "draft_followup", label: "Draft follow-up", description: "Create a follow-up email draft for review" },
  { value: "send_notification", label: "Send notification", description: "Send an alert about the event" },
  { value: "update_stage", label: "Update job stage", description: "Automatically move a job to a new stage" },
  { value: "add_note", label: "Add note", description: "Add a note to the contact record" },
];

const STAGES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quoted", label: "Quoted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function AutomationBuilder({ automations }: { automations: Automation[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "no_reply",
    action: "draft_followup",
    days: "3",
    stage: "quoted",
    noteText: "",
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const conditions: Record<string, unknown> = {};
      const actionConfig: Record<string, unknown> = {};

      if (form.trigger === "no_reply" || form.trigger === "stale_deal") {
        conditions.days = parseInt(form.days, 10) || 3;
      }
      if (form.trigger === "deal_stage_change") {
        conditions.stage = form.stage;
      }
      if (form.action === "update_stage") {
        actionConfig.newStage = form.stage;
      }
      if (form.action === "add_note") {
        actionConfig.text = form.noteText;
      }

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          conditions,
          action: form.action,
          actionConfig,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast("Automation created", "success");
      setCreating(false);
      setForm({ name: "", trigger: "no_reply", action: "draft_followup", days: "3", stage: "quoted", noteText: "" });
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      const res = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      toast(enabled ? "Automation paused" : "Automation enabled", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/automations", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast("Automation deleted", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Existing automations */}
      {automations.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
          {automations.map((auto) => {
            const trigger = TRIGGERS.find((t) => t.value === auto.trigger);
            const action = ACTIONS.find((a) => a.value === auto.action);
            return (
              <div key={auto.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${auto.enabled ? "bg-success" : "bg-fg-subtle"}`} />
                      <span className="text-sm font-medium text-fg truncate">{auto.name}</span>
                    </div>
                    <div className="text-xs text-fg-muted mt-1 ml-4">
                      <span className="font-medium">When:</span> {trigger?.label || auto.trigger}
                      {auto.conditions.days != null && <span> ({String(auto.conditions.days)}d)</span>}
                      {auto.conditions.stage != null && <span> ({String(auto.conditions.stage)})</span>}
                      <span className="mx-1.5">&rarr;</span>
                      <span className="font-medium">Then:</span> {action?.label || auto.action}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(auto.id, auto.enabled)}
                      className={`h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                        auto.enabled
                          ? "border-success/30 text-success hover:bg-success/10"
                          : "border-border text-fg-subtle hover:bg-surface-2"
                      }`}
                    >
                      {auto.enabled ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(auto.id)}
                      className="h-7 px-2 text-xs text-danger hover:bg-danger/10 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create new */}
      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-surface py-6 text-center transition-colors group"
        >
          <div className="text-lg text-fg-subtle group-hover:text-accent transition-colors mb-1">+</div>
          <div className="text-sm font-medium text-fg-muted group-hover:text-fg transition-colors">Create automation</div>
          <div className="text-xs text-fg-subtle mt-0.5">Set up rules to automate repetitive tasks</div>
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-fg">New automation</h3>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Auto-follow-up after 3 days"
              className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Trigger */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">When this happens</label>
              <div className="mt-2 space-y-2">
                {TRIGGERS.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      form.trigger === t.value
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="trigger"
                      value={t.value}
                      checked={form.trigger === t.value}
                      onChange={(e) => setForm((p) => ({ ...p, trigger: e.target.value }))}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium text-fg">{t.label}</div>
                      <div className="text-[11px] text-fg-subtle">{t.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Condition fields */}
              {(form.trigger === "no_reply" || form.trigger === "stale_deal") && (
                <div className="mt-3">
                  <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">After days</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={form.days}
                    onChange={(e) => setForm((p) => ({ ...p, days: e.target.value }))}
                    className="mt-1 w-20 text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
                  />
                </div>
              )}
              {form.trigger === "deal_stage_change" && (
                <div className="mt-3">
                  <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">When stage is</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
                    className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Action */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Do this</label>
              <div className="mt-2 space-y-2">
                {ACTIONS.map((a) => (
                  <label
                    key={a.value}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      form.action === a.value
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="action"
                      value={a.value}
                      checked={form.action === a.value}
                      onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium text-fg">{a.label}</div>
                      <div className="text-[11px] text-fg-subtle">{a.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              {form.action === "update_stage" && (
                <div className="mt-3">
                  <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Move to stage</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
                    className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.action === "add_note" && (
                <div className="mt-3">
                  <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Note text</label>
                  <textarea
                    value={form.noteText}
                    onChange={(e) => setForm((p) => ({ ...p, noteText: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    placeholder="Note to add..."
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !form.name}
              className="h-8 px-4 text-xs font-medium rounded-md bg-accent text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create automation"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="h-8 px-4 text-xs font-medium rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
