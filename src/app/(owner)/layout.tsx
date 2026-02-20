import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/requireOwner";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const owner = await requireOwner();
  if (!owner) redirect("/login");
  return <>{children}</>;
}
