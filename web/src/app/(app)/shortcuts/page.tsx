import { Stack } from "@chakra-ui/react";
import { listActionLinks } from "@/db/actions";
import { ensureIrSeed, getIrDevices } from "@/db/ir";
import { ShortcutsView } from "@/components/shortcuts/shortcuts-view";
import { SectionHeader } from "@/components/shared/bits";

export const dynamic = "force-dynamic";

export default async function ShortcutsPage() {
  await ensureIrSeed();
  const [actions, devices] = await Promise.all([
    listActionLinks(),
    getIrDevices(),
  ]);

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Home · voice" title="Shortcuts" />
      <ShortcutsView initialActions={actions} devices={devices} />
    </Stack>
  );
}
