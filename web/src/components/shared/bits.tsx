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
  | "lime"
  | "cyan"
  | "orange"
  | "purple"
  | "red";

/** Small, quiet caption, optionally with a leading lime tick. */
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
      fontSize="xs"
      fontWeight="semibold"
      letterSpacing="0.01em"
      color="fg.subtle"
      {...props}
    >
      {tick ? (
        <Box as="span" boxSize="1.5" rounded="full" bg="lime.solid" />
      ) : null}
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
 * Hero readout — the friendly display face at its heaviest weight, tabular. For
 * the big numbers (live rep count, PR value). Reserved for these and headings,
 * never for controls or data cells.
 */
export function Readout(props: React.ComponentProps<typeof Text>) {
  return (
    <Text
      as="span"
      data-tnum
      fontFamily="heading"
      fontWeight="800"
      fontVariantNumeric="tabular-nums"
      letterSpacing="-0.03em"
      lineHeight="0.9"
      {...props}
    />
  );
}

/** Page header: eyebrow + friendly title, optional right-side actions. */
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
          letterSpacing="-0.02em"
          lineHeight="1.05"
          mt="1.5"
          textWrap="balance"
        >
          {title}
        </Heading>
      </Box>
      {children}
    </Flex>
  );
}

/**
 * Metric tile — a soft panel with a big friendly readout. The label sits quiet
 * at the top with a small accent tick, the number carries the mass, and the
 * icon is an unobtrusive mark tinted to the accent.
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
      rounded="2xl"
      overflow="hidden"
      px="5"
      py="4"
      className="ih-machined"
    >
      <HStack justify="space-between" align="center" mb="3">
        <HStack gap="2">
          {hot ? (
            <Box boxSize="1.5" rounded="full" bg="colorPalette.solid" />
          ) : null}
          <Eyebrow>{label}</Eyebrow>
        </HStack>
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
          <Text fontSize="sm" fontWeight="medium" color="fg.subtle">
            {unit}
          </Text>
        ) : null}
      </HStack>
      {sub ? (
        <Text mt="2" fontSize="xs" color="fg.subtle">
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
  colorPalette = "lime",
}: {
  value: number;
  max: number;
  colorPalette?: Accent;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <Progress.Root value={pct} colorPalette={colorPalette} size="sm" rounded="full">
      <Progress.Track bg="bg.emphasized" rounded="full">
        <Progress.Range rounded="full" />
      </Progress.Track>
    </Progress.Root>
  );
}

/** Circular progress ring drawn with SVG. Children render centered inside. */
export function RingProgress({
  value,
  max,
  colorPalette = "lime",
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
          strokeLinecap="round"
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
  pullup_set: { label: "Pull-up set", palette: "lime" as const },
  dead_hang: { label: "Dead hang", palette: "cyan" as const },
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
      rounded="full"
      px="2.5"
      py="0.5"
      fontSize="xs"
      fontWeight="medium"
    >
      <Box as="span" boxSize="1.5" rounded="full" bg="colorPalette.solid" />
      {meta.label}
    </Box>
  );
}
