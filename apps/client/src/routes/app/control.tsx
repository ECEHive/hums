import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";

export const Route = createFileRoute("/app/control")({
	component: ControlLayout,
});

function ControlLayout() {
	return <AppShell banners={<ImpersonationBanner />} />;
}
