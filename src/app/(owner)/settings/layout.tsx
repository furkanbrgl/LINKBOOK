import Link from "next/link";
import { getOwnerOnboardingStatus } from "@/lib/onboarding/getOwnerOnboardingStatus";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const onboarding = await getOwnerOnboardingStatus();

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="flex flex-wrap items-center gap-3">
          {onboarding != null && (
            <>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Onboarding: {onboarding.done}/{onboarding.total}
              </span>
              <Link
                href="/onboarding"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Checklist
              </Link>
              {onboarding.next != null && (
                <Link
                  href={onboarding.next.href}
                  className="text-sm font-medium text-neutral-700 underline hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                >
                  Next: {onboarding.next.label}
                </Link>
              )}
            </>
          )}
        </div>
      </header>
      <div className="mt-3">
        <SettingsNav />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
