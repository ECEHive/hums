import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";
import { ShiftsSidebar } from "@/components/navigation/shifts-sidebar";
import { PeriodProvider } from "@/components/providers/period-provider";

export const Route = createFileRoute("/app/shifts")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell
			sidebar={<ShiftsSidebar />}
			banners={<ImpersonationBanner />}
			wrapper={(children) => <PeriodProvider>{children}</PeriodProvider>}
		/>
	);
}
