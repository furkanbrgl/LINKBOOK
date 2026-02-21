"use client";

import { ReactNode, useState } from "react";
import { TopBar } from "./TopBar";
import { SidebarNav } from "./SidebarNav";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell({
  children,
  shopName,
}: {
  children: ReactNode;
  shopName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/20">
      <TopBar onOpenMobileNav={() => setOpen(true)} shopName={shopName} />

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 border-r bg-background p-4 md:block">
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground">
              Workspace
            </div>
            <div className="mt-1 text-sm font-semibold">Owner</div>
          </div>
          <SidebarNav />
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-4">
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground">
                Workspace
              </div>
              <div className="mt-1 text-sm font-semibold">Owner</div>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
