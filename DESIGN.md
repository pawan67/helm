---
name: HELM
description: A calm, premium self-hosted console for the home & body systems you run.
colors:
  # Slate neutrals (hue 260, near-zero chroma) — the surface layering.
  canvas: "oklch(0.175 0.006 260)"
  panel: "oklch(0.205 0.007 260)"
  surface-subtle: "oklch(0.225 0.007 260)"
  surface-muted: "oklch(0.26 0.008 260)"
  surface-emphasized: "oklch(0.30 0.008 260)"
  border: "oklch(0.34 0.008 260)"
  border-subtle: "oklch(0.285 0.008 260)"
  border-emphasized: "oklch(0.42 0.009 260)"
  fg: "oklch(0.96 0.004 260)"
  fg-muted: "oklch(0.74 0.006 260)"
  fg-subtle: "oklch(0.64 0.007 260)"
  # Lime — the one primary signal (chartreuse, hue 128): live / interactive / device-on.
  lime-solid: "oklch(0.87 0.21 128)"
  lime-fg: "oklch(0.91 0.17 128)"
  lime-ink: "oklch(0.20 0.03 130)"
  # Cyan — endurance & humidity (hue 246): hang time, moisture.
  cyan-solid: "oklch(0.71 0.12 246)"
  cyan-fg: "oklch(0.82 0.085 245)"
  # Amber — reward & heat ONLY (hue 72): streaks, PRs, goals, temperature.
  amber-solid: "oklch(0.77 0.135 72)"
  amber-fg: "oklch(0.85 0.115 76)"
  amber-ink: "oklch(0.20 0.04 70)"
  # Green — device ready / connected (hue 150).
  online-solid: "oklch(0.73 0.125 150)"
  online-fg: "oklch(0.83 0.115 152)"
  # Red — fault / offline / destructive (hue 28).
  danger-solid: "oklch(0.56 0.175 28)"
  danger-fg: "oklch(0.78 0.13 29)"
  danger-ink: "oklch(0.97 0.01 28)"
typography:
  hero:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(7rem, 30vw, 17rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  heading:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  metric:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tabular-nums"
  eyebrow:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.01em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  "2xl": "24px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.lime-solid}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
  button-destructive:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  stat-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.2xl}"
  input:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
  nav-item-active:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.lime-fg}"
    rounded: "{rounded.md}"
  badge-pill:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.pill}"
---

# Design System: HELM

## 1. Overview

**Creative North Star: "The Quiet Helm"**

HELM is a calm, premium instrument panel for the systems one operator runs under their own roof: their training on the bar, the climate of their rooms, the devices they command by infrared. The surface is soft layered slate under low light, and it stays visually silent until something matters, at which point a single bold lime signal lights the one thing worth reading. The feeling is a well-made control panel at dusk, not a cloud app: sovereign, quiet, and legible across a room.

The system is dark-only by intent (a console glanced at on a wall or a propped-up phone in varied light) and telemetry-first. The dominant reading on any screen carries the mass; everything else recedes into muted slate. Corners are softly rounded and depth is gentle, so the panel reads as premium hardware rather than a flat spec sheet, but it never tips into playful: no pastel bubbles, no chatty assistant, no confetti. Warmth is reserved. The one warm color, amber, appears only when the operator has earned it.

This system explicitly rejects the generic SaaS dashboard (identical rounded card grids, the big-number-hero template, gradient accents, the stock-component look), the consumer smart-home app (pastel round bubbles, "Good morning!" greeting cards, cloud dependency), the neon crypto / gamer look (glow on pure black, gradient text), and any cluttered, data-dense screen where nothing dominates.

**Key Characteristics:**
- Dark-only, soft-slate surface with a single lime signal.
- One dominant, glanceable reading per screen; everything else muted.
- Telemetry set in tabular mono; headings and hero numbers in a friendly geometric sans.
- Softly rounded corners (6–24px) and gentle, layered depth, never flat and never glassy.
- Reserved color: lime for "live / on," amber for reward only, green/red for device state.

## 2. Colors

A near-monochrome slate palette carrying one bold accent, with three functional signals held in reserve. Every neutral is faintly cooled toward hue 260 so the surface reads as slate, not dead gray; no value is pure black or pure white.

### Primary
- **Signal Lime** (`oklch(0.87 0.21 128)`): the one primary voice. Primary buttons, active navigation, the live rep counter, the "session live" banner, device-on state, focus rings, text selection. Its lighter tint (`lime-fg` `oklch(0.91 0.17 128)`) is the readable lime for text and icons on slate; its dark ink (`lime-ink` `oklch(0.20 0.03 130)`) is the text color on a lime fill.

