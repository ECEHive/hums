import { createFileRoute } from "@tanstack/react-router";
import { AgreementsBanner } from "@/components/banners/agreements-banner";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppShell } from "@/components/layout";

export const Route = createFileRoute("/app/_app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell
			banners={
				<>
					<ImpersonationBanner />
					<AgreementsBanner />
				</>
			}
		/>
	);
}
