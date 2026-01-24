import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";
import { InventorySidebar } from "@/components/navigation/inventory-sidebar";

export const Route = createFileRoute("/app/inventory")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell
      sidebar={<InventorySidebar />}
      banners={<ImpersonationBanner />}
    />
  );
}
