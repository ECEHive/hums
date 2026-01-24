import { createFileRoute } from "@tanstack/react-router";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";

export const Route = createFileRoute("/app/inventory/request-item")({
	component: () => <MyTransactions />,
});

function MyTransactions() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Request Item</PageTitle>
			</PageHeader>

			<PageContent>
				<div className="prose">
					<p>Request Item placeholder page for inventory.</p>
				</div>
			</PageContent>
		</Page>
	);
}
