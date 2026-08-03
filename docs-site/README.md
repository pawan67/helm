# HELM Docs

The documentation site for [HELM](../README.md) — the self-hosted ESP32 bar node
(pull-up + climate tracker with IR control) and its Next.js console. Built with
[Fumadocs](https://fumadocs.dev) on Next.js 16.

Content covers the whole build: **hardware** (parts, pin mapping, wiring, reading
resistors, the IR blaster), **firmware** (setup, flashing, calibration, OTA), the
**web console** (local dev, Dokploy deployment, configuration), and
**integrations** (Home Assistant + Google Home voice control, Bixby shortcuts).

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

> This project uses the webpack builder (`next dev/build --webpack`) to match the
> rest of the repo. Turbopack currently mis-resolves the `fumadocs-*` subpath
> exports under pnpm in this setup.

## Build

```bash
pnpm build
pnpm start
```

## Where content lives

All docs are MDX under `content/docs/`. Navigation and section order come from the
`meta.json` files:

```text
content/docs/
  index.mdx                 Overview
  getting-started.mdx       End-to-end path
  meta.json                 Top-level nav order + section separators
  hardware/                 Parts, pin mapping, wiring, resistors, IR blaster
  firmware/                 Setup, flashing, calibration, OTA
  console/                  The web app: local dev, deployment, configuration
  integrations/             Google Home, Home Assistant, voice shortcuts
  reference/                Architecture, MQTT topics
```

To add a page, drop a new `.mdx` file in the right folder with frontmatter
(`title`, `description`, optional `icon` — a [Lucide](https://lucide.dev) name),
then add its slug to that folder's `meta.json` to place it in the nav.

## Key files

| File | Purpose |
| ---- | ------- |
| `lib/source.ts` | Content source adapter (`loader()`), with the Lucide icons plugin. |
| `lib/shared.ts` | App name and GitHub repo info. |
| `lib/layout.shared.tsx` | Shared layout options (nav title, GitHub link). |
| `components/mdx.tsx` | Global MDX components — registers `Steps`/`Step` and `Tabs`/`Tab`. |
| `source.config.ts` | Fumadocs MDX config (frontmatter/meta schema). |
| `app/(home)/page.tsx` | The landing page. |
