import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { Sidebar } from "@/components/Sidebar";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth";
import { listEmails, listFollowUps } from "@/lib/store";
import Link from "next/link";

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            {user ? (
              <div className="flex h-screen bg-bg text-fg">
                <Sidebar
                  user={{ name: user.name, email: user.email }}
                  badges={badges}
                />
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  <main
                    id="main-content"
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="max-w-6xl px-6 py-6 lg:px-8 lg:py-8">
                      {children}
                    </div>
                  </main>
                </div>
              </div>
            ) : (
              <div className="min-h-screen bg-bg text-fg flex flex-col">
                <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
                  <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent text-accent-fg text-xs font-bold">
                        AI
                      </span>
                      <span className="font-semibold text-sm text-fg">SMB AI Ops</span>
                    </Link>
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        href="/login"
                        className="px-3 py-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/signup"
                        className="px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90 transition-opacity"
                      >
                        Sign up
                      </Link>
                    </div>
                  </div>
                </header>
                <main id="main-content" className="flex-1 w-full max-w-md mx-auto px-4 py-8">
                  {children}
                </main>
              </div>
            )}
            <CommandPalette enabled={Boolean(user)} />
            <KeyboardHelp enabled={Boolean(user)} />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
