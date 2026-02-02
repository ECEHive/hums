import { createFileRoute } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";
import { PeriodProvider } from "@/components/providers/period-provider";

export const Route = createFileRoute("/app/shifts")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell
			banners={<ImpersonationBanner />}
			showPeriodSelector={true}
			wrapper={(children) => <PeriodProvider>{children}</PeriodProvider>}
		/>
	);
}
