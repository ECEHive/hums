import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircleIcon,
	Loader2Icon,
	RefreshCcwIcon,
	XCircleIcon,
} from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
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
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions as TRequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/control/logs")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <LogsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = ["control.logs.list"] as TRequiredPermissions;

type ControlLog = {
	id: string;
	action: string;
	previousState: boolean | null;
	newState: boolean | null;
	success: boolean;
	errorMessage: string | null;
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
		email: string;
	};
};

const ACTION_LABELS: Record<string, string> = {
	TURN_ON: "Turn On",
	TURN_OFF: "Turn Off",
	UNLOCK: "Unlock",
	READ_STATE: "Read State",
};

function LogsPage() {
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState();

	const [actionFilter, setActionFilter] = React.useState<string>("all");
	const [successFilter, setSuccessFilter] = React.useState<string>("all");

	const queryParams = React.useMemo(() => {
		return {
			offset,
			limit: pageSize,
			action:
				actionFilter === "all"
					? undefined
					: (actionFilter as "TURN_ON" | "TURN_OFF" | "UNLOCK" | "READ_STATE"),
			success:
				successFilter === "all" ? undefined : successFilter === "success",
		};
	}, [offset, pageSize, actionFilter, successFilter]);

	const {
		data = { logs: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["control", "logs", queryParams],
		queryFn: async () => await trpc.control.logs.list.query(queryParams),
		retry: false,
	});

	const columns: ColumnDef<ControlLog>[] = [
		{
			accessorKey: "createdAt",
			header: "Time",
			cell: ({ row }) => (
				<span className="text-sm">
					{new Date(row.original.createdAt).toLocaleString()}
				</span>
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
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => (
				<Badge variant="outline">
					{ACTION_LABELS[row.original.action] || row.original.action}
				</Badge>
			),
		},
		{
			accessorKey: "success",
			header: "Result",
			cell: ({ row }) =>
				row.original.success ? (
					<Badge className="bg-green-500">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Success
					</Badge>
				) : (
					<Badge variant="destructive">
						<XCircleIcon className="h-3 w-3 mr-1" />
						Failed
					</Badge>
				),
		},
	];

	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.logs.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Control Logs</PageTitle>
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
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<div className="flex items-center gap-2">
								<Select
									value={actionFilter}
									onValueChange={(value) => {
										setActionFilter(value);
										resetToFirstPage();
									}}
								>
									<SelectTrigger className="w-[150px]">
										<SelectValue placeholder="Action" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Actions</SelectItem>
										<SelectItem value="TURN_ON">Turn On</SelectItem>
										<SelectItem value="TURN_OFF">Turn Off</SelectItem>
										<SelectItem value="UNLOCK">Unlock</SelectItem>
										<SelectItem value="READ_STATE">Read State</SelectItem>
									</SelectContent>
								</Select>
								<Select
									value={successFilter}
									onValueChange={(value) => {
										setSuccessFilter(value);
										resetToFirstPage();
									}}
								>
									<SelectTrigger className="w-[130px]">
										<SelectValue placeholder="Result" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Results</SelectItem>
										<SelectItem value="success">Success</SelectItem>
										<SelectItem value="failed">Failed</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</TableSearchInput>
					</TableToolbar>
					<DataTable columns={columns} data={data.logs} isLoading={isLoading} />
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.logs.length}
						total={data.total}
						itemName="logs"
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
