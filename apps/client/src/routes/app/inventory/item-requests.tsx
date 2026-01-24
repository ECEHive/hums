import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/item-requests")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ItemRequests />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["inventory.requests.list"] as RequiredPermissions;

function ItemRequests() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Item Requests</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="prose">
					<p>Item Requests placeholder page for inventory.</p>
				</div>
			</PageContent>
		</Page>
	);
}
