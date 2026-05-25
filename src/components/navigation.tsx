"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Library,
  GraduationCap,
  ListTodo,
  Lightbulb,
} from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Tez Karargahı",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Kurulum",
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
      <aside className="hidden md:flex flex-col w-64 h-screen bg-sidebar border-r border-border select-none shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="size-8 rounded bg-primary flex items-center justify-center">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-foreground font-sans uppercase">
              Fabricca
            </h1>
          </div>
        </div>

        {/* Vertical Links List */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            // Check if the current route is strictly active or begins with the same pathname (for subroutes)
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition duration-150 group ${
                  isActive
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon
                  className={`size-5 transition duration-150 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-accent-foreground"
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer/System Status Indicator */}
        <div className="p-4 border-t border-border">
          <div className="bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                Sistem Aktif
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground font-sans mt-1">
              Gemini 3.1 Flash Lite
            </p>
          </div>
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
