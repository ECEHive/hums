import { createFileRoute, Link } from "@tanstack/react-router";
import {
	HistoryIcon,
	LaptopMinimalCheckIcon,
	PlusCircleIcon,
} from "lucide-react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/")({
	component: () => <InventoryIndex />,
});

function InventoryIndex() {
	const currentUser = useCurrentUser();
	const canViewTransactions = checkPermissions(currentUser, [
		"inventory.transactions.list",
	]);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Inventory</PageTitle>
			</PageHeader>

			<PageContent>
				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<Link to="/app/inventory/items">
							<Button variant="outline" className="w-full justify-start">
								<LaptopMinimalCheckIcon className="mr-2 h-4 w-4" />
								View Items
							</Button>
						</Link>
						<Link to="/app/inventory/request-item">
							<Button variant="outline" className="w-full justify-start">
								<PlusCircleIcon className="mr-2 h-4 w-4" />
								Request an Item
							</Button>
						</Link>
						{canViewTransactions ? (
							<Link to="/app/inventory/transactions">
								<Button variant="outline" className="w-full justify-start">
									<HistoryIcon className="mr-2 h-4 w-4" />
									View All Transactions
								</Button>
							</Link>
						) : (
							<Link to="/app/inventory/my-transactions">
								<Button variant="outline" className="w-full justify-start">
									<HistoryIcon className="mr-2 h-4 w-4" />
									View My Transactions
								</Button>
							</Link>
						)}
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
