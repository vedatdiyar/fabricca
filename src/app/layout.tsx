import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Poppins, Fredoka } from "next/font/google";
import { getExpectedHash } from "@/lib/auth";
import Navigation from "@/components/navigation";
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
  title: "Fabricca - Tez Stratejisi ve RAG Karargahı",
  description:
    "Siyaset Bilimi Tez Karargahı ve Dijital Akademik Danışman Portali",
  icons: {
    icon: [
      { url: "/icon0.svg", type: "image/svg+xml" },
      { url: "/icon1.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-title": "Fabricca",
  },
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

  return (
    <html lang="tr" className={`${poppins.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {isAuthenticated ? (
          <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background text-foreground">
            {/* Sidebar (Desktop) / Bottom Bar (Mobile) */}
            <Navigation />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-0">
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
