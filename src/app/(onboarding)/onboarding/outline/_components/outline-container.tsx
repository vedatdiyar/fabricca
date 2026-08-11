"use client";

import { useState, useCallback } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { OutlineTreeView } from "./outline-tree-view";

interface OutlineSection {
  title: string;
  description: string;
  sortOrder: number;
  subSections?: Array<{
    title: string;
    description: string;
    sortOrder: number;
  }>;
}

interface OutlineContainerProps {
  sections: OutlineSection[];
}

/**
 * Client wrapper that renders the outline tree view and provides
 * the confirm/proceed action to finalize onboarding.
 *
 * @param root0 - Component props.
 * @param root0.sections - The outline sections array.
 * @returns The outline container markup.
 */
export function OutlineContainer({
  sections,
}: OutlineContainerProps) {
  const { proceedFromOutline } = useOnboardingNavigation();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await proceedFromOutline();
    } finally {
      setConfirming(false);
    }
  }, [proceedFromOutline, confirming]);

  return (
    <div className="w-full flex flex-col gap-8">
      <OutlineTreeView sections={sections} />

      <div className="flex justify-end pt-4 pb-8">
        <Button onClick={handleConfirm} disabled={confirming} size="lg" className="shadow-sm">
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Onayla ve Literatür Tarama Adımına Geç
              <ArrowRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
