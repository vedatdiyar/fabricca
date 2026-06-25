"use client";

import { startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  MessageSquareCode,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction, resetOnboardingAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Genel Özet", icon: LayoutDashboard },
  { href: "/library", label: "Kütüphane", icon: BookOpen },
  { href: "/card-index", label: "Dijital Kartoteks", icon: Layers },
  { href: "/advisor", label: "Danışman Odası", icon: MessageSquareCode },
] as const;

/**
 * Ana uygulamanin üst navigasyon çubuğu (Header).
 * Desktop'ta yatay nav linkleri, mobil/tablet'te alt navigation bar (Bottom Nav) olarak çalışir.
 * Aktif rota usePathname ile tespit edilir.
 *
 * @param userName - Giriş yapan kullanicinin adi
 */
export function Header({ userName }: { userName: string }) {
  const pathname = usePathname();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  function handleReset() {
    if (
      window.confirm(
        "Onboarding sürecini sıfırlamak istediğinize emin misiniz? Tüm verileriniz silinecek ve başa döneceksiniz.",
      )
    ) {
      startTransition(async () => {
        await resetOnboardingAction();
      });
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Fabricca"
              width={55}
              height={55}
              className="shrink-0"
            />
            <span className="badge-brand text-xl font-normal tracking-widest text-foreground">
              FABRICCA
            </span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;

              return (
                <Button
                  key={href}
                  variant="ghost"
                  asChild
                  className={cn(
                    "header-nav-item",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Link href={href}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-28 truncate text-sm text-muted-foreground sm:block">
              {userName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={handleReset}
              title="Süreci Sıfırla"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={handleLogout}
              title="Çikis Yap"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-around px-4 sm:px-6 lg:px-8">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "bottom-nav-item",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleReset}
            title="Süreci Sıfırla"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="text-xs">Sıfırla</span>
          </button>
          <button
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            title="Çikis Yap"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-xs">Çıkış</span>
          </button>
        </div>
      </nav>
    </>
  );
}
