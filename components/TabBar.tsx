"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/log", label: "Log" },
  { href: "/trends", label: "Trends" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--line)] flex">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center py-4 text-sm ${
              active ? "text-[var(--acc)]" : "text-[var(--dim)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
