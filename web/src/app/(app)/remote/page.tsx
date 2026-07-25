import { ensureIrSeed, getIrDevices } from "@/db/ir";
import { RemoteView } from "@/components/remote/remote-view";

export const dynamic = "force-dynamic";

export default async function RemotePage() {
  await ensureIrSeed();
  const devices = await getIrDevices();
  return <RemoteView initial={devices} />;
}
