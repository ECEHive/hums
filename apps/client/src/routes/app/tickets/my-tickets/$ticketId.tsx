import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	CalendarIcon,
	ClockIcon,
	PackageIcon,
	UserIcon,
} from "lucide-react";
import { RequireAuth } from "@/auth/AuthProvider";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { DynamicTicketDetails, type TicketField } from "@/components/tickets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/tickets/my-tickets/$ticketId")({
	component: () => (
		<RequireAuth>
			<MyTicketDetailPage />
		</RequireAuth>
	),
});

export const permissions = [] as RequiredPermissions;

// Map ticket type names to icons
const ticketTypeIcons: Record<
	string,
	React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
	"inventory-request": PackageIcon,
	concern: AlertTriangleIcon,
};

// Status badge styles
const statusStyles: Record<
	string,
	{
		variant: "default" | "secondary" | "destructive" | "outline";
		label: string;
	}
> = {
	pending: { variant: "secondary", label: "Pending" },
	in_progress: { variant: "default", label: "In Progress" },
	resolved: { variant: "outline", label: "Resolved" },
	closed: { variant: "outline", label: "Closed" },
	cancelled: { variant: "destructive", label: "Cancelled" },
};

function MyTicketDetailPage() {
	const { ticketId } = Route.useParams();

	const {
		data: ticket,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["my-ticket", ticketId],
		queryFn: async () => {
			return await trpc.tickets.getMy.query({ id: ticketId });
		},
	});

	if (isLoading) {
		return (
			<Page>
				<PageHeader>
					<div className="flex items-center gap-2">
						<Link to="/app/tickets/my-tickets">
							<Button variant="ghost" size="sm">
								<ArrowLeftIcon className="mr-2 h-4 w-4" />
								Back
							</Button>
						</Link>
					</div>
				</PageHeader>
				<PageContent>
					<Skeleton className="h-8 w-64 mb-4" />
					<Skeleton className="h-64" />
				</PageContent>
			</Page>
		);
	}

	if (error || !ticket) {
		return (
			<Page>
				<PageHeader>
					<div className="flex items-center gap-2">
						<Link to="/app/tickets/my-tickets">
							<Button variant="ghost" size="sm">
								<ArrowLeftIcon className="mr-2 h-4 w-4" />
								Back
							</Button>
						</Link>
					</div>
				</PageHeader>
				<PageContent>
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							{error instanceof Error
								? error.message
								: "Failed to load ticket details. Please try again later."}
						</AlertDescription>
					</Alert>
				</PageContent>
			</Page>
		);
	}

	const Icon = (ticketTypeIcons[ticket.ticketType.name] ??
		AlertTriangleIcon) as React.ComponentType<{
		className?: string;
		style?: React.CSSProperties;
	}>;
	const statusStyle = statusStyles[ticket.status] ?? statusStyles.pending;
	const ticketData = ticket.data as Record<string, unknown>;
	const displayTypeName = ticket.ticketType.name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return (
		<Page>
			<PageHeader>
				<div className="flex items-center gap-4">
					<Link to="/app/tickets/my-tickets">
						<Button variant="ghost" size="sm">
							<ArrowLeftIcon className="mr-2 h-4 w-4" />
							Back
						</Button>
					</Link>
					<PageTitle className="flex items-center gap-3">
						<div
							className="flex h-10 w-10 items-center justify-center rounded-lg"
							style={{
								backgroundColor: ticket.ticketType.color
									? `${ticket.ticketType.color}20`
									: undefined,
							}}
						>
							<Icon
								className="h-5 w-5"
								style={{
									color: ticket.ticketType.color ?? undefined,
								}}
							/>
						</div>
						{displayTypeName}
					</PageTitle>
				</div>
			</PageHeader>

			<PageContent>
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Main Content */}
					<div className="lg:col-span-2 space-y-6">
						{/* Status Card */}
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">Status</CardTitle>
									<Badge variant={statusStyle.variant} className="text-sm">
										{statusStyle.label}
									</Badge>
								</div>
							</CardHeader>
							{ticket.resolutionNotes && (
								<CardContent>
									<p className="text-sm font-medium mb-1">Resolution Notes</p>
									<p className="text-sm text-muted-foreground whitespace-pre-wrap">
										{ticket.resolutionNotes}
									</p>
								</CardContent>
							)}
						</Card>

						{/* Ticket Data */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Submission Details</CardTitle>
							</CardHeader>
							<CardContent>
								<DynamicTicketDetails
									data={ticketData}
									fields={
										(
											ticket.ticketType.fieldSchema as {
												fields: TicketField[];
											} | null
										)?.fields ?? []
									}
								/>
							</CardContent>
						</Card>

						{/* Status History */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Status History</CardTitle>
							</CardHeader>
							<CardContent>
								{ticket.statusHistory.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No status changes yet.
									</p>
								) : (
									<div className="space-y-4">
										{ticket.statusHistory.map((history, index) => (
											<div key={history.id} className="flex gap-4">
												<div className="flex flex-col items-center">
													<div className="h-2 w-2 rounded-full bg-primary" />
													{index < ticket.statusHistory.length - 1 && (
														<div className="w-px flex-1 bg-border" />
													)}
												</div>
												<div className="flex-1 pb-4">
													<div className="flex items-center gap-2">
														<Badge
															variant={
																statusStyles[history.newStatus]?.variant ??
																"outline"
															}
														>
															{statusStyles[history.newStatus]?.label ??
																history.newStatus}
														</Badge>
														<span className="text-xs text-muted-foreground">
															{new Date(history.createdAt).toLocaleString()}
														</span>
													</div>
													{history.notes && (
														<p className="mt-1 text-sm text-muted-foreground">
															{history.notes}
														</p>
													)}
													{history.changedBy && (
														<p className="mt-1 text-xs text-muted-foreground">
															by {history.changedBy.name}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Info Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Information</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center gap-2 text-sm">
									<CalendarIcon className="h-4 w-4 text-muted-foreground" />
									<span className="text-muted-foreground">Submitted:</span>
									<span>{new Date(ticket.createdAt).toLocaleString()}</span>
								</div>
								{ticket.resolvedAt && (
									<div className="flex items-center gap-2 text-sm">
										<ClockIcon className="h-4 w-4 text-muted-foreground" />
										<span className="text-muted-foreground">Resolved:</span>
										<span>{new Date(ticket.resolvedAt).toLocaleString()}</span>
									</div>
								)}
								{ticket.handler && (
									<div className="flex items-center gap-2 text-sm">
										<UserIcon className="h-4 w-4 text-muted-foreground" />
										<span className="text-muted-foreground">Handler:</span>
										<span>{ticket.handler.name}</span>
									</div>
								)}
								<Separator />
								<div>
									<p className="text-xs text-muted-foreground">Ticket ID</p>
									<p className="font-mono text-xs">{ticket.id}</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
