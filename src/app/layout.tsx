import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Poppins, Fredoka } from "next/font/google";
import { getExpectedHash } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { SidebarProvider } from "@/components/sidebar-provider";
import MainContent from "@/components/main-content";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  let isAuthenticated = false;
  if (!password) {
    // Treat as authenticated if password is not configured yet to support developer onboarding
    isAuthenticated = true;
  } else {
    const expectedHash = await getExpectedHash(password);
    isAuthenticated = sessionCookie === expectedHash;
  }

  // Onboarding status check to provide a distraction-free onboarding environment
  let isThesisCoreEmpty = true;
  if (isAuthenticated) {
    try {
      const coreEntries = await db.select().from(thesisCore).limit(1);
      isThesisCoreEmpty = coreEntries.length === 0;
    } catch (error) {
      console.error("Failed to query thesisCore in layout:", error);
      isThesisCoreEmpty = true; // Fallback to true (not completed) on failure
    }
  }

  // Show navigation bar and sidebar only if authenticated AND onboarding is completed
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
