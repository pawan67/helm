import { LiveProvider } from "@/components/live-provider";
import { AppShell } from "@/components/app-shell";

/**
 * Layout for every authenticated page. Opens the single shared SSE connection
 * (LiveProvider) and renders the nav shell. Auth itself is enforced in
 * middleware.ts, which redirects unauthenticated requests to /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiveProvider>
      <AppShell>{children}</AppShell>
    </LiveProvider>
  );
}
