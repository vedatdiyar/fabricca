import { headers } from "next/headers";
import type { Metadata } from "next";
import { Poppins, Fredoka } from "next/font/google";
import Navigation from "@/components/navigation";
import { SidebarProvider } from "@/components/sidebar-provider";
import MainContent from "@/components/main-content";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Fabricca",
  description: "Fabricca",
};

const AUTH_HEADER = "x-auth-authenticated";
const THESIS_STATE_HEADER = "x-thesis-state";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();

  // Auth & thesis state are pre-computed by proxy.ts — no cookie/hash re-check needed
  const isAuthenticated = headerStore.get(AUTH_HEADER) === "true"
    || !process.env.APP_PASSWORD; // developer onboarding
  const thesisState = headerStore.get(THESIS_STATE_HEADER) ?? "unknown";
  const isThesisCoreEmpty = thesisState !== "present";

  const showSidebar = isAuthenticated && !isThesisCoreEmpty;

  return (
    <html
      lang="tr"
      className={`${poppins.variable} ${fredoka.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="Fabricca" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Toaster />
        {showSidebar ? (
          <SidebarProvider>
            <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background text-foreground">
              {/* Sidebar (Desktop) / Bottom Bar (Mobile) */}
              <Navigation />

              {/* Main Content Area */}
              <MainContent>{children}</MainContent>
            </div>
          </SidebarProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
