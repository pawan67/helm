import { Stack } from "@chakra-ui/react";
import { getSettings } from "@/db/persist";
import { SectionHeader } from "@/components/shared/bits";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Goals · detection · device" title="Settings" />
      <SettingsForm initial={settings} />
    </Stack>
  );
}
