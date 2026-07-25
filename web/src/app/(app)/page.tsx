import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ArrowRight, Dumbbell, Flame, Radio } from "lucide-react";
import {
  getDashboardSummary,
  getRecentSessions,
  getDailyStats,
} from "@/db/queries";
import {
  Eyebrow,
  Meter,
  Metric,
  RingProgress,
  SectionHeader,
  StatCard,
} from "@/components/shared/bits";
import { SessionRow } from "@/components/session-row";
import { RepsTrend, type TrendDatum } from "@/components/charts/reps-trend";
import { LiveNudge } from "@/components/live-nudge";
import { formatHang, localDate, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, sessions, daily] = await Promise.all([
    getDashboardSummary(),
    getRecentSessions(6),
    getDailyStats(14),
  ]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const goalHit =
    summary.dailyGoalReps > 0 && summary.todayReps >= summary.dailyGoalReps;
  const toGo = Math.max(0, summary.dailyGoalReps - summary.todayReps);

  const today = localDate(new Date());
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const trend: TrendDatum[] = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, -(13 - i));
    const reps = byDate.get(date)?.totalReps ?? 0;
    return {
      label: date === today ? "today" : date.slice(5),
      reps,
      goal: summary.dailyGoalReps,
      hit: summary.dailyGoalReps > 0 && reps >= summary.dailyGoalReps,
    };
  });

  return (
    <Stack gap="6">
      <SectionHeader eyebrow={dateLabel} title="Dashboard">
        <Button asChild colorPalette="teal" size="lg">
          <Link href="/live">
            <Radio size={16} />
            GO LIVE
          </Link>
        </Button>
      </SectionHeader>

      <LiveNudge />

      {/* Top row: goal hero + KPI tiles */}
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }}
        gap="4"
      >
        <GridItem colSpan={{ base: 1, md: 2 }}>
          <Card.Root bg="bg.panel" h="full">
            <Card.Body>
              <Flex
                direction={{ base: "column", sm: "row" }}
                align="center"
                gap="6"
              >
                <RingProgress
                  value={summary.todayReps}
                  max={summary.dailyGoalReps || 1}
                  colorPalette="teal"
                  size={140}
                >
                  <Metric fontSize="4xl" color="teal.fg">
                    {summary.todayReps}
                  </Metric>
                  <Eyebrow mt="1">/ {summary.dailyGoalReps} reps</Eyebrow>
                </RingProgress>

                <Stack flex="1" w="full" gap="5" minW="0">
                  <Stack gap="1">
                    <Eyebrow>Today</Eyebrow>
                    <Heading size="xl" color={goalHit ? "teal.fg" : "fg"}>
                      {goalHit ? (
                        "GOAL SMASHED"
                      ) : (
                        <>
                          {toGo}{" "}
                          <Text as="span" color="fg.muted" fontWeight="normal">
                            to go
                          </Text>
                        </>
                      )}
                    </Heading>
                  </Stack>

                  <Stack gap="2">
                    <HStack
                      justify="space-between"
                      fontFamily="mono"
                      fontSize="xs"
                    >
                      <Text color="fg.muted">Hang time</Text>
                      <Text color="cyan.fg" fontVariantNumeric="tabular-nums">
                        {formatHang(summary.todayHangMs)}
                      </Text>
                    </HStack>
                    <HStack
                      justify="space-between"
                      fontFamily="mono"
                      fontSize="xs"
                    >
                      <Text color="fg.muted">Weekly reps</Text>
                      <Text fontVariantNumeric="tabular-nums">
                        {summary.weeklyReps} / {summary.weeklyGoalReps}
                      </Text>
                    </HStack>
                    <Meter
                      value={summary.weeklyReps}
                      max={summary.weeklyGoalReps || 1}
                      colorPalette="teal"
                    />
                  </Stack>
                </Stack>
              </Flex>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <StatCard
            label="Current streak"
            value={summary.currentStreak}
            unit="days"
            icon={Flame}
            accent="orange"
            sub={`Best · ${summary.bestStreak} days`}
          />
        </GridItem>
        <GridItem>
          <StatCard
            label="Lifetime reps"
            value={summary.lifetimeReps.toLocaleString()}
            icon={Dumbbell}
            accent="teal"
            sub={`${summary.lifetimeSessions} sessions`}
          />
        </GridItem>
      </Grid>

      {/* Second row: trend + recent */}
      <Grid templateColumns={{ base: "1fr", lg: "repeat(5, 1fr)" }} gap="4">
        <GridItem colSpan={{ base: 1, lg: 3 }}>
          <Card.Root bg="bg.panel" h="full">
            <Card.Header pb="0">
              <HStack justify="space-between">
                <Eyebrow>Last 14 days</Eyebrow>
                <HStack
                  asChild
                  gap="1"
                  fontFamily="mono"
                  fontSize="xs"
                  color="fg.subtle"
                  _hover={{ color: "teal.fg" }}
                >
                  <Link href="/history">
                    full history <ArrowRight size={13} />
                  </Link>
                </HStack>
              </HStack>
            </Card.Header>
            <Card.Body>
              <RepsTrend data={trend} goal={summary.dailyGoalReps} />
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem colSpan={{ base: 1, lg: 2 }}>
          <Card.Root bg="bg.panel" h="full">
            <Card.Header pb="0">
              <Eyebrow>Recent sessions</Eyebrow>
            </Card.Header>
            <Card.Body>
              {sessions.length === 0 ? (
                <Text py="6" textAlign="center" fontSize="sm" color="fg.muted">
                  No sessions yet — grab the bar.
                </Text>
              ) : (
                <Stack gap="0">
                  {sessions.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </Stack>
              )}
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {summary.lifetimeSessions === 0 && (
        <Card.Root bg="bg.panel/50" borderStyle="dashed">
          <Card.Body>
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Dumbbell />
                </EmptyState.Indicator>
                <EmptyState.Title>Waiting for your first rep</EmptyState.Title>
                <EmptyState.Description>
                  Flash the ESP32, mount the sensor above the bar, and pull.
                  Sessions land here automatically.
                </EmptyState.Description>
              </EmptyState.Content>
            </EmptyState.Root>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  );
}
