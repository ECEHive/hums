import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlarmClockIcon,
	AlertTriangleIcon,
	ArrowLeftIcon,
	ChevronRightIcon,
	LaptopMinimalIcon,
	LockIcon,
	type LucideIcon,
	MessageSquareHeartIcon,
	MessageSquareWarningIcon,
	PackageIcon,
	ShoppingBasketIcon,
	ShoppingCartIcon,
	TagIcon,
	UnlockIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/shared/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/submit/")({
	component: SubmitTicketPage,
});

/**
 * Available icons for ticket types
 */
const TICKET_TYPE_ICONS: Record<string, LucideIcon> = {
	"alarm-clock": AlarmClockIcon,
	"laptop-minimal": LaptopMinimalIcon,
	"shopping-basket": ShoppingBasketIcon,
	"shopping-cart": ShoppingCartIcon,
	"message-square-warning": MessageSquareWarningIcon,
	"message-square-heart": MessageSquareHeartIcon,
	tag: TagIcon,
	// Legacy support for old icon names
	"inventory-request": PackageIcon,
	concern: AlertTriangleIcon,
};

function getTicketTypeIcon(iconName: string | null): LucideIcon {
	if (!iconName) return TagIcon;
	return TICKET_TYPE_ICONS[iconName] ?? TagIcon;
}

function SubmitTicketPage() {
	const { status } = useAuth();
	const isAuthenticated = status === "authenticated";
	const {
		data: ticketTypes,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["ticket-types", { activeOnly: true }],
		queryFn: async () => {
			return await trpc.tickets.types.list.query({ activeOnly: true });
		},
	});

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4 flex items-center justify-between">
						<Logo className="h-8" />
						{isAuthenticated && (
							<Link to="/app">
								<Button variant="outline" size="sm">
									<ArrowLeftIcon className="h-4 w-4 mr-2" />
									Back to HUMS
								</Button>
							</Link>
						)}
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
					<h1 className="text-2xl font-bold mb-2">Submit a Ticket</h1>
					<p className="text-muted-foreground mb-8">
						Choose the type of ticket you'd like to submit
					</p>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-40" />
						))}
					</div>
				</main>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<header className="border-b">
					<div className="container mx-auto px-4 py-4 flex items-center justify-between">
						<Logo className="h-8" />
						{isAuthenticated && (
							<Link to="/app">
								<Button variant="outline" size="sm">
									<ArrowLeftIcon className="h-4 w-4 mr-2" />
									Back to HUMS
								</Button>
							</Link>
						)}
					</div>
				</header>
				<main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
					<h1 className="text-2xl font-bold mb-8">Submit a Ticket</h1>
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Failed to load ticket types. Please try again later.
						</AlertDescription>
					</Alert>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<Logo className="h-8" />
					{isAuthenticated && (
						<Link to="/app">
							<Button variant="outline" size="sm">
								<ArrowLeftIcon className="h-4 w-4 mr-2" />
								Back to HUMS
							</Button>
						</Link>
					)}
				</div>
			</header>
			<main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
				<h1 className="text-2xl font-bold mb-2">Submit a Ticket</h1>
				<p className="text-muted-foreground mb-8">
					Choose the type of ticket you'd like to submit
				</p>

				{ticketTypes && ticketTypes.length === 0 ? (
					<Alert>
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>No Ticket Types Available</AlertTitle>
						<AlertDescription>
							There are currently no ticket types available for submission.
						</AlertDescription>
					</Alert>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{ticketTypes?.map((ticketType) => {
							const Icon = getTicketTypeIcon(ticketType.icon);
							return (
								<Link
									key={ticketType.id}
									to="/submit/$ticketTypeId"
									params={{ ticketTypeId: String(ticketType.id) }}
									className="block"
								>
									<Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
										<CardHeader>
											<div className="flex items-center justify-between">
												<div
													className="flex h-10 w-10 items-center justify-center rounded-lg"
													style={{
														backgroundColor: ticketType.color
															? `${ticketType.color}20`
															: "hsl(var(--muted))",
													}}
												>
													<Icon
														className="h-5 w-5"
														style={{
															color: ticketType.color ?? undefined,
														}}
													/>
												</div>
												<div className="flex items-center gap-2">
													{ticketType.requiresAuth ? (
														<LockIcon
															className="h-4 w-4 text-muted-foreground"
															aria-label="Requires login"
														/>
													) : (
														<UnlockIcon
															className="h-4 w-4 text-muted-foreground"
															aria-label="Anonymous submission allowed"
														/>
													)}
													<ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
												</div>
											</div>
											<CardTitle className="text-lg mt-2">
												{ticketType.name}
											</CardTitle>
											{ticketType.description && (
												<CardDescription>
													{ticketType.description}
												</CardDescription>
											)}
										</CardHeader>
										<CardContent>
											<p className="text-xs text-muted-foreground">
												{ticketType.requiresAuth
													? "Login required to submit"
													: "No login required"}
											</p>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
