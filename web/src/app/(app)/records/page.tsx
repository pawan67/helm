import {
  Box,
  Card,
  Circle,
  EmptyState,
  Grid,
  HStack,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Flame, Medal, Timer, Trophy } from "lucide-react";
import { getRecords, getDashboardSummary } from "@/db/queries";
import {
  Eyebrow,
  Metric,
  SectionHeader,
  StatCard,
  type Accent,
} from "@/components/shared/bits";
import { RECORD_LABELS } from "@/lib/live-types";
import { formatHang } from "@/lib/time";

export const dynamic = "force-dynamic";

const ORDER = ["most_reps_set", "most_reps_day", "longest_hang"] as const;

const META: Record<
  (typeof ORDER)[number],
  { icon: typeof Trophy; accent: Accent; desc: string }
> = {
  most_reps_set: {
    icon: Trophy,
    accent: "teal",
    desc: "Reps in one unbroken set",
  },
  most_reps_day: {
    icon: Medal,
    accent: "orange",
    desc: "Most reps across a single day",
  },
  longest_hang: {
    icon: Timer,
    accent: "cyan",
    desc: "Longest single dead hang",
  },
};

function renderValue(type: string, value: number) {
  if (type === "longest_hang") return formatHang(value);
  return value.toLocaleString();
}

function unit(type: string) {
  return type === "longest_hang" ? "" : "reps";
}

export default async function RecordsPage() {
  const [records, summary] = await Promise.all([
    getRecords(),
    getDashboardSummary(),
  ]);
  const byType = new Map(records.map((r) => [r.recordType, r]));
  const anyRecord = records.some((r) => r.value > 0);

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Personal bests" title="Records" />

      {!anyRecord ? (
        <Card.Root bg="bg.panel/50" borderStyle="dashed">
          <Card.Body>
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Trophy />
                </EmptyState.Indicator>
                <EmptyState.Title>No records yet</EmptyState.Title>
                <EmptyState.Description>
                  Every session is measured against your bests. Beat one and it
                  lands here with a celebration.
                </EmptyState.Description>
              </EmptyState.Content>
            </EmptyState.Root>
          </Card.Body>
        </Card.Root>
      ) : (
        <Grid templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap="4">
          {ORDER.map((type, i) => {
            const meta = META[type];
            const RecIcon = meta.icon;
            const rec = byType.get(type);
            const value = rec?.value ?? 0;
            const isSet = value > 0;
            const achieved = rec?.achievedAt ? new Date(rec.achievedAt) : null;
            return (
              <Card.Root
                key={type}
                colorPalette={meta.accent}
                bg="bg.panel"
                position="relative"
                overflow="hidden"
              >
                {/* ghost rank numeral */}
                <Metric
                  aria-hidden
                  position="absolute"
                  top="-6"
                  right="-1"
                  fontSize="8rem"
                  color="colorPalette.solid/10"
                  userSelect="none"
                  pointerEvents="none"
                >
                  {i + 1}
                </Metric>

                <Card.Header>
                  <HStack justify="space-between" align="start">
                    <Stack gap="1">
                      <Eyebrow>{RECORD_LABELS[type]}</Eyebrow>
                      <Text fontSize="xs" color="fg.muted">
                        {meta.desc}
                      </Text>
                    </Stack>
                    <Circle
                      size="10"
                      bg="colorPalette.subtle"
                      color="colorPalette.fg"
                      borderWidth="1px"
                      borderColor="colorPalette.muted"
                    >
                      <RecIcon size={20} />
                    </Circle>
                  </HStack>
                </Card.Header>

                <Card.Body justifyContent="flex-end" gap="2">
                  <HStack align="baseline" gap="2">
                    <Metric
                      fontSize="5xl"
                      color={isSet ? "colorPalette.fg" : "fg.subtle"}
                    >
                      {isSet ? renderValue(type, value) : "—"}
                    </Metric>
                    {unit(type) ? <Eyebrow>{unit(type)}</Eyebrow> : null}
                  </HStack>
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="fg.subtle"
                    fontVariantNumeric="tabular-nums"
                  >
                    {achieved
                      ? `set ${achieved.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "not set"}
                  </Text>
                </Card.Body>

                <Box
                  aria-hidden
                  position="absolute"
                  insetX="0"
                  bottom="0"
                  h="2px"
                  bg="colorPalette.solid/40"
                />
              </Card.Root>
            );
          })}
        </Grid>
      )}

      <Stack gap="4">
        <HStack gap="3">
          <Eyebrow>Consistency</Eyebrow>
          <Separator flex="1" borderColor="border.subtle" />
        </HStack>
        <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap="4">
          <StatCard
            label="Current streak"
            value={summary.currentStreak}
            unit="days"
            icon={Flame}
            accent="teal"
            sub="Days hitting goal, back to back"
          />
          <StatCard
            label="Best streak"
            value={summary.bestStreak}
            unit="days"
            icon={Flame}
            accent="orange"
            sub="Your all-time longest run"
          />
        </Grid>
      </Stack>
    </Stack>
  );
}
