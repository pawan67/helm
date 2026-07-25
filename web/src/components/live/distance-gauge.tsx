"use client";

import { Badge, Box, Card, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Radar } from "lucide-react";
import type { DetectionThresholds } from "@/db/schema";
import type { DeviceState } from "@/lib/live-types";
import { Eyebrow, Metric } from "@/components/shared/bits";

/**
 * Vertical distance instrument. Top = close to the sensor (top of a pull-up),
 * bottom = far / off the bar. Renders the rep zone and hang zone as bands, plus
 * a live marker at the current smoothed reading.
 */
export function DistanceGauge({
  distanceMm,
  state,
  thresholds,
}: {
  distanceMm: number | null;
  state: DeviceState;
  thresholds: DetectionThresholds;
}) {
  const { presenceMaxMm, repNearMm } = thresholds;

  const toPct = (mm: number) =>
    Math.max(0, Math.min(100, (mm / presenceMaxMm) * 100));

  const repZoneEnd = toPct(repNearMm);
  const hasReading = distanceMm != null && distanceMm <= presenceMaxMm;
  const markerPct = distanceMm != null ? toPct(distanceMm) : 100;
  const inRepZone =
    state === "rep_up" || (hasReading && distanceMm! < repNearMm);
  const active = state === "hanging" || state === "rep_up";

  const readoutColor = inRepZone ? "teal.fg" : hasReading ? "cyan.fg" : "fg.subtle";
  const markerColor = inRepZone ? "teal.solid" : "cyan.solid";

  return (
    <Card.Root bg="bg.panel" h="full">
      <Card.Header pb="0">
        <HStack justify="space-between">
          <HStack gap="2">
            <Icon
              as={Radar}
              boxSize="3.5"
              color={active ? "teal.fg" : "fg.subtle"}
            />
            <Eyebrow>Sensor</Eyebrow>
          </HStack>
          <Badge
            variant="outline"
            size="sm"
            fontFamily="mono"
            letterSpacing="wider"
            color="fg.subtle"
          >
            VL53L0X
          </Badge>
        </HStack>
      </Card.Header>

      <Card.Body gap="4">
        {/* Track + scale */}
        <Box position="relative" flex="1" minH="15rem">
          <Text
            position="absolute"
            left="0"
            top="0"
            fontSize="9px"
            letterSpacing="0.2em"
            textTransform="uppercase"
            color="fg.subtle"
          >
            near
          </Text>
          <Text
            position="absolute"
            left="0"
            bottom="0"
            fontSize="9px"
            letterSpacing="0.2em"
            textTransform="uppercase"
            color="fg.subtle"
          >
            far
          </Text>
          <Text
            position="absolute"
            left="0"
            zIndex="3"
            transform="translateY(-50%)"
            fontSize="9px"
            letterSpacing="0.2em"
            textTransform="uppercase"
            color="teal.fg"
            style={{ top: `${repZoneEnd}%` }}
          >
            rep
          </Text>

          {/* beam slot */}
          <Box
            position="relative"
            mx="auto"
            h="full"
            w="14"
            overflow="hidden"
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg"
          >
            {/* rep zone band */}
            <Box
              position="absolute"
              insetX="0"
              top="0"
              bgGradient="to-b"
              gradientFrom="teal.solid/25"
              gradientTo="transparent"
              style={{ height: `${repZoneEnd}%` }}
            />
            {/* hang zone band */}
            <Box
              position="absolute"
              insetX="0"
              bottom="0"
              bgGradient="to-b"
              gradientFrom="cyan.solid/12"
              gradientTo="transparent"
              style={{ top: `${repZoneEnd}%` }}
            />

            {/* tick marks */}
            {Array.from({ length: 9 }).map((_, i) => (
              <Box
                key={i}
                position="absolute"
                right="0"
                h="1px"
                w={i % 4 === 0 ? "3" : "2"}
                bg="border.emphasized"
                style={{ top: `${(i / 8) * 100}%` }}
              />
            ))}

            {/* dashed rep threshold line */}
            <Box
              position="absolute"
              insetX="0"
              zIndex="1"
              borderTopWidth="1px"
              borderStyle="dashed"
              borderColor="teal.solid/70"
              style={{ top: `${repZoneEnd}%` }}
            />

            {/* scan sweep while active */}
            {active && (
              <Box
                position="absolute"
                insetX="0"
                h="10"
                bgGradient="to-b"
                gradientFrom="transparent"
                gradientVia="teal.solid/25"
                gradientTo="transparent"
                animation="ih-sweep 2.4s linear infinite"
              />
            )}

            {/* live marker */}
            {hasReading && (
              <Box
                position="absolute"
                insetX="0"
                zIndex="2"
                transition="top 0.15s ease-out"
                style={{ top: `calc(${markerPct}% - 1px)` }}
              >
                <Box h="0.5" w="full" bg={markerColor} />
                <Box
                  position="absolute"
                  left="-1"
                  top="50%"
                  boxSize="2"
                  transform="translateY(-50%)"
                  rounded="full"
                  bg={markerColor}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* digital readout */}
        <Box
          rounded="lg"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          px="3"
          py="2.5"
          textAlign="center"
        >
          <Metric fontSize="2xl" color={readoutColor}>
            {distanceMm != null ? distanceMm : "—"}
          </Metric>
          <Eyebrow mt="1.5">mm to head</Eyebrow>
        </Box>
      </Card.Body>
    </Card.Root>
  );
}
