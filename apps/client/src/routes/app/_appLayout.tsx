import { createFileRoute } from "@tanstack/react-router";
import { AgreementsBanner } from "@/components/banners/agreements-banner";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";
import { AppSidebar } from "@/components/navigation/app-sidebar";

export const Route = createFileRoute("/app/_appLayout")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell
			sidebar={<AppSidebar />}
			banners={
				<>
					<ImpersonationBanner />
					<AgreementsBanner />
				</>
			}
		/>
	);
}
