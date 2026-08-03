"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  Circle,
  HStack,
  Icon,
  IconButton,
  Spacer,
  Stack,
  Text,
  Wrap,
} from "@chakra-ui/react";
import { Minus, Pencil, Plus, Power } from "lucide-react";
import { Eyebrow, Metric, Readout } from "@/components/shared/bits";
import { toaster } from "@/components/ui/toaster";
import { useLive } from "@/components/live-provider";
import {
  applyClimatePatch,
  normalizeClimate,
  resolveClimateConfig,
  type ClimatePatch,
  type IrClimateState,
} from "@/lib/ir-climate";
import { iconFor } from "./icons";
import { ButtonDialog } from "./edit-dialogs";
import type { DeviceWithButtons, IrButton } from "./types";

const MODE_LABEL: Record<string, string> = {
  auto: "Auto",
  cool: "Cool",
  heat: "Heat",
  dry: "Dry",
  fan: "Fan",
};
const FAN_LABEL: Record<string, string> = {
  auto: "Auto",
  min: "Min",
  low: "Low",
  med: "Med",
  high: "High",
  max: "Max",
};
const SWING_LABEL: Record<string, string> = {
  auto: "Auto",
  highest: "Top",
  high: "High",
  middle: "Mid",
  low: "Low",
  lowest: "Btm",
};
const SWING_H_LABEL: Record<string, string> = {
  auto: "Auto",
  full_left: "◀◀",
  left: "◀",
  middle: "Mid",
  right: "▶",
  full_right: "▶▶",
};
const PRESET_LABEL: Record<string, string> = {
  none: "Normal",
  quiet: "Quiet",
  powerful: "Turbo",
};

/** A row of toggle buttons; the active value is highlighted. */
function ToggleRow({
  label,
  options,
  labels,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  options: string[];
  labels: Record<string, string>;
  value: string;
  disabled?: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <Stack gap="1.5" opacity={disabled ? 0.4 : 1} pointerEvents={disabled ? "none" : "auto"}>
      <Eyebrow>{label}</Eyebrow>
      <Wrap gap="1.5">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Button
              key={opt}
              size="sm"
              // 44px min touch target (Chakra sm is 32px): sweaty-hand,
              // look-away taps from across the room need a real hit area.
              minW="12"
              minH="11"
              variant={active ? "solid" : "outline"}
              colorPalette={active ? "lime" : "gray"}
              color={active ? "lime.contrast" : "fg.muted"}
              borderColor={active ? "lime.solid" : "border.subtle"}
              onClick={() => onSelect(opt)}
            >
              {labels[opt] ?? opt}
            </Button>
          );
        })}
      </Wrap>
    </Stack>
  );
}

