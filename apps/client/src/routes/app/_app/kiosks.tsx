import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCcw } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { generateColumns } from "@/components/kiosks/columns";
import { CreateDialog } from "@/components/kiosks/create-dialog";
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
import { Button } from "@/components/ui/button";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/_app/kiosks")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Devices />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["devices.list"];

function Devices() {
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

	const { data = { devices: [], count: 0 }, isLoading, refetch } = useQuery({
		queryKey: ["devices", queryParams],
		queryFn: async () => {
			return await trpc.devices.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns();
	const { totalPages } = usePaginationInfo({
		total: data.count,
		pageSize,
		offset,
		currentCount: data.devices.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Devices</PageTitle>
				<PageActions>
					<CreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search devices..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
						<Button
							variant="outline"
							size="icon"
							onClick={() => refetch()}
							title="Refresh"
						>
							<RefreshCcw className="h-4 w-4" />
						</Button>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.devices}
						isLoading={isLoading}
						emptyMessage="No devices found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.devices.length}
						total={data.count}
						itemName="devices"
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
