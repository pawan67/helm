"use client";

import Link from "next/link";
import { useLive } from "./live-provider";

/**
 * A banner shown on the dashboard when the device reports an active session, so
 * the user can jump straight to the live screen.
 */
export function LiveNudge() {
  const { state } = useLive();
  const active = state.state === "hanging" || state.state === "rep_up";
  if (!active) return null;

  return (
    <Link
      href="/live"
      className="animate-rise mb-6 flex items-center justify-between gap-4 rounded-2xl border border-lime/40 bg-lime/10 px-5 py-4 transition-colors hover:bg-lime/15"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-lime" />
        </span>
        <div>
          <div className="font-display text-lg tracking-wide text-lime">
            SESSION LIVE
          </div>
          <div className="font-mono text-[0.7rem] text-lime/70">
            {state.reps} reps · on the bar now
          </div>
        </div>
      </div>
      <span className="font-mono text-xs uppercase tracking-widest text-lime">
        Watch →
      </span>
    </Link>
  );
}
