import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth";
import { listEmails, listFollowUps } from "@/lib/store";

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

  let badges: { inbox?: number; followups?: number } | undefined;
  if (user) {
    const inboxCount = listEmails(user.id).filter((e) => !e.processed).length;
    const draftsCount = listFollowUps(user.id).filter((f) => f.status === "draft").length;
    if (inboxCount > 0 || draftsCount > 0) {
      badges = { inbox: inboxCount, followups: draftsCount };
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Runs synchronously before React hydrates so dark mode doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <div className="min-h-screen bg-bg text-fg flex flex-col">
              <Nav
                user={user ? { name: user.name, email: user.email } : null}
                badges={badges}
              />
              <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">{children}</main>
              {user && <Footer />}
              <CommandPalette enabled={Boolean(user)} />
              <KeyboardHelp enabled={Boolean(user)} />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
