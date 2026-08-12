"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal component that mounts children into the thesis architecture main tab header bar (#thesis-tab-actions).
 *
 * @param root0 - Component props.
 * @param root0.children - The action buttons markup to portal.
 * @returns The rendered portal or null if not mounted.
 */
export function TabActions({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById("thesis-tab-actions"));
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
