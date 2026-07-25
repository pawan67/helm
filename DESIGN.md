# Design

Visual system for HELM. Register: **product**. Aesthetic: **industrial command console**
— steel and chalk, one hot hazard signal, hard edges, telemetry that looks like telemetry.
A machined panel for the systems the operator runs (their training, their rooms, their
devices), not a gym app and not a smart-home app. Read [PRODUCT.md](./PRODUCT.md) for the
strategy this serves.

## Visual Theme

Matte machined steel under harsh light. Near-black cool-grey surfaces, chalk-white marks,
structural 1px borders instead of soft shadows, and a single safety-orange "hazard" accent
that only ever means *live / active / now*: a running session, a command firing, a device
awake. Fixed dark theme (no light mode: this is a wall-mounted console glanced at in varied
light, and the equipment metaphor is dark by nature). Texture is a faint film grain, never
gloss or glass. Color strategy: **committed** — steel neutrals carry the surface, hazard
orange is the one saturated voice.

## Color Palette

OKLCH. Neutrals tinted cool (hue 250) so steel reads as steel; the accent brings the warmth.
Never `#000`/`#fff`.

### Steel (neutral surfaces + text)

| Token | OKLCH | Role |
|---|---|---|
| `bg` (canvas) | `oklch(0.15 0.006 250)` | app background |
| `bg.panel` | `oklch(0.185 0.007 250)` | panels, sidebar, top bar |
| `bg.subtle` | `oklch(0.215 0.008 250)` | raised blocks, inputs |
| `bg.muted` | `oklch(0.25 0.009 250)` | hover surface |
| `border.subtle` | `oklch(0.28 0.008 250)` | hairline dividers |
| `border` | `oklch(0.36 0.010 250)` | default borders |
| `border.emphasized` | `oklch(0.44 0.011 250)` | focused / machined edge |
| `fg` (chalk) | `oklch(0.93 0.005 250)` | primary text, big numbers |
| `fg.muted` | `oklch(0.72 0.006 250)` | secondary text |
| `fg.subtle` | `oklch(0.55 0.007 250)` | labels, hints |

### Hazard (the accent — hue ~52, safety orange)

| Token | OKLCH | Role |
|---|---|---|
| `hazard.solid` | `oklch(0.70 0.17 52)` | primary buttons, active nav, live |
| `hazard.emphasized` | `oklch(0.745 0.17 52)` | hover |
| `hazard.fg` | `oklch(0.80 0.15 62)` | accent text on steel |
| `hazard.contrast` | `oklch(0.16 0.02 62)` | text/icon on solid hazard |
| `hazard.muted` | `oklch(0.31 0.065 52)` | accent-tinted panel |
| `hazard.subtle` | `oklch(0.24 0.04 52)` | faint accent wash |

Chroma stays medium (~0.17), never pushed to neon. Energy comes from the L jump against dark
steel, not glow. Registered as the Chakra `colorPalette` named **hazard**.

### Signals (tiny, functional, shape-backed)

| Token | OKLCH | Role |
|---|---|---|
| `online` | `oklch(0.76 0.12 155)` | device online (steel-green) |
| `danger` | `oklch(0.63 0.18 30)` | offline, destructive (rust-red) |

Signals appear only in status dots/badges and destructive actions, always paired with an
icon or label. Hazard is never used for "good/online" and green is never used for "live".

## Typography

Barlow superfamily (industrial signage grotesk) + a tabular mono for telemetry. Loaded via
`next/font/google`, exposed as CSS vars, mapped to Chakra font tokens.

| Role | Family | Use |
|---|---|---|
| **Display** | Barlow Condensed 700/800 | page headings and big rep/hang readouts only. Uppercase, tracking `+0.02em`. |
| **Body** | Barlow 400/500/600 | everything interactive: nav, buttons, labels, paragraphs. Body copy capped 65–75ch. |
| **Mono** | JetBrains Mono 400/500 | timers, distance, dBm, coordinates, chart ticks. `font-variant-numeric: tabular-nums`. |

Product-register discipline: **display font never appears in buttons, form controls, or data
cells** — those are Body or Mono. The only display uses are true headings and the hero numbers.
Small uppercase eyebrow labels (11px, tracking `+0.18em`, `fg.subtle`, leading 1px rule) may use
condensed or mono, since they are heading-like section markers, not controls.

Hierarchy by scale **and** weight: display steps ≥1.25 ratio, condensed 800 vs body 400 gives
strong weight contrast. **Fixed rem scale** (product UI, consistent DPI), not fluid:
display xl `3` · lg `2.25` · md `1.5`; body `1` / `0.875` / `0.8125`. The single exception is the
**live** screen's hero readout, `clamp(5rem, 22vw, 13rem)` — an instrument display sized to be
read across a room, which earns fluid scale where ordinary headings do not.

## Radii, Elevation & Texture

- **Radii are hard.** `xs 1px · sm 2px · md 3px · lg 4px · xl 6px · 2xl 8px`. Full-round is
  reserved for status pills and the sensor gauge. No pill-shaped panels.
- **Elevation via borders, not shadows.** Panels: `bg.panel` + 1px `border.subtle`. A single
  inset top highlight (`box-shadow: inset 0 1px 0 rgba(chalk, .04)`) reads as a machined edge.
  Shadows only for the mobile drawer and true overlays.
- **Film grain.** A fixed, ~3% opacity SVG-noise overlay on the canvas. Subtle enough to feel
  like matte metal, never a visible pattern.
- **Hazard stripe.** 45° `repeating-linear-gradient` of hazard + transparent, ~10px pitch.
  Used *only* on the live/on-bar banner and the PR strip. It is the "caution tape" that marks
  a live surface; never decorative.

## Components

- **Panels** replace cards. Segment with 1px dividers and uppercase section labels, not nested
  boxes. Nested cards are banned; card grids of identical tiles are banned.
- **Buttons.** Primary = solid `hazard`, **body** font semibold (not display), radius `sm`.
  Secondary = `bg.subtle` + 1px border. Nav = ghost; the active item gets a 3px solid hazard tab
  on the inner (menu-facing) edge as a structural position indicator plus a hazard label. That
  inner tab is a deliberate structural marker, not the banned decorative side-stripe on a card.
- **Big metric.** Raw stamped number in Display 800, tabular, with a small uppercase mono unit
  label beneath. Not wrapped in a card — it sits on the surface like a readout. This is the
  deliberate replacement for the SaaS hero-metric template.
- **Status badge.** Pill, `dot + label`: online green, offline rust, live hazard (blinking dot,
  reduced-motion → steady).
- **Inputs / sliders (Settings).** Steel fields, hazard focus ring, mono values. The distance
  gauge is an instrument: chalk ticks, hazard needle/beam.
- **Charts (Recharts 2.x).** Steel gridlines (`border.subtle`), hazard primary series, mono
  tick labels, no legends-as-decoration.

## Motion

- Durations `fast 120ms · base 200ms · slow 320ms`. Easing ease-out only:
  expo `cubic-bezier(0.16, 1, 0.3, 1)`, quart `cubic-bezier(0.25, 1, 0.5, 1)`. No bounce/elastic.
- Never animate layout props (width/height/top). Transform + opacity only.
- **Rep count:** hard, quick pop on each increment. **PR:** a one-shot "stamp" (scale from
  1.3→1 + tiny settle), heavy not sparkly. **Live beam:** slow vertical sweep on the gauge.
- All motion gated behind `prefers-reduced-motion: reduce` → instant state changes.
