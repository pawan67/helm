import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="font-display mt-2 text-4xl tracking-wide sm:text-5xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

type Accent = "lime" | "cyan" | "amber" | "fg";

const accentText: Record<Accent, string> = {
  lime: "text-lime",
  cyan: "text-cyan",
  amber: "text-amber",
  fg: "text-fg",
};

export function StatCard({
  label,
  value,
  unit,
  accent = "fg",
  sub,
  glow,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: Accent;
  sub?: ReactNode;
  glow?: boolean;
}) {
  return (
    <div className="panel group relative overflow-hidden p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-display text-5xl leading-none tnum ${accentText[accent]} ${
            glow ? (accent === "cyan" ? "glow-cyan" : "glow-lime") : ""
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs uppercase tracking-widest text-fg-faint">
            {unit}
          </span>
        )}
      </div>
      {sub && <div className="mt-2 text-sm text-fg-dim">{sub}</div>}
    </div>
  );
}

/** Circular goal ring. `value`/`max` drive the arc; children render centered. */
export function RingProgress({
  value,
  max,
  size = 168,
  stroke = 12,
  accent = "lime",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  accent?: Accent;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const dash = c * pct;
  const strokeColor =
    accent === "cyan"
      ? "var(--color-cyan)"
      : accent === "amber"
        ? "var(--color-amber)"
        : "var(--color-lime)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{
            transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)",
            filter: `drop-shadow(0 0 8px color-mix(in srgb, ${strokeColor} 55%, transparent))`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** A slim horizontal meter. */
export function Meter({
  value,
  max,
  accent = "lime",
}: {
  value: number;
  max: number;
  accent?: Accent;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    accent === "cyan"
      ? "var(--color-cyan)"
      : accent === "amber"
        ? "var(--color-amber)"
        : "var(--color-lime)";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 12px color-mix(in srgb, ${color} 60%, transparent)`,
        }}
      />
    </div>
  );
}

export function TypePill({ type }: { type: "pullup_set" | "dead_hang" }) {
  const isPull = type === "pullup_set";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-widest ${
        isPull
          ? "border-lime/30 bg-lime/10 text-lime"
          : "border-cyan/30 bg-cyan/10 text-cyan"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isPull ? "bg-lime" : "bg-cyan"}`}
      />
      {isPull ? "Pull-ups" : "Dead hang"}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="font-display text-2xl text-fg-dim">{title}</div>
      <p className="max-w-sm text-sm text-fg-faint">{hint}</p>
    </div>
  );
}
