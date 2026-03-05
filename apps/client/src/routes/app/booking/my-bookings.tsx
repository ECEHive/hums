import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarIcon, Loader2Icon, RefreshCcwIcon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableToolbar,
} from "@/components/layout";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/booking/my-bookings")({
	component: MyBookingsPage,
});

type BookingRow = {
	id: number;
	startTime: Date;
	endTime: Date;
	instantEventType: { id: number; name: string };
	requestor: { id: number; name: string; username: string };
	schedulers: { id: number; name: string; username: string }[];
	createdAt: Date;
};

function MyBookingsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState({ persistKey: "scheduling-my-bookings" });

	const [cancelTarget, setCancelTarget] = React.useState<BookingRow | null>(
		null,
	);
	const [cancelReason, setCancelReason] = React.useState("");
	const [rescheduleTarget, setRescheduleTarget] =
		React.useState<BookingRow | null>(null);

	const queryParams = React.useMemo(
		() => ({ offset, limit: pageSize }),
		[offset, pageSize],
	);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["scheduling", "myBookings", queryParams],
		queryFn: () => trpc.bookings.myBookings.query(queryParams),
	});

	const cancelMutation = useMutation({
		mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
			trpc.bookings.cancelMyBooking.mutate({ id, reason }),
		onSuccess: () => {
			toast.success("Booking cancelled");
			setCancelTarget(null);
			setCancelReason("");
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "myBookings"],
			});
		},
		onError: (err: unknown) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to cancel booking",
			);
		},
	});

	// Reschedule: cancel the booking, then navigate to the booking page for that event type
	const rescheduleMutation = useMutation({
		mutationFn: ({ id }: { id: number; eventTypeId: string }) =>
			trpc.bookings.cancelMyBooking.mutate({ id }),
		onSuccess: (_data, variables) => {
			setRescheduleTarget(null);
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "myBookings"],
			});
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "slots"],
			});
			toast.success("Booking cancelled — pick a new time");
			navigate({
				to: "/app/booking/book/$eventTypeId",
				params: {
					eventTypeId: variables.eventTypeId,
				},
			});
		},
		onError: (err: unknown) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to cancel booking",
			);
		},
	});

	const columns: ColumnDef<BookingRow>[] = React.useMemo(
		() => [
			{
				accessorKey: "instantEventType.name",
				header: "Event Type",
			},
			{
				accessorKey: "startTime",
				header: "Date",
				cell: ({ row }) =>
					new Date(row.original.startTime).toLocaleDateString("en-US", {
						weekday: "short",
						month: "short",
						day: "numeric",
					}),
			},
			{
				id: "time",
				header: "Time",
				cell: ({ row }) => {
					const start = new Date(row.original.startTime);
					const end = new Date(row.original.endTime);
					return `${start.toLocaleTimeString("en-US", {
						hour: "numeric",
						minute: "2-digit",
					})} – ${end.toLocaleTimeString("en-US", {
						hour: "numeric",
						minute: "2-digit",
					})}`;
				},
			},
			{
				id: "schedulers",
				header: "Assigned To",
				cell: ({ row }) =>
					row.original.schedulers.map((s) => s.name).join(", ") || "—",
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => {
					const now = new Date();
					const start = new Date(row.original.startTime);
					const end = new Date(row.original.endTime);
					if (now < start) {
						return <Badge>Upcoming</Badge>;
					}
					if (now >= start && now <= end) {
						return <Badge variant="default">In Progress</Badge>;
					}
					return <Badge variant="outline">Completed</Badge>;
				},
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const now = new Date();
					const start = new Date(row.original.startTime);
					if (now >= start) return null;
					return (
						<div className="flex items-center justify-end gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setRescheduleTarget(row.original)}
							>
								<CalendarIcon className="mr-1 size-4" />
								Reschedule
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setCancelTarget(row.original)}
							>
								<XIcon className="mr-1 size-4" />
								Cancel
							</Button>
						</div>
					);
				},
			},
		],
		[],
	);

	const { totalPages } = usePaginationInfo({
		total: data?.total ?? 0,
		pageSize,
		offset,
		currentCount: data?.bookings?.length ?? 0,
	});

	if (isLoading && !data) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Bookings</PageTitle>
				<PageActions>
					<Button variant="outline" asChild>
						<Link to="/app/booking/book">Book New Event</Link>
					</Button>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar />
					<DataTable
						columns={columns}
						data={data?.bookings ?? []}
						isLoading={isLoading}
						emptyMessage="No bookings"
						emptyDescription="Book an event to see it here"
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data?.bookings?.length ?? 0}
						total={data?.total ?? 0}
						itemName="bookings"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>

				{/* Cancel confirmation dialog */}
				<AlertDialog
					open={cancelTarget !== null}
					onOpenChange={(open) => {
						if (!open) {
							setCancelTarget(null);
							setCancelReason("");
						}
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Cancel Booking</AlertDialogTitle>
							<AlertDialogDescription>
								This will permanently cancel your booking
								{cancelTarget
									? ` for ${cancelTarget.instantEventType.name} on ${new Date(cancelTarget.startTime).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
									: ""}
								. This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<div className="space-y-2 py-2">
							<Label htmlFor="cancel-reason">Reason (optional)</Label>
							<Textarea
								id="cancel-reason"
								placeholder="Optionally provide a reason for cancelling..."
								value={cancelReason}
								onChange={(e) => setCancelReason(e.target.value)}
							/>
						</div>
						<AlertDialogFooter>
							<AlertDialogCancel>Keep Booking</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									if (cancelTarget) {
										cancelMutation.mutate({
											id: cancelTarget.id,
											reason: cancelReason || undefined,
										});
									}
								}}
								disabled={cancelMutation.isPending}
							>
								{cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				{/* Reschedule confirmation dialog */}
				<AlertDialog
					open={rescheduleTarget !== null}
					onOpenChange={(open) => {
						if (!open) setRescheduleTarget(null);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Reschedule Booking</AlertDialogTitle>
							<AlertDialogDescription>
								This will cancel your current booking
								{rescheduleTarget
									? ` for ${rescheduleTarget.instantEventType.name} on ${new Date(rescheduleTarget.startTime).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
									: ""}{" "}
								and take you to the booking page to pick a new time. Different
								schedulers may be assigned.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Keep Current Time</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									if (rescheduleTarget) {
										rescheduleMutation.mutate({
											id: rescheduleTarget.id,
											eventTypeId:
												rescheduleTarget.instantEventType.id.toString(),
										});
									}
								}}
								disabled={rescheduleMutation.isPending}
							>
								{rescheduleMutation.isPending
									? "Rescheduling..."
									: "Reschedule"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageContent>
		</Page>
	);
}
