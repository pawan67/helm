/**
 * HELM design system — a calm, premium home & body console.
 *
 * Soft layered slate under a single bright "lime" signal, rounded corners, a
 * friendly geometric typeface, and telemetry that stays quiet until it matters.
 * The app is dark-only by design (a console on a wall), so tokens are defined
 * flat: the same value in _light and _dark.
 *
 * Built on Chakra's defaultConfig, then overridden:
 *  - neutral scale + bg/fg/border → a soft, faintly-cool slate
 *  - accent palettes:
 *      lime   — the primary signal: live / interactive / device-on
 *      cyan   — a soft blue for endurance (hang time, humidity)
 *      hazard — warm amber, reserved for reward + heat (streaks, PRs, goals, temp)
 *      online — green, device ready / connected
 *      danger — red, fault / offline / destructive
 *  - radii rounded up to soft, premium values
 *  - fonts wired to the next/font CSS vars set in app/layout.tsx
 */
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/** Same value in both color modes (the app never renders light). */
const flat = (v: string) => ({ value: { _light: v, _dark: v } });
/** Semantic token that points at a raw token in both modes. */
const ref = (token: string) => flat(`{${token}}`);
/** A full palette that borrows another palette's raw scale (legacy remaps). */
const aliasOf = (palette: string, contrast: string) => ({
  contrast: flat(contrast),
  fg: ref(`colors.${palette}.300`),
  subtle: ref(`colors.${palette}.900`),
  muted: ref(`colors.${palette}.800`),
  emphasized: ref(`colors.${palette}.400`),
  solid: ref(`colors.${palette}.500`),
  focusRing: ref(`colors.${palette}.500`),
});
/** The standard semantic palette shape, pointing at a raw scale of its own name. */
const paletteFrom = (name: string, contrast: string) => ({
  contrast: flat(contrast),
  fg: ref(`colors.${name}.300`),
  subtle: ref(`colors.${name}.900`),
  muted: ref(`colors.${name}.800`),
  emphasized: ref(`colors.${name}.400`),
  solid: ref(`colors.${name}.500`),
  focusRing: ref(`colors.${name}.500`),
});

// Dark ink used as the readable text color on a bright accent fill.
const INK_LIME = "oklch(0.20 0.03 130)"; // dark chartreuse: text on a lime fill
const INK_CYAN = "oklch(0.18 0.03 246)";
const INK_AMBER = "oklch(0.20 0.04 70)";
const INK_GREEN = "oklch(0.17 0.03 150)";
const INK_RED = "oklch(0.97 0.01 28)";

