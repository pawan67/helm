import { Stack } from "@chakra-ui/react";
import { SectionHeader } from "@/components/shared/bits";
import { DevicePanel } from "@/components/device-panel";
import { listFirmware } from "@/db/firmware";
import { getSettings } from "@/db/persist";

export const dynamic = "force-dynamic";

export default async function DevicePage() {
  const [settings, firmware] = await Promise.all([getSettings(), listFirmware()]);
  const initialFirmware = firmware.map((f) => ({
    ...f,
    uploadedAt: f.uploadedAt.toISOString(),
  }));

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Health · firmware · OTA" title="Device" />
      <DevicePanel deviceId={settings.deviceId} initialFirmware={initialFirmware} />
    </Stack>
  );
}
