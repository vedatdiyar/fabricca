"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Library,
  Quote,
  Briefcase,
  LogOut,
  RotateCcw,
  ChevronDown,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logoutAction, reopenOnboardingAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Genel Özet", icon: LayoutDashboard },
  { href: "/library", label: "Kütüphane", icon: Library },
  { href: "/citation-cards", label: "Alıntı Fişleri", icon: Quote },
  { href: "/advisor", label: "Danışman Odası", icon: Briefcase },
] as const;

/**
 * Top navigation bar for the main app: horizontal nav links on desktop, bottom nav on mobile/tablet.
 *
 * @param root0 - Component props.
 * @param root0.userName - Display name of the signed-in user.
 * @returns The header markup.
 */
export function Header({ userName }: { userName: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  /** Clears the client query cache and signs the user out. */
  function handleLogout() {
    startTransition(async () => {
      queryClient.clear();
      await logoutAction();
    });
  }

  /** Reopens the onboarding flow without clearing user data. */
  function handleConfirmReopen() {
    setShowReopenDialog(false);
    startTransition(async () => {
      queryClient.clear();
      await reopenOnboardingAction();
    });
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
              priority
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

          <UserMenu
            userName={userName}
            onReopenOnboarding={() => setShowReopenDialog(true)}
            onLogout={handleLogout}
          />
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
            onClick={() => setShowReopenDialog(true)}
            title="Onboarding'i Gözden Geçir"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="text-xs">Onboarding</span>
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

      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Onboarding Adımlarına Dön
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Mevcut akademik verileriniz silinmeden onboarding kurulum
              adımlarını kaldığınız yerden gözden geçirmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReopen}
              className="text-xs font-medium"
            >
              Evet, Devam Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Dropdown menu showing the user identity and the logout/reopen onboarding actions.
 *
 * @param root0 - Component props.
 * @param root0.userName - Display name of the signed-in user.
 * @param root0.onReopenOnboarding - Callback invoked when reopening the onboarding flow.
 * @param root0.onLogout - Callback invoked when signing out.
 * @returns The user menu markup.
 */
function UserMenu({
  userName,
  onReopenOnboarding,
  onLogout,
}: {
  userName: string;
  onReopenOnboarding: () => void;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /** Closes the menu when a click lands outside of it.
     *
     * @param event - The mouse down event to inspect.
     */
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    /** Closes the menu when the Escape key is pressed.
     *
     * @param event - The key down event to inspect.
     */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0].toUpperCase())
    .join("");

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border/40 bg-background px-3 py-2 transition-all hover:bg-accent/20",
          isOpen && "bg-accent/20 border-primary/20",
        )}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-semibold border border-primary/20 shrink-0">
          {initials || <User className="h-3 w-3" />}
        </div>

        <span className="max-w-32 truncate text-xs font-medium text-foreground hidden sm:block">
          {userName}
        </span>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-foreground",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-card p-2 z-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center gap-2 p-2 border-b border-border/40 pb-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold border border-primary/20 shrink-0">
              {initials || <User className="h-4 w-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">
                {userName}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                Akademik Araştırmacı
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onReopenOnboarding();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-4 w-4 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span>Onboarding&apos;i Gözden Geçir</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </div>
  );
}
