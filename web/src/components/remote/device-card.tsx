"use client";

import { useState } from "react";
import {
  Box,
  Card,
  Circle,
  HStack,
  IconButton,
  SimpleGrid,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Pencil, Plus } from "lucide-react";
import { Eyebrow } from "@/components/shared/bits";
import { toaster } from "@/components/ui/toaster";
import { iconFor } from "./icons";
import { ButtonDialog } from "./edit-dialogs";
import type { DeviceWithButtons, IrButton } from "./types";

export function DeviceCard({
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
  const [firing, setFiring] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; button?: IrButton }>({ open: false });
  const DeviceIcon = iconFor(device.icon);

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

  return (
    <Card.Root bg="bg.panel" borderColor="border.subtle" position="relative" overflow="hidden">
      <Card.Header>
        <HStack>
          <Circle size="10" bg="bg.subtle" color="fg.muted" borderWidth="1px" borderColor="border.subtle">
            <DeviceIcon size={18} />
          </Circle>
          <Stack gap="0.5">
            <Text fontFamily="heading" fontWeight="700" textTransform="uppercase" letterSpacing="0.02em">
              {device.name}
            </Text>
            <Eyebrow>{device.buttons.length} buttons · IR</Eyebrow>
          </Stack>
          <Spacer />
          {editMode ? (
            <IconButton aria-label="Edit device" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
          ) : null}
        </HStack>
      </Card.Header>

      <Card.Body>
        {device.buttons.length === 0 && !editMode ? (
          <Text fontFamily="mono" fontSize="xs" color="fg.subtle">
            No buttons yet — turn on edit to add some.
          </Text>
        ) : null}
        <SimpleGrid columns={{ base: 3, sm: 4 }} gap="2.5">
          {device.buttons.map((b) => {
            const BtnIcon = iconFor(b.icon);
            const isFiring = firing === b.id;
            return (
              <Box
                key={b.id}
                as="button"
                onClick={() => (editMode ? setDialog({ open: true, button: b }) : fire(b))}
                position="relative"
                borderWidth="1px"
                borderColor={isFiring ? "hazard.solid" : "border.subtle"}
                bg={isFiring ? "hazard.subtle" : "bg.subtle"}
                color={isFiring ? "hazard.fg" : "fg.muted"}
                rounded="md"
                py="3"
                px="2"
                minH="20"
                transition="all 0.12s"
                _hover={{ borderColor: "border.emphasized", color: "fg", bg: "bg.muted" }}
                className="ih-machined"
              >
                <Stack gap="1.5" align="center" justify="center" h="full">
                  <BtnIcon size={20} />
                  <Text
                    fontFamily="mono"
                    fontSize="10px"
                    letterSpacing="0.06em"
                    textTransform="uppercase"
                    lineClamp={1}
                  >
                    {b.label}
                  </Text>
                </Stack>
                {editMode ? (
                  <Box
                    position="absolute"
                    top="1"
                    right="1"
                    color="fg.subtle"
                    aria-hidden
                  >
                    <Pencil size={11} />
                  </Box>
                ) : null}
              </Box>
            );
          })}

          {editMode ? (
            <Box
              as="button"
              onClick={() => setDialog({ open: true, button: undefined })}
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border"
              color="fg.subtle"
              bg="transparent"
              rounded="md"
              minH="20"
              transition="all 0.12s"
              _hover={{ borderColor: "hazard.solid", color: "hazard.fg" }}
            >
              <Stack gap="1" align="center" justify="center" h="full">
                <Plus size={20} />
                <Text fontFamily="mono" fontSize="10px" letterSpacing="0.06em" textTransform="uppercase">
                  Add
                </Text>
              </Stack>
            </Box>
          ) : null}
        </SimpleGrid>
      </Card.Body>

      <ButtonDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        deviceId={device.id}
        button={dialog.button}
        onSaved={onButtonSaved}
        onDeleted={onButtonDeleted}
      />
    </Card.Root>
  );
}
