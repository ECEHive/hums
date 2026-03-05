import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CalendarClockIcon,
	CheckCircleIcon,
	ClockIcon,
	Loader2Icon,
	UsersIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/app/booking/book/$eventTypeId")({
	component: BookEventPage,
});

function BookEventPage() {
	const { eventTypeId } = Route.useParams();
	const queryClient = useQueryClient();
	const eventTypeIdNum = Number(eventTypeId);

	const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
		undefined,
	);
	const [selectedSlot, setSelectedSlot] = React.useState<{
		start: Date;
		end: Date;
	} | null>(null);
	const [confirmed, setConfirmed] = React.useState(false);

	// Fetch event type info
	const { data: eventTypeData, isLoading: loadingType } = useQuery({
		queryKey: ["scheduling", "eventType", eventTypeIdNum],
		queryFn: () => trpc.instantEventTypes.get.query({ id: eventTypeIdNum }),
		enabled: !Number.isNaN(eventTypeIdNum),
	});

	// Compute the month range to fetch slots for based on the currently visible month
	const [visibleMonth, setVisibleMonth] = React.useState(() => new Date());

	const monthRange = React.useMemo(() => {
		const start = new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth(),
			1,
		);
		const end = new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth() + 1,
			1,
		);
		// Clamp start to now (don't fetch past slots)
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return {
			start: start < now ? now : start,
			end,
		};
	}, [visibleMonth]);

	// Fetch available slots for the visible month
	const {
		data: slotsData,
		isLoading: loadingSlots,
		isFetching: fetchingSlots,
	} = useQuery({
		queryKey: [
			"scheduling",
			"slots",
			eventTypeIdNum,
			monthRange.start.toISOString(),
			monthRange.end.toISOString(),
		],
		queryFn: () =>
			trpc.bookings.availableSlots.query({
				instantEventTypeId: eventTypeIdNum,
				dateRangeStart: monthRange.start,
				dateRangeEnd: monthRange.end,
			}),
		enabled: !Number.isNaN(eventTypeIdNum),
	});

	// Group slots by date key (YYYY-MM-DD)
	const slotsByDateKey = React.useMemo(() => {
		const map = new Map<string, { start: Date; end: Date }[]>();
		if (!slotsData?.slots) return map;
		for (const slot of slotsData.slots) {
			const d = new Date(slot.start);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			const existing = map.get(key) ?? [];
			existing.push({ start: new Date(slot.start), end: new Date(slot.end) });
			map.set(key, existing);
		}
		return map;
	}, [slotsData]);

	// Dates that have at least one slot
	const datesWithSlots = React.useMemo(() => {
		const set = new Set<string>();
		for (const key of slotsByDateKey.keys()) {
			set.add(key);
		}
		return set;
	}, [slotsByDateKey]);

	// Slots for the selected date
	const slotsForSelectedDate = React.useMemo(() => {
		if (!selectedDate) return [];
		const key = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
		return slotsByDateKey.get(key) ?? [];
	}, [selectedDate, slotsByDateKey]);

	// Calendar modifiers: highlight days with available slots
	const availableDayMatcher = React.useCallback(
		(date: Date) => {
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
			return datesWithSlots.has(key);
		},
		[datesWithSlots],
	);

	// Auto-select the first available date when slots load
	React.useEffect(() => {
		if (selectedDate || datesWithSlots.size === 0) return;
		const sortedKeys = Array.from(datesWithSlots).sort();
		if (sortedKeys.length > 0) {
			const [y, m, d] = sortedKeys[0].split("-").map(Number);
			setSelectedDate(new Date(y, m - 1, d));
		}
	}, [datesWithSlots, selectedDate]);

	const bookMutation = useMutation({
		mutationFn: (input: { instantEventTypeId: number; startTime: Date }) =>
			trpc.bookings.create.mutate(input),
		onSuccess: () => {
			setConfirmed(true);
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "slots"],
			});
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "myBookings"],
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create booking");
		},
	});

	function handleBook() {
		if (!selectedSlot) return;
		bookMutation.mutate({
			instantEventTypeId: eventTypeIdNum,
			startTime: selectedSlot.start,
		});
	}

	const eventType = eventTypeData?.eventType;

	if (loadingType) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (!eventType) {
		return (
			<Page>
				<PageContent>
					<div className="flex flex-col items-center justify-center py-16">
						<h3 className="font-medium text-lg">Event type not found</h3>
						<p className="text-muted-foreground mb-4 text-sm">
							This event type does not exist or has been removed.
						</p>
						<Button variant="outline" asChild>
							<Link to="/app/booking/book">
								<ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Events
							</Link>
						</Button>
					</div>
				</PageContent>
			</Page>
		);
	}

	// Confirmation success screen
	if (confirmed && selectedSlot) {
		return (
			<Page>
				<PageContent>
					<div className="mx-auto max-w-md py-16 text-center">
						<div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
							<CheckCircleIcon className="text-primary h-8 w-8" />
						</div>
						<h2 className="mb-2 font-semibold text-2xl">Booking Confirmed!</h2>
						<p className="text-muted-foreground mb-1">{eventType.name}</p>
						<p className="mb-1 font-medium">
							{selectedSlot.start.toLocaleDateString("en-US", {
								weekday: "long",
								month: "long",
								day: "numeric",
							})}
						</p>
						<p className="text-muted-foreground mb-6">
							{selectedSlot.start.toLocaleTimeString("en-US", {
								hour: "numeric",
								minute: "2-digit",
							})}{" "}
							–{" "}
							{selectedSlot.end.toLocaleTimeString("en-US", {
								hour: "numeric",
								minute: "2-digit",
							})}
						</p>
						<div className="flex justify-center gap-3">
							<Button variant="outline" asChild>
								<Link to="/app/booking/my-bookings">View My Bookings</Link>
							</Button>
							<Button asChild>
								<Link
									to="/app/booking/book/$eventTypeId"
									params={{ eventTypeId: eventTypeId }}
									onClick={() => {
										setConfirmed(false);
										setSelectedSlot(null);
										setSelectedDate(undefined);
									}}
								>
									Book Another
								</Link>
							</Button>
						</div>
					</div>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader>
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon" asChild>
						<Link to="/app/booking/book">
							<ArrowLeftIcon className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<PageTitle>{eventType.name}</PageTitle>
						{eventType.description && (
							<p className="text-muted-foreground text-sm">
								{eventType.description}
							</p>
						)}
					</div>
				</div>
			</PageHeader>
			<PageContent>
				<div className="flex flex-wrap items-center gap-3 mb-6">
					<Badge variant="secondary" className="gap-1">
						<ClockIcon className="h-3 w-3" />
						{eventType.durationMinutes} minutes
					</Badge>
					<Badge variant="secondary" className="gap-1">
						<UsersIcon className="h-3 w-3" />
						{eventType.minSchedulers} scheduler
						{eventType.minSchedulers > 1 ? "s" : ""}
					</Badge>
					{(eventType.bookingWindowStart || eventType.bookingWindowEnd) && (
						<Badge variant="secondary" className="gap-1">
							<CalendarClockIcon className="h-3 w-3" />
							{eventType.bookingWindowStart &&
								new Date(eventType.bookingWindowStart).toLocaleDateString(
									"en-US",
									{ month: "short", day: "numeric" },
								)}
							{eventType.bookingWindowStart &&
								eventType.bookingWindowEnd &&
								" – "}
							{eventType.bookingWindowEnd &&
								new Date(eventType.bookingWindowEnd).toLocaleDateString(
									"en-US",
									{ month: "short", day: "numeric" },
								)}
						</Badge>
					)}
				</div>

				{/* No availability state */}
				{!loadingSlots &&
					!fetchingSlots &&
					slotsData &&
					slotsData.slots.length === 0 && (
						<Card>
							<CardContent className="py-12 text-center">
								<CalendarClockIcon className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
								<h3 className="font-medium text-lg mb-1">No Availability</h3>
								<p className="text-muted-foreground text-sm">
									There are no available time slots for this event type this
									month. Try navigating to a different month or check back
									later.
								</p>
							</CardContent>
						</Card>
					)}

				<div className="grid gap-6 lg:grid-cols-[auto_1fr]">
					{/* Calendar */}
					<div>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">Select a Date</CardTitle>
							</CardHeader>
							<CardContent>
								<Calendar
									mode="single"
									selected={selectedDate}
									onSelect={(date) => {
										setSelectedDate(date);
										setSelectedSlot(null);
									}}
									onMonthChange={setVisibleMonth}
									disabled={(date) => {
										const today = new Date();
										today.setHours(0, 0, 0, 0);
										if (date < today) return true;
										// Disable dates outside booking window
										if (eventType.bookingWindowStart) {
											const windowStart = new Date(
												eventType.bookingWindowStart,
											);
											windowStart.setHours(0, 0, 0, 0);
											if (date < windowStart) return true;
										}
										if (eventType.bookingWindowEnd) {
											const windowEnd = new Date(eventType.bookingWindowEnd);
											windowEnd.setHours(23, 59, 59, 999);
											if (date > windowEnd) return true;
										}
										return !availableDayMatcher(date);
									}}
									modifiers={{
										available: availableDayMatcher,
									}}
									modifiersClassNames={{
										available:
											"bg-primary/10 font-semibold text-primary rounded-md",
									}}
									className="rounded-lg border"
								/>
								{(loadingSlots || fetchingSlots) && (
									<div className="mt-2 flex items-center gap-2">
										<Loader2Icon className="h-3 w-3 animate-spin" />
										<span className="text-muted-foreground text-xs">
											Loading availability...
										</span>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Time slots + Confirmation */}
					<div className="space-y-4">
						{!selectedDate ? (
							<Card>
								<CardContent className="py-12 text-center">
									<CalendarClockIcon className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
									<p className="text-muted-foreground text-sm">
										Select a highlighted date to view available time slots.
									</p>
								</CardContent>
							</Card>
						) : slotsForSelectedDate.length === 0 ? (
							<Card>
								<CardContent className="py-12 text-center">
									<p className="text-muted-foreground text-sm">
										No available time slots for this date.
									</p>
								</CardContent>
							</Card>
						) : (
							<>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">
											Available Times –{" "}
											{selectedDate.toLocaleDateString("en-US", {
												weekday: "long",
												month: "long",
												day: "numeric",
											})}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
											{slotsForSelectedDate.map((slot) => {
												const isSelected =
													selectedSlot?.start.getTime() ===
													slot.start.getTime();
												return (
													<Button
														key={slot.start.toISOString()}
														variant={isSelected ? "default" : "outline"}
														size="sm"
														className="w-full"
														onClick={() => setSelectedSlot(slot)}
													>
														{new Date(slot.start).toLocaleTimeString("en-US", {
															hour: "numeric",
															minute: "2-digit",
														})}
													</Button>
												);
											})}
										</div>
									</CardContent>
								</Card>

								{selectedSlot && (
									<Card className="border-primary/30 bg-primary/5">
										<CardContent className="p-5">
											<h3 className="mb-3 font-semibold text-sm">
												Confirm Your Booking
											</h3>
											<div className="mb-4 flex items-center gap-3">
												<CalendarClockIcon className="text-muted-foreground h-5 w-5" />
												<div>
													<p className="font-medium">
														{selectedSlot.start.toLocaleDateString("en-US", {
															weekday: "long",
															month: "long",
															day: "numeric",
														})}
													</p>
													<p className="text-muted-foreground text-sm">
														{selectedSlot.start.toLocaleTimeString("en-US", {
															hour: "numeric",
															minute: "2-digit",
														})}{" "}
														–{" "}
														{selectedSlot.end.toLocaleTimeString("en-US", {
															hour: "numeric",
															minute: "2-digit",
														})}
													</p>
												</div>
											</div>
											<Button
												onClick={handleBook}
												disabled={bookMutation.isPending}
												className="w-full sm:w-auto"
											>
												{bookMutation.isPending ? (
													<>
														<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
														Booking...
													</>
												) : (
													<>
														<CheckCircleIcon className="mr-2 h-4 w-4" />
														Confirm Booking
													</>
												)}
											</Button>
										</CardContent>
									</Card>
								)}
							</>
						)}
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
