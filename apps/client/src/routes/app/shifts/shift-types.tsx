import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
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
import { usePeriod } from "@/components/providers/period-provider";
import {
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { generateColumns } from "@/components/shift-types/columns";
import { CreateShiftTypeSheet } from "@/components/shift-types/create-shift-type-sheet";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/shift-types")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ShiftTypesPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["shift_types.list"] as RequiredPermissions;

function ShiftTypesPage() {
	const { period: periodId } = usePeriod();
	const [createOpen, setCreateOpen] = React.useState(false);
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
			periodId: Number(periodId),
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		};
	}, [periodId, debouncedSearch, offset, pageSize]);

	const { data, isLoading } = useQuery({
		queryKey: ["shiftTypes", queryParams],
		queryFn: async () => trpc.shiftTypes.list.query(queryParams),
	});

	const currentUser = useCurrentUser();
	const canCreate =
		currentUser && checkPermissions(currentUser, ["shift_types.create"]);

	const { totalPages } = usePaginationInfo({
		total: data?.total ?? 0,
		pageSize,
		offset,
		currentCount: data?.shiftTypes?.length ?? 0,
	});

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

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
				<PageTitle>Shift Types</PageTitle>
				<PageActions>
					{canCreate && (
						<Button variant="outline" onClick={() => setCreateOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Shift Type
						</Button>
					)}
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search shift types..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
					</TableToolbar>

					<DataTable
						columns={generateColumns(currentUser)}
						data={data?.shiftTypes ?? []}
						isLoading={isLoading}
						emptyMessage="No shift types found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data?.shiftTypes?.length ?? 0}
						total={data?.total ?? 0}
						itemName="shift types"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>

				<CreateShiftTypeSheet
					periodId={Number(periodId)}
					open={createOpen}
					onOpenChange={setCreateOpen}
				/>
			</PageContent>
		</Page>
	);
}
