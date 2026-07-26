"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Grid,
  HStack,
  Icon,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Chart, useChart } from "@chakra-ui/charts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarCheck,
  Dumbbell,
  Timer,
  Waves,
} from "lucide-react";
import type { DailyStat } from "@/db/schema";
import { SessionsTable } from "@/components/charts/sessions-table";
import { Eyebrow, StatCard } from "@/components/shared/bits";
import { formatHang } from "@/lib/time";

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
];

// Round Y-axis ticks so Recharts' interpolated domain values (e.g.
// 32.349999999999994) render clean; whole numbers stay whole.
const tidyTick = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

type ChartDatum = {
  date: string;
  label: string;
  reps: number;
  hangMin: number;
  goal: number;
  hit: boolean;
};

export function HistoryView({ initialDays }: { initialDays: DailyStat[] }) {
  const [range, setRange] = useState(30);
  const [days, setDays] = useState<DailyStat[]>(initialDays);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stats?days=${range}`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        setDays(s.days ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, reload]);

  // Editing/deleting a session in the table changes the daily rollups, so let
  // the table nudge the charts to refetch.
  const refresh = () => setReload((n) => n + 1);

  const chartData: ChartDatum[] = useMemo(
    () =>
      days.map((d) => ({
        date: d.date,
        label: d.date.slice(5),
        reps: d.totalReps,
        hangMin: Math.round((d.totalHangMs / 60000) * 10) / 10,
        goal: d.goalReps,
        hit: d.goalReps > 0 && d.totalReps >= d.goalReps,
      })),
    [days],
  );

  const totalReps = chartData.reduce((s, d) => s + d.reps, 0);
  const totalHangMs = days.reduce((s, d) => s + d.totalHangMs, 0);
  const activeDays = chartData.filter((d) => d.reps > 0 || d.hangMin > 0).length;
  const goalLine = chartData.find((d) => d.goal > 0)?.goal ?? 0;

  const repsChart = useChart({
    data: chartData,
    series: [{ name: "reps", color: "lime.solid" }],
  });
  const hangChart = useChart({
    data: chartData,
    series: [{ name: "hangMin", color: "cyan.solid" }],
  });

  return (
    <Stack gap="6">
      {/* Range control */}
      <HStack justify="space-between" flexWrap="wrap" gap="3">
        <Eyebrow>Showing last {range} days</Eyebrow>
        <SegmentGroup.Root
          value={String(range)}
          onValueChange={(e) => e.value && setRange(Number(e.value))}
          size="sm"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={RANGES} />
        </SegmentGroup.Root>
      </HStack>

      {/* Totals */}
      <Grid templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap="4">
        <StatCard
          label="Total reps"
          value={totalReps.toLocaleString()}
          icon={Dumbbell}
          accent="lime"
          sub={`Across the last ${range} days`}
        />
        <StatCard
          label="Time hung"
          value={formatHang(totalHangMs)}
          icon={Timer}
          accent="cyan"
          sub="Total time on the bar"
        />
        <StatCard
          label="Active days"
          value={activeDays}
          unit={activeDays === 1 ? "day" : "days"}
          icon={CalendarCheck}
          accent="gray"
          sub="Days with a set or hang"
        />
      </Grid>

      {/* Reps per day */}
      <Card.Root bg="bg.panel">
        <Card.Header pb="0">
          <HStack justify="space-between">
            <HStack gap="2" color="fg.muted">
              <Icon as={BarChart3} boxSize="3.5" color="lime.fg" />
              <Eyebrow>Reps per day</Eyebrow>
            </HStack>
            {goalLine > 0 ? (
              <Text
                fontFamily="mono"
                fontSize="xs"
                color="orange.fg"
                fontVariantNumeric="tabular-nums"
              >
                goal {goalLine}
              </Text>
            ) : null}
          </HStack>
        </Card.Header>
        <Card.Body opacity={loading ? 0.6 : 1} transition="opacity 0.2s">
          <Chart.Root w="full" h="260px" aspectRatio="auto" chart={repsChart}>
            <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={repsChart.data}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                stroke={repsChart.color("border.muted")}
                vertical={false}
              />
              <XAxis
                dataKey={repsChart.key("label")}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={20}
                tick={{ fontSize: 10, fill: repsChart.color("fg.muted") }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                allowDecimals={false}
                tickFormatter={tidyTick}
                tick={{ fontSize: 10, fill: repsChart.color("fg.muted") }}
              />
              {goalLine > 0 ? (
                <ReferenceLine
                  y={goalLine}
                  stroke={repsChart.color("orange.solid")}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              ) : null}
              <Tooltip
                cursor={{ fill: repsChart.color("bg.emphasized"), opacity: 0.4 }}
                content={<Chart.Tooltip />}
              />
              <Bar
                isAnimationActive={false}
                dataKey={repsChart.key("reps")}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              >
                {repsChart.data.map((d) => (
                  <Cell
                    key={d.date}
                    fill={repsChart.color(d.hit ? "lime.solid" : "lime.muted")}
                  />
                ))}
              </Bar>
            </BarChart>
            </ResponsiveContainer>
          </Chart.Root>
        </Card.Body>
      </Card.Root>

      {/* Hang time per day */}
      <Card.Root bg="bg.panel">
        <Card.Header pb="0">
          <HStack justify="space-between">
            <HStack gap="2" color="fg.muted">
              <Icon as={Waves} boxSize="3.5" color="cyan.fg" />
              <Eyebrow>Hang time per day</Eyebrow>
            </HStack>
            <Text fontFamily="mono" fontSize="xs" color="fg.subtle">
              minutes
            </Text>
          </HStack>
        </Card.Header>
        <Card.Body opacity={loading ? 0.6 : 1} transition="opacity 0.2s">
          <Chart.Root w="full" h="200px" aspectRatio="auto" chart={hangChart}>
            <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={hangChart.data}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <defs>
                <Chart.Gradient
                  id="hangFill"
                  stops={[
                    { offset: "0%", color: "cyan.solid", opacity: 0.5 },
                    { offset: "100%", color: "cyan.solid", opacity: 0 },
                  ]}
                />
              </defs>
              <CartesianGrid
                stroke={hangChart.color("border.muted")}
                vertical={false}
              />
              <XAxis
                dataKey={hangChart.key("label")}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={20}
                tick={{ fontSize: 10, fill: hangChart.color("fg.muted") }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                tickFormatter={tidyTick}
                tick={{ fontSize: 10, fill: hangChart.color("fg.muted") }}
              />
              <Tooltip
                cursor={{ stroke: hangChart.color("cyan.solid"), strokeOpacity: 0.4 }}
                content={<Chart.Tooltip />}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey={hangChart.key("hangMin")}
                stroke={hangChart.color("cyan.solid")}
                strokeWidth={2}
                fill="url(#hangFill)"
              />
            </AreaChart>
            </ResponsiveContainer>
          </Chart.Root>
        </Card.Body>
      </Card.Root>

      {/* All sessions — filterable, selectable table */}
      <SessionsTable onMutate={refresh} />
    </Stack>
  );
}
