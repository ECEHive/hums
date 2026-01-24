import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/transactions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Transactions />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [
	"inventory.transactions.list",
] as RequiredPermissions;

function Transactions() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Transactions</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="prose">
					<p>Transactions placeholder page for inventory.</p>
				</div>
			</PageContent>
		</Page>
	);
}
