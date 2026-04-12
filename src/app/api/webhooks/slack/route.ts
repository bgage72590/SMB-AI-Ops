import { NextResponse } from "next/server";
import { verifySlackSignature, isSlackEventsConfigured } from "@/lib/slack";
import { createEmail } from "@/lib/store";
import { getFirstUser } from "@/lib/store";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/slack
 *
 * Receives Slack Events API payloads (messages from a connected channel).
 * Converts them into inbox emails so the pipeline can triage them like
 * any other inbound message.
 *
 * Handles:
 * - url_verification challenge (required by Slack on setup)
 * - event_callback for message events
 */
export async function POST(request: Request) {
  if (!isSlackEventsConfigured()) {
    return NextResponse.json(
      { error: "slack_events_not_configured" },
      { status: 503 }
    );
  }

  const bodyText = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signature, timestamp, bodyText)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event?.type === "message") {
    const event = payload.event;

    if (event.subtype === "bot_message" || event.bot_id) {
      return NextResponse.json({ ok: true });
    }

    const owner = getFirstUser();
    if (!owner) {
      return NextResponse.json({ error: "no_owner" }, { status: 500 });
    }

    createEmail(owner.id, {
      from: `slack:${event.user || "unknown"}`,
      fromName: event.user_profile?.real_name || event.user || "Slack User",
      to: owner.email,
      subject: `Slack message in #${event.channel || "general"}`,
      body: event.text || "(empty message)",
      receivedAt: event.ts
        ? new Date(parseFloat(event.ts) * 1000).toISOString()
        : new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
