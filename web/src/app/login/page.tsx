"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      const from = params.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="bg-atmosphere relative flex min-h-dvh items-center justify-center px-5">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="animate-rise relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-16 w-16" />
          <h1 className="font-display mt-5 text-5xl tracking-wide glow-lime">
            IRONHANG
          </h1>
          <p className="eyebrow mt-3">pull-up · dead-hang · telemetry</p>
        </div>

        <form onSubmit={submit} className="panel ring-accent p-6">
          <label className="eyebrow mb-2 block">Access key</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full rounded-xl border border-line bg-ink-2 px-4 py-3 font-mono text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-lime/60"
          />

          {error && (
            <p className="mt-3 font-mono text-xs text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="mt-5 w-full rounded-xl bg-lime px-4 py-3 font-display text-lg tracking-wider text-ink transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "UNLOCKING…" : "ENTER THE BAR"}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[0.68rem] text-fg-faint">
          single-user · self-hosted
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
