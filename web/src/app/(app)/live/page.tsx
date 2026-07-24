import { getSettings } from "@/db/persist";
import { LiveScreen } from "@/components/live/live-screen";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const settings = await getSettings();
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="eyebrow">Real-time telemetry</div>
          <h1 className="font-display mt-1 text-3xl tracking-wide sm:text-4xl">
            Live
          </h1>
        </div>
      </div>
      <LiveScreen thresholds={settings.thresholds} />
    </>
  );
}
