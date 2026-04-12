import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { upsertContact } from "@/lib/store";

export const runtime = "nodejs";

interface CsvRow {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) =>
    h.toLowerCase().trim().replace(/[^a-z_]/g, "")
  );

  const nameIdx = headers.findIndex((h) =>
    h === "name" || h === "full_name" || h === "fullname" || h === "contact_name"
  );
  const emailIdx = headers.findIndex((h) =>
    h === "email" || h === "email_address" || h === "emailaddress"
  );

  if (nameIdx === -1 || emailIdx === -1) return [];

  const companyIdx = headers.findIndex((h) =>
    h === "company" || h === "organization" || h === "business"
  );
  const phoneIdx = headers.findIndex((h) =>
    h === "phone" || h === "phone_number" || h === "phonenumber" || h === "mobile"
  );
  const notesIdx = headers.findIndex((h) =>
    h === "notes" || h === "note" || h === "comments"
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    const email = cols[emailIdx]?.trim();
    if (!name || !email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    rows.push({
      name,
      email,
      company: companyIdx >= 0 ? cols[companyIdx]?.trim() : undefined,
      phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() : undefined,
      notes: notesIdx >= 0 ? cols[notesIdx]?.trim() : undefined,
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export async function POST(request: Request) {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "invalid_request", message: "Expected multipart form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "missing_file", message: "No CSV file provided" },
      { status: 400 }
    );
  }

  const text = await (file as Blob).text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: "empty_or_invalid",
        message:
          "No valid rows found. Make sure your CSV has 'name' and 'email' columns.",
      },
      { status: 400 }
    );
  }

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      upsertContact(user.id, {
        name: row.name,
        email: row.email,
        company: row.company,
        phone: row.phone,
        notes: row.notes,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, total: rows.length });
}
