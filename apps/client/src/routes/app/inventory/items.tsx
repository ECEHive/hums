import { createFileRoute } from "@tanstack/react-router";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";

export const Route = createFileRoute("/app/inventory/items")({
	component: () => <MyTransactions />,
});

function MyTransactions() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Items</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="prose">
					<p>Items placeholder page for inventory.</p>
				</div>
			</PageContent>
		</Page>
	);
}
