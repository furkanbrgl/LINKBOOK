import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireOwnerShop } from "@/lib/auth/requireOwnerShop";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireOwnerShop();
  return <AppShell shopName={ctx.shop.name}>{children}</AppShell>;
}
