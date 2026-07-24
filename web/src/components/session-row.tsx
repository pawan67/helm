import type { Session } from "@/db/schema";
import { TypePill } from "./ui";
import { formatHang } from "@/lib/time";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionRow({ session }: { session: Session }) {
  const isPull = session.type === "pullup_set";
  const started = new Date(session.startedAt);
  return (
    <div className="flex items-center gap-4 border-b border-line/70 py-3.5 last:border-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-2">
        <span
          className={`font-display text-xl leading-none tnum ${isPull ? "text-lime" : "text-cyan"}`}
        >
          {isPull ? session.reps : formatHang(session.maxHangMs).replace(" ", "")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TypePill type={session.type} />
        </div>
        <div className="mt-1 font-mono text-[0.7rem] text-fg-faint">
          {started.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {timeAgo(started)}
        </div>
      </div>
      <div className="text-right">
        {isPull ? (
          <>
            <div className="font-mono text-sm text-fg">{session.reps} reps</div>
            <div className="font-mono text-[0.7rem] text-fg-faint">
              {formatHang(session.hangMs)} on bar
            </div>
          </>
        ) : (
          <>
            <div className="font-mono text-sm text-fg">
              {formatHang(session.maxHangMs)}
            </div>
            <div className="font-mono text-[0.7rem] text-fg-faint">best hold</div>
          </>
        )}
      </div>
    </div>
  );
}
