"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Circle,
  Dialog,
  Field,
  Grid,
  HStack,
  Icon,
  Input,
  Portal,
  Progress,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  Activity,
  CircleCheck,
  CircleX,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Radio,
  RotateCw,
  Timer,
  Trash2,
  Upload,
  Wifi,
} from "lucide-react";
import { useLive } from "@/components/live-provider";
import { toaster } from "@/components/ui/toaster";
import { Eyebrow, Metric } from "@/components/shared/bits";

type FirmwareMeta = {
  id: string;
  version: string;
  filename: string;
  size: number;
  md5: string;
  notes: string;
  uploadedAt: string;
};

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatUptime(sec: number | null): string {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function timeAgo(fromMs: number | null, now: number): string {
  if (fromMs == null) return "—";
  const s = Math.max(0, Math.round((now - fromMs) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** RSSI → a plain-English quality word (never signal by number alone). */
function rssiQuality(rssi: number | null): string {
  if (rssi == null) return "—";
  if (rssi >= -55) return "excellent";
  if (rssi >= -67) return "good";
  if (rssi >= -75) return "fair";
  return "weak";
}

export function DevicePanel({
  deviceId,
  initialFirmware,
}: {
  deviceId: string;
  initialFirmware: FirmwareMeta[];
}) {
  const { state, connected, ota, clearOta } = useLive();
  const [list, setList] = useState(initialFirmware);
  const [now, setNow] = useState(() => 0);

  // Tick once a second so "last seen" ages without a full re-fetch.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const online = connected && state.deviceOnline;
  const statusLabel = online ? "Online" : connected ? "Offline" : "No stream";

  return (
    <Stack gap="6">
      <HealthCard
        online={online}
        statusLabel={statusLabel}
        deviceId={deviceId}
        fwVersion={state.fwVersion}
        rssi={state.rssi}
        uptimeSec={state.uptimeSec}
        heapFree={state.heapFree}
        ipAddress={state.ipAddress}
        lastStatusAt={state.lastStatusAt}
        now={now}
      />

      <FirmwareCard
        list={list}
        setList={setList}
        runningVersion={state.fwVersion}
        ota={ota}
        clearOta={clearOta}
        deviceOnline={online}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
//  Device health
// ---------------------------------------------------------------------------
function HealthCard({
  online,
  statusLabel,
  deviceId,
  fwVersion,
  rssi,
  uptimeSec,
  heapFree,
  ipAddress,
  lastStatusAt,
  now,
}: {
  online: boolean;
  statusLabel: string;
  deviceId: string;
  fwVersion: string | null;
  rssi: number | null;
  uptimeSec: number | null;
  heapFree: number | null;
  ipAddress: string | null;
  lastStatusAt: number | null;
  now: number;
}) {
  return (
    <Card.Root bg="bg.panel">
      <Card.Header>
        <HStack justify="space-between" align="start">
          <Stack gap="1">
            <HStack gap="2" color="fg.muted">
              <Icon as={Activity} boxSize="3.5" />
              <Eyebrow>Device health</Eyebrow>
            </HStack>
            <Card.Description>
              Live telemetry from <b>{deviceId}</b> — refreshed every heartbeat.
            </Card.Description>
          </Stack>
          <Badge
            size="sm"
            rounded="full"
            colorPalette={online ? "online" : "gray"}
            variant={online ? "surface" : "subtle"}
          >
            <Box
              boxSize="1.5"
              rounded="full"
              bg={online ? "online.solid" : "fg.subtle"}
            />
            {statusLabel}
          </Badge>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Grid
          templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
          gap="3"
        >
          <HealthCell icon={Cpu} label="Firmware" value={fwVersion ?? "—"} />
          <HealthCell
            icon={Wifi}
            label="Signal"
            value={rssi != null ? `${rssi} dBm` : "—"}
            sub={rssiQuality(rssi)}
          />
          <HealthCell icon={Timer} label="Uptime" value={formatUptime(uptimeSec)} />
          <HealthCell
            icon={MemoryStick}
            label="Free memory"
            value={formatBytes(heapFree)}
          />
          <HealthCell icon={Network} label="IP address" value={ipAddress ?? "—"} />
          <HealthCell
            icon={Radio}
            label="Last heartbeat"
            value={online ? timeAgo(lastStatusAt, now) : "—"}
          />
        </Grid>
      </Card.Body>
    </Card.Root>
  );
}

function HealthCell({
  icon,
  label,
  value,
  sub,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Stack
      gap="1.5"
      rounded="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      bg="bg.subtle"
      px="3.5"
      py="3"
    >
      <HStack gap="2" color="fg.subtle">
        <Icon as={icon} boxSize="3.5" />
        <Eyebrow fontSize="9px">{label}</Eyebrow>
      </HStack>
      <Metric fontSize="md" color="fg" truncate>
        {value}
      </Metric>
      {sub ? (
        <Text fontSize="10px" color="fg.subtle" textTransform="uppercase" letterSpacing="0.04em">
          {sub}
        </Text>
      ) : null}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
//  Firmware / OTA
// ---------------------------------------------------------------------------
function FirmwareCard({
  list,
  setList,
  runningVersion,
  ota,
  clearOta,
  deviceOnline,
}: {
  list: FirmwareMeta[];
  setList: React.Dispatch<React.SetStateAction<FirmwareMeta[]>>;
  runningVersion: string | null;
  ota: ReturnType<typeof useLive>["ota"];
  clearOta: () => void;
  deviceOnline: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<FirmwareMeta | null>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (version.trim()) body.append("version", version.trim());
      const res = await fetch("/api/system/firmware", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.firmware) {
        setList((l) => [json.firmware, ...l]);
        setFile(null);
        setVersion("");
        if (fileRef.current) fileRef.current.value = "";
        toaster.create({ title: "Firmware uploaded", type: "success" });
      } else {
        toaster.create({
          title: json.error ?? "Upload failed",
          type: "error",
        });
      }
    } catch {
      toaster.create({ title: "Couldn't reach the server", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function doPush(fw: FirmwareMeta) {
    setConfirm(null);
    setPushingId(fw.id);
    clearOta();
    try {
      const res = await fetch(`/api/system/firmware/${fw.id}/push`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toaster.create({
          title: `Pushing ${fw.version} to the bar node…`,
          type: "success",
        });
      } else {
        toaster.create({ title: json.error ?? "Push failed", type: "error" });
      }
    } catch {
      toaster.create({ title: "Couldn't reach the server", type: "error" });
    } finally {
      setPushingId(null);
    }
  }

  async function del(fw: FirmwareMeta) {
    setList((l) => l.filter((f) => f.id !== fw.id));
    try {
      const res = await fetch(`/api/system/firmware/${fw.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      // Restore on failure.
      setList((l) => [fw, ...l].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
      toaster.create({ title: "Couldn't delete", type: "error" });
    }
  }

  return (
    <Card.Root bg="bg.panel">
      <Card.Header>
        <HStack gap="2" color="fg.muted">
          <Icon as={HardDrive} boxSize="3.5" />
          <Eyebrow>Firmware · over-the-air</Eyebrow>
        </HStack>
        <Card.Description>
          Upload a compiled <Text as="span" fontFamily="mono">.bin</Text> and push it
          to the bar node over the air. The device verifies it, flashes it, and
          reboots — no USB cable.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Stack gap="5">
          {ota ? <OtaBanner ota={ota} onDismiss={clearOta} /> : null}

          {/* Upload */}
          <Stack
            gap="3"
            rounded="lg"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.subtle"
            bg="bg.subtle"
            p="4"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".bin,application/octet-stream"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Grid templateColumns={{ base: "1fr", md: "auto 1fr auto" }} gap="3" alignItems="end">
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                justifyContent="flex-start"
              >
                <Icon as={Upload} boxSize="4" />
                {file ? "Change file" : "Choose .bin"}
              </Button>
              <Field.Root>
                <Field.Label>
                  <Eyebrow fontSize="9px">Version label (optional)</Eyebrow>
                </Field.Label>
                <Input
                  value={version}
                  placeholder={file ? file.name.replace(/\.bin$/i, "") : "e.g. 1.4.0"}
                  onChange={(e) => setVersion(e.target.value)}
                  size="sm"
                />
              </Field.Root>
              <Button
                colorPalette="lime"
                onClick={upload}
                loading={uploading}
                loadingText="Uploading…"
                disabled={!file}
              >
                Upload
              </Button>
            </Grid>
            {file ? (
              <Text fontSize="xs" color="fg.subtle">
                Selected: <b>{file.name}</b> · {formatBytes(file.size)}
              </Text>
            ) : (
              <Text fontSize="xs" color="fg.subtle">
                Build in the Arduino IDE with <b>Sketch → Export Compiled Binary</b>,
                then upload the <Text as="span" fontFamily="mono">.ino.bin</Text> here.
              </Text>
            )}
          </Stack>

          {/* Image list */}
          {list.length === 0 ? (
            <Text fontSize="sm" color="fg.subtle" py="2">
              No firmware uploaded yet.
            </Text>
          ) : (
            <Stack gap="2.5">
              {list.map((fw) => (
                <FirmwareRow
                  key={fw.id}
                  fw={fw}
                  running={runningVersion != null && fw.version === runningVersion}
                  pushing={pushingId === fw.id}
                  canPush={deviceOnline && pushingId == null}
                  onPush={() => setConfirm(fw)}
                  onDelete={() => del(fw)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card.Body>

      <PushConfirmDialog
        fw={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={doPush}
      />
    </Card.Root>
  );
}

function FirmwareRow({
  fw,
  running,
  pushing,
  canPush,
  onPush,
  onDelete,
}: {
  fw: FirmwareMeta;
  running: boolean;
  pushing: boolean;
  canPush: boolean;
  onPush: () => void;
  onDelete: () => void;
}) {
  return (
    <Grid
      templateColumns={{ base: "1fr auto", md: "1fr auto auto" }}
      alignItems="center"
      gap="3"
      rounded="lg"
      borderWidth="1px"
      borderColor={running ? "lime.muted" : "border.subtle"}
      bg="bg.subtle"
      px="3.5"
      py="2.5"
    >
      <Stack gap="1" minW="0">
        <HStack gap="2">
          <Metric fontSize="sm" color="fg" truncate>
            {fw.version}
          </Metric>
          {running ? (
            <Badge size="xs" colorPalette="lime" variant="surface" rounded="full">
              <Box boxSize="1" rounded="full" bg="lime.solid" />
              on device
            </Badge>
          ) : null}
        </HStack>
        <Text fontSize="11px" color="fg.subtle" fontFamily="mono" truncate>
          {formatBytes(fw.size)} · {fw.md5.slice(0, 12)} ·{" "}
          {new Date(fw.uploadedAt).toLocaleString()}
        </Text>
      </Stack>
      <Button
        size="sm"
        variant="outline"
        colorPalette="lime"
        onClick={onPush}
        loading={pushing}
        loadingText="Pushing…"
        disabled={!canPush}
      >
        <Icon as={RotateCw} boxSize="3.5" />
        Push
      </Button>
      <Button
        size="sm"
        variant="ghost"
        colorPalette="red"
        aria-label={`Delete ${fw.version}`}
        onClick={onDelete}
        disabled={pushing}
      >
        <Icon as={Trash2} boxSize="3.5" />
      </Button>
    </Grid>
  );
}

/** Live OTA progress, driven by device-reported status over SSE. */
function OtaBanner({
  ota,
  onDismiss,
}: {
  ota: NonNullable<ReturnType<typeof useLive>["ota"]>;
  onDismiss: () => void;
}) {
  const isError = ota.phase === "error";
  const isDone = ota.phase === "success";
  const inFlight = ota.phase === "start" || ota.phase === "progress";
  const palette = isError ? "red" : isDone ? "online" : "lime";
  const label = isError
    ? `Update failed${ota.error ? `: ${ota.error}` : ""}`
    : isDone
      ? `Flashed ${ota.version ?? ""} — device rebooting`
      : `Flashing${ota.version ? ` ${ota.version}` : ""}…`;

  return (
    <Box
      colorPalette={palette}
      rounded="lg"
      borderWidth="1px"
      borderColor="colorPalette.muted"
      bg="colorPalette.subtle"
      px="4"
      py="3"
    >
      <HStack justify="space-between" mb={inFlight ? "2.5" : "0"}>
        <HStack gap="2">
          <Icon
            as={isError ? CircleX : isDone ? CircleCheck : RotateCw}
            boxSize="4"
            color="colorPalette.fg"
          />
          <Text fontSize="sm" fontWeight="medium" color="colorPalette.fg">
            {label}
          </Text>
        </HStack>
        {!inFlight ? (
          <Button size="xs" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : ota.percent != null ? (
          <Metric fontSize="sm" color="colorPalette.fg">
            {ota.percent}%
          </Metric>
        ) : null}
      </HStack>
      {inFlight ? (
        <Progress.Root
          value={ota.percent ?? null}
          size="sm"
          colorPalette={palette}
          striped
          animated
        >
          <Progress.Track rounded="full">
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      ) : null}
    </Box>
  );
}

function PushConfirmDialog({
  fw,
  onCancel,
  onConfirm,
}: {
  fw: FirmwareMeta | null;
  onCancel: () => void;
  onConfirm: (fw: FirmwareMeta) => void;
}) {
  return (
    <Dialog.Root
      open={fw != null}
      onOpenChange={(e) => {
        if (!e.open) onCancel();
      }}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel">
            <Dialog.Header>
              <Dialog.Title>Push firmware to the bar node?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted">
                The device will download{" "}
                <Text as="span" fontFamily="mono" color="fg">
                  {fw?.version}
                </Text>{" "}
                ({formatBytes(fw?.size ?? 0)}), verify it, flash it, and reboot.
                Detection is offline for a few seconds during the flash.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                colorPalette="lime"
                onClick={() => fw && onConfirm(fw)}
              >
                <Icon as={RotateCw} boxSize="4" />
                Push &amp; reboot
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
