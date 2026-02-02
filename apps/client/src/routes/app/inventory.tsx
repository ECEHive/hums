import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";

export const Route = createFileRoute("/app/inventory")({
	component: AppLayout,
});

function AppLayout() {
	return <AppShell banners={<ImpersonationBanner />} />;
}
