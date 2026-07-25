/**
 * HELM design system — industrial command console.
 *
 * Steel and chalk under harsh light, one hot "hazard" signal, hard edges,
 * telemetry that looks like telemetry. See ../../../DESIGN.md for the spec.
 *
 * Built on Chakra's defaultConfig, then overridden:
 *  - neutral scale + bg/fg/border → cool steel (hue 250, near-zero chroma)
 *  - three equipment-LED palettes: hazard (amber = live/effort/primary),
 *    online (green LED = device ready), danger (rust = fault)
 *  - radii tightened to machined-hard values
 *  - fonts wired to the next/font CSS vars set in app/layout.tsx
 *
 * The app is dark-only by design (equipment on a wall), so tokens are defined
 * flat: the same value for _light and _dark.
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

const config = defineConfig({
  cssVarsPrefix: "chakra",
  globalCss: {
    "::selection": {
      background: "hazard.solid",
      color: "hazard.contrast",
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
            'var(--font-display), "Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
        },
        body: {
          value:
            'var(--font-body), Barlow, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        },
        mono: {
          value:
            'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        },
      },

      // Machined-hard corners. Full-round is reserved for status pills + gauge.
      radii: {
        "2xs": { value: "1px" },
        xs: { value: "1px" },
        sm: { value: "2px" },
        md: { value: "3px" },
        lg: { value: "4px" },
        xl: { value: "6px" },
        "2xl": { value: "8px" },
        "3xl": { value: "10px" },
        "4xl": { value: "12px" },
      },

      colors: {
        // Steel — cool neutral, hue 250, near-zero chroma. Replaces gray.
        gray: {
          50: { value: "oklch(0.96 0.004 250)" },
          100: { value: "oklch(0.90 0.005 250)" },
          200: { value: "oklch(0.83 0.006 250)" },
          300: { value: "oklch(0.72 0.006 250)" },
          400: { value: "oklch(0.58 0.008 250)" },
          500: { value: "oklch(0.48 0.010 250)" },
          600: { value: "oklch(0.40 0.010 250)" },
          700: { value: "oklch(0.32 0.009 250)" },
          800: { value: "oklch(0.26 0.009 250)" },
          900: { value: "oklch(0.20 0.008 250)" },
          950: { value: "oklch(0.16 0.006 250)" },
        },

        // Hazard — safety amber, hue 52. The one hot signal: live / effort / primary.
        hazard: {
          50: { value: "oklch(0.96 0.02 62)" },
          100: { value: "oklch(0.90 0.05 60)" },
          200: { value: "oklch(0.85 0.09 58)" },
          300: { value: "oklch(0.80 0.14 56)" },
          400: { value: "oklch(0.76 0.16 54)" },
          500: { value: "oklch(0.70 0.17 52)" },
          600: { value: "oklch(0.64 0.165 50)" },
          700: { value: "oklch(0.52 0.13 49)" },
          800: { value: "oklch(0.33 0.075 51)" },
          900: { value: "oklch(0.25 0.045 52)" },
          950: { value: "oklch(0.19 0.028 52)" },
        },

        // Online — green equipment LED, hue 150. Device ready / connected.
        online: {
          50: { value: "oklch(0.95 0.03 152)" },
          100: { value: "oklch(0.90 0.06 152)" },
          200: { value: "oklch(0.84 0.09 151)" },
          300: { value: "oklch(0.82 0.12 152)" },
          400: { value: "oklch(0.78 0.13 151)" },
          500: { value: "oklch(0.72 0.13 150)" },
          600: { value: "oklch(0.64 0.12 150)" },
          700: { value: "oklch(0.50 0.10 150)" },
          800: { value: "oklch(0.30 0.055 150)" },
          900: { value: "oklch(0.23 0.035 150)" },
          950: { value: "oklch(0.18 0.022 150)" },
        },

        // Danger — rust red, hue 30. Fault / offline / destructive.
        danger: {
          50: { value: "oklch(0.96 0.02 32)" },
          100: { value: "oklch(0.90 0.05 32)" },
          200: { value: "oklch(0.83 0.09 31)" },
          300: { value: "oklch(0.77 0.14 31)" },
          400: { value: "oklch(0.70 0.17 30)" },
          500: { value: "oklch(0.63 0.18 30)" },
          600: { value: "oklch(0.56 0.17 29)" },
          700: { value: "oklch(0.45 0.14 28)" },
          800: { value: "oklch(0.32 0.09 30)" },
          900: { value: "oklch(0.24 0.06 30)" },
          950: { value: "oklch(0.19 0.04 30)" },
        },
      },
    },

    semanticTokens: {
      colors: {
        // Steel surface layering (canvas darkest → panel → subtle → muted).
        bg: {
          DEFAULT: flat("oklch(0.145 0.006 250)"),
          subtle: flat("oklch(0.215 0.008 250)"),
          muted: flat("oklch(0.25 0.009 250)"),
          emphasized: flat("oklch(0.285 0.009 250)"),
          panel: flat("oklch(0.185 0.007 250)"),
          inverted: flat("oklch(0.93 0.005 250)"),
        },
        fg: {
          DEFAULT: flat("oklch(0.93 0.005 250)"), // chalk
          muted: flat("oklch(0.70 0.006 250)"),
          subtle: flat("oklch(0.52 0.007 250)"),
          inverted: flat("oklch(0.145 0.006 250)"),
        },
        border: {
          DEFAULT: flat("oklch(0.36 0.010 250)"),
          muted: flat("oklch(0.24 0.008 250)"),
          subtle: flat("oklch(0.285 0.008 250)"),
          emphasized: flat("oklch(0.46 0.011 250)"),
        },
        focusRing: ref("colors.hazard.500"),

        // Hazard palette (mirrors Chakra's built-in palette token shape).
        hazard: {
          contrast: flat("oklch(0.16 0.02 62)"),
          fg: ref("colors.hazard.300"),
          subtle: ref("colors.hazard.900"),
          muted: ref("colors.hazard.800"),
          emphasized: ref("colors.hazard.400"),
          solid: ref("colors.hazard.500"),
          focusRing: ref("colors.hazard.500"),
        },
        online: {
          contrast: flat("oklch(0.14 0.02 150)"),
          fg: ref("colors.online.300"),
          subtle: ref("colors.online.900"),
          muted: ref("colors.online.800"),
          emphasized: ref("colors.online.400"),
          solid: ref("colors.online.500"),
          focusRing: ref("colors.online.500"),
        },
        danger: {
          contrast: flat("oklch(0.97 0.01 32)"),
          fg: ref("colors.danger.300"),
          subtle: ref("colors.danger.900"),
          muted: ref("colors.danger.800"),
          emphasized: ref("colors.danger.400"),
          solid: ref("colors.danger.500"),
          focusRing: ref("colors.danger.500"),
        },

        // Legacy-palette remaps: the codebase sprinkled teal/cyan/orange/red as
        // ad-hoc accents. Rather than hand-edit every call site, we point those
        // palettes at the real system so untouched screens adopt it immediately.
        //   teal / orange / purple → hazard (hot)   red → danger (fault)
        //   cyan → steel (calm endurance / hang; no second hue)
        teal: aliasOf("hazard", "oklch(0.16 0.02 62)"),
        orange: aliasOf("hazard", "oklch(0.16 0.02 62)"),
        purple: aliasOf("hazard", "oklch(0.16 0.02 62)"),
        red: aliasOf("danger", "oklch(0.97 0.01 32)"),
        cyan: {
          contrast: flat("oklch(0.145 0.006 250)"),
          fg: ref("colors.gray.100"),
          subtle: ref("colors.gray.900"),
          muted: ref("colors.gray.800"),
          emphasized: ref("colors.gray.600"),
          solid: ref("colors.gray.400"),
          focusRing: ref("colors.gray.500"),
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
