"use client";

import { useId, useState, type ComponentType } from "react";
import {
  Box,
  Button,
  Card,
  Circle,
  Field,
  Flex,
  Grid,
  HStack,
  Icon,
  Input,
  InputGroup,
  Slider,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import {
  CalendarRange,
  Check,
  CircleDot,
  Cpu,
  Dumbbell,
  Radar,
  Save,
  SlidersHorizontal,
  Target,
  Timer,
  Volume2,
} from "lucide-react";
import { useLive } from "@/components/live-provider";
import { toaster } from "@/components/ui/toaster";
import type { Settings, DetectionThresholds } from "@/db/schema";
import { Eyebrow, Metric } from "@/components/shared/bits";

type ThresholdKey = keyof DetectionThresholds;

const THRESHOLD_FIELDS: {
  key: ThresholdKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "repNearMm", label: "Rep line", hint: "Head this close to the sensor = top of a pull-up.", min: 20, max: 1000, step: 5, unit: "mm" },
  { key: "presenceMaxMm", label: "Presence range", hint: "Beyond this (or no reading) = nobody on the bar.", min: 100, max: 2000, step: 10, unit: "mm" },
  { key: "hangBandMm", label: "Hang band", hint: "Distance that counts as a hanging body.", min: 100, max: 2000, step: 10, unit: "mm" },
  { key: "repHysteresisMm", label: "Rep hysteresis", hint: "Must rise this far back above the rep line to count & re-arm.", min: 0, max: 500, step: 5, unit: "mm" },
  { key: "minRepMs", label: "Min rep time", hint: "Ignore up/down cycles faster than this (anti-jitter).", min: 0, max: 5000, step: 50, unit: "ms" },
  { key: "releaseMs", label: "Release delay", hint: "Off the bar this long ends the session.", min: 200, max: 10000, step: 100, unit: "ms" },
  { key: "presenceDebounceMs", label: "Start debounce", hint: "Must be present this long before a session starts.", min: 0, max: 5000, step: 50, unit: "ms" },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const { state, connected } = useLive();
  const [dailyGoalReps, setDailyGoalReps] = useState(initial.dailyGoalReps);
  const [weeklyGoalReps, setWeeklyGoalReps] = useState(initial.weeklyGoalReps);
  const [dailyGoalHangSec, setDailyGoalHangSec] = useState(
    Math.round(initial.dailyGoalHangMs / 1000),
  );
  const [thresholds, setThresholds] = useState<DetectionThresholds>(
    initial.thresholds,
  );
  const [soundEnabled, setSoundEnabled] = useState(initial.soundEnabled);
  const [beepOnRep, setBeepOnRep] = useState(initial.beepOnRep);
  const [beepOnSessionEnd, setBeepOnSessionEnd] = useState(
    initial.beepOnSessionEnd,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  function setT(key: ThresholdKey, value: number) {
    setThresholds((t) => ({ ...t, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyGoalReps,
          weeklyGoalReps,
          dailyGoalHangMs: dailyGoalHangSec * 1000,
          thresholds,
          soundEnabled,
          beepOnRep,
          beepOnSessionEnd,
        }),
      });
      if (res.ok) {
        setSaved(true);
        toaster.create({ title: "Saved & pushed to device", type: "success" });
      } else {
        toaster.create({ title: "Couldn't save — try again", type: "error" });
      }
    } catch {
      toaster.create({ title: "Couldn't reach the server", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const live = connected && state.deviceOnline;

  return (
    <Stack gap="6" pb="4">
      {/* Live calibration strip */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <Flex align="center" justify="space-between" flexWrap="wrap" gapX="8" gapY="5">
            <HStack gap="4">
              <Circle
                size="12"
                borderWidth="1px"
                borderColor={live ? "lime.muted" : "border.subtle"}
                bg="bg.subtle"
              >
                <Icon
                  as={Radar}
                  boxSize="6"
                  color={live ? "lime.fg" : "fg.subtle"}
                />
              </Circle>
              <Stack gap="1">
                <Eyebrow>Live reading</Eyebrow>
                <HStack align="baseline" gap="2">
                  <Metric fontSize="4xl" color="lime.fg">
                    {state.distanceMm != null ? state.distanceMm : "—"}
                  </Metric>
                  <Text fontSize="xs" color="fg.subtle">
                    mm · {live ? state.state : "offline"}
                  </Text>
                </HStack>
              </Stack>
            </HStack>
            <Text
              maxW="xs"
              fontSize="12px"
              lineHeight="tall"
              color="fg.subtle"
            >
              Hang from the bar and pull to a full rep while watching this
              number. Set the rep line just above your chin-over-bar reading.
            </Text>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Goals */}
      <Card.Root bg="bg.panel">
        <Card.Header>
          <HStack gap="2" color="fg.muted">
            <Icon as={Target} boxSize="3.5" />
            <Eyebrow>Goals</Eyebrow>
          </HStack>
          <Card.Description>
            Targets that power your rings, weekly meter and streaks.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Grid templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap="5">
            <GoalField
              icon={Dumbbell}
              label="Daily reps"
              unit="reps"
              description="Reps target each day."
              value={dailyGoalReps}
              min={0}
              max={10000}
              onChange={(v) => {
                setDailyGoalReps(v);
                setSaved(false);
              }}
            />
            <GoalField
              icon={CalendarRange}
              label="Weekly reps"
              unit="reps"
              description="Reps target across the week."
              value={weeklyGoalReps}
              min={0}
              max={70000}
              onChange={(v) => {
                setWeeklyGoalReps(v);
                setSaved(false);
              }}
            />
            <GoalField
              icon={Timer}
              label="Daily hang"
              unit="sec"
              description="Seconds of hang time each day."
              value={dailyGoalHangSec}
              min={0}
              max={3600}
              onChange={(v) => {
                setDailyGoalHangSec(v);
                setSaved(false);
              }}
            />
          </Grid>
        </Card.Body>
      </Card.Root>

      {/* Sound */}
      <Card.Root bg="bg.panel">
        <Card.Header>
          <HStack gap="2" color="fg.muted">
            <Icon as={Volume2} boxSize="3.5" />
            <Eyebrow>Sound</Eyebrow>
          </HStack>
          <Card.Description>
            The on-bar buzzer. Turn beeps off if the chirping bugs you — this
            pushes to the ESP32 instantly over MQTT.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Stack gap="5">
            <ToggleRow
              label="Beeps"
              hint="Master switch for the buzzer. Off silences everything."
              checked={soundEnabled}
              onChange={(v) => {
                setSoundEnabled(v);
                setSaved(false);
              }}
            />
            <ToggleRow
              label="Chirp on each rep"
              hint="A short beep every time a rep is counted."
              checked={beepOnRep}
              disabled={!soundEnabled}
              onChange={(v) => {
                setBeepOnRep(v);
                setSaved(false);
              }}
            />
            <ToggleRow
              label="Jingle when a set is saved"
              hint="A two-tone chime at the end of a set."
              checked={beepOnSessionEnd}
              disabled={!soundEnabled}
              onChange={(v) => {
                setBeepOnSessionEnd(v);
                setSaved(false);
              }}
            />
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Detection thresholds */}
      <Card.Root bg="bg.panel">
        <Card.Header>
          <HStack gap="2" color="fg.muted">
            <Icon as={SlidersHorizontal} boxSize="3.5" />
            <Eyebrow>Detection thresholds</Eyebrow>
          </HStack>
          <Card.Description>
            Pushed to the ESP32 instantly over MQTT — no reflashing. Tune them
            against the live reading above.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Grid
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
            columnGap="8"
            rowGap="6"
          >
            {THRESHOLD_FIELDS.map((f) => (
              <SliderField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={thresholds[f.key]}
                min={f.min}
                max={f.max}
                step={f.step}
                unit={f.unit}
                onChange={(v) => setT(f.key, v)}
              />
            ))}
          </Grid>
        </Card.Body>
      </Card.Root>

      {/* Device */}
      <Card.Root bg="bg.panel">
        <Card.Header>
          <HStack gap="2" color="fg.muted">
            <Icon as={Cpu} boxSize="3.5" />
            <Eyebrow>Device</Eyebrow>
          </HStack>
          <Card.Description>
            Read-only telemetry from the sensor on the bar.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Grid
            templateColumns={{ base: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }}
            gap="3"
          >
            <Info label="ID" value={initial.deviceId} />
            <Info label="Status" value={live ? "online" : "offline"} tone={live ? "lime" : "red"} dot />
            <Info label="Firmware" value={state.fwVersion ?? "—"} />
            <Info label="Signal" value={state.rssi != null ? `${state.rssi} dBm` : "—"} />
          </Grid>
        </Card.Body>
      </Card.Root>

      {/* Save bar */}
      <Box position="sticky" bottom={{ base: "4", lg: "6" }} zIndex="5">
        <Flex
          align="center"
          justify="space-between"
          gap="4"
          rounded="xl"
          borderWidth="1px"
          borderColor="border.subtle"
          bg="bg.panel/90"
          backdropFilter="blur(8px)"
          shadow="lg"
          px="4"
          py="3"
        >
          <HStack gap="2" fontSize="xs" minW="0">
            {saved ? (
              <>
                <Icon as={Check} boxSize="3.5" color="lime.fg" />
                <Text color="fg.subtle" truncate>
                  All changes saved
                </Text>
              </>
            ) : (
              <>
                <Icon as={CircleDot} boxSize="3.5" color="orange.fg" />
                <Text color="orange.fg" truncate>
                  Unsaved changes
                </Text>
              </>
            )}
          </HStack>
          <Button
            colorPalette="lime"
            size="lg"
            onClick={save}
            loading={saving}
            loadingText="Saving…"
          >
            <Icon as={Save} boxSize="4" />
            Save changes
          </Button>
        </Flex>
      </Box>
    </Stack>
  );
}

function GoalField({
  icon: Ico,
  label,
  value,
  min,
  max,
  unit,
  description,
  onChange,
}: {
  icon: ComponentType<{ size?: number | string }>;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  description: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <Field.Root>
      <Field.Label htmlFor={id}>
        <Icon as={Ico} boxSize="3.5" color="fg.subtle" />
        <Eyebrow>{label}</Eyebrow>
      </Field.Label>
      <InputGroup
        endElement={
          <Text fontSize="xs" color="fg.subtle">
            {unit}
          </Text>
        }
      >
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          fontVariantNumeric="tabular-nums"
        />
      </InputGroup>
      <Field.HelperText>{description}</Field.HelperText>
    </Field.Root>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="6"
      opacity={disabled ? 0.5 : 1}
    >
      <Stack gap="0.5" minW="0">
        <Text fontSize="sm" fontWeight="medium">
          {label}
        </Text>
        <Text fontSize="xs" color="fg.subtle">
          {hint}
        </Text>
      </Stack>
      <Switch.Root
        checked={checked}
        onCheckedChange={(e) => onChange(e.checked)}
        colorPalette="lime"
        size="md"
        disabled={disabled}
        flexShrink="0"
      >
        <Switch.HiddenInput />
        <Switch.Control />
      </Switch.Root>
    </Flex>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <Slider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      colorPalette="lime"
      onValueChange={(e) => onChange(e.value[0])}
    >
      <HStack justify="space-between" mb="1">
        <Slider.Label fontSize="sm" fontWeight="medium">
          {label}
        </Slider.Label>
        <Text fontSize="sm" color="lime.fg" fontVariantNumeric="tabular-nums">
          {value}
          <Text as="span" ml="1" color="fg.subtle">
            {unit}
          </Text>
        </Text>
      </HStack>
      <Slider.Control>
        <Slider.Track>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumbs />
      </Slider.Control>
      <Text fontSize="xs" color="fg.subtle" mt="1.5">
        {hint}
      </Text>
    </Slider.Root>
  );
}

function Info({
  label,
  value,
  tone,
  dot = false,
}: {
  label: string;
  value: string;
  tone?: "lime" | "red";
  dot?: boolean;
}) {
  const color = tone === "lime" ? "lime.fg" : tone === "red" ? "red.fg" : "fg";
  return (
    <Stack
      gap="1.5"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      bg="bg.subtle"
      px="3.5"
      py="3"
    >
      <Eyebrow fontSize="9px">{label}</Eyebrow>
      <HStack
        gap="2"
        fontSize="sm"
        color={color}
        fontVariantNumeric="tabular-nums"
      >
        {dot ? (
          <Circle
            size="2"
            bg={tone === "lime" ? "lime.solid" : "red.solid"}
            flexShrink="0"
          />
        ) : null}
        <Text truncate>{value}</Text>
      </HStack>
    </Stack>
  );
}
