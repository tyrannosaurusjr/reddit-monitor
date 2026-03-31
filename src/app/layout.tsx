import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ProjectProvider } from "@/lib/project-context";
import { AuthSessionProvider } from "@/components/session-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RedditReach — Reddit Outreach Platform",
  description: "Monitor subreddits, draft replies, and schedule outreach across multiple projects",
  manifest: "/manifest.json",
  themeColor: "#f97316",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RedditReach",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <AuthSessionProvider>
          <ProjectProvider>
            <div className="flex min-h-screen">
              <Nav />
              <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
              </main>
            </div>
          </ProjectProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
