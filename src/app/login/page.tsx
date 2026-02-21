"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/supabase.browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace("/app/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-2 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Use your Supabase Email auth user
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Don&apos;t have an account?{" "}
          <span className="text-neutral-400 dark:text-neutral-500">
            Create account
          </span>{" "}
          (coming soon)
        </p>
      </div>
    </div>
  );
}
