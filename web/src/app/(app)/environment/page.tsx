import { Stack } from "@chakra-ui/react";
import { getEnvSeries } from "@/db/queries";
import { EnvironmentView } from "@/components/charts/environment-view";
import { SectionHeader } from "@/components/shared/bits";

export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  const initial = await getEnvSeries(7);
  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Ambient · on the bar" title="Climate" />
      <EnvironmentView initial={initial} />
    </Stack>
  );
}
