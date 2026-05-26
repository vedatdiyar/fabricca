"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Library,
  GraduationCap,
  ListTodo,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSidebar } from "./sidebar-provider";

export default function Navigation() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  const navItems = [
    {
      name: "Tez Karargahı",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Tez Anayasası",
      href: "/onboarding",
      icon: Sparkles,
    },
    {
      name: "Kütüphane",
      href: "/library",
      icon: Library,
    },
    {
      name: "Görevlerim",
      href: "/tasks",
      icon: ListTodo,
    },
    {
      name: "Fikir Sepeti",
      href: "/insights",
      icon: Lightbulb,
    },
    {
      name: "Danışman Odası",
      href: "/advisor",
      icon: GraduationCap,
    },
  ];

  return (
    <>
      {/* Desktop Sidebar (md breakpoint and up) */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-border select-none shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`border-b border-border flex items-center transition-all duration-300 ${
            isSidebarOpen ? "p-6 justify-start" : "p-3 justify-center"
          }`}
        >
          <div
            className={`flex items-center transition-all duration-300 ${isSidebarOpen ? "gap-3" : "gap-0"}`}
          >
            <div
              className={`flex items-center justify-center shrink-0 transition-all duration-300 ${
                isSidebarOpen ? "size-14" : "size-10"
              }`}
            >
              <Image
                src="/logo.svg"
                alt="Fabricca Logo"
                className="w-full h-full object-contain"
                width={56}
                height={56}
                unoptimized
              />
            </div>
            <h1
              className={`text-2xl font-medium tracking-wider text-foreground font-fredoka transition-all duration-300 ease-in-out ${
                isSidebarOpen
                  ? "opacity-100 max-w-[150px]"
                  : "opacity-0 max-w-0 pointer-events-none"
              } whitespace-nowrap overflow-hidden`}
            >
              FABRICCA
            </h1>
          </div>
        </div>

        {/* Vertical Links List */}
        <nav
          className={`flex-1 py-6 space-y-1.5 overflow-y-auto transition-all duration-300 ${
            isSidebarOpen ? "px-4" : "px-2"
          }`}
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg text-sm font-medium transition-all duration-300 group ${
                  isSidebarOpen
                    ? "px-3 py-2.5 gap-3"
                    : "px-0 py-2.5 justify-center gap-0"
                } ${
                  isActive
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <Icon
                  className={`size-5 shrink-0 transition duration-150 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-accent-foreground"
                  }`}
                />
                <span
                  className={`transition-all duration-300 ease-in-out ${
                    isSidebarOpen
                      ? "opacity-100 max-w-[200px]"
                      : "opacity-0 max-w-0 pointer-events-none"
                  } whitespace-nowrap overflow-hidden`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Toggle Button at the bottom */}
        <div
          className={`p-4 border-t border-border transition-all duration-300 ${isSidebarOpen ? "px-4" : "px-2"}`}
        >
          <button
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-lg text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer ${
              isSidebarOpen
                ? "px-3 py-2.5 gap-3"
                : "px-0 py-2.5 justify-center gap-0"
            }`}
            title={isSidebarOpen ? "Daralt" : "Genişlet"}
          >
            {isSidebarOpen ? (
              <>
                <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
                <span className="opacity-100 max-w-[200px] whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out">
                  Daralt
                </span>
              </>
            ) : (
              <>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                <span className="opacity-0 max-w-0 pointer-events-none whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out">
                  Genişlet
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (below md breakpoint) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-border flex items-center justify-around px-2 z-50 select-none">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition duration-150 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5 mb-1 transition duration-150" />
              <span className="text-[9px] font-medium tracking-tight truncate max-w-[80px]">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
