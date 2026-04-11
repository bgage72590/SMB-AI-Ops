import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { Nav } from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "SMB AI Ops — AI Office Manager",
  description:
    "AI office manager for small businesses. Reads inbox, updates CRM, drafts follow-ups, tracks deals.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getCurrentUser();
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <Nav
            user={user ? { name: user.name, email: user.email } : null}
          />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
          <CommandPalette enabled={Boolean(user)} />
        </div>
      </body>
    </html>
  );
}
