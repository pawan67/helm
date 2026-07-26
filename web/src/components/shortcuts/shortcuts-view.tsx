"use client";

import { useEffect, useMemo, useState } from "react";
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
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Copy, ExternalLink, Plus, Trash2, Zap } from "lucide-react";
import type { ActionLink } from "@/db/schema";
import type { DeviceWithButtons } from "@/components/remote/types";
import { ShortcutForm } from "@/components/shortcuts/shortcut-form";
import { toaster } from "@/components/ui/toaster";
import { Eyebrow } from "@/components/shared/bits";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function actionSummary(a: ActionLink["action"], device?: DeviceWithButtons): string {
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

export function ShortcutsView({
  initialActions,
  devices,
}: {
  initialActions: ActionLink[];
  devices: DeviceWithButtons[];
}) {
  const [actions, setActions] = useState<ActionLink[]>(initialActions);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<ActionLink | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const deviceMap = useMemo(
    () => new Map(devices.map((d) => [d.id, d])),
    [devices],
  );
  const hasDevices = devices.length > 0;

  async function refresh() {
    const res = await fetch("/api/actions");
    if (res.ok) setActions((await res.json()).actions ?? []);
  }

  function urlFor(a: ActionLink) {
    return `${origin || ""}/a/${a.key}`;
  }

  async function copy(a: ActionLink) {
    try {
      await navigator.clipboard.writeText(urlFor(a));
      toaster.create({ title: "Link copied", type: "success" });
    } catch {
      toaster.create({ title: "Couldn't copy — long-press to select", type: "error" });
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/actions/${confirm.id}`, { method: "DELETE" });
      if (res.ok) {
        toaster.create({ title: "Shortcut deleted", type: "success" });
        setConfirm(null);
        await refresh();
      } else {
        toaster.create({ title: "Couldn't delete the shortcut", type: "error" });
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Stack gap="5">
      <HStack justify="space-between" flexWrap="wrap" gap="3">
        <Eyebrow>
          {actions.length} shortcut{actions.length === 1 ? "" : "s"}
        </Eyebrow>
        <Button size="sm" onClick={() => setFormOpen(true)} disabled={!hasDevices}>
          <Icon as={Plus} boxSize="4" />
          Add shortcut
        </Button>
      </HStack>

      {/* How to use */}
      <Card.Root bg="bg.subtle" borderColor="border.subtle">
        <Card.Body py="4">
          <HStack align="start" gap="3">
            <Icon as={Zap} boxSize="4" color="lime.fg" mt="0.5" />
            <Stack gap="1.5">
              <Text fontSize="sm" fontWeight="medium">
                Voice & one-tap control
              </Text>
              <Text fontSize="xs" color="fg.muted" lineHeight="1.6">
                Each shortcut is a private link that fires the action with no login.
                On your phone: make a <b>Bixby Quick Command</b> (say “AC on” → action{" "}
                <i>Open&nbsp;[link]</i>), write it to an <b>NFC tag</b>, or add it as a{" "}
                <b>home-screen shortcut</b>. Works wherever your phone can reach Helm —
                copy the link while viewing Helm at the address you’ll use on the phone.
              </Text>
            </Stack>
          </HStack>
        </Card.Body>
      </Card.Root>

      <Card.Root bg="bg.panel">
        <Card.Body>
          {actions.length === 0 ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon as={Zap} />
                </EmptyState.Indicator>
                <EmptyState.Title>No shortcuts yet</EmptyState.Title>
                <EmptyState.Description>
                  {hasDevices
                    ? "Create a shortcut like “AC on” or “Fan speed 3” to trigger by voice or tap."
                    : "Add an AC or fan on the Remote screen first, then create shortcuts here."}
                </EmptyState.Description>
                {hasDevices ? (
                  <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} mt="2">
                    <Icon as={Plus} boxSize="4" />
                    Add shortcut
                  </Button>
                ) : null}
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <Stack gap="0">
              {actions.map((a) => {
                const device = deviceMap.get(a.deviceId);
                return (
                  <Stack
                    key={a.id}
                    gap="2.5"
                    py="3.5"
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                    _last={{ borderBottomWidth: "0" }}
                  >
                    <Flex align="center" gap="3">
                      <Stack gap="0.5" flex="1" minW="0">
                        <Text fontWeight="medium" truncate>
                          {a.label}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" truncate>
                          {device?.name ?? "Unknown device"} · {actionSummary(a.action, device)}
                        </Text>
                      </Stack>
                      <IconButton
                        aria-label="Test shortcut"
                        asChild
                        variant="ghost"
                        size="sm"
                        color="fg.muted"
                      >
                        <a href={urlFor(a)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink />
                        </a>
                      </IconButton>
                      <IconButton
                        aria-label="Delete shortcut"
                        variant="ghost"
                        size="sm"
                        color="fg.muted"
                        _hover={{ color: "red.fg", bg: "bg.muted" }}
                        onClick={() => setConfirm(a)}
                      >
                        <Trash2 />
                      </IconButton>
                    </Flex>
                    <HStack gap="2">
                      <Input
                        readOnly
                        size="xs"
                        fontFamily="mono"
                        fontSize="11px"
                        color="fg.subtle"
                        value={urlFor(a)}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button size="xs" variant="subtle" onClick={() => copy(a)}>
                        <Icon as={Copy} boxSize="3.5" />
                        Copy
                      </Button>
                    </HStack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      <ShortcutForm
        open={formOpen}
        onOpenChange={setFormOpen}
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
                <Dialog.Title>Delete this shortcut?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted" fontSize="sm">
                  The link will stop working immediately. Any Bixby command or NFC tag
                  pointing at it will break.
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
