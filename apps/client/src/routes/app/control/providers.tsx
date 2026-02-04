import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2Icon, PlugZapIcon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { CreateProviderDialog } from "@/components/control/create-provider-dialog";
import { DeleteProviderDialog } from "@/components/control/delete-provider-dialog";
import { EditProviderDialog } from "@/components/control/edit-provider-dialog";
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
import {
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions as TRequiredPermissions } from "@/lib/permissions";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/control/providers")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ProvidersPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = ["control.providers.list"] as TRequiredPermissions;

type ControlProvider = {
	id: number;
	name: string;
	providerType: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	_count: {
		controlPoints: number;
	};
};

const PROVIDER_TYPE_LABELS: Record<string, string> = {
	GEORGIA_TECH_PLC: "Georgia Tech PLC",
};

function ProvidersPage() {
	const { user } = useAuth();
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
	} = useTableState();

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize]);

	const {
		data = { providers: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["control", "providers", queryParams],
		queryFn: async () => await trpc.control.providers.list.query(queryParams),
		retry: false,
	});

	const canCreate =
		user && checkPermissions(user, ["control.providers.create"]);
	const canUpdate =
		user && checkPermissions(user, ["control.providers.update"]);
	const canDelete =
		user && checkPermissions(user, ["control.providers.delete"]);

	const columns: ColumnDef<ControlProvider>[] = [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					<PlugZapIcon className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">{row.original.name}</span>
				</div>
			),
		},
		{
			accessorKey: "providerType",
			header: "Type",
			cell: ({ row }) => (
				<Badge variant="outline">
					{PROVIDER_TYPE_LABELS[row.original.providerType] ||
						row.original.providerType}
				</Badge>
			),
		},
		{
			accessorKey: "_count.controlPoints",
			header: "Control Points",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{row.original._count.controlPoints}
				</span>
			),
		},
		{
			accessorKey: "isActive",
			header: "Status",
			cell: ({ row }) =>
				row.original.isActive ? (
					<Badge className="bg-green-500">Active</Badge>
				) : (
					<Badge variant="secondary">Inactive</Badge>
				),
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => {
				if (!canUpdate && !canDelete) return null;
				return (
					<div className="flex items-center gap-1">
						{canUpdate && <EditProviderDialog provider={row.original} />}
						{canDelete && <DeleteProviderDialog provider={row.original} />}
					</div>
				);
			},
		},
	];

	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.providers.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Control Providers</PageTitle>
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
					{canCreate && <CreateProviderDialog />}
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
								placeholder="Search providers..."
							/>
						</TableSearchInput>
					</TableToolbar>
					<DataTable
						columns={columns}
						data={data.providers}
						isLoading={isLoading}
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.providers.length}
						total={data.total}
						itemName="providers"
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
