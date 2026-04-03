import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarClockIcon,
	CheckCircleIcon,
	ClockIcon,
	Loader2Icon,
	RefreshCcwIcon,
	XCircleIcon,
	XIcon,
} from "lucide-react";
import React from "react";
import { RequireAuth } from "@/auth/AuthProvider";
import { CreateReservationDialog } from "@/components/control/create-reservation-dialog";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/control/reservations")({
	component: () => <RequireAuth>{<ReservationsPage />}</RequireAuth>,
});

type ReservationStatus =
	| "PENDING"
	| "ACTIVE"
	| "COMPLETED"
	| "CANCELLED"
	| "NO_SHOW";

type Reservation = {
	id: string;
	startTime: Date;
	endTime: Date;
	status: ReservationStatus;
	notes: string | null;
	checkedInAt: Date | null;
	cancelledAt: Date | null;
	createdAt: Date;
	controlPoint: {
		id: string;
		name: string;
		location: string | null;
		controlClass: string;
	};
	user: {
		id: number;
		name: string;
		username: string;
	};
};

const STATUS_CONFIG: Record<
	ReservationStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
		icon: React.ElementType;
	}
> = {
	PENDING: { label: "Pending", variant: "secondary", icon: ClockIcon },
	ACTIVE: { label: "Active", variant: "default", icon: CalendarClockIcon },
	COMPLETED: { label: "Completed", variant: "outline", icon: CheckCircleIcon },
	CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircleIcon },
	NO_SHOW: { label: "No Show", variant: "destructive", icon: XIcon },
};

function ReservationsPage() {
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState();

	const [statusFilter, setStatusFilter] = React.useState<string>("all");
	const queryClient = useQueryClient();

	const queryParams = React.useMemo(() => {
		return {
			page: Math.floor(offset / pageSize) + 1,
			pageSize,
			status:
				statusFilter === "all"
					? undefined
					: (statusFilter as ReservationStatus),
			orderBy: "startTime" as const,
			orderDir: "desc" as const,
		};
	}, [offset, pageSize, statusFilter]);

	const {
		data = { reservations: [], total: 0, page: 1, pageSize: 25, totalPages: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["control", "reservations", "list", queryParams],
		queryFn: async () =>
			await trpc.control.reservations.list.query(queryParams),
		retry: false,
	});

	const cancelMutation = useMutation({
		mutationFn: (id: string) => trpc.control.reservations.cancel.mutate({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "reservations"] });
		},
	});

	const columns: ColumnDef<Reservation>[] = [
		{
			accessorKey: "startTime",
			header: "Time",
			cell: ({ row }) => (
				<div className="text-sm">
					<div>{new Date(row.original.startTime).toLocaleDateString()}</div>
					<div className="text-muted-foreground">
						{new Date(row.original.startTime).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}{" "}
						-{" "}
						{new Date(row.original.endTime).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</div>
				</div>
			),
		},
		{
			accessorKey: "controlPoint",
			header: "Control Point",
			cell: ({ row }) => (
				<div>
					<div className="font-medium">{row.original.controlPoint.name}</div>
					{row.original.controlPoint.location && (
						<div className="text-xs text-muted-foreground">
							{row.original.controlPoint.location}
						</div>
					)}
				</div>
			),
		},
		{
			accessorKey: "user",
			header: "User",
			cell: ({ row }) => (
				<div>
					<div className="font-medium">{row.original.user.name}</div>
					<div className="text-xs text-muted-foreground">
						{row.original.user.username}
					</div>
				</div>
			),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const config = STATUS_CONFIG[row.original.status];
				const Icon = config.icon;
				return (
					<Badge variant={config.variant}>
						<Icon className="h-3 w-3 mr-1" />
						{config.label}
					</Badge>
				);
			},
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => {
				const reservation = row.original;
				if (
					reservation.status !== "PENDING" &&
					reservation.status !== "ACTIVE"
				) {
					return null;
				}
				return (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => cancelMutation.mutate(reservation.id)}
								disabled={cancelMutation.isPending}
							>
								<XCircleIcon className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Cancel reservation</TooltipContent>
					</Tooltip>
				);
			},
		},
	];

	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.reservations.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Reservations</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="h-4 w-4" />
						)}
						<span className="ml-2 hidden sm:inline">Refresh</span>
					</Button>
					<CreateReservationDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<div className="flex items-center gap-2">
								<Select
									value={statusFilter}
									onValueChange={(value) => {
										setStatusFilter(value);
										resetToFirstPage();
									}}
								>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Statuses</SelectItem>
										<SelectItem value="PENDING">Pending</SelectItem>
										<SelectItem value="ACTIVE">Active</SelectItem>
										<SelectItem value="COMPLETED">Completed</SelectItem>
										<SelectItem value="CANCELLED">Cancelled</SelectItem>
										<SelectItem value="NO_SHOW">No Show</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</TableSearchInput>
					</TableToolbar>
					<DataTable
						columns={columns}
						data={data.reservations}
						isLoading={isLoading}
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.reservations.length}
						total={data.total}
						itemName="reservations"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}