export function ClimateCard({
  device,
  editMode,
  onEdit,
  onButtonSaved,
  onButtonDeleted,
}: {
  device: DeviceWithButtons;
  editMode: boolean;
  onEdit: () => void;
  onButtonSaved: (button: IrButton) => void;
  onButtonDeleted: (id: string) => void;
}) {
  const config = resolveClimateConfig(device.config);
  const { irClimate } = useLive();
  const [state, setState] = useState<IrClimateState>(() => normalizeClimate(device.state, config));
  const [firing, setFiring] = useState<string | null>(null);
  const [btnDialog, setBtnDialog] = useState<{ open: boolean; button?: IrButton }>({ open: false });

  // Reconcile with server-pushed state (another tab, or Home Assistant).
  const external = irClimate[device.id];
  useEffect(() => {
    if (external) setState(external);
  }, [external]);

  async function send(patch: ClimatePatch) {
    const prev = state;
    const next = applyClimatePatch(state, patch, config);
    setState(next);
    try {
      const res = await fetch("/api/remote/climate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id, patch }),
      });
      if (!res.ok) throw new Error("send failed");
    } catch {
      setState(prev); // revert; the AC never got the command
      toaster.create({ title: "Couldn't reach the device", type: "error" });
    }
  }

  // Fire an extra one-shot IR button attached to the AC (e.g. a captured
  // "Light" toggle) — independent of the AC power state.
  async function fire(button: IrButton) {
    setFiring(button.id);
    try {
      const res = await fetch("/api/remote/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonId: button.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Send failed");
      }
    } catch (err) {
      toaster.create({ title: (err as Error).message, type: "error" });
    } finally {
      setTimeout(() => setFiring((f) => (f === button.id ? null : f)), 350);
    }
  }

  const on = state.power;
  const DeviceIcon = iconFor(device.icon);

  return (
    <Card.Root
      colorPalette={on ? "lime" : "gray"}
      bg="bg.panel"
      borderColor={on ? "lime.muted" : "border.subtle"}
      position="relative"
      overflow="hidden"
      transition="border-color 0.2s"
    >
      <Card.Header>
        <HStack>
          <Circle
            size="10"
            bg={on ? "lime.subtle" : "bg.subtle"}
            color={on ? "lime.fg" : "fg.subtle"}
            borderWidth="1px"
            borderColor={on ? "lime.muted" : "border.subtle"}
          >
            <DeviceIcon size={18} />
          </Circle>
          <Stack gap="0.5">
            <Text fontWeight="700">
              {device.name}
            </Text>
            <Eyebrow>{on ? MODE_LABEL[state.mode] : "Standby"} · Panasonic</Eyebrow>
          </Stack>
          <Spacer />
          {editMode ? (
            <IconButton aria-label="Edit device" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
          ) : null}
          <Button
            size="sm"
            variant={on ? "solid" : "outline"}
            colorPalette={on ? "lime" : "gray"}
            onClick={() => send({ power: !on })}
          >
            <Icon as={Power} boxSize="4" />
            {on ? "On" : "Off"}
          </Button>
        </HStack>
      </Card.Header>

      <Card.Body gap="5">
        {/* Temperature */}
        <HStack justify="center" gap="5" opacity={on ? 1 : 0.4} pointerEvents={on ? "auto" : "none"}>
          <IconButton
            aria-label="Cooler"
            variant="outline"
            size="lg"
            rounded="full"
            onClick={() => send({ tempC: state.tempC - 1 })}
            disabled={state.tempC <= config.tempMin}
          >
            <Minus />
          </IconButton>
          <HStack align="baseline" gap="1" minW="28" justify="center">
            <Readout fontSize="clamp(3rem, 12vw, 4.5rem)" color={on ? "lime.fg" : "fg.subtle"}>
              {state.tempC}
            </Readout>
            <Text fontSize="lg" color="fg.subtle">
              °C
            </Text>
          </HStack>
          <IconButton
            aria-label="Warmer"
            variant="outline"
            size="lg"
            rounded="full"
            onClick={() => send({ tempC: state.tempC + 1 })}
            disabled={state.tempC >= config.tempMax}
          >
            <Plus />
          </IconButton>
        </HStack>

        <ToggleRow
          label="Mode"
          options={config.modes}
          labels={MODE_LABEL}
          value={state.mode}
          disabled={!on}
          onSelect={(v) => send({ mode: v as IrClimateState["mode"] })}
        />
        <ToggleRow
          label="Fan"
          options={config.fans}
          labels={FAN_LABEL}
          value={state.fan}
          disabled={!on}
          onSelect={(v) => send({ fan: v as IrClimateState["fan"] })}
        />
        <ToggleRow
          label="Swing (up/down)"
          options={config.swings}
          labels={SWING_LABEL}
          value={state.swing}
          disabled={!on}
          onSelect={(v) => send({ swing: v as IrClimateState["swing"] })}
        />
        <ToggleRow
          label="Swing (left/right)"
          options={config.swingsH}
          labels={SWING_H_LABEL}
          value={state.swingH}
          disabled={!on}
          onSelect={(v) => send({ swingH: v as IrClimateState["swingH"] })}
        />
        <ToggleRow
          label="Preset"
          options={config.presets}
          labels={PRESET_LABEL}
          value={state.preset}
          disabled={!on}
          onSelect={(v) => send({ preset: v as IrClimateState["preset"] })}
        />

        {/* Extra one-shot IR buttons (e.g. a learned "Light" toggle). Always
            enabled — the display light works regardless of AC power state. */}
        {device.buttons.length > 0 || editMode ? (
          <Stack gap="1.5">
            <Eyebrow>Buttons</Eyebrow>
            <Wrap gap="1.5">
              {device.buttons.map((b) => {
                const BtnIcon = iconFor(b.icon);
                const isFiring = firing === b.id;
                return (
                  <Button
                    key={b.id}
                    size="sm"
                    minW="12"
                    minH="11"
                    variant="outline"
                    colorPalette={isFiring ? "lime" : "gray"}
                    color={isFiring ? "lime.fg" : "fg.muted"}
                    borderColor={isFiring ? "lime.solid" : "border.subtle"}
                    onClick={() => (editMode ? setBtnDialog({ open: true, button: b }) : fire(b))}
                  >
                    <BtnIcon size={15} />
                    {b.label}
                    {editMode ? <Pencil size={11} /> : null}
                  </Button>
                );
              })}
              {editMode ? (
                <Button
                  size="sm"
                  minW="12"
                  minH="11"
                  variant="outline"
                  borderStyle="dashed"
                  colorPalette="gray"
                  color="fg.subtle"
                  onClick={() => setBtnDialog({ open: true, button: undefined })}
                >
                  <Plus size={15} /> Add
                </Button>
              ) : null}
            </Wrap>
          </Stack>
        ) : null}

        <HStack gap="2" color="fg.subtle">
          <Box boxSize="1.5" rounded="full" bg="fg.subtle" />
          <Metric fontSize="10px">
            Commanded · not sensor-verified
          </Metric>
        </HStack>
      </Card.Body>

      <ButtonDialog
        open={btnDialog.open}
        onOpenChange={(open) => setBtnDialog((d) => ({ ...d, open }))}
        deviceId={device.id}
        button={btnDialog.button}
        onSaved={onButtonSaved}
        onDeleted={onButtonDeleted}
      />
    </Card.Root>
  );
}
