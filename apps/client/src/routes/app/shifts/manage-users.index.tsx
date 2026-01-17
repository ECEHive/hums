import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2Icon, RefreshCcwIcon, UserIcon } from "lucide-react";
import { useMemo } from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import {
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/manage-users/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ManageUsersPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [
	"shift_schedules.manipulate",
] as RequiredPermissions;

type UserWithStats = {
	id: number;
	name: string | null;
	username: string;
	email: string | null;
	roles: Array<{ id: number; name: string }>;
	registeredShifts: number;
	droppedShifts: number;
	makeupShifts: number;
};

function generateColumns(): ColumnDef<UserWithStats>[] {
	return [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => {
				const user = row.original;
				return (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<UserIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{user.name ?? user.username}</p>
							<p className="text-sm text-muted-foreground">
								{user.email ?? user.username}
							</p>
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "registeredShifts",
			header: "Registered Shifts",
			cell: ({ row }) => (
				<div className="text-center font-medium">
					{row.original.registeredShifts}
				</div>
			),
		},
		{
			accessorKey: "droppedShifts",
			header: "Dropped Shifts",
			cell: ({ row }) => (
				<div className="text-center font-medium">
					{row.original.droppedShifts}
				</div>
			),
		},
		{
			accessorKey: "makeupShifts",
			header: "Makeup Shifts",
			cell: ({ row }) => (
				<div className="text-center font-medium">
					{row.original.makeupShifts}
				</div>
			),
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				const user = row.original;
				return (
					<div className="flex justify-end">
						<Link
							to="/app/shifts/manage-users/$userId"
							params={{ userId: String(user.id) }}
						>
							<Button variant="outline" size="sm">
								Manage
							</Button>
						</Link>
					</div>
				);
			},
		},
	];
}

function ManageUsersPage() {
	const { period: selectedPeriodId } = usePeriod();

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		resetToFirstPage,
	} = useTableState({ initialPageSize: 20 });

	const queryParams = useMemo(() => {
		return {
			periodId: selectedPeriodId ?? 0,
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		};
	}, [selectedPeriodId, debouncedSearch, offset, pageSize]);

	const {
		data = { users: [], total: 0, period: null },
		isFetching,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["manage-users-list", queryParams],
		queryFn: async () => {
			if (!selectedPeriodId) return { users: [], total: 0, period: null };
			return trpc.shiftSchedules.listAllUsersWithStats.query(queryParams);
		},
		enabled: Boolean(selectedPeriodId),
		retry: false,
	});

	const columns = useMemo(() => generateColumns(), []);
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.users.length,
	});

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	const periodLabel = data.period?.name ?? `Period ${selectedPeriodId}`;

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>Manage Users</PageTitle>
					<PageDescription>
						View and manage shift assignments for all users in {periodLabel}
					</PageDescription>
				</div>
				<PageActions>
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
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search users..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.users}
						isLoading={isLoading}
						emptyMessage="No users found"
						emptyDescription="No users match the period's shift roles, or try adjusting your search"
					/>

					{data.total > 0 && (
						<TablePaginationFooter
							page={page}
							totalPages={totalPages}
							onPageChange={setPage}
							offset={offset}
							currentCount={data.users.length}
							total={data.total}
							itemName="users"
							pageSize={pageSize}
							onPageSizeChange={(size) => {
								setPageSize(size);
								resetToFirstPage();
							}}
							pageSizeOptions={[10, 20, 50, 100]}
						/>
					)}
				</TableContainer>
			</PageContent>
		</Page>
	);
}
