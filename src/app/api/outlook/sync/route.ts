import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { getUserById, updateUserOutlook, upsertEmailFromGmail } from "@/lib/store";
import { fetchRecentOutlookMessages, refreshOutlookToken } from "@/lib/outlook";

export const runtime = "nodejs";

export async function POST() {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const fresh = getUserById(user.id);
  if (!fresh?.outlookConnected || !fresh.outlookAccessToken || !fresh.outlookRefreshToken) {
    return NextResponse.json(
      { error: "not_connected", message: "Outlook is not connected." },
      { status: 400 }
    );
  }

  let accessToken = fresh.outlookAccessToken;

  try {
    const messages = await fetchRecentOutlookMessages(accessToken, { top: 20 });

    let imported = 0;
    for (const msg of messages) {
      const created = upsertEmailFromGmail(user.id, {
        gmailId: `outlook-${msg.id}`,
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
        const refreshed = await refreshOutlookToken(fresh.outlookRefreshToken);
        updateUserOutlook(user.id, {
          outlookAccessToken: refreshed.accessToken,
        });
        accessToken = refreshed.accessToken;

        const messages = await fetchRecentOutlookMessages(accessToken, { top: 20 });

        let imported = 0;
        for (const msg of messages) {
          const created = upsertEmailFromGmail(user.id, {
            gmailId: `outlook-${msg.id}`,
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
      } catch {
        updateUserOutlook(user.id, {
          outlookConnected: false,
          outlookAccessToken: null,
          outlookRefreshToken: null,
        });
        return NextResponse.json(
          { error: "token_expired", message: "Outlook connection expired. Please reconnect." },
          { status: 401 }
        );
      }
    }
    throw err;
  }
}
