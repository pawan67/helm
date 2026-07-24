import { getDailyStats, getRecentSessions } from "@/db/queries";
import { HistoryView } from "@/components/charts/history-view";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [days, sessions] = await Promise.all([
    getDailyStats(30),
    getRecentSessions(60),
  ]);

  return (
    <>
      <PageHeader eyebrow="Progress over time" title="History" />
      <HistoryView initialDays={days} initialSessions={sessions} />
    </>
  );
}
