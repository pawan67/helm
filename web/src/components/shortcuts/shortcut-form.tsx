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
import type { DeviceWithButtons } from "@/components/remote/types";
import { toaster } from "@/components/ui/toaster";
import {
  DEFAULT_PANASONIC_CONFIG,
  type ClimateFan,
  type ClimateMode,
} from "@/lib/ir-climate";
import type { ScheduleAction } from "@/lib/schedule";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Add a one-tap action link. Shortcuts are delete-and-recreate (no edit). */
export function ShortcutForm({
  open,
  onOpenChange,
  devices,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: DeviceWithButtons[];
  onSaved: () => void | Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState<ClimateMode>("cool");
  const [tempC, setTempC] = useState(24);
  const [fan, setFan] = useState<ClimateFan>("auto");
  const [buttonId, setButtonId] = useState("");
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

  useEffect(() => {
    if (!open) return;
    const dev = devices[0];
    setLabel("");
    setDeviceId(dev?.id ?? "");
    applyDeviceDefaults(dev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onDeviceChange(id: string) {
    setDeviceId(id);
    applyDeviceDefaults(devices.find((d) => d.id === id));
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
    if (!label.trim() || !deviceId || !action) {
      toaster.create({ title: "Add a name, device and action", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), deviceId, action }),
      });
      if (res.ok) {
        toaster.create({ title: "Shortcut created", type: "success" });
        await onSaved();
        onOpenChange(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toaster.create({ title: err.error ?? "Couldn't create the shortcut", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

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
              <Dialog.Title>New shortcut</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Name</Field.Label>
                  <Input
                    size="sm"
                    value={label}
                    placeholder="e.g. AC on, Fan speed 3"
                    maxLength={60}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </Field.Root>

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
                              Number.isFinite(e.valueAsNumber) && setTempC(e.valueAsNumber)
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
                loadingText="Creating…"
              >
                Create shortcut
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
