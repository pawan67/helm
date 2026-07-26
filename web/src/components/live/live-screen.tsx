"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  CloseButton,
  Dialog,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Clock } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { DistanceGauge } from "./distance-gauge";
import type { DetectionThresholds } from "@/db/schema";
import { RECORD_LABELS } from "@/lib/live-types";
import { formatDuration, formatHang } from "@/lib/time";
import { Eyebrow, Metric, Readout } from "@/components/shared/bits";

type StateMeta = { label: string; palette: string; dot: string };

const STATE_META: Record<string, StateMeta> = {
  idle: { label: "Ready", palette: "gray", dot: "fg.subtle" },
  hanging: { label: "On the bar", palette: "lime", dot: "lime.solid" },
  rep_up: { label: "Pulling", palette: "lime", dot: "lime.solid" },
  offline: { label: "Device offline", palette: "danger", dot: "danger.solid" },
};

export function LiveScreen({ thresholds }: { thresholds: DetectionThresholds }) {
  const { state, connected, repTick, lastSessionEnd, clearSessionEnd } =
    useLive();
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(0);
  const prevTick = useRef(0);

  const active = state.state === "hanging" || state.state === "rep_up";
  const deviceState = connected ? state.state : "offline";
  const meta = STATE_META[deviceState] ?? STATE_META.idle;

  // On-bar timer, driven client-side from the session start instant.
  useEffect(() => {
    if (!active || !state.sessionStartedAt) {
      setElapsed(0);
      return;
    }
    const start = state.sessionStartedAt;
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [active, state.sessionStartedAt]);

  // Full-screen flash on each new rep.
  useEffect(() => {
    if (repTick !== prevTick.current) {
      prevTick.current = repTick;
      if (repTick > 0) setFlash((n) => n + 1);
    }
  }, [repTick]);

  // Auto-dismiss the session summary after a while.
  useEffect(() => {
    if (!lastSessionEnd) return;
    const id = setTimeout(clearSessionEnd, 14000);
    return () => clearTimeout(id);
  }, [lastSessionEnd, clearSessionEnd]);

  return (
    <Box position="relative">
      {/* rep flash */}
      <Box
        key={flash}
        position="fixed"
        inset="0"
        zIndex="40"
        pointerEvents="none"
        opacity={flash > 0 ? undefined : 0}
        animation={flash > 0 ? "ih-flash 0.5s ease-out" : undefined}
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, color-mix(in srgb, var(--chakra-colors-lime-solid) 20%, transparent), transparent 70%)",
        }}
      />

      <Grid templateColumns={{ base: "1fr", lg: "1fr auto" }} gap="4">
        {/* Main readout panel */}
        <Box
          position="relative"
          bg="bg.panel"
          borderWidth="1px"
          borderColor={active ? "lime.muted" : "border.subtle"}
          rounded="lg"
          overflow="hidden"
          className="ih-machined"
          transition="border-color 0.3s ease-out"
        >
          {/* live caution stripe */}
          {active ? (
            <Box position="absolute" top="0" insetX="0" h="3px" className="ih-stripe" />
          ) : null}

          {/* faint lime wash from the top while active */}
          <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            opacity={active ? 1 : 0}
            transition="opacity 0.4s ease-out"
            style={{
              background:
                "radial-gradient(95% 55% at 50% -10%, color-mix(in srgb, var(--chakra-colors-lime-solid) 9%, transparent), transparent 60%)",
            }}
          />

          <Flex
            direction="column"
            position="relative"
            minH={{ base: "62dvh", lg: "72dvh" }}
            p={{ base: "6", sm: "8" }}
          >
            {/* status row */}
            <HStack justify="space-between" gap="3">
              <Badge
                colorPalette={meta.palette}
                variant="surface"
                size="lg"
                rounded="full"
                fontWeight="600"
                letterSpacing="0.01em"
              >
                <Box
                  rounded="full"
                  boxSize="2"
                  bg={meta.dot}
                  animation={active ? "ih-blink 1.1s ease-in-out infinite" : undefined}
                />
                {meta.label}
              </Badge>

              <HStack gap="1.5" fontSize="xs" color="fg.subtle">
                {connected ? (
                  <>
                    <Text>Stream</Text>
                    <Box boxSize="1.5" rounded="full" bg="online.solid" />
                    <Text color="fg.muted">live</Text>
                  </>
                ) : (
                  <>
                    <Box
                      rounded="full"
                      boxSize="1.5"
                      bg="danger.solid"
                      animation="ih-blink 1.1s ease-in-out infinite"
                    />
                    <Text>reconnecting…</Text>
                  </>
                )}
              </HStack>
            </HStack>

            {/* giant counter */}
            <Flex direction="column" align="center" justify="center" flex="1" py="6">
              <Readout
                key={repTick}
                color="lime.fg"
                animation={repTick > 0 ? "ih-pop 0.28s cubic-bezier(0.16,1,0.3,1)" : undefined}
                style={{ fontSize: "clamp(7rem, 30vw, 17rem)" }}
              >
                {state.reps}
              </Readout>
              <Eyebrow mt="2" fontSize="sm" letterSpacing="0.16em" color="fg.muted">
                reps
              </Eyebrow>

              {/* on-bar timer */}
              <HStack
                mt="8"
                gap="3"
                rounded="md"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg/60"
                px="5"
                py="2.5"
                className="ih-machined"
              >
                <Icon as={Clock} boxSize="4.5" color="fg.subtle" />
                <Metric fontSize="3xl" fontWeight="500" color="fg">
                  {formatDuration(elapsed)}
                </Metric>
                <Eyebrow fontSize="9px">on bar</Eyebrow>
              </HStack>
            </Flex>

            {/* idle hint */}
            {!active && !lastSessionEnd && (
              <Text
                textAlign="center"
                fontSize="sm"
                color="fg.subtle"
              >
                {connected
                  ? "Grab the bar to start a session"
                  : "Waiting for the device stream…"}
              </Text>
            )}
          </Flex>
        </Box>

        {/* Distance gauge */}
        <GridItem w={{ base: "full", lg: "56" }}>
          <DistanceGauge
            distanceMm={state.distanceMm}
            state={deviceState}
            thresholds={thresholds}
          />
        </GridItem>
      </Grid>

      {/* Session summary overlay */}
      <SessionSummary end={lastSessionEnd} onClose={clearSessionEnd} />
    </Box>
  );
}