const config = defineConfig({
  cssVarsPrefix: "chakra",
  globalCss: {
    "::selection": {
      background: "lime.solid",
      color: "lime.contrast",
    },
    // Tabular figures everywhere numbers change, so counters never jitter.
    "[data-tnum]": {
      fontVariantNumeric: "tabular-nums",
      fontFeatureSettings: '"tnum" 1',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: {
          value:
            'var(--font-display), "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        },
        body: {
          value:
            'var(--font-body), "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        },
        mono: {
          value:
            'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        },
      },

      // Soft, premium corners. Full-round is still reserved for pills + gauges.
      radii: {
        "2xs": { value: "4px" },
        xs: { value: "6px" },
        sm: { value: "8px" },
        md: { value: "10px" },
        lg: { value: "14px" },
        xl: { value: "18px" },
        "2xl": { value: "24px" },
        "3xl": { value: "30px" },
        "4xl": { value: "36px" },
      },

      colors: {
        // Slate — a soft, faintly-cool neutral (hue 260). Replaces gray.
        gray: {
          50: { value: "oklch(0.97 0.004 260)" },
          100: { value: "oklch(0.93 0.005 260)" },
          200: { value: "oklch(0.87 0.006 260)" },
          300: { value: "oklch(0.78 0.007 260)" },
          400: { value: "oklch(0.65 0.008 260)" },
          500: { value: "oklch(0.55 0.009 260)" },
          600: { value: "oklch(0.46 0.009 260)" },
          700: { value: "oklch(0.38 0.009 260)" },
          800: { value: "oklch(0.30 0.008 260)" },
          900: { value: "oklch(0.24 0.007 260)" },
          950: { value: "oklch(0.19 0.006 260)" },
        },

        // Lime — the primary signal (chartreuse, hue 128): live / interactive /
        // on, used boldly. Bright by nature, so solid fills take a dark ink
        // (INK_LIME below) for legible text, like the reference's lime bars.
        lime: {
          50: { value: "oklch(0.97 0.04 128)" },
          100: { value: "oklch(0.95 0.08 128)" },
          200: { value: "oklch(0.93 0.13 128)" },
          300: { value: "oklch(0.91 0.17 128)" },
          400: { value: "oklch(0.89 0.20 128)" },
          500: { value: "oklch(0.87 0.21 128)" },
          600: { value: "oklch(0.78 0.19 128)" },
          700: { value: "oklch(0.62 0.15 129)" },
          800: { value: "oklch(0.40 0.09 130)" },
          900: { value: "oklch(0.30 0.06 130)" },
          950: { value: "oklch(0.24 0.04 130)" },
        },

        // Cyan — a soft blue for endurance (hang time, humidity), hue 245.
        cyan: {
          50: { value: "oklch(0.96 0.02 245)" },
          100: { value: "oklch(0.92 0.04 245)" },
          200: { value: "oklch(0.87 0.06 245)" },
          300: { value: "oklch(0.82 0.085 245)" },
          400: { value: "oklch(0.77 0.11 245)" },
          500: { value: "oklch(0.71 0.12 246)" },
          600: { value: "oklch(0.63 0.12 246)" },
          700: { value: "oklch(0.51 0.10 246)" },
          800: { value: "oklch(0.34 0.07 246)" },
          900: { value: "oklch(0.27 0.05 246)" },
          950: { value: "oklch(0.21 0.035 246)" },
        },

        // Hazard — warm amber (hue 72), softened from safety-vest to honey.
        // Reserved for reward + heat: streaks, PRs, goals, temperature.
        hazard: {
          50: { value: "oklch(0.96 0.03 82)" },
          100: { value: "oklch(0.92 0.06 80)" },
          200: { value: "oklch(0.88 0.09 78)" },
          300: { value: "oklch(0.85 0.115 76)" },
          400: { value: "oklch(0.81 0.13 74)" },
          500: { value: "oklch(0.77 0.135 72)" },
          600: { value: "oklch(0.71 0.13 70)" },
          700: { value: "oklch(0.57 0.11 68)" },
          800: { value: "oklch(0.38 0.075 70)" },
          900: { value: "oklch(0.29 0.05 72)" },
          950: { value: "oklch(0.22 0.032 72)" },
        },

        // Online — green (hue 150). Device ready / connected.
        online: {
          50: { value: "oklch(0.95 0.03 152)" },
          100: { value: "oklch(0.90 0.06 152)" },
          200: { value: "oklch(0.85 0.09 151)" },
          300: { value: "oklch(0.83 0.115 152)" },
          400: { value: "oklch(0.79 0.125 151)" },
          500: { value: "oklch(0.73 0.125 150)" },
          600: { value: "oklch(0.65 0.115 150)" },
          700: { value: "oklch(0.51 0.095 150)" },
          800: { value: "oklch(0.31 0.055 150)" },
          900: { value: "oklch(0.24 0.035 150)" },
          950: { value: "oklch(0.19 0.022 150)" },
        },

        // Danger — red (hue 28). Fault / offline / destructive.
        // 500/600/700 darkened together (ramp stays monotonic) so a solid
        // destructive button clears WCAG AA with its near-white ink: white on
        // danger.500 is now 4.64:1 (was 3.20 at the old L0.65). The offline dot
        // reads as a slightly deeper, more serious red.
        danger: {
          50: { value: "oklch(0.96 0.02 30)" },
          100: { value: "oklch(0.90 0.05 30)" },
          200: { value: "oklch(0.84 0.09 29)" },
          300: { value: "oklch(0.78 0.13 29)" },
          400: { value: "oklch(0.72 0.16 28)" },
          500: { value: "oklch(0.56 0.175 28)" },
          600: { value: "oklch(0.48 0.16 27)" },
          700: { value: "oklch(0.41 0.135 26)" },
          800: { value: "oklch(0.33 0.09 28)" },
          900: { value: "oklch(0.25 0.06 28)" },
          950: { value: "oklch(0.20 0.04 28)" },
        },
      },
    },

    semanticTokens: {
      // Rounded defaults for Chakra's built-in recipes (buttons, inputs, etc).
      radii: {
        l1: { value: "{radii.sm}" },
        l2: { value: "{radii.md}" },
        l3: { value: "{radii.lg}" },
      },

      colors: {
        // Slate surface layering (canvas → panel → subtle → muted), lifted and
        // soft rather than clinical black.
        bg: {
          DEFAULT: flat("oklch(0.175 0.006 260)"),
          subtle: flat("oklch(0.225 0.007 260)"),
          muted: flat("oklch(0.26 0.008 260)"),
          emphasized: flat("oklch(0.30 0.008 260)"),
          panel: flat("oklch(0.205 0.007 260)"),
          inverted: flat("oklch(0.95 0.004 260)"),
        },
        fg: {
          DEFAULT: flat("oklch(0.96 0.004 260)"), // soft white
          muted: flat("oklch(0.74 0.006 260)"),
          // L lifted 0.56→0.64 so small labels clear WCAG AA (4.5:1) on every
          // surface: 5.3 on panel, 5.6 on canvas, 5.1 on bg.subtle.
          subtle: flat("oklch(0.64 0.007 260)"),
          inverted: flat("oklch(0.175 0.006 260)"),
        },
        border: {
          DEFAULT: flat("oklch(0.34 0.008 260)"),
          muted: flat("oklch(0.25 0.007 260)"),
          subtle: flat("oklch(0.285 0.008 260)"),
          emphasized: flat("oklch(0.42 0.009 260)"),
        },
        focusRing: ref("colors.lime.500"),

        // First-class accent palettes (mirror Chakra's built-in palette shape).
        lime: paletteFrom("lime", INK_LIME),
        cyan: paletteFrom("cyan", INK_CYAN),
        hazard: paletteFrom("hazard", INK_AMBER),
        online: paletteFrom("online", INK_GREEN),
        danger: paletteFrom("danger", INK_RED),

        // Legacy-palette remaps so untouched call sites stay on-brand:
        //   orange → hazard (warm)   purple → lime (primary)   red → danger
        orange: aliasOf("hazard", INK_AMBER),
        purple: aliasOf("lime", INK_LIME),
        red: aliasOf("danger", INK_RED),
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
