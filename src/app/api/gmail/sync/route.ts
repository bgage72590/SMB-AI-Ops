import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { getUserById, updateUserGmail, upsertEmailFromGmail } from "@/lib/store";
import { fetchRecentMessages, refreshGmailToken } from "@/lib/gmail";

export const runtime = "nodejs";

export async function POST() {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const fresh = getUserById(user.id);
  if (!fresh?.gmailConnected || !fresh.gmailAccessToken || !fresh.gmailRefreshToken) {
    return NextResponse.json(
      { error: "not_connected", message: "Gmail is not connected." },
      { status: 400 }
    );
  }

  let accessToken = fresh.gmailAccessToken;

  try {
    const messages = await fetchRecentMessages(accessToken, {
      maxResults: 20,
    });

    let imported = 0;
    for (const msg of messages) {
      const created = upsertEmailFromGmail(user.id, {
        gmailId: msg.id,
        from: msg.from,
        fromName: msg.fromName,
        to: msg.to,
        subject: msg.subject,
        body: msg.body,
        receivedAt: msg.date,
      });
      if (created) imported++;
    }

    return NextResponse.json({ imported, total: messages.length });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("401") || err.message.includes("403"))
    ) {
      try {
        const refreshed = await refreshGmailToken(fresh.gmailRefreshToken);
        updateUserGmail(user.id, {
          gmailAccessToken: refreshed.accessToken,
        });
        accessToken = refreshed.accessToken;

        const messages = await fetchRecentMessages(accessToken, {
          maxResults: 20,
        });

        let imported = 0;
        for (const msg of messages) {
          const created = upsertEmailFromGmail(user.id, {
            gmailId: msg.id,
            from: msg.from,
            fromName: msg.fromName,
            to: msg.to,
            subject: msg.subject,
            body: msg.body,
            receivedAt: msg.date,
          });
          if (created) imported++;
        }

        return NextResponse.json({ imported, total: messages.length });
      } catch (refreshErr) {
        updateUserGmail(user.id, {
          gmailConnected: false,
          gmailAccessToken: null,
          gmailRefreshToken: null,
        });
        return NextResponse.json(
          { error: "token_expired", message: "Gmail connection expired. Please reconnect." },
          { status: 401 }
        );
      }
    }
    throw err;
  }
}
