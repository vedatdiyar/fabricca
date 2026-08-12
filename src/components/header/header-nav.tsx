"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Library,
  Quote,
  Briefcase,
  RotateCcw,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Genel Özet", icon: LayoutDashboard },
  { href: "/thesis-architecture", label: "Tez Mimarisi", icon: Network },
  { href: "/library", label: "Kütüphane", icon: Library },
  { href: "/citation-cards", label: "Alıntı Fişleri", icon: Quote },
  { href: "/advisor", label: "Danışman Odası", icon: Briefcase },
] as const;

/**
 * Horizontal navigation links rendered on desktop (md and up).
 *
 * @returns The desktop nav markup.
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
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
  );
}

/**
 * Fixed bottom navigation bar rendered on mobile/tablet (below md).
 *
 * @param root0 - Component props.
 * @param root0.onOpenOnboarding - Callback invoked to reopen the onboarding flow.
 * @param root0.onLogout - Callback invoked when signing out.
 * @returns The bottom nav markup.
 */
export function BottomNav({
  onOpenOnboarding,
  onLogout,
}: {
  onOpenOnboarding: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
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
          onClick={onOpenOnboarding}
          title="Onboarding'i Gözden Geçir"
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-xs">Onboarding</span>
        </button>
        <button
          className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={onLogout}
          title="Çikis Yap"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-xs">Çıkış</span>
        </button>
      </div>
    </nav>
  );
}