### Secondary
- **Endurance Cyan** (`oklch(0.71 0.12 246)`): a soft blue for duration and moisture, distinct from lime so "hang time" and "humidity" never read as "live." Used on the dead-hang metric, the hang-zone gauge band, and humidity readings. Text tint `cyan-fg` (`oklch(0.82 0.085 245)`).

### Tertiary
- **Reward Amber** (`oklch(0.77 0.135 72)`): warm, softened from safety-orange to honey. Strictly the reward-and-heat color: streaks, personal records, goal-hit states, and temperature. It is never a primary action. Text tint `amber-fg` (`oklch(0.85 0.115 76)`); ink on fill `amber-ink` (`oklch(0.20 0.04 70)`).

### Neutral
- **Canvas Slate** (`oklch(0.175 0.006 260)`): app background.
- **Panel Slate** (`oklch(0.205 0.007 260)`): cards, sidebar, top bar, tiles. The default raised surface.
- **Subtle / Muted / Emphasized Slate** (`0.225` / `0.26` / `0.30` L): inputs, raised blocks, hover surfaces, gauge tracks.
- **Chalk** (`fg` `oklch(0.96 0.004 260)`): primary text and big numbers. **Muted** (`0.74` L) for secondary text; **Subtle** (`0.64` L) for labels, units, and hints.
- **Borders** (`border` `0.34` L, `subtle` `0.285`, `emphasized` `0.42`): hairline structure in place of heavy shadow.

### Signals
- **Ready Green** (`oklch(0.73 0.125 150)`): device online / connected. Text tint `online-fg` (`0.83` L).
- **Fault Red** (`oklch(0.56 0.175 28)`): offline, destructive actions. Deep enough that its near-white ink (`danger-ink` `oklch(0.97 0.01 28)`) clears WCAG AA on a solid fill. Text tint `danger-fg` (`0.78` L).

### Named Rules
**The One Signal Rule.** Lime means live, interactive, or on, and nothing else. It is the only accent used for primary actions and the only color that says "now." Do not spend it on decoration.

**The Earned-Amber Rule.** Amber appears only as a reward or a heat reading: a streak, a PR, a hit goal, a temperature. It is never a button, never a nav state, never a default accent. Its rarity is what makes a PR land.

**The Tinted-Neutral Rule.** Every neutral carries hue 260 at chroma ≤0.008. Pure `#000` / `#fff` are forbidden; the slate must read as slate.

## 3. Typography

**Display / Body Font:** Plus Jakarta Sans (with `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). One friendly geometric sans carries headings, hero numbers, buttons, labels, and body. Headings are simply the body face at its heaviest weights.
**Telemetry Font:** JetBrains Mono (with `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`).

**Character:** Warm, geometric, and confident without shouting. The single-family choice keeps the interface quiet; contrast comes from weight and size, not from mixing typefaces. Mono is reserved so that any *changing* number reads as an instrument.

### Hierarchy
- **Hero Readout** (800, `clamp(7rem, 30vw, 17rem)`, line-height 0.9, tracking -0.03em, tabular): the live rep counter, read across a room. The one place fluid scale is earned.
- **Heading** (700, `clamp(1.5rem–1.875rem)`, line-height 1.05, tracking -0.02em): page and section titles.
- **Title** (600–700, ~1.25rem): card and dialog headings, device names.
- **Body** (400–500, 1rem / 0.875rem): interactive text, paragraphs. Prose capped at 65–75ch.
- **Metric** (mono, 500, tabular): timers, distances, dBm, temperatures, chart ticks, any small changing value.
- **Eyebrow / Label** (600, 0.75rem and down to 9–11px, tracking 0.01em, `fg-subtle`): quiet section markers, often with a small lime tick.

### Named Rules
**The Telemetry-Is-Mono Rule.** If a number changes on screen (a timer, a distance, a reading, a count), it is set in JetBrains Mono with `tabular-nums` so it never jitters or reflows. Static numbers may use the sans.

**The Weight-Not-Face Rule.** Hierarchy is built from weight (400 → 800) and size, on one family. Do not reach for a second display face to create emphasis.

## 4. Elevation

Soft and layered, never flat and never glassy. Depth is built from three cheap, physical cues stacked in order: a tonal step up in slate (canvas → panel → subtle), a 1px structural border, and a faint machined sheen. Heavy drop shadows and glass are avoided; the panel should feel like matte, lit hardware.

### Shadow Vocabulary
- **Machined edge** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.18)`, the `.ih-machined` class): the default panel/tile depth. A one-pixel top highlight over a whisper of drop shadow reads as a bevelled metal edge.
- **Overlay shadow** (Chakra `shadow="lg"`): reserved for true overlays only, the mobile drawer, dialogs, and the sticky save bar.

### Named Rules
**The Border-Before-Shadow Rule.** Separation is a 1px `border-subtle` and a tonal step first. Shadow is added only for genuine floating layers (drawer, dialog, sticky bar).

