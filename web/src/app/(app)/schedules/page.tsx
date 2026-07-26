import { Stack } from "@chakra-ui/react";
import { listSchedules } from "@/db/schedules";
import { ensureIrSeed, getIrDevices } from "@/db/ir";
import { SchedulesView } from "@/components/schedules/schedules-view";
import { SectionHeader } from "@/components/shared/bits";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  await ensureIrSeed();
  const [schedules, devices] = await Promise.all([
    listSchedules(),
    getIrDevices(),
  ]);

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Home · automation" title="Schedules" />
      <SchedulesView initialSchedules={schedules} devices={devices} />
    </Stack>
  );
}
