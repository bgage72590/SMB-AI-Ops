import { NextResponse } from "next/server";
import { getUserById, updateUserGmail, upsertEmailFromGmail } from "@/lib/store";
import { fetchRecentMessages, refreshGmailToken } from "@/lib/gmail";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({ rate: { bucket: "sync", max: 10, windowMs: 10 * 60_000 } }, async (_request, user) => {
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
});
