import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableActions,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { generateColumns } from "@/components/period-exceptions/columns";
import { CreatePeriodExceptionSheet } from "@/components/period-exceptions/create-period-exception-sheet";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { usePeriod } from "@/components/providers/period-provider";
import {
	DataTable,
	PageSizeSelect,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const permissions = ["period_exceptions.list"] as RequiredPermissions;

export const Route = createFileRoute("/shifts/period-exceptions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <PeriodExceptionsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

function PeriodExceptionsPage() {
	const { period: periodId } = usePeriod();
	const currentUser = useCurrentUser();
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

	React.useEffect(() => {
		resetToFirstPage();
	}, [periodId, resetToFirstPage]);

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
		queryKey: ["periodExceptions", queryParams],
		enabled: periodId !== null,
		queryFn: async () => trpc.periodExceptions.list.query(queryParams),
	});

	const canCreate = checkPermissions(currentUser, ["period_exceptions.create"]);

	const { totalPages } = usePaginationInfo({
		total: data?.total ?? 0,
		pageSize,
		offset,
		currentCount: data?.periodExceptions?.length ?? 0,
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
				<PageTitle>Period Exceptions</PageTitle>
				{canCreate && (
					<PageActions>
						<Button onClick={() => setCreateOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							New Exception
						</Button>
					</PageActions>
				)}
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search exceptions..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
						<TableActions>
							<PageSizeSelect
								pageSize={pageSize}
								onPageSizeChange={(size) => {
									setPageSize(size);
									resetToFirstPage();
								}}
							/>
						</TableActions>
					</TableToolbar>

					<DataTable
						columns={generateColumns(currentUser)}
						data={data?.periodExceptions ?? []}
						isLoading={isLoading}
						emptyMessage="No period exceptions found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data?.periodExceptions?.length ?? 0}
						total={data?.total ?? 0}
						itemName="exceptions"
					/>
				</TableContainer>

				{canCreate && (
					<CreatePeriodExceptionSheet
						periodId={Number(periodId)}
						open={createOpen}
						onOpenChange={setCreateOpen}
					/>
				)}
			</PageContent>
		</Page>
	);
}
