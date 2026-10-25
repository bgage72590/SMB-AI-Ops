import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createFollowUp,
  getContact,
  getDeal,
  listFollowUps,
  updateFollowUp,
} from "@/lib/store";
import { draftFollowUp } from "@/lib/ai";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { trialGuardResponse } from "@/lib/trialGuard";

export const runtime = "nodejs";

const CreateSchema = z.object({
  contactId: z.string().min(1),
  dealId: z.string().optional(),
  context: z.string().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["draft", "approved", "sent", "dismissed"]).optional(),
  subject: z.string().optional(),
  draft: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ followUps: listFollowUps(user.id) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const postBlocked = trialGuardResponse(user);
  if (postBlocked) return postBlocked;

  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const contact = getContact(user.id, parsed.data.contactId);
  if (!contact) {
    return NextResponse.json(
      { error: "contact_not_found" },
      { status: 404 }
    );
  }
  const deal = parsed.data.dealId
    ? getDeal(user.id, parsed.data.dealId)
    : undefined;

  const draft = await draftFollowUp({
    contact,
    deal,
    context: parsed.data.context,
  });

  const followUp = createFollowUp(user.id, {
    contactId: contact.id,
    dealId: deal?.id,
    subject: draft.subject,
    draft: draft.body,
    reason: draft.reason,
  });

  return NextResponse.json({ followUp }, { status: 201 });
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const patchBlocked = trialGuardResponse(user);
  if (patchBlocked) return patchBlocked;

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, ...rest } = parsed.data;
  const followUp = updateFollowUp(user.id, id, rest);
  if (!followUp)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ followUp });
}