**The Rare-Glass Rule.** `backdrop-filter: blur()` is allowed on exactly two surfaces, the sticky top bar and the sticky settings save bar, where content scrolls beneath. It is never a decorative glass card.

## 5. Components

### Buttons
- **Shape:** softly rounded (8px, `rounded.sm`), body font at semibold. Never the case where a display face lands in a control.
- **Primary:** solid Signal Lime fill with `lime-ink` text. Hover lifts one lime step.
- **Destructive:** solid Fault Red fill with near-white `danger-ink` text (the deep red is what keeps it legible). Used for the primary confirm in a delete dialog; secondary destructive actions inside an edit flow use the outline variant instead.
- **Secondary:** `surface-subtle` fill with a 1px border. **Ghost:** transparent, used for nav and low-emphasis actions.
- **Touch:** interactive controls meant for look-away, across-the-room taps carry a ≥44px hit target (device toggles, climate mode/fan/swing).

### Chips / Badges
- **Style:** fully rounded pill, a small state dot plus a label. Status badges pair hue with the dot and text so state never rides on color alone: lime (live), green (online), red (offline), amber (record).

### Cards / Containers
- **Corner Style:** 14px (`rounded.lg`) for cards, 24px (`rounded.2xl`) for stat tiles.
- **Background:** Panel Slate on Canvas Slate.
- **Depth:** the `.ih-machined` sheen plus a 1px `border-subtle`. No nested cards.
- **Internal Padding:** generous and varied for rhythm (roughly 16–32px), not a uniform box everywhere.

### Inputs / Fields
- **Style:** `surface-subtle` fill, 1px border, 10px radius, mono values where the field holds telemetry.
- **Focus:** a lime focus ring (`lime-solid`). Sliders and the distance gauge are treated as instruments: chalk ticks, lime marker and threshold line.

### Charts (Recharts)
- **Style:** slate gridlines (`border-subtle`), one accent series per chart (lime for reps, amber for temperature, cyan for humidity), mono tick labels in `fg-subtle`, no decorative legends.
- **Axis numbers:** always rounded for display. Never render a raw interpolated float (`32.349999999999994`); format ticks to the reading's real precision (whole reps, one-decimal °C / %).

### Navigation
- **Style:** a fixed 256px slate rail (drawer below `lg`), sectioned Overview / Body / Home / System with quiet uppercase-ish labels.
- **States:** ghost by default (`fg-muted`); the active item gets a `surface-muted` fill, `lime-fg` label, and a 3px lime bar on its inner edge as a structural position marker (a deliberate indicator, not a decorative card stripe).

### Signature Component — The Live Readout
The centerpiece of the Live screen: a hero rep count in the 800-weight sans at `clamp(7rem, 30vw, 17rem)`, tabular, lime, with a soft pop on each rep and a full-screen lime wash flash. A caution-lime stripe marks the panel as a live surface while a session runs. This is HELM's deliberate replacement for the SaaS hero-metric card: a bare stamped instrument reading that sits on the surface, not in a box.

## 6. Do's and Don'ts

### Do:
- **Do** keep one dominant reading per screen; mute everything else to `fg-muted` / `fg-subtle` slate.
- **Do** spend lime only on live / interactive / on states, and amber only on earned reward and heat.
- **Do** set every changing number in JetBrains Mono with `tabular-nums`, and round chart-axis numbers to their real precision.
- **Do** build depth from a tonal slate step plus a 1px border plus the `.ih-machined` sheen, in that order.
- **Do** pair every status color with a dot, icon, or label (color is never the only signal).
- **Do** give look-away controls a ≥44px touch target and honor `prefers-reduced-motion` (all motion degrades to instant).
- **Do** keep body text at ≥ `fg-subtle` lightness so labels clear WCAG AA (4.5:1) on slate.

### Don't:
- **Don't** build the generic SaaS dashboard: identical rounded card grids, the big-number-hero template, gradient accents, or the stock-component look.
- **Don't** drift into the consumer smart-home app: pastel bubbles, a chatty assistant, "Good morning!" greeting cards, emoji, or confetti on a PR.
- **Don't** use neon-on-black, gradient text (`background-clip: text`), or glow for energy; contrast and weight carry it.
- **Don't** use lime for anything that isn't "live/on," or amber for anything that isn't a reward or a temperature.
- **Don't** use a colored `border-left`/`border-right` greater than 1px as a decorative stripe on a card, callout, or list item.
- **Don't** nest cards, or wrap a bare instrument reading in a card just to contain it.
- **Don't** animate layout properties (`top`, `left`, `width`, `height`); move with `transform` and `opacity` only, ease-out, no bounce.
- **Don't** render a raw interpolated axis float, use `backdrop-filter` glass anywhere but the two sticky bars, or use pure `#000` / `#fff`.
