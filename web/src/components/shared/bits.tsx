import type { ComponentType } from "react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Progress,
  Stack,
  Text,
} from "@chakra-ui/react";

/**
 * Accent palettes. The system defines hazard / online / danger / gray (steel);
 * the legacy names are remapped at the token level (see theme/system.ts) so old
 * call sites keep type-checking and render on-brand until each screen is swept.
 */
export type Accent =
  | "hazard"
  | "online"
  | "danger"
  | "gray"
  | "teal"
  | "cyan"
  | "orange"
  | "purple"
  | "red";

/** Small uppercase tracked caption, optionally with a leading hazard tick. */
export function Eyebrow({
  tick,
  children,
  ...props
}: React.ComponentProps<typeof Text> & { tick?: boolean }) {
  return (
    <Text
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="2"
      fontSize="10px"
      fontWeight="semibold"
      letterSpacing="0.2em"
      textTransform="uppercase"
      color="fg.subtle"
      {...props}
    >
      {tick ? <Box as="span" w="3" h="2px" bg="hazard.solid" /> : null}
      {children}
    </Text>
  );
}

/**
 * Telemetry readout — monospaced, tabular. For timers, distances, dBm, and any
 * small changing value that must not jitter or drift. Instrument-grade.
 */
export function Metric(props: React.ComponentProps<typeof Text>) {
  return (
    <Text
      as="span"
      fontFamily="mono"
      fontWeight="medium"
      fontVariantNumeric="tabular-nums"
      lineHeight="1"
      {...props}
    />
  );
}

/**
 * Hero readout — heavy condensed display face, tabular. For the big stamped
 * numbers (live rep count, PR value). Display font is reserved for these and
 * for headings, never for controls or data cells.
 */
export function Readout(props: React.ComponentProps<typeof Text>) {
  return (
    <Text
      as="span"
      data-tnum
      fontFamily="heading"
      fontWeight="800"
      fontVariantNumeric="tabular-nums"
      letterSpacing="-0.01em"
      lineHeight="0.82"
      {...props}
    />
  );
}

/** Page header: eyebrow + condensed uppercase title, optional right-side actions. */
export function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Flex
      align={{ base: "start", sm: "center" }}
      justify="space-between"
      gap="4"
      direction={{ base: "column", sm: "row" }}
      pb="5"
      mb="6"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Box>
        {eyebrow ? <Eyebrow tick>{eyebrow}</Eyebrow> : null}
        <Heading
          size="3xl"
          fontWeight="700"
          textTransform="uppercase"
          letterSpacing="0.01em"
          lineHeight="0.95"
          mt="1.5"
        >
          {title}
        </Heading>
      </Box>
      {children}
    </Flex>
  );
}

/**
 * Instrument tile — a steel panel with a stamped readout. Deliberately not the
 * icon-in-a-circle SaaS hero-metric card: label sits on a hairline, the number
 * is the mass, a thin hazard rule anchors the accent, the icon is a quiet mark.
 */
export function StatCard({
  label,
  value,
  unit,
  icon,
  accent = "gray",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon: ComponentType<{ size?: number | string }>;
  accent?: Accent;
  sub?: string;
}) {
  const IconCmp = icon;
  const hot = accent !== "gray";
  return (
    <Box
      colorPalette={accent}
      position="relative"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="lg"
      overflow="hidden"
      px="4"
      py="3.5"
      className="ih-machined"
    >
      {/* accent spine along the bottom edge, not a decorative side stripe */}
      <Box
        position="absolute"
        insetX="0"
        bottom="0"
        h="2px"
        bg={hot ? "colorPalette.solid" : "border"}
        opacity={hot ? 0.9 : 0.6}
      />
      <HStack justify="space-between" align="center" mb="3">
        <Eyebrow>{label}</Eyebrow>
        {/* Render the icon directly (not via Chakra's client <Icon as=…/>): this
            file is a Server Component and a lucide icon is a forwardRef object,
            which can't cross the server→client prop boundary. */}
        <Box
          display="inline-flex"
          lineHeight="0"
          color={hot ? "colorPalette.fg" : "fg.subtle"}
        >
          <IconCmp size={16} />
        </Box>
      </HStack>
      <HStack align="baseline" gap="1.5">
        <Readout
          fontSize="clamp(2.25rem, 6vw, 3rem)"
          color={hot ? "colorPalette.fg" : "fg"}
        >
          {value}
        </Readout>
        {unit ? (
          <Text
            fontFamily="mono"
            fontSize="xs"
            color="fg.subtle"
            textTransform="uppercase"
            letterSpacing="0.1em"
          >
            {unit}
          </Text>
        ) : null}
      </HStack>
      {sub ? (
        <Text mt="2" fontSize="xs" color="fg.subtle" fontFamily="mono">
          {sub}
        </Text>
      ) : null}
    </Box>
  );
}

/** Thin horizontal progress meter. */
export function Meter({
  value,
  max,
  colorPalette = "hazard",
}: {
  value: number;
  max: number;
  colorPalette?: Accent;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <Progress.Root value={pct} colorPalette={colorPalette} size="sm" rounded="sm">
      <Progress.Track bg="bg.emphasized" rounded="sm">
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}

/** Circular progress ring drawn with SVG. Children render centered inside. */
export function RingProgress({
  value,
  max,
  colorPalette = "hazard",
  size = 132,
  thickness = 10,
  children,
}: {
  value: number;
  max: number;
  colorPalette?: Accent;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Box
      position="relative"
      boxSize={`${size}px`}
      flexShrink="0"
      colorPalette={colorPalette}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chakra-colors-bg-emphasized)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chakra-colors-color-palette-solid)"
          strokeWidth={thickness}
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <Flex position="absolute" inset="0" align="center" justify="center" textAlign="center">
        <Stack gap="0" align="center">
          {children}
        </Stack>
      </Flex>
    </Box>
  );
}

const TYPE_META = {
  pullup_set: { label: "Pull-up set", palette: "hazard" as const },
  dead_hang: { label: "Dead hang", palette: "gray" as const },
};

/** Badge distinguishing a pull-up set from a dead hang. */
export function TypeBadge({ type }: { type: "pullup_set" | "dead_hang" }) {
  const meta = TYPE_META[type] ?? TYPE_META.pullup_set;
  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap="1.5"
      colorPalette={meta.palette}
      bg="colorPalette.subtle"
      color="colorPalette.fg"
      borderWidth="1px"
      borderColor="colorPalette.muted"
      rounded="sm"
      px="2"
      py="0.5"
      fontFamily="mono"
      fontSize="10px"
      textTransform="uppercase"
      letterSpacing="0.12em"
      fontWeight="medium"
    >
      <Box as="span" boxSize="1.5" rounded="full" bg="colorPalette.solid" />
      {meta.label}
    </Box>
  );
}
