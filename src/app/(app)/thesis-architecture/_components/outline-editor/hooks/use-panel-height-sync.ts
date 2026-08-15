"use client";

import { useEffect, useRef, useState } from "react";
import { Outline } from "@/db/schema";

interface UsePanelHeightSyncResult {
  rightPanelRef: React.RefObject<HTMLDivElement | null>;
  rightPanelHeight: number | undefined;
}

/**
 * Synchronizes the left tree column height with the measured height of the
 * right panel via ResizeObserver and window resize, active only on desktop.
 *
 * @param selectedOutlineId - The currently selected outline id (triggers remeasure).
 * @param outlinesList - The outline sections of the thesis (triggers remeasure).
 * @returns A ref to attach to the right panel and the measured height.
 */
export function usePanelHeightSync(
  selectedOutlineId: number | null,
  outlinesList: Outline[],
): UsePanelHeightSyncResult {
  // Dynamic height sync: sidebar matches right panel height strictly
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [rightPanelHeight, setRightPanelHeight] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;

    const measureHeight = () => {
      if (window.innerWidth >= 1024) {
        setRightPanelHeight(el.offsetHeight);
      } else {
        setRightPanelHeight(undefined);
      }
    };

    measureHeight();

    const ro = new ResizeObserver(() => {
      measureHeight();
    });
    ro.observe(el);
    window.addEventListener("resize", measureHeight);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureHeight);
    };
  }, [selectedOutlineId, outlinesList]);

  return { rightPanelRef, rightPanelHeight };
}
