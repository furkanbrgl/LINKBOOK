import Link from "next/link";

const ITEMS = [
  { href: "/settings", label: "General" },
  { href: "/settings/staff", label: "Staff" },
  { href: "/settings/services", label: "Services" },
  { href: "/settings/hours", label: "Working hours" },
] as const;

export function SettingsNav({ currentPath }: { currentPath: string }) {
  const path = currentPath.replace(/\/$/, "") || "/settings";

  return (
    <nav
      className="flex flex-wrap gap-1"
      aria-label="Settings"
    >
      {ITEMS.map(({ href, label }) => {
        const isActive =
          path === href || (href === "/settings" && path === "/settings");
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-neutral-200 text-neutral-900 underline dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
