import { LiveProvider } from "@/components/live-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/toaster";

/**
 * Layout for every authenticated page. Opens the single shared SSE connection
 * (LiveProvider) and renders the Chakra sidebar shell. Auth itself is enforced
 * in proxy.ts, which redirects unauthenticated requests to /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiveProvider>
      <AppShell>{children}</AppShell>
      <Toaster />
    </LiveProvider>
  );
}
