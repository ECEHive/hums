import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeIcon, HistoryIcon, ShieldCheckIcon } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/")({
    component: () => (
        <InventoryIndex />
    ),
});

function InventoryIndex() {
    const currentUser = useCurrentUser();
    const canManageUsers = checkPermissions(currentUser, [
        "inventory.transactions.manipulate",
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
                        <Link to="/app/inventory">
                            <Button variant="outline" className="w-full justify-start">
                                <HomeIcon className="mr-2 h-4 w-4" />
                                Open Inventory Home
                            </Button>
                        </Link>
                        <Link to="/app/inventory/transactions">
                            <Button variant="outline" className="w-full justify-start">
                                <HistoryIcon className="mr-2 h-4 w-4" />
                                View Transactions
                            </Button>
                        </Link>
                        {canManageUsers ? (
                            <Link to="/app/inventory/transactions">
                                <Button variant="outline" className="w-full justify-start">
                                    <ShieldCheckIcon className="mr-2 h-4 w-4" />
                                    Manage Transactions
                                </Button>
                            </Link>
                        ) : null}
                    </CardContent>
                </Card>
            </PageContent>
        </Page>
    );
}
