"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return document.getElementById("thesis-tab-actions");
}

function getServerSnapshot() {
  return null;
}

/**
 * Portal component that mounts children into the thesis architecture main tab header bar (#thesis-tab-actions).
 *
 * @param root0 - Component props.
 * @param root0.children - The action buttons markup to portal.
 * @returns The rendered portal or null if not mounted.
 */
export function TabActions({ children }: { children: React.ReactNode }) {
  const container = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!container) return null;
  return createPortal(children, container);
}
