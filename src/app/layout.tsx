import type { Metadata } from "next";
import { Space_Grotesk, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import QueryProvider from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const fontSerif = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Fabricca — Dijital Tez Asistanı",
  description:
    "Yüksek lisans ve doktora öğrencileri için yapay zeka destekli akademik çalışma platformu",
  icons: [
    { rel: "icon", url: "/icon0.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/icon1.png", type: "image/png" },
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Fabricca",
  },
};

/**
 * Global root layout.
 * Tüm sayfaları saran üst yapıdır.
 * Sonner Toaster tüm sayfalarda görünebilmesi için buraya eklenmiştir.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}
    >
      <body>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
