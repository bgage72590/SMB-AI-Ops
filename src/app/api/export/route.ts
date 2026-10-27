import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { listContacts, listDeals } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "contacts") {
    const contacts = listContacts(user.id);
    const rows = [
      ["Name", "Email", "Phone", "Company", "Created", "Updated"].join(","),
      ...contacts.map((c) =>
        [
          csvEscape(c.name),
          csvEscape(c.email),
          csvEscape(c.phone || ""),
          csvEscape(c.company || ""),
          c.createdAt,
          c.updatedAt,
        ].join(",")
      ),
    ];
    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-${dateStamp()}.csv"`,
      },
    });
  }

  if (type === "deals") {
    const deals = listDeals(user.id);
    const rows = [
      ["Title", "Stage", "Amount", "Currency", "Materials", "Labor", "Next Step", "Created", "Last Activity"].join(","),
      ...deals.map((d) =>
        [
          csvEscape(d.title),
          d.stage,
          d.amount,
          d.currency,
          d.costMaterials,
          d.costLabor,
          csvEscape(d.nextStep || ""),
          d.createdAt,
          d.lastActivityAt,
        ].join(",")
      ),
    ];
    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deals-${dateStamp()}.csv"`,
      },
    });
  }

  return NextResponse.json(
    { error: "invalid_type", message: "Use ?type=contacts or ?type=deals" },
    { status: 400 }
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
