import Link from 'next/link';

const sections = [
  {
    title: 'Hardware',
    href: '/docs/hardware',
    desc: 'Parts list, the full ESP32 pin map, and a beginner wiring walkthrough.',
  },
  {
    title: 'Firmware',
    href: '/docs/firmware',
    desc: 'Flash the bar node, calibrate the sensor, and push OTA updates.',
  },
  {
    title: 'Web console',
    href: '/docs/console',
    desc: 'Run it locally, deploy on Dokploy, and set every environment variable.',
  },
  {
    title: 'Integrations',
    href: '/docs/integrations',
    desc: 'Voice control the AC and fan through Home Assistant and Google Home.',
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-20">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <span className="rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          Self-hosted home &amp; body console
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">HELM</h1>
        <p className="mt-4 max-w-xl text-fd-muted-foreground">
          An ESP32 bar node that counts pull-ups and dead-hang time, reports room
          climate, and blasts IR to your AC and fan — all streaming live to a
          Next.js console you host yourself. This is the build &amp; setup guide.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Read the docs
          </Link>
          <Link
            href="/docs/hardware/pin-mapping"
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Pin mapping
          </Link>
        </div>
      </div>

      <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-fd-border bg-fd-card p-5 text-left transition-colors hover:bg-fd-accent"
          >
            <h2 className="font-semibold group-hover:text-fd-accent-foreground">
              {s.title}
            </h2>
            <p className="mt-1 text-sm text-fd-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
