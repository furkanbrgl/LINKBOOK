"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/app/dashboard", label: "Schedule" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/onboarding", label: "Onboarding" },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
