import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getWorkspace,
  getWorkspaceMembers,
  getUserById,
  listWorkspaceInvites,
} from "@/lib/store";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { TeamManager } from "@/components/TeamManager";

export const dynamic = "force-dynamic";

export default function TeamPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const fresh = getUserById(user.id);
  if (!fresh) redirect("/login");

  const workspace = fresh.workspaceId
    ? getWorkspace(fresh.workspaceId)
    : undefined;
  const members = fresh.workspaceId
    ? getWorkspaceMembers(fresh.workspaceId)
    : [];
  const invites = fresh.workspaceId
    ? listWorkspaceInvites(fresh.workspaceId).filter((i) => !i.acceptedAt)
    : [];

  const isOwner = workspace?.ownerId === fresh.id;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Team"
        description="Invite a second owner to share your inbox, contacts, and deals."
      />

      <Card>
        <CardHeader
          title={workspace?.name ?? "Your workspace"}
          subtitle={`${members.length} member${members.length === 1 ? "" : "s"}`}
        />
        <CardBody>
          <TeamManager
            members={members.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              isOwner: workspace?.ownerId === m.id,
            }))}
            pendingInvites={invites.map((i) => ({
              id: i.id,
              email: i.email,
              createdAt: i.createdAt,
            }))}
            isOwner={isOwner}
          />
        </CardBody>
      </Card>
    </main>
  );
}
