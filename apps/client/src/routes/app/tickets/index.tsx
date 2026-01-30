import { createFileRoute, Link } from "@tanstack/react-router";
import { InboxIcon, PlusCircleIcon, TicketIcon } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/tickets/")({
	component: TicketsIndex,
});

export const permissions = [] as RequiredPermissions;

function TicketsIndex() {
	const currentUser = useCurrentUser();
	const canManageTickets = checkPermissions(currentUser, ["tickets.manage"]);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Tickets</PageTitle>
			</PageHeader>

			<PageContent>
				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<Link to="/submit">
							<Button variant="outline" className="w-full justify-start">
								<PlusCircleIcon className="mr-2 h-4 w-4" />
								Submit a Ticket
							</Button>
						</Link>
						<Link to="/app/tickets/my-tickets">
							<Button variant="outline" className="w-full justify-start">
								<TicketIcon className="mr-2 h-4 w-4" />
								View My Tickets
							</Button>
						</Link>
						{canManageTickets && (
							<Link to="/app/tickets/admin">
								<Button variant="outline" className="w-full justify-start">
									<InboxIcon className="mr-2 h-4 w-4" />
									Manage All Tickets
								</Button>
							</Link>
						)}
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
