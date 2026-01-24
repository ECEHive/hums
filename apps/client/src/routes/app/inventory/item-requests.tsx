import { createFileRoute } from "@tanstack/react-router";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";

export const Route = createFileRoute("/app/inventory/item-requests")({
	component: () => <MyTransactions />,
});

function MyTransactions() {
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
