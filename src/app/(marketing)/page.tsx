import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <main className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-5xl">
          Linkbook
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Simple online booking for your business. Let customers book
          appointments 24/7.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Log in
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Learn more
          </a>
        </div>
      </main>
    </div>
  );
}