function SessionSummary({
  end,
  onClose,
}: {
  end: ReturnType<typeof useLive>["lastSessionEnd"];
  onClose: () => void;
}) {
  const open = !!end;
  const [shown, setShown] = useState(end);
  useEffect(() => {
    if (end) setShown(end);
  }, [end]);

  const isPull = shown?.type === "pullup_set";
  const hasPR = (shown?.brokenRecords.length ?? 0) > 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      placement="center"
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" rounded="lg">
            <Dialog.Title srOnly>Session complete</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            {shown && (
              <Dialog.Body>
                <Stack gap="5" py="2">
                  <Eyebrow tick>Session complete</Eyebrow>

                  {hasPR && (
                    <HStack
                      justify="center"
                      gap="2"
                      bg="hazard.solid"
                      color="hazard.contrast"
                      rounded="full"
                      py="2"
                      fontWeight="700"
                      letterSpacing="0.01em"
                      animation="ih-stamp 0.45s cubic-bezier(0.16,1,0.3,1)"
                    >
                      ★ New personal record
                    </HStack>
                  )}

                  <HStack align="baseline" gap="3">
                    <Readout fontSize="6xl" color={isPull ? "lime.fg" : "fg"}>
                      {isPull ? shown.reps : formatHang(shown.maxHangMs)}
                    </Readout>
                    <Text
                      fontWeight="600"
                      fontSize="2xl"
                      color="fg.muted"
                    >
                      {isPull ? "reps" : "hang"}
                    </Text>
                  </HStack>

                  <Grid templateColumns="repeat(3, 1fr)" gap="2.5">
                    <SummaryStat label="On bar" value={formatDuration(shown.durationMs)} />
                    <SummaryStat label="Hang time" value={formatHang(shown.hangMs)} />
                    <SummaryStat label="Best hold" value={formatHang(shown.maxHangMs)} accent />
                  </Grid>

                  {hasPR && (
                    <HStack gap="2" flexWrap="wrap">
                      {shown.brokenRecords.map((r) => (
                        <Badge
                          key={r}
                          colorPalette="hazard"
                          variant="surface"
                          rounded="full"
                        >
                          ★ {RECORD_LABELS[r] ?? r}
                        </Badge>
                      ))}
                    </HStack>
                  )}
                </Stack>
              </Dialog.Body>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function SummaryStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Box
      rounded="md"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      px="3"
      py="3"
      textAlign="center"
    >
      <Eyebrow fontSize="10px">{label}</Eyebrow>
      <Metric mt="1.5" fontSize="lg" color={accent ? "lime.fg" : "fg"}>
        {value}
      </Metric>
    </Box>
  );
}
