"use client";

import { Chart, useChart } from "@chakra-ui/charts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export type TrendDatum = {
  label: string;
  reps: number;
  goal: number;
  hit: boolean;
};

/**
 * Compact reps-per-day bar chart (dashboard). Bars are solid lime when the
 * daily goal was hit, dimmed otherwise; a dashed line marks the goal.
 */
export function RepsTrend({ data, goal }: { data: TrendDatum[]; goal: number }) {
  const chart = useChart({
    data,
    series: [{ name: "reps", color: "lime.solid" }],
  });

  return (
    <Chart.Root w="full" h="180px" aspectRatio="auto" chart={chart}>
      <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={chart.data}
        margin={{ top: 12, right: 4, left: -18, bottom: 0 }}
      >
        <CartesianGrid
          stroke={chart.color("border.muted")}
          vertical={false}
        />
        <XAxis
          dataKey={chart.key("label")}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
          tick={{ fontSize: 10, fill: chart.color("fg.muted") }}
        />
        {goal > 0 ? (
          <ReferenceLine
            y={goal}
            stroke={chart.color("orange.solid")}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
        ) : null}
        <Tooltip
          cursor={{ fill: chart.color("bg.emphasized"), opacity: 0.4 }}
          content={<Chart.Tooltip />}
        />
        <Bar
          isAnimationActive={false}
          dataKey={chart.key("reps")}
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
        >
          {chart.data.map((d, i) => (
            <Cell
              key={i}
              fill={chart.color(d.hit ? "lime.solid" : "lime.muted")}
            />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    </Chart.Root>
  );
}
