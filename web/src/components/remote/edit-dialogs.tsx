"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Radio, Trash2, X } from "lucide-react";
import { toaster } from "@/components/ui/toaster";
import { useLive } from "@/components/live-provider";
import { PANASONIC_MODELS } from "@/lib/ir-climate";
import { IR_ICON_KEYS, iconFor } from "./icons";
import type { IrDevice, IrButton } from "./types";

/** Protocols the firmware can transmit via IRremoteESP8266's strToDecodeType(). */
const BUTTON_PROTOCOLS = [
  "NEC",
  "SAMSUNG",
  "SONY",
  "RC5",
  "RC6",
  "LG",
  "JVC",
  "PANASONIC",
  "DENON",
  "SHARP",
];

function IconField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const Preview = iconFor(value);
  return (
    <Field.Root>
      <Field.Label>Icon</Field.Label>
      <HStack w="full" gap="3">
        <HStack
          boxSize="10"
          justify="center"
          flexShrink="0"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="md"
          bg="bg.subtle"
          color="fg.muted"
        >
          <Preview size={18} />
        </HStack>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field value={value} onChange={(e) => onChange(e.currentTarget.value)}>
            {IR_ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
    </Field.Root>
  );
}

/** Shell that wires the controlled Chakra Dialog + a corner close button. */
function DialogShell({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
            <Dialog.Header>
              <Dialog.Title>
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">{children}</Stack>
            </Dialog.Body>
            <Dialog.Footer>{footer}</Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close" variant="ghost" size="sm">
                <X />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
//  Device dialog (add / edit)
// ---------------------------------------------------------------------------

export function DeviceDialog({
  open,
  onOpenChange,
  device,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: IrDevice;
  onSaved: (device: IrDevice) => void;
  onDeleted?: (id: string) => void;
}) {
  const editing = !!device;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"climate" | "generic">("generic");
  const [icon, setIcon] = useState("tv");
  const [model, setModel] = useState("DKE");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(device?.name ?? "");
    setKind((device?.kind as "climate" | "generic") ?? "generic");
    setIcon(device?.icon ?? "tv");
    setModel(device?.config?.model ?? "DKE");
  }, [open, device]);

  async function save() {
    if (!name.trim()) {
      toaster.create({ title: "Name is required", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = editing
        ? await fetch(`/api/remote/devices/${device!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              icon,
              ...(kind === "climate" ? { config: { model } } : {}),
            }),
          })
        : await fetch("/api/remote/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, kind, icon }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved(data.device);
      onOpenChange(false);
      toaster.create({ title: editing ? "Device updated" : "Device added", type: "success" });
    } catch (err) {
      toaster.create({ title: (err as Error).message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!device) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/remote/devices/${device.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted?.(device.id);
      onOpenChange(false);
      toaster.create({ title: "Device removed", type: "success" });
    } catch (err) {
      toaster.create({ title: (err as Error).message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit device" : "Add device"}
      footer={
        <HStack w="full">
          {editing ? (
            <Button variant="outline" colorPalette="red" onClick={remove} loading={busy}>
              <Trash2 size={16} /> Delete
            </Button>
          ) : null}
          <Spacer />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button colorPalette="lime" onClick={save} loading={busy}>
            {editing ? "Save" : "Add"}
          </Button>
        </HStack>
      }
    >
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Living room AC" />
      </Field.Root>

      {!editing ? (
        <Field.Root>
          <Field.Label>Type</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as "climate" | "generic")}
            >
              <option value="generic">Generic (button set)</option>
              <option value="climate">Climate (AC)</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Field.HelperText>Climate gives you an AC control; generic gives a button grid.</Field.HelperText>
        </Field.Root>
      ) : null}

      <IconField value={icon} onChange={setIcon} />

      {kind === "climate" ? (
        <Field.Root>
          <Field.Label>Panasonic model</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field value={model} onChange={(e) => setModel(e.currentTarget.value)}>
              {PANASONIC_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Field.HelperText>
            If the AC ignores commands, try another remote model. Default DKE fits most units.
          </Field.HelperText>
        </Field.Root>
      ) : null}
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
//  Button dialog (add / edit)
// ---------------------------------------------------------------------------

export function ButtonDialog({
  open,
  onOpenChange,
  deviceId,
  button,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  button?: IrButton;
  onSaved: (button: IrButton) => void;
  onDeleted?: (id: string) => void;
}) {
  const editing = !!button;
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("dot");
  const [protocol, setProtocol] = useState("NEC");
  const [code, setCode] = useState("");
  const [bits, setBits] = useState(32);
  const [repeats, setRepeats] = useState(0);
  const [busy, setBusy] = useState(false);

  // IR learn: ask the bar node to capture the next remote frame and auto-fill
  // the code fields. `lastLearned` is pushed over the live bus when the device
  // decodes a press; we only accept captures newer than the moment we started.
  const { lastLearned } = useLive();
  const [listening, setListening] = useState(false);
  const listenStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(button?.label ?? "");
    setIcon(button?.icon ?? "dot");
    setProtocol(button?.protocol ?? "NEC");
    setCode(button?.code ?? "");
    setBits(button?.bits ?? 32);
    setRepeats(button?.repeats ?? 0);
  }, [open, button]);

  /** Tell the device to stop capturing and clear the local listening state. */
  function stopLearn() {
    setListening(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    void fetch("/api/remote/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: false }),
    }).catch(() => {});
  }

  async function learn() {
    if (listening) {
      stopLearn();
      return;
    }
    listenStartRef.current = Date.now();
    setListening(true);
    try {
      const res = await fetch("/api/remote/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't start learn mode");
      }
      // Give up a beat after the device's own ~20s window closes.
      timeoutRef.current = setTimeout(() => {
        setListening(false);
        timeoutRef.current = null;
        toaster.create({ title: "No IR signal captured — try again", type: "error" });
      }, 21000);
    } catch (err) {
      setListening(false);
      toaster.create({ title: (err as Error).message, type: "error" });
    }
  }

  // Fill the fields when a fresh capture arrives while we're listening.
  useEffect(() => {
    if (!listening || !lastLearned) return;
    if (lastLearned.at < listenStartRef.current) return; // stale (pre-start) capture
    setProtocol(lastLearned.protocol);
    setCode(lastLearned.code);
    setBits(lastLearned.bits);
    stopLearn();
    toaster.create({
      title: `Captured ${lastLearned.protocol} · 0x${lastLearned.code} (${lastLearned.bits}-bit)`,
      type: "success",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLearned, listening]);

  // Stop any capture when the dialog closes.
  useEffect(() => {
    if (open) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (listening) stopLearn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Show a captured protocol that isn't one of the built-in options.
  const protocolOptions = BUTTON_PROTOCOLS.includes(protocol)
    ? BUTTON_PROTOCOLS
    : [protocol, ...BUTTON_PROTOCOLS];

  async function save() {
    if (!label.trim() || !code.trim()) {
      toaster.create({ title: "Label and code are required", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const payload = { label, icon, protocol, code, bits, repeats };
      const res = editing
        ? await fetch(`/api/remote/buttons/${button!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/remote/buttons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, ...payload }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved(data.button);
      onOpenChange(false);
      toaster.create({ title: editing ? "Button updated" : "Button added", type: "success" });
    } catch (err) {
      toaster.create({ title: (err as Error).message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!button) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/remote/buttons/${button.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted?.(button.id);
      onOpenChange(false);
      toaster.create({ title: "Button removed", type: "success" });
    } catch (err) {
      toaster.create({ title: (err as Error).message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit button" : "Add button"}
      footer={
        <HStack w="full">
          {editing ? (
            <Button variant="outline" colorPalette="red" onClick={remove} loading={busy}>
              <Trash2 size={16} /> Delete
            </Button>
          ) : null}
          <Spacer />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button colorPalette="lime" onClick={save} loading={busy}>
            {editing ? "Save" : "Add"}
          </Button>
        </HStack>
      }
    >
      <Field.Root>
        <Field.Label>Label</Field.Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Power" />
      </Field.Root>

      <IconField value={icon} onChange={setIcon} />

      <Field.Root>
        <Field.Label>Capture from a remote</Field.Label>
        <Button
          w="full"
          variant={listening ? "solid" : "outline"}
          colorPalette={listening ? "lime" : "gray"}
          onClick={learn}
        >
          <Radio size={16} />
          {listening ? "Listening… press the remote (tap to cancel)" : "Learn from remote"}
        </Button>
        <Field.HelperText>
          Point the remote at the bar node and press a button — protocol, code and bits fill in below.
        </Field.HelperText>
      </Field.Root>

      <HStack gap="3" align="start">
        <Field.Root>
          <Field.Label>Protocol</Field.Label>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field value={protocol} onChange={(e) => setProtocol(e.currentTarget.value)}>
              {protocolOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <Field.Root>
          <Field.Label>Bits</Field.Label>
          <Input
            type="number"
            inputMode="numeric"
            value={bits}
            onChange={(e) => setBits(Number(e.target.value))}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Repeats</Field.Label>
          <Input
            type="number"
            inputMode="numeric"
            value={repeats}
            onChange={(e) => setRepeats(Number(e.target.value))}
          />
        </Field.Root>
      </HStack>

      <Field.Root>
        <Field.Label>Hex code</Field.Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="00CF8976"
        />
        <Field.HelperText>
          <Text as="span">
            0x
          </Text>{" "}
          optional. Grab codes from an IR database or your captured remote.
        </Field.HelperText>
      </Field.Root>
    </DialogShell>
  );
}
