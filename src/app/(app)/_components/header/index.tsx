"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import {
  logoutAction,
  reopenOnboardingAction,
  resetOnboardingAction,
} from "@/app/(app)/actions";
import { HeaderNav, BottomNav } from "./header-nav";
import { UserMenu } from "./user-menu";
import {
  ReopenOnboardingDialog,
  ResetAllDataDialog,
} from "./onboarding-dialogs";

/**
 * Top navigation bar for the main app: horizontal nav links on desktop, bottom nav on mobile/tablet.
 *
 * @param root0 - Component props.
 * @param root0.userName - Display name of the signed-in user.
 * @returns The header markup.
 */
export function Header({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

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

  /** Deletes all user data and resets onboarding. */
  function handleConfirmResetAll() {
    setShowResetDialog(false);
    startTransition(async () => {
      queryClient.clear();
      await resetOnboardingAction();
    });
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-19 sm:h-20 w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-4.5 lg:px-8">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <Image
              src="/logo.svg"
              alt="Fabricca"
              width={46}
              height={46}
              priority
              className="shrink-0"
            />
            <span className="badge-brand text-lg font-normal tracking-widest text-foreground">
              FABRICCA
            </span>
          </Link>

          <HeaderNav />

          <UserMenu
            userName={userName}
            onReopenOnboarding={() => setShowReopenDialog(true)}
            onResetAllData={() => setShowResetDialog(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <BottomNav
        onOpenOnboarding={() => setShowReopenDialog(true)}
        onLogout={handleLogout}
      />

      <ReopenOnboardingDialog
        open={showReopenDialog}
        onOpenChange={setShowReopenDialog}
        onConfirm={handleConfirmReopen}
      />

      <ResetAllDataDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={handleConfirmResetAll}
      />
    </>
  );
}
