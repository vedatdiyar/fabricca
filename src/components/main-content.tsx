"use client";

import React from "react";
import { useSidebar } from "./sidebar-provider";

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen } = useSidebar();

  return (
    <main
      className={`flex-1 overflow-y-auto min-h-0 pb-20 md:pb-0 transition-all duration-300 ease-in-out ${
        isSidebarOpen ? "md:pl-64" : "md:pl-16"
      } min-w-0`}
    >
      {children}
    </main>
  );
}
