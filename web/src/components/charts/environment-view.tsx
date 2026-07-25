"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  EmptyState,
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
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets, Gauge, Thermometer } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { Eyebrow, StatCard } from "@/components/shared/bits";
import type { EnvBucketUnit, EnvSeries } from "@/lib/env-series";

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
];

type Datum = {
  at: string;
  label: string;
  temp: number | null;
  humidity: number | null;
};

/** Bucket-start label: "MM-DD HHh" for hourly, "MM-DD" for daily. */
function fmtLabel(iso: string, unit: EnvBucketUnit): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const md = `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return unit === "hour" ? `${md} ${p(d.getHours())}h` : md;
}

const fmtTemp = (n: number | null) => (n == null ? "—" : n.toFixed(1));
const fmtHum = (n: number | null) => (n == null ? "—" : Math.round(n).toString());

export function EnvironmentView({ initial }: { initial: EnvSeries }) {
  const { state, connected } = useLive();
  const [range, setRange] = useState(7);
  const [series, setSeries] = useState<EnvSeries>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/env?days=${range}`)
      .then((r) => r.json())
      .then((s: EnvSeries) => {
        if (!cancelled) setSeries(s);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const data: Datum[] = useMemo(
    () =>
      series.points.map((p) => ({
        at: p.at,
        label: fmtLabel(p.at, series.unit),
        temp: p.tempAvg,
        humidity: p.humidityAvg,
      })),
    [series],
  );

  // Prefer the live reading; fall back to the latest stored sample.
  const liveTemp = state.tempC ?? series.current?.tempC ?? null;
  const liveHum = state.humidity ?? series.current?.humidity ?? null;
  const live = connected && state.deviceOnline;

  const temps = series.points.map((p) => p.tempMin).filter((n): n is number => n != null);
  const highs = series.points.map((p) => p.tempMax).filter((n): n is number => n != null);
  const low = temps.length ? Math.min(...temps) : null;
  const high = highs.length ? Math.max(...highs) : null;

  const hasData = data.some((d) => d.temp != null || d.humidity != null);

  const tempChart = useChart({
    data,
    series: [{ name: "temp", color: "orange.solid" }],
  });
  const humChart = useChart({
    data,
    series: [{ name: "humidity", color: "cyan.solid" }],
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

      {/* Current readings */}
      <Grid templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap="4">
        <StatCard
          label="Temperature"
          value={fmtTemp(liveTemp)}
          unit="°C"
          icon={Thermometer}
          accent="orange"
          sub={live ? "Live on the bar" : "Last reading"}
        />
        <StatCard
          label="Humidity"
          value={fmtHum(liveHum)}
          unit="%"
          icon={Droplets}
          accent="cyan"
          sub={live ? "Live on the bar" : "Last reading"}
        />
        <StatCard
          label="Range"
          value={low != null && high != null ? `${fmtTemp(low)}–${fmtTemp(high)}` : "—"}
          unit="°C"
          icon={Gauge}
          accent="gray"
          sub={`Low–high over ${range} days`}
        />
      </Grid>

      {!hasData ? (
        <Card.Root bg="bg.panel">
          <Card.Body>
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon as={Thermometer} />
                </EmptyState.Indicator>
                <EmptyState.Title>No readings yet</EmptyState.Title>
                <EmptyState.Description>
                  Ambient temperature and humidity from the DHT11 on the bar will
                  chart here once the device starts reporting.
                </EmptyState.Description>
              </EmptyState.Content>
            </EmptyState.Root>
          </Card.Body>
        </Card.Root>
      ) : (
        <>
          {/* Temperature */}
          <Card.Root bg="bg.panel">
            <Card.Header pb="0">
              <HStack justify="space-between">
                <HStack gap="2" color="fg.muted">
                  <Icon as={Thermometer} boxSize="3.5" color="orange.fg" />
                  <Eyebrow>Temperature</Eyebrow>
                </HStack>
                <Text fontFamily="mono" fontSize="xs" color="fg.subtle">
                  °C
                </Text>
              </HStack>
            </Card.Header>
            <Card.Body opacity={loading ? 0.6 : 1} transition="opacity 0.2s">
              <Chart.Root w="full" h="240px" aspectRatio="auto" chart={tempChart}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={tempChart.data}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <Chart.Gradient
                        id="tempFill"
                        stops={[
                          { offset: "0%", color: "orange.solid", opacity: 0.5 },
                          { offset: "100%", color: "orange.solid", opacity: 0 },
                        ]}
                      />
                    </defs>
                    <CartesianGrid stroke={tempChart.color("border.muted")} vertical={false} />
                    <XAxis
                      dataKey={tempChart.key("label")}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tick={{ fontSize: 10, fill: tempChart.color("fg.muted") }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      domain={["dataMin - 1", "dataMax + 1"]}
                      tick={{ fontSize: 10, fill: tempChart.color("fg.muted") }}
                    />
                    <Tooltip
                      cursor={{ stroke: tempChart.color("orange.solid"), strokeOpacity: 0.4 }}
                      content={<Chart.Tooltip />}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey={tempChart.key("temp")}
                      stroke={tempChart.color("orange.solid")}
                      strokeWidth={2}
                      fill="url(#tempFill)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Chart.Root>
            </Card.Body>
          </Card.Root>

          {/* Humidity */}
          <Card.Root bg="bg.panel">
            <Card.Header pb="0">
              <HStack justify="space-between">
                <HStack gap="2" color="fg.muted">
                  <Icon as={Droplets} boxSize="3.5" color="cyan.fg" />
                  <Eyebrow>Humidity</Eyebrow>
                </HStack>
                <Text fontFamily="mono" fontSize="xs" color="fg.subtle">
                  %
                </Text>
              </HStack>
            </Card.Header>
            <Card.Body opacity={loading ? 0.6 : 1} transition="opacity 0.2s">
              <Chart.Root w="full" h="200px" aspectRatio="auto" chart={humChart}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={humChart.data}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <Chart.Gradient
                        id="humFill"
                        stops={[
                          { offset: "0%", color: "cyan.solid", opacity: 0.45 },
                          { offset: "100%", color: "cyan.solid", opacity: 0 },
                        ]}
                      />
                    </defs>
                    <CartesianGrid stroke={humChart.color("border.muted")} vertical={false} />
                    <XAxis
                      dataKey={humChart.key("label")}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tick={{ fontSize: 10, fill: humChart.color("fg.muted") }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: humChart.color("fg.muted") }}
                    />
                    <Tooltip
                      cursor={{ stroke: humChart.color("cyan.solid"), strokeOpacity: 0.4 }}
                      content={<Chart.Tooltip />}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey={humChart.key("humidity")}
                      stroke={humChart.color("cyan.solid")}
                      strokeWidth={2}
                      fill="url(#humFill)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Chart.Root>
            </Card.Body>
          </Card.Root>
        </>
      )}
    </Stack>
  );
}
