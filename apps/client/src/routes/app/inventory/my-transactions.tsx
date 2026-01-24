import { createFileRoute } from "@tanstack/react-router";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";

export const Route = createFileRoute("/app/inventory/my-transactions")({
	component: () => <MyTransactions />,
});

function MyTransactions() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>My Transactions</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="prose">
					<p>My Transactions placeholder page for inventory.</p>
				</div>
			</PageContent>
		</Page>
	);
}
