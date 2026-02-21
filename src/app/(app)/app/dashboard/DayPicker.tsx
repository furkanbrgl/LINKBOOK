"use client";

import { useRouter } from "next/navigation";

type Props = { day: string };

export function DayPicker({ day }: Props) {
  const router = useRouter();
  return (
    <input
      type="date"
      value={day}
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.replace(`/app/dashboard?day=${v}`);
      }}
      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
    />
  );
}
