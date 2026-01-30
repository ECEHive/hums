import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";
import { TicketsSidebar } from "@/components/navigation/tickets-sidebar";

export const Route = createFileRoute("/app/tickets")({
	component: TicketsLayout,
});

function TicketsLayout() {
	return (
		<AppShell sidebar={<TicketsSidebar />} banners={<ImpersonationBanner />} />
	);
}
