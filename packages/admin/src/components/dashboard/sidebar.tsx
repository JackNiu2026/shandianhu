"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "D" },
  { href: "/assessments", label: "Assessments", icon: "A" },
  { href: "/settings", label: "Settings", icon: "S" },
];

export function Sidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r-2 border-ink bg-surface-paper">
      <div className="border-b-2 border-ink p-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink">Lightning Tiger</h1>
        <p className="mt-1 text-xs text-ink-muted">Administrator</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium transition-all",
              isActive ? "border-ink bg-growth text-white" : "border-transparent text-ink hover:bg-growth-soft",
            )}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
