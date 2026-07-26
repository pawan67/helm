import { Stack } from "@chakra-ui/react";
import { getDailyStats } from "@/db/queries";
import { HistoryView } from "@/components/charts/history-view";
import { SectionHeader } from "@/components/shared/bits";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const days = await getDailyStats(30);

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Trends · sessions" title="History" />
      <HistoryView initialDays={days} />
    </Stack>
  );
}
