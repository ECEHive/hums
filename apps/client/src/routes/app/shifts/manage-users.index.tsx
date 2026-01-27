import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2Icon, RefreshCcwIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
import {
	DataTable,
	FilterField,
	SearchInput,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { clearManageUsersMemory } from "@/hooks/use-manage-users-memory";
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

type NumericFilterOperator = "gt" | "lt" | "gte" | "lte" | "eq";

type NumericFilter = {
	operator: NumericFilterOperator;
	value: number;
} | null;

type RolesFilterMode =
	| "has_any"
	| "has_all"
	| "has_none"
	| "missing_any"
	| "missing_all";

type RolesFilter = {
	roles: Role[];
	mode: RolesFilterMode;
} | null;

type ShiftFilters = {
	registeredShifts: NumericFilter;
	droppedShifts: NumericFilter;
	makeupShifts: NumericFilter;
	roles: RolesFilter;
};

const DEFAULT_FILTERS: ShiftFilters = {
	registeredShifts: null,
	droppedShifts: null,
	makeupShifts: null,
	roles: null,
};

const ROLES_FILTER_MODE_LABELS: Record<RolesFilterMode, string> = {
	has_any: "Has any of",
	has_all: "Has all of",
	has_none: "Has none of",
	missing_any: "Missing any of",
	missing_all: "Missing all of",
};

const OPERATOR_LABELS: Record<NumericFilterOperator, string> = {
	gt: "Greater than",
	lt: "Less than",
	gte: "At least",
	lte: "At most",
	eq: "Exactly",
};

function NumericFilterInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: NumericFilter;
	onChange: (value: NumericFilter) => void;
}) {
	const [operator, setOperator] = useState<NumericFilterOperator>(
		value?.operator ?? "gte",
	);
	const [inputValue, setInputValue] = useState<string>(
		value?.value?.toString() ?? "",
	);

	const handleApply = () => {
		const num = Number.parseInt(inputValue, 10);
		if (!Number.isNaN(num) && num >= 0) {
			onChange({ operator, value: num });
		}
	};

	const handleClear = () => {
		setInputValue("");
		onChange(null);
	};

	return (
		<div className="space-y-2">
			<span className="text-sm font-medium">{label}</span>
			<div className="flex gap-2">
				<Select
					value={operator}
					onValueChange={(val) => setOperator(val as NumericFilterOperator)}
				>
					<SelectTrigger className="w-[130px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(OPERATOR_LABELS).map(([op, opLabel]) => (
							<SelectItem key={op} value={op}>
								{opLabel}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					type="number"
					min={0}
					placeholder="0"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					className="w-20"
				/>
				<Button size="sm" variant="secondary" onClick={handleApply}>
					Apply
				</Button>
				{value && (
					<Button size="sm" variant="ghost" onClick={handleClear}>
						Clear
					</Button>
				)}
			</div>
		</div>
	);
}

function RolesFilterInput({
	value,
	onChange,
}: {
	value: RolesFilter;
	onChange: (value: RolesFilter) => void;
}) {
	const [mode, setMode] = useState<RolesFilterMode>(value?.mode ?? "has_any");
	const [selectedRoles, setSelectedRoles] = useState<Role[]>(
		value?.roles ?? [],
	);

	const handleApply = () => {
		if (selectedRoles.length > 0) {
			onChange({ roles: selectedRoles, mode });
		}
	};

	const handleClear = () => {
		setSelectedRoles([]);
		onChange(null);
	};

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				<Label className="text-sm font-medium">Filter mode</Label>
				<Select
					value={mode}
					onValueChange={(val) => setMode(val as RolesFilterMode)}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(ROLES_FILTER_MODE_LABELS).map(([m, label]) => (
							<SelectItem key={m} value={m}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="space-y-2">
				<Label className="text-sm font-medium">Roles</Label>
				<RoleMultiSelect
					value={selectedRoles}
					onChange={setSelectedRoles}
					placeholder="Select roles..."
				/>
			</div>
			<div className="flex gap-2">
				<Button size="sm" variant="secondary" onClick={handleApply}>
					Apply
				</Button>
				{value && (
					<Button size="sm" variant="ghost" onClick={handleClear}>
						Clear
					</Button>
				)}
			</div>
		</div>
	);
}

function ManageUsersPage() {
	const { period: selectedPeriodId } = usePeriod();
	const [filters, setFilters] = useState<ShiftFilters>(DEFAULT_FILTERS);

	// Clear the "memory" when visiting the users list page
	// This ensures clicking the sidebar will go to this page next time
	useEffect(() => {
		clearManageUsersMemory();
	}, []);

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

	const activeFiltersCount = [
		filters.registeredShifts,
		filters.droppedShifts,
		filters.makeupShifts,
		filters.roles,
	].filter(Boolean).length;

	const hasActiveFilters =
		activeFiltersCount > 0 || debouncedSearch.trim().length > 0;

	const queryParams = useMemo(() => {
		return {
			periodId: selectedPeriodId ?? 0,
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
			registeredShiftsFilter: filters.registeredShifts ?? undefined,
			droppedShiftsFilter: filters.droppedShifts ?? undefined,
			makeupShiftsFilter: filters.makeupShifts ?? undefined,
			rolesFilter: filters.roles
				? {
						roleIds: filters.roles.roles.map((r) => r.id),
						mode: filters.roles.mode,
					}
				: undefined,
		};
	}, [selectedPeriodId, debouncedSearch, offset, pageSize, filters]);

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
						<TableFilters
							activeFiltersCount={activeFiltersCount}
							hasActiveFilters={hasActiveFilters}
							onReset={() => {
								setFilters(DEFAULT_FILTERS);
								resetToFirstPage();
							}}
						>
							<FilterField
								label="Registered Shifts"
								description="Filter by number of registered shifts"
							>
								<NumericFilterInput
									label=""
									value={filters.registeredShifts}
									onChange={(value) => {
										setFilters((prev) => ({
											...prev,
											registeredShifts: value,
										}));
										resetToFirstPage();
									}}
								/>
							</FilterField>
							<FilterField
								label="Dropped Shifts"
								description="Filter by number of dropped shifts"
							>
								<NumericFilterInput
									label=""
									value={filters.droppedShifts}
									onChange={(value) => {
										setFilters((prev) => ({
											...prev,
											droppedShifts: value,
										}));
										resetToFirstPage();
									}}
								/>
							</FilterField>
							<FilterField
								label="Makeup Shifts"
								description="Filter by number of makeup shifts"
							>
								<NumericFilterInput
									label=""
									value={filters.makeupShifts}
									onChange={(value) => {
										setFilters((prev) => ({
											...prev,
											makeupShifts: value,
										}));
										resetToFirstPage();
									}}
								/>
							</FilterField>
							<FilterField label="Roles" description="Filter by user roles">
								<RolesFilterInput
									value={filters.roles}
									onChange={(value) => {
										setFilters((prev) => ({
											...prev,
											roles: value,
										}));
										resetToFirstPage();
									}}
								/>
							</FilterField>
						</TableFilters>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.users}
						isLoading={isLoading}
						emptyMessage="No users found"
						emptyDescription={
							hasActiveFilters
								? "No users match the current filters. Try adjusting or clearing your filters."
								: "No users match the period's shift roles."
						}
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
