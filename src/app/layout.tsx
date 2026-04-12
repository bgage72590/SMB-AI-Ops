import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { Nav } from "@/components/Nav";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs synchronously before React hydrates so dark mode doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <div className="min-h-screen bg-bg text-fg">
              <Nav
                user={user ? { name: user.name, email: user.email } : null}
              />
              <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">{children}</main>
              <CommandPalette enabled={Boolean(user)} />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
