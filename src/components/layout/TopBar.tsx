"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TopBar({
  onOpenMobileNav,
  shopName,
}: {
  onOpenMobileNav: () => void;
  shopName: string;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          ☰
        </button>
        <Link href="/app/dashboard" className="font-semibold tracking-tight">
          Linkbook
        </Link>
        <span className="hidden text-sm text-muted-foreground md:inline">
          {shopName || "Shop"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/onboarding">Onboarding</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/settings">Settings</Link>
        </Button>

        <form action="/app/logout" method="post">
          <Button variant="outline" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}
