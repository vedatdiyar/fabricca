"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, RotateCcw, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Dropdown menu showing the user identity and the logout/reopen/reset onboarding actions.
 *
 * @param root0 - Component props.
 * @param root0.userName - Display name of the signed-in user.
 * @param root0.onReopenOnboarding - Callback invoked when reopening the onboarding flow.
 * @param root0.onResetAllData - Callback invoked when resetting all user data.
 * @param root0.onLogout - Callback invoked when signing out.
 * @returns The user menu markup.
 */
export function UserMenu({
  userName,
  onOpenCalendarSettings,
  onReopenOnboarding,
  onResetAllData,
  onLogout,
}: {
  userName: string;
  onOpenCalendarSettings?: () => void;
  onReopenOnboarding: () => void;
  onResetAllData: () => void;
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
          "flex h-8 items-center gap-2 rounded-full border border-border/50 bg-card/70 px-2.5 py-1 transition-all hover:bg-accent/30 hover:border-border",
          isOpen && "bg-accent/50 border-primary/30",
        )}
      >
        <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-[10px] font-semibold border border-primary/20 shrink-0">
          {initials || <User className="h-3 w-3" />}
        </div>

        <span className="text-xs font-medium text-foreground hidden sm:block whitespace-nowrap">
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
        <Card className="absolute right-0 top-full mt-2 w-56 rounded-md p-2 z-50 animate-in fade-in-0 zoom-in-95">
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

          {onOpenCalendarSettings && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCalendarSettings();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-primary shrink-0 hidden" />
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary/80" />
                Akademik Takvim Ayarları
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onReopenOnboarding();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mt-1"
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
              onResetAllData();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>Tüm Verileri Sıfırla</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1 border-t border-border/40 pt-2"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Çıkış Yap</span>
          </button>
        </Card>
      )}
    </div>
  );
}
