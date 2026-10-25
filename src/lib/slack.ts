// Slack integration — inbound messages from Slack and outbound
// notifications to a Slack channel.
//
// Each workspace installs the operator's Slack app with "Add to Slack"
// (OAuth). The install picks one channel: we keep its incoming-webhook URL
// for outbound notifications, and route inbound Events API messages by
// that (Slack team, channel) pair. Nothing is shared between workspaces.
//
// Operator env vars (from the Slack app's Basic Information page):
//   SLACK_CLIENT_ID, SLACK_CLIENT_SECRET — OAuth install
//   SLACK_SIGNING_SECRET                  — verifies inbound event payloads
// The app needs the incoming-webhook and channels:history scopes, the
// redirect URL {APP_BASE_URL}/api/slack/callback, and Event Subscriptions
// (message.channels) pointed at {APP_BASE_URL}/api/webhooks/slack.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "./types";

export interface SlackMessage {
  text: string;
  channel?: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string; url?: string }>;
}

export const SLACK_OAUTH_STATE_COOKIE = "slack_oauth_state";

/** The operator's Slack app is set up, so workspaces can install it. */
export function isSlackAppConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
      process.env.SLACK_CLIENT_SECRET &&
      process.env.SLACK_SIGNING_SECRET
  );
}

/** This workspace has installed Slack and can receive notifications. */
export function isSlackConfigured(user: Pick<User, "slackWebhookUrl">): boolean {
  return Boolean(user.slackWebhookUrl);
}

export function isSlackEventsConfigured(): boolean {
  return Boolean(process.env.SLACK_SIGNING_SECRET);
}

function slackRedirectUri(): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/slack/callback`;
}

export function buildSlackInstallUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    scope: "incoming-webhook,channels:history",
    redirect_uri: slackRedirectUri(),
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export interface SlackInstall {
  teamId: string;
  channelId: string;
  channelName: string;
  webhookUrl: string;
}

/** Exchange the OAuth code for the install's team, channel and webhook. */
export async function exchangeSlackCode(code: string): Promise<SlackInstall> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
      code,
      redirect_uri: slackRedirectUri(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    team?: { id: string };
    incoming_webhook?: { channel: string; channel_id: string; url: string };
  };
  if (!data.ok || !data.team?.id || !data.incoming_webhook?.url) {
    throw new Error(`Slack OAuth failed: ${data.error ?? "missing install data"}`);
  }
  return {
    teamId: data.team.id,
    channelId: data.incoming_webhook.channel_id,
    channelName: data.incoming_webhook.channel,
    webhookUrl: data.incoming_webhook.url,
  };
}

export async function sendSlackNotification(
  user: Pick<User, "slackWebhookUrl">,
  message: SlackMessage
): Promise<boolean> {
  const webhookUrl = user.slackWebhookUrl;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.error("[slack] notification failed:", err);
    return false;
  }
}

export function buildNewLeadBlock(fields: {
  contactName: string;
  email: string;
  subject: string;
  summary: string;
  dealTitle?: string;
  amount?: number;
}): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "New Lead" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*From:*\n${fields.contactName} <${fields.email}>` },
        { type: "mrkdwn", text: `*Subject:*\n${fields.subject}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Summary:*\n${fields.summary}` },
    },
  ];

  if (fields.dealTitle) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Job:*\n${fields.dealTitle}` },
        {
          type: "mrkdwn",
          text: `*Value:*\n${fields.amount ? `$${fields.amount.toLocaleString()}` : "TBD"}`,
        },
      ],
    });
  }

  return {
    text: `New lead: ${fields.contactName} — ${fields.subject}`,
    blocks,
  };
}

export function buildDealUpdateBlock(fields: {
  dealTitle: string;
  stage: string;
  contactName: string;
  amount: number;
}): SlackMessage {
  return {
    text: `Deal update: ${fields.dealTitle} moved to ${fields.stage}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Deal Update" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Job:*\n${fields.dealTitle}` },
          { type: "mrkdwn", text: `*Stage:*\n${fields.stage}` },
          { type: "mrkdwn", text: `*Client:*\n${fields.contactName}` },
          {
            type: "mrkdwn",
            text: `*Value:*\n$${fields.amount.toLocaleString()}`,
          },
        ],
      },
    ],
  };
}

export function buildFollowUpSentBlock(fields: {
  contactName: string;
  subject: string;
  channel: string;
}): SlackMessage {
  return {
    text: `Follow-up sent to ${fields.contactName}: ${fields.subject}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Follow-up sent via *${fields.channel}* to *${fields.contactName}*: _${fields.subject}_`,
        },
      },
    ],
  };
}

// Verify Slack request signature (Events API)
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;

  const fiveMinAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinAgo) return false;

  const sigBaseString = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", secret)
    .update(sigBaseString)
    .digest("hex");
  const expected = `v0=${hmac}`;

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
