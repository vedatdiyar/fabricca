"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Library,
  Quote,
  Table,
  Briefcase,
  RotateCcw,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Genel Özet", icon: LayoutDashboard },
  { href: "/thesis-architecture", label: "Tez Mimarisi", icon: Network },
  { href: "/library", label: "Kütüphane", icon: Library },
  { href: "/literature-matrix", label: "Literatür Matrisi", icon: Table },
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
    <nav className="hidden items-center gap-0.5 rounded-full border border-border/50 bg-card/70 p-1 shadow-xs backdrop-blur-sm md:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 select-none",
              isActive
                ? "bg-accent text-accent-foreground font-semibold border border-primary/25 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </Link>
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
