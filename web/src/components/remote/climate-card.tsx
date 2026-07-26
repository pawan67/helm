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
  DEFAULT_PANASONIC_CONFIG,
  type ClimatePatch,
  type IrClimateState,
} from "@/lib/ir-climate";
import { iconFor } from "./icons";
import type { DeviceWithButtons } from "./types";

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
              colorPalette={active ? "teal" : "gray"}
              color={active ? "teal.contrast" : "fg.muted"}
              borderColor={active ? "teal.solid" : "border.subtle"}
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
}: {
  device: DeviceWithButtons;
  editMode: boolean;
  onEdit: () => void;
}) {
  const config = device.config ?? DEFAULT_PANASONIC_CONFIG;
  const { irClimate } = useLive();
  const [state, setState] = useState<IrClimateState>(() => normalizeClimate(device.state, config));

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

  const on = state.power;
  const DeviceIcon = iconFor(device.icon);

  return (
    <Card.Root
      colorPalette={on ? "teal" : "gray"}
      bg="bg.panel"
      borderColor={on ? "teal.muted" : "border.subtle"}
      position="relative"
      overflow="hidden"
      transition="border-color 0.2s"
    >
      <Card.Header>
        <HStack>
          <Circle
            size="10"
            bg={on ? "teal.subtle" : "bg.subtle"}
            color={on ? "teal.fg" : "fg.subtle"}
            borderWidth="1px"
            borderColor={on ? "teal.muted" : "border.subtle"}
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
            colorPalette={on ? "teal" : "gray"}
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
            <Readout fontSize="clamp(3rem, 12vw, 4.5rem)" color={on ? "teal.fg" : "fg.subtle"}>
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
          label="Swing"
          options={config.swings}
          labels={SWING_LABEL}
          value={state.swing}
          disabled={!on}
          onSelect={(v) => send({ swing: v as IrClimateState["swing"] })}
        />

        <HStack gap="2" color="fg.subtle">
          <Box boxSize="1.5" rounded="full" bg="fg.subtle" />
          <Metric fontSize="10px">
            Commanded · not sensor-verified
          </Metric>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
