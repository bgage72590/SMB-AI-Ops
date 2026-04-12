// Slack integration — inbound messages from Slack and outbound
// notifications to a Slack channel. Uses Slack's Incoming Webhooks
// for sending and Events API for receiving.
//
// Set SLACK_WEBHOOK_URL to enable outbound notifications.
// Set SLACK_SIGNING_SECRET to verify inbound event payloads.

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

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

export function isSlackEventsConfigured(): boolean {
  return Boolean(process.env.SLACK_SIGNING_SECRET);
}

export async function sendSlackNotification(
  message: SlackMessage
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
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

  const { createHmac } = require("node:crypto");
  const sigBaseString = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", secret)
    .update(sigBaseString)
    .digest("hex");
  const expected = `v0=${hmac}`;

  const { timingSafeEqual } = require("node:crypto");
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
