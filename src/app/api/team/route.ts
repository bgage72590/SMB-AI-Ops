import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  createWorkspaceInvite,
  getWorkspace,
  getWorkspaceMembers,
  listWorkspaceInvites,
  logAudit,
  removeWorkspaceMember,
} from "@/lib/store";

export const runtime = "nodejs";

const InviteSchema = z.object({
  email: z.string().email().max(254),
});

const RemoveSchema = z.object({
  userId: z.string().min(1),
});

export async function GET() {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  if (!user.workspaceId) {
    return NextResponse.json({ members: [], invites: [], workspace: null });
  }

  const workspace = getWorkspace(user.workspaceId);
  const members = getWorkspaceMembers(user.workspaceId);
  const invites = listWorkspaceInvites(user.workspaceId);

  return NextResponse.json({
    workspace: workspace
      ? { id: workspace.id, name: workspace.name, ownerId: workspace.ownerId }
      : null,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      isOwner: workspace?.ownerId === m.id,
    })),
    invites: invites
      .filter((i) => !i.acceptedAt)
      .map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        createdAt: i.createdAt,
      })),
  });
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

  if (!user.workspaceId) {
    return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  }

  const workspace = getWorkspace(user.workspaceId);
  if (!workspace || workspace.ownerId !== user.id) {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const invite = createWorkspaceInvite(
    user.workspaceId,
    parsed.data.email,
    user.id
  );
  logAudit(
    user.id,
    "invited",
    "team",
    invite.id,
    `Invited ${parsed.data.email}`
  );

  return NextResponse.json({ invite }, { status: 201 });
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  if (!user.workspaceId) {
    return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  }

  const workspace = getWorkspace(user.workspaceId);
  if (!workspace || workspace.ownerId !== user.id) {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = RemoveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const removed = removeWorkspaceMember(user.workspaceId, parsed.data.userId);
  if (removed) {
    logAudit(user.id, "removed", "team", parsed.data.userId);
  }

  return NextResponse.json({ removed });
}
