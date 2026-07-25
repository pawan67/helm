"use client";

import { useEffect, useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Field,
  Grid,
  Input,
  Portal,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type { Session } from "@/db/schema";

type SessionType = "pullup_set" | "dead_hang";

/** Format a Date as the value a <input type="datetime-local"> expects (local). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

const secs = (ms: number) => Math.round(ms / 1000);

export function SessionForm({
  open,
  onOpenChange,
  session,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The session being edited (null only while the dialog is closed). */
  session: Session | null;
  onSaved: () => void;
}) {
  const [type, setType] = useState<SessionType>("pullup_set");
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [reps, setReps] = useState(10);
  const [durationSec, setDurationSec] = useState(60);
  const [onBarSec, setOnBarSec] = useState(0);
  const [holdSec, setHoldSec] = useState(30);
  const [saving, setSaving] = useState(false);

  // Load the session's values whenever the dialog opens on a new target.
  useEffect(() => {
    if (!open || !session) return;
    setType(session.type);
    setWhen(toLocalInput(new Date(session.startedAt)));
    setReps(session.reps || 1);
    setDurationSec(secs(session.durationMs));
    setOnBarSec(secs(session.hangMs));
    setHoldSec(secs(session.maxHangMs || session.durationMs));
  }, [open, session]);

  async function save() {
    if (!session) return;
    const started = new Date(when);
    if (Number.isNaN(started.getTime())) {
      toaster.create({ title: "Pick a valid date & time", type: "error" });
      return;
    }

    const payload =
      type === "pullup_set"
        ? {
            startedAt: started.toISOString(),
            reps: Math.max(1, reps),
            durationMs: durationSec * 1000,
            hangMs: onBarSec * 1000,
            maxHangMs: 0,
          }
        : {
            startedAt: started.toISOString(),
            reps: 0,
            durationMs: holdSec * 1000,
            hangMs: holdSec * 1000,
            maxHangMs: holdSec * 1000,
          };

    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        toaster.create({ title: error || "Couldn't save the session", type: "error" });
        return;
      }
      toaster.create({ title: "Session updated", type: "success" });
      onOpenChange(false);
      onSaved();
    } catch {
      toaster.create({ title: "Couldn't reach the server", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel">
            <Dialog.Header>
              <Dialog.Title textTransform="uppercase" letterSpacing="0.02em">
                Edit session
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap="5">
                <SegmentGroup.Root
                  value={type}
                  onValueChange={(e) => e.value && setType(e.value as SessionType)}
                  size="sm"
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items
                    items={[
                      { value: "pullup_set", label: "Pull-up set" },
                      { value: "dead_hang", label: "Dead hang" },
                    ]}
                  />
                </SegmentGroup.Root>

                <Field.Root>
                  <Field.Label>Date & time</Field.Label>
                  <Input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    fontFamily="mono"
                  />
                </Field.Root>

                {type === "pullup_set" ? (
                  <Grid templateColumns="repeat(3, 1fr)" gap="4">
                    <NumField label="Reps" value={reps} min={1} onChange={setReps} />
                    <NumField
                      label="Duration"
                      unit="s"
                      value={durationSec}
                      min={0}
                      onChange={setDurationSec}
                    />
                    <NumField
                      label="On bar"
                      unit="s"
                      value={onBarSec}
                      min={0}
                      onChange={setOnBarSec}
                    />
                  </Grid>
                ) : (
                  <NumField
                    label="Hold time"
                    unit="s"
                    value={holdSec}
                    min={1}
                    onChange={setHoldSec}
                  />
                )}

                <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                  {type === "pullup_set"
                    ? "Counts toward daily reps, streaks and the most-reps records."
                    : "Counts toward hang time and the longest-hang record."}
                </Text>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="teal"
                onClick={save}
                loading={saving}
                loadingText="Saving…"
              >
                Save changes
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

function NumField({
  label,
  unit,
  value,
  min,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field.Root>
      <Field.Label>
        {label}
        {unit ? (
          <Text as="span" ml="1" color="fg.subtle" fontFamily="mono" fontSize="xs">
            ({unit})
          </Text>
        ) : null}
      </Field.Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        fontFamily="mono"
        fontVariantNumeric="tabular-nums"
      />
    </Field.Root>
  );
}
