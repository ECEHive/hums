import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarClockIcon,
	ChevronRightIcon,
	ClockIcon,
	UsersIcon,
} from "lucide-react";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/app/booking/book/")({
	component: BookPage,
});

function BookPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["scheduling", "bookableEventTypes"],
		queryFn: () => trpc.bookings.bookableEventTypes.query(),
	});

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	const eventTypes = data?.eventTypes ?? [];

	return (
		<Page>
			<PageHeader>
				<PageTitle>Book an Event</PageTitle>
			</PageHeader>
			<PageContent>
				{eventTypes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16">
						<CalendarClockIcon className="text-muted-foreground mb-4 h-12 w-12" />
						<h3 className="font-medium text-lg">No events available</h3>
						<p className="text-muted-foreground text-sm">
							There are no active event types to book at this time.
						</p>
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{eventTypes.map((et) => (
							<Link
								key={et.id}
								to="/app/booking/book/$eventTypeId"
								params={{ eventTypeId: et.id.toString() }}
								className="block"
							>
								<Card className="hover:border-primary/50 hover:shadow-md cursor-pointer group transition-all">
									<CardContent className="p-5">
										<div className="flex items-start justify-between">
											<div className="flex-1 space-y-2">
												<h3 className="font-semibold text-base leading-tight">
													{et.name}
												</h3>
												{et.description && (
													<p className="text-muted-foreground line-clamp-2 text-sm">
														{et.description}
													</p>
												)}
												<div className="flex flex-wrap items-center gap-3 pt-1">
													<Badge variant="secondary" className="gap-1 text-xs">
														<ClockIcon className="h-3 w-3" />
														{et.durationMinutes} min
													</Badge>
													<Badge variant="secondary" className="gap-1 text-xs">
														<UsersIcon className="h-3 w-3" />
														{et.minSchedulers} scheduler
														{et.minSchedulers > 1 ? "s" : ""}
													</Badge>
													{(et.bookingWindowStart || et.bookingWindowEnd) && (
														<Badge
															variant="secondary"
															className="gap-1 text-xs"
														>
															<CalendarClockIcon className="h-3 w-3" />
															{et.bookingWindowStart &&
																new Date(
																	et.bookingWindowStart,
																).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																})}
															{et.bookingWindowStart &&
																et.bookingWindowEnd &&
																" – "}
															{et.bookingWindowEnd &&
																new Date(
																	et.bookingWindowEnd,
																).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																})}
														</Badge>
													)}
												</div>
											</div>
											<ChevronRightIcon className="text-muted-foreground group-hover:text-primary mt-0.5 h-5 w-5 flex-shrink-0 transition-colors" />
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</PageContent>
		</Page>
	);
}
