"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type SidebarContextType = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("fabricca_sidebar_open");
    const isOpen = saved !== null ? saved === "true" : true;

    const handle = requestAnimationFrame(() => {
      setIsSidebarOpen(isOpen);
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("fabricca_sidebar_open", String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen: isMounted ? isSidebarOpen : true,
        toggleSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
