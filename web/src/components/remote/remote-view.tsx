"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Icon, SimpleGrid, Stack } from "@chakra-ui/react";
import { Plus, SlidersHorizontal, Tv } from "lucide-react";
import { SectionHeader } from "@/components/shared/bits";
import { ClimateCard } from "./climate-card";
import { DeviceCard } from "./device-card";
import { DeviceDialog } from "./edit-dialogs";
import type { DeviceWithButtons, IrButton, IrDevice } from "./types";

export function RemoteView({ initial }: { initial: DeviceWithButtons[] }) {
  const [devices, setDevices] = useState<DeviceWithButtons[]>(initial);
  const [editMode, setEditMode] = useState(false);
  const [deviceDialog, setDeviceDialog] = useState<{ open: boolean; device?: IrDevice }>({
    open: false,
  });

  function onDeviceSaved(saved: IrDevice) {
    setDevices((list) => {
      const existing = list.find((d) => d.id === saved.id);
      if (existing) {
        return list.map((d) => (d.id === saved.id ? { ...d, ...saved } : d));
      }
      return [...list, { ...saved, buttons: [] }];
    });
  }

  function onDeviceDeleted(id: string) {
    setDevices((list) => list.filter((d) => d.id !== id));
  }

  function onButtonSaved(deviceId: string, saved: IrButton) {
    setDevices((list) =>
      list.map((d) => {
        if (d.id !== deviceId) return d;
        const has = d.buttons.some((b) => b.id === saved.id);
        return {
          ...d,
          buttons: has
            ? d.buttons.map((b) => (b.id === saved.id ? saved : b))
            : [...d.buttons, saved],
        };
      }),
    );
  }

  function onButtonDeleted(deviceId: string, id: string) {
    setDevices((list) =>
      list.map((d) =>
        d.id === deviceId ? { ...d, buttons: d.buttons.filter((b) => b.id !== id) } : d,
      ),
    );
  }

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Home · infrared" title="Remote">
        <Stack direction="row" gap="2">
          <Button
            variant={editMode ? "solid" : "outline"}
            colorPalette={editMode ? "lime" : "gray"}
            size="sm"
            onClick={() => setEditMode((e) => !e)}
          >
            <Icon as={SlidersHorizontal} boxSize="4" />
            {editMode ? "Done" : "Edit"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeviceDialog({ open: true, device: undefined })}
          >
            <Icon as={Plus} boxSize="4" />
            Device
          </Button>
        </Stack>
      </SectionHeader>

      {devices.length === 0 ? (
        <Card.Root bg="bg.panel/50" borderStyle="dashed">
          <Card.Body>
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Tv />
                </EmptyState.Indicator>
                <EmptyState.Title>No devices yet</EmptyState.Title>
                <EmptyState.Description>
                  Add an AC or a button-based device and fire it over the bar node&apos;s IR blaster.
                </EmptyState.Description>
                <Button
                  mt="2"
                  colorPalette="lime"
                  onClick={() => setDeviceDialog({ open: true, device: undefined })}
                >
                  <Icon as={Plus} boxSize="4" /> Add device
                </Button>
              </EmptyState.Content>
            </EmptyState.Root>
          </Card.Body>
        </Card.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" alignItems="start">
          {devices.map((device) =>
            device.kind === "climate" ? (
              <ClimateCard
                key={device.id}
                device={device}
                editMode={editMode}
                onEdit={() => setDeviceDialog({ open: true, device })}
              />
            ) : (
              <DeviceCard
                key={device.id}
                device={device}
                editMode={editMode}
                onEdit={() => setDeviceDialog({ open: true, device })}
                onButtonSaved={(b) => onButtonSaved(device.id, b)}
                onButtonDeleted={(id) => onButtonDeleted(device.id, id)}
              />
            ),
          )}
        </SimpleGrid>
      )}

      <DeviceDialog
        open={deviceDialog.open}
        onOpenChange={(open) => setDeviceDialog((d) => ({ ...d, open }))}
        device={deviceDialog.device}
        onSaved={onDeviceSaved}
        onDeleted={onDeviceDeleted}
      />
    </Stack>
  );
}
