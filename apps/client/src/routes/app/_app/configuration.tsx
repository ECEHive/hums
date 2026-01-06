import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { ConfigurationPanel } from "@/components/config/configuration-panel";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Spinner } from "@/components/ui/spinner";

export const permissions = ["config.read"];

export const Route = createFileRoute("/app/_app/configuration")({
	component: () =>
		RequirePermissions({
			permissions,
			forbiddenFallback: <MissingPermissions />,
			children: <ConfigurationPage />,
		}),
});

function ConfigurationPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["config", "all"],
		queryFn: () => trpc.config.getAll.query({}),
		staleTime: 30_000, // 30 seconds
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Configuration</PageTitle>
			</PageHeader>
			<PageContent>
				{isLoading ? (
					<div className="flex items-center justify-center p-8">
						<Spinner className="h-8 w-8" />
					</div>
				) : data ? (
					<ConfigurationPanel
						definitions={data.definitions}
						initialValues={data.values}
					/>
				) : (
					<div className="text-center p-8 text-muted-foreground">
						Failed to load configuration
					</div>
				)}
			</PageContent>
		</Page>
	);
}
