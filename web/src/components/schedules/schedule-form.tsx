"use client";

import { useEffect, useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Field,
  HStack,
  Input,
  NativeSelect,
  NumberInput,
  Portal,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import type { Schedule } from "@/db/schema";
import type { DeviceWithButtons } from "@/components/remote/types";
import { toaster } from "@/components/ui/toaster";
import {
  DEFAULT_PANASONIC_CONFIG,
  type ClimateFan,
  type ClimateMode,
} from "@/lib/ir-climate";
import { WEEKDAYS, type ScheduleAction } from "@/lib/schedule";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,…,55

export function ScheduleForm({
  open,
  onOpenChange,
  schedule,
  devices,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create, a Schedule = edit. */
  schedule: Schedule | null;
  devices: DeviceWithButtons[];
  onSaved: () => void | Promise<void>;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState<ClimateMode>("cool");
  const [tempC, setTempC] = useState(24);
  const [fan, setFan] = useState<ClimateFan>("auto");
  const [buttonId, setButtonId] = useState("");
  const [hour, setHour] = useState(22);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const device = devices.find((d) => d.id === deviceId);
  const isClimate = device?.kind === "climate";
  const cfg = device?.config ?? DEFAULT_PANASONIC_CONFIG;

  function applyDeviceDefaults(dev?: DeviceWithButtons) {
    if (!dev) return;
    if (dev.kind === "climate") {
      setPower(true);
      setMode(dev.state?.mode ?? dev.config?.modes[0] ?? "cool");
      setTempC(dev.state?.tempC ?? 24);
      setFan(dev.state?.fan ?? dev.config?.fans[0] ?? "auto");
    } else {
      setButtonId(dev.buttons[0]?.id ?? "");
    }
  }

  // Seed fields whenever the dialog opens (edit prefills; add uses defaults).
  useEffect(() => {
    if (!open) return;
    if (schedule) {
      const dev = devices.find((d) => d.id === schedule.deviceId);
      setDeviceId(schedule.deviceId);
      setHour(Math.floor(schedule.atMinute / 60));
      setMinute(schedule.atMinute % 60);
      setDays(schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6]);
      setName(schedule.name);
      applyDeviceDefaults(dev);
      const a = schedule.action;
      if (a.kind === "climate") {
        setPower(a.patch.power !== false);
        if (a.patch.mode) setMode(a.patch.mode);
        if (a.patch.tempC != null) setTempC(a.patch.tempC);
        if (a.patch.fan) setFan(a.patch.fan);
      } else {
        setButtonId(a.buttonId);
      }
    } else {
      const dev = devices[0];
      setDeviceId(dev?.id ?? "");
      setHour(22);
      setMinute(0);
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setName("");
      applyDeviceDefaults(dev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onDeviceChange(id: string) {
    setDeviceId(id);
    applyDeviceDefaults(devices.find((d) => d.id === id));
  }

  function toggleDay(i: number) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  }

  function buildAction(): ScheduleAction | null {
    if (!device) return null;
    if (device.kind === "climate") {
      return power
        ? { kind: "climate", patch: { power: true, mode, tempC, fan } }
        : { kind: "climate", patch: { power: false } };
    }
    return buttonId ? { kind: "button", buttonId } : null;
  }

  async function save() {
    const action = buildAction();
    if (!deviceId || !action) {
      toaster.create({ title: "Pick a device and an action", type: "error" });
      return;
    }
    if (days.length === 0) {
      toaster.create({ title: "Pick at least one day", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const body = { deviceId, action, atMinute: hour * 60 + minute, days, name };
      const res = await fetch(
        schedule ? `/api/schedules/${schedule.id}` : "/api/schedules",
        {
          method: schedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        toaster.create({
          title: schedule ? "Schedule updated" : "Schedule added",
          type: "success",
        });
        await onSaved();
        onOpenChange(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toaster.create({
          title: err.error ?? "Couldn't save the schedule",
          type: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  // Include an off-grid minute (from an edited schedule) so it stays selectable.
  const minuteOptions = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => a - b);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel">
            <Dialog.Header>
              <Dialog.Title>{schedule ? "Edit schedule" : "New schedule"}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Device</Field.Label>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={deviceId}
                      onChange={(e) => onDeviceChange(e.target.value)}
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                {isClimate ? (
                  <Stack gap="3">
                    <Switch.Root
                      checked={power}
                      onCheckedChange={(e) => setPower(e.checked)}
                      colorPalette="lime"
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                      <Switch.Label>{power ? "Turn on" : "Turn off"}</Switch.Label>
                    </Switch.Root>

                    {power ? (
                      <HStack gap="3" align="end" flexWrap="wrap">
                        <Field.Root maxW="8.5rem">
                          <Field.Label>Mode</Field.Label>
                          <NativeSelect.Root size="sm">
                            <NativeSelect.Field
                              value={mode}
                              onChange={(e) => setMode(e.target.value as ClimateMode)}
                            >
                              {cfg.modes.map((m) => (
                                <option key={m} value={m}>
                                  {cap(m)}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>

                        <Field.Root maxW="6.5rem">
                          <Field.Label>Temp °C</Field.Label>
                          <NumberInput.Root
                            size="sm"
                            value={String(tempC)}
                            min={cfg.tempMin}
                            max={cfg.tempMax}
                            onValueChange={(e) =>
                              Number.isFinite(e.valueAsNumber) &&
                              setTempC(e.valueAsNumber)
                            }
                          >
                            <NumberInput.Control />
                            <NumberInput.Input />
                          </NumberInput.Root>
                        </Field.Root>

                        <Field.Root maxW="8rem">
                          <Field.Label>Fan</Field.Label>
                          <NativeSelect.Root size="sm">
                            <NativeSelect.Field
                              value={fan}
                              onChange={(e) => setFan(e.target.value as ClimateFan)}
                            >
                              {cfg.fans.map((f) => (
                                <option key={f} value={f}>
                                  {cap(f)}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                      </HStack>
                    ) : null}
                  </Stack>
                ) : (
                  <Field.Root>
                    <Field.Label>Button</Field.Label>
                    {device && device.buttons.length > 0 ? (
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={buttonId}
                          onChange={(e) => setButtonId(e.target.value)}
                        >
                          {device.buttons.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    ) : (
                      <Text fontSize="sm" color="fg.muted">
                        This device has no buttons yet — add some on the Remote screen.
                      </Text>
                    )}
                  </Field.Root>
                )}

                <Field.Root>
                  <Field.Label>Time</Field.Label>
                  <HStack gap="2" align="center">
                    <NativeSelect.Root size="sm" maxW="5.5rem">
                      <NativeSelect.Field
                        value={String(hour)}
                        onChange={(e) => setHour(Number(e.target.value))}
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Text fontWeight="bold" color="fg.muted">
                      :
                    </Text>
                    <NativeSelect.Root size="sm" maxW="5.5rem">
                      <NativeSelect.Field
                        value={String(minute)}
                        onChange={(e) => setMinute(Number(e.target.value))}
                      >
                        {minuteOptions.map((m) => (
                          <option key={m} value={m}>
                            {String(m).padStart(2, "0")}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </HStack>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Days</Field.Label>
                  <Stack gap="2">
                    <HStack gap="1.5">
                      <Button
                        size="2xs"
                        variant="outline"
                        onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}
                      >
                        Every day
                      </Button>
                      <Button
                        size="2xs"
                        variant="outline"
                        onClick={() => setDays([1, 2, 3, 4, 5])}
                      >
                        Weekdays
                      </Button>
                      <Button
                        size="2xs"
                        variant="outline"
                        onClick={() => setDays([0, 6])}
                      >
                        Weekends
                      </Button>
                    </HStack>
                    <HStack gap="1">
                      {WEEKDAYS.map((d, i) => {
                        const on = days.includes(i);
                        return (
                          <Button
                            key={i}
                            size="xs"
                            minW="9"
                            px="0"
                            variant={on ? "solid" : "outline"}
                            colorPalette={on ? "lime" : "gray"}
                            onClick={() => toggleDay(i)}
                          >
                            {d.slice(0, 2)}
                          </Button>
                        );
                      })}
                    </HStack>
                  </Stack>
                </Field.Root>

                <Field.Root>
                  <Field.Label>
                    Name{" "}
                    <Text as="span" color="fg.subtle" fontWeight="normal">
                      (optional)
                    </Text>
                  </Field.Label>
                  <Input
                    size="sm"
                    value={name}
                    placeholder="e.g. Bedtime AC"
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="lime"
                onClick={save}
                loading={saving}
                loadingText="Saving…"
              >
                {schedule ? "Save changes" : "Add schedule"}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
