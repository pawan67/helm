import { Stack } from "@chakra-ui/react";
import { getSettings } from "@/db/persist";
import { SectionHeader } from "@/components/shared/bits";
import { LiveScreen } from "@/components/live/live-screen";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const settings = await getSettings();

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Real-time telemetry" title="Live" />
      <LiveScreen thresholds={settings.thresholds} />
    </Stack>
  );
}
