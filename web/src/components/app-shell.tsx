"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLive } from "./live-provider";
import { Logo } from "./logo";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconGrid },
  { href: "/live", label: "Live", icon: IconPulse },
  { href: "/history", label: "History", icon: IconChart },
  { href: "/records", label: "Records", icon: IconTrophy },
  { href: "/settings", label: "Settings", icon: IconGear },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, connected } = useLive();
  const online = state.deviceOnline && connected;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="bg-atmosphere relative min-h-dvh">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-ink/70 px-5 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex items-center gap-3 px-1">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="font-display text-2xl tracking-wide text-fg">
              IRONHANG
            </div>
            <div className="eyebrow mt-1 !text-[0.6rem]">bar telemetry</div>
          </div>
        </Link>

        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-panel-2 text-fg"
                    : "text-fg-dim hover:bg-panel/60 hover:text-fg"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-lime shadow-[0_0_12px] shadow-lime/60" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] ${active ? "text-lime" : "text-fg-faint group-hover:text-fg-dim"}`}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <DeviceBadge online={online} rssi={state.rssi} />

        <button
          onClick={logout}
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-fg-faint transition-colors hover:bg-panel/60 hover:text-danger"
        >
          <IconLogout className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-display text-xl tracking-wide">IRONHANG</span>
        </Link>
        <div className="flex items-center gap-3">
          <StatusDot online={online} />
          <button
            onClick={logout}
            aria-label="Sign out"
            className="text-fg-faint hover:text-danger"
          >
            <IconLogout className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-line bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              {active && (
                <span className="absolute top-0 h-[3px] w-8 rounded-full bg-lime shadow-[0_0_10px] shadow-lime/60" />
              )}
              <Icon
                className={`h-5 w-5 ${active ? "text-lime" : "text-fg-faint"}`}
              />
              <span
                className={`text-[0.62rem] font-medium ${active ? "text-fg" : "text-fg-faint"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function DeviceBadge({ online, rssi }: { online: boolean; rssi: number | null }) {
  return (
    <div className="panel-inset flex items-center justify-between rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <StatusDot online={online} />
        <div className="leading-tight">
          <div className="text-xs font-semibold text-fg">
            {online ? "Device online" : "Device offline"}
          </div>
          <div className="font-mono text-[0.62rem] text-fg-faint">
            {online && rssi != null ? `${rssi} dBm` : "bar-01"}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          online ? "bg-lime" : "bg-danger"
        }`}
      />
    </span>
  );
}

/* ---- inline icons (stroke, 1.6) ---- */
function base(props: React.SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}
function IconGrid(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconPulse(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M2 12h4l2.5-7 5 14L16 12h6" />
    </svg>
  );
}
function IconChart(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconTrophy(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v3" />
    </svg>
  );
}
function IconGear(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
function IconLogout(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
