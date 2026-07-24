import { getSettings } from "@/db/persist";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader eyebrow="Goals · detection · device" title="Settings" />
      <SettingsForm initial={settings} />
    </>
  );
}
