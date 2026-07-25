import { Stack } from "@chakra-ui/react";
import { getDailyStats, getRecentSessions } from "@/db/queries";
import { HistoryView } from "@/components/charts/history-view";
import { SectionHeader } from "@/components/shared/bits";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [days, sessions] = await Promise.all([
    getDailyStats(30),
    getRecentSessions(60),
  ]);

  return (
    <Stack gap="6">
      <SectionHeader eyebrow="Trends · sessions" title="History" />
      <HistoryView initialDays={days} initialSessions={sessions} />
    </Stack>
  );
}
