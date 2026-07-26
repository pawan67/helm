"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CloseButton,
  Dialog,
  EmptyState,
  Flex,
  HStack,
  Icon,
  IconButton,
  Portal,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import type { Schedule } from "@/db/schema";
import type { DeviceWithButtons } from "@/components/remote/types";
import { ScheduleForm } from "@/components/schedules/schedule-form";
import { toaster } from "@/components/ui/toaster";
import { Eyebrow, Metric } from "@/components/shared/bits";
import { daysLabel, minuteToHHMM } from "@/lib/schedule";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One-line description of what a schedule does, resolving button labels. */
function actionSummary(s: Schedule, device?: DeviceWithButtons): string {
  const a = s.action;
  if (a.kind === "climate") {
    if (a.patch.power === false) return "Turn off";
    const parts: string[] = [];
    if (a.patch.mode) parts.push(cap(a.patch.mode));
    if (a.patch.tempC != null) parts.push(`${a.patch.tempC}°`);
    if (a.patch.fan) parts.push(`fan ${a.patch.fan}`);
    return parts.length ? `Turn on · ${parts.join(" · ")}` : "Turn on";
  }
  const btn = device?.buttons.find((b) => b.id === a.buttonId);
  return btn ? `Press ${btn.label}` : "Press button";
}

export function SchedulesView({
  initialSchedules,
  devices,
}: {
  initialSchedules: Schedule[];
  devices: DeviceWithButtons[];
}) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [confirm, setConfirm] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deviceMap = useMemo(
    () => new Map(devices.map((d) => [d.id, d])),
    [devices],
  );
  const hasDevices = devices.length > 0;

  async function refresh() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules((await res.json()).schedules ?? []);
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Schedule) {
    setEditing(s);
    setFormOpen(true);
  }

  async function toggleEnabled(s: Schedule, enabled: boolean) {
    // Optimistic flip; revert on failure.
    setSchedules((list) =>
      list.map((x) => (x.id === s.id ? { ...x, enabled } : x)),
    );
    const res = await fetch(`/api/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      setSchedules((list) =>
        list.map((x) => (x.id === s.id ? { ...x, enabled: !enabled } : x)),
      );
      toaster.create({ title: "Couldn't update the schedule", type: "error" });
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/schedules/${confirm.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toaster.create({ title: "Schedule deleted", type: "success" });
        setConfirm(null);
        await refresh();
      } else {
        toaster.create({ title: "Couldn't delete the schedule", type: "error" });
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Stack gap="5">
      <HStack justify="space-between" flexWrap="wrap" gap="3">
        <Eyebrow>
          {schedules.length} schedule{schedules.length === 1 ? "" : "s"}
        </Eyebrow>
        <Button size="sm" onClick={openAdd} disabled={!hasDevices}>
          <Icon as={Plus} boxSize="4" />
          Add schedule
        </Button>
      </HStack>

      <Card.Root bg="bg.panel">
        <Card.Body>
          {schedules.length === 0 ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon as={CalendarClock} />
                </EmptyState.Indicator>
                <EmptyState.Title>No schedules yet</EmptyState.Title>
                <EmptyState.Description>
                  {hasDevices
                    ? "Add a schedule to turn the AC or fan on and off at set times."
                    : "Add an AC or fan on the Remote screen first, then schedule it here."}
                </EmptyState.Description>
                {hasDevices ? (
                  <Button variant="outline" size="sm" onClick={openAdd} mt="2">
                    <Icon as={Plus} boxSize="4" />
                    Add schedule
                  </Button>
                ) : null}
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <Stack gap="0">
              {schedules.map((s) => {
                const device = deviceMap.get(s.deviceId);
                return (
                  <Flex
                    key={s.id}
                    align="center"
                    gap="4"
                    py="3"
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                    _last={{ borderBottomWidth: "0" }}
                    opacity={s.enabled ? 1 : 0.55}
                    transition="opacity 0.15s"
                  >
                    <Box minW="14" textAlign="center">
                      <Metric fontSize="lg" color={s.enabled ? "lime.fg" : "fg.muted"}>
                        {minuteToHHMM(s.atMinute)}
                      </Metric>
                    </Box>
                    <Stack gap="0.5" flex="1" minW="0">
                      <Text fontWeight="medium" truncate>
                        {s.name || device?.name || "Unknown device"}
                      </Text>
                      <Text fontSize="sm" color="fg.muted" truncate>
                        {actionSummary(s, device)}
                      </Text>
                      <Text fontSize="11px" color="fg.subtle">
                        {daysLabel(s.days)}
                      </Text>
                    </Stack>
                    <Switch.Root
                      checked={s.enabled}
                      onCheckedChange={(e) => toggleEnabled(s, e.checked)}
                      colorPalette="lime"
                      size="sm"
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                    </Switch.Root>
                    <IconButton
                      aria-label="Edit schedule"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      aria-label="Delete schedule"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "red.fg", bg: "bg.muted" }}
                      onClick={() => setConfirm(s)}
                    >
                      <Trash2 />
                    </IconButton>
                  </Flex>
                );
              })}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      <ScheduleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editing}
        devices={devices}
        onSaved={refresh}
      />

      <Dialog.Root
        open={!!confirm}
        onOpenChange={(e) => !e.open && setConfirm(null)}
        placement="center"
        role="alertdialog"
        size="sm"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="bg.panel">
              <Dialog.Header>
                <Dialog.Title>Delete this schedule?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted" fontSize="sm">
                  It will stop running immediately. This can’t be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  onClick={doDelete}
                  loading={deleting}
                  loadingText="Deleting…"
                >
                  Delete
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
}
