"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Target,
  FolderKanban,
  BookOpen,
  Library,
  Table,
  Quote,
  Briefcase,
  RotateCcw,
  LogOut,
  ChevronDown,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export const THESIS_ITEMS = [
  { href: "/thesis-architecture/matrix", label: "Tez Matrisi", icon: Target },
  {
    href: "/thesis-architecture/boxes",
    label: "Konu Kutuları",
    icon: FolderKanban,
  },
  {
    href: "/thesis-architecture/outline",
    label: "Bölüm Planı",
    icon: BookOpen,
  },
] as const;

export const LITERATURE_ITEMS = [
  { href: "/library", label: "Kütüphane", icon: Library },
  { href: "/literature-matrix", label: "Literatür Matrisi", icon: Table },
  { href: "/citation-cards", label: "Alıntı Fişleri", icon: Quote },
] as const;

/**
 * Horizontal navigation links rendered on desktop (md and up).
 * Uses dropdown menus for grouped items to keep the pill nav clean.
 *
 * @returns The desktop nav markup.
 */
export function HeaderNav() {
  const pathname = usePathname();

  const isThesisActive = pathname.startsWith("/thesis-architecture");
  const isLiteratureActive =
    pathname === "/library" ||
    pathname === "/literature-matrix" ||
    pathname === "/citation-cards";

  return (
    <nav className="hidden items-center gap-1 rounded-full border border-border/50 bg-card/70 p-1 shadow-xs backdrop-blur-sm md:flex">
      {/* 1. Genel Özet */}
      <Link
        href="/dashboard"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 select-none",
          pathname === "/dashboard"
            ? "bg-accent text-accent-foreground font-semibold border border-primary/25 shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
        )}
      >
        <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
        <span>Genel Özet</span>
      </Link>

      {/* 2. Tez Mimarisi (Dropdown) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 select-none cursor-pointer",
            isThesisActive
              ? "bg-accent text-accent-foreground font-semibold border border-primary/25 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
          )}
        >
          <Network className="h-3.5 w-3.5 shrink-0" />
          <span>Tez Mimarisi</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 p-1">
          {THESIS_ITEMS.map((item) => (
            <DropdownMenuItem key={item.href} className="p-0">
              <Link
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-2 text-xs rounded-sm select-none",
                  pathname === item.href
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent/50",
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 3. Literatür & Kaynaklar (Dropdown) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 select-none cursor-pointer",
            isLiteratureActive
              ? "bg-accent text-accent-foreground font-semibold border border-primary/25 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
          )}
        >
          <BookMarked className="h-3.5 w-3.5 shrink-0" />
          <span>Literatür & Kaynaklar</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 p-1">
          {LITERATURE_ITEMS.map((item) => (
            <DropdownMenuItem key={item.href} className="p-0">
              <Link
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-2 text-xs rounded-sm select-none",
                  pathname === item.href
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent/50",
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 4. Danışman Odası */}
      <Link
        href="/advisor"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 select-none",
          pathname === "/advisor"
            ? "bg-accent text-accent-foreground font-semibold border border-primary/25 shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
        )}
      >
        <Briefcase className="h-3.5 w-3.5 shrink-0" />
        <span>Danışman Odası</span>
      </Link>
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

  const isThesisActive = pathname.startsWith("/thesis-architecture");
  const isLiteratureActive =
    pathname === "/library" ||
    pathname === "/literature-matrix" ||
    pathname === "/citation-cards";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-around px-2 sm:px-4">
        {/* 1. Genel Özet */}
        <Link
          href="/dashboard"
          className={cn(
            "bottom-nav-item",
            pathname === "/dashboard"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Özet</span>
        </Link>

        {/* 2. Tez Mimarisi (Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "bottom-nav-item cursor-pointer",
              isThesisActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Network className="h-5 w-5" />
            <span>Mimarisi</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 p-1 mb-2">
            {THESIS_ITEMS.map((item) => (
              <DropdownMenuItem key={item.href} className="p-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-2 text-xs rounded-sm select-none",
                    pathname === item.href
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent/50",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 3. Literatür (Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "bottom-nav-item cursor-pointer",
              isLiteratureActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookMarked className="h-5 w-5" />
            <span>Literatür</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 p-1 mb-2">
            {LITERATURE_ITEMS.map((item) => (
              <DropdownMenuItem key={item.href} className="p-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-2 text-xs rounded-sm select-none",
                    pathname === item.href
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent/50",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 4. Danışman */}
        <Link
          href="/advisor"
          className={cn(
            "bottom-nav-item",
            pathname === "/advisor"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Briefcase className="h-5 w-5" />
          <span>Danışman</span>
        </Link>

        {/* Action Buttons */}
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={onOpenOnboarding}
          title="Onboarding'i Gözden Geçir"
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-[10px]">Onboarding</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={onLogout}
          title="Çıkış Yap"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px]">Çıkış</span>
        </button>
      </div>
    </nav>
  );
}
