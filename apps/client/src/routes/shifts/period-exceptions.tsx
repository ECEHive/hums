import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { generateColumns } from "@/components/period-exceptions/columns";
import { CreatePeriodExceptionSheet } from "@/components/period-exceptions/create-period-exception-sheet";
import { DataTable } from "@/components/period-exceptions/data-table";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "@/lib/debounce";
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
	const [page, setPage] = React.useState(1);
	const [search, setSearch] = React.useState("");
	const debouncedSearch = useDebounce(search, 300);
	const limit = 10;

	React.useEffect(() => {
		setPage(1);
	}, [periodId]);

	const hasPeriod = periodId !== null;

	const { data, isLoading } = useQuery({
		queryKey: [
			"periodExceptions",
			{ periodId, page, search: debouncedSearch.trim() || undefined },
		],
		enabled: hasPeriod,
		queryFn: async () => {
			if (periodId === null) {
				return { periodExceptions: [], total: 0 };
			}

			return trpc.periodExceptions.list.query({
				periodId: Number(periodId),
				limit,
				offset: (page - 1) * limit,
				search:
					debouncedSearch.trim().length > 0
						? debouncedSearch.trim()
						: undefined,
			});
		},
	});

	const canCreate = checkPermissions(currentUser, ["period_exceptions.create"]);

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

	const rows = data?.periodExceptions ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / limit));

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Period Exceptions</h1>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<Input
							placeholder="Search by name..."
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
							className="w-full sm:w-64"
						/>
						{canCreate && (
							<Button onClick={() => setCreateOpen(true)}>
								<Plus className="mr-2 h-4 w-4" />
								New Exception
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={generateColumns(currentUser)}
						data={rows}
						isLoading={isLoading}
						emptyMessage="No period exceptions found for this period."
					/>
					{total > limit && (
						<TablePagination
							page={page}
							totalPages={totalPages}
							onPageChange={setPage}
							className="mt-4"
						/>
					)}
				</CardContent>
			</Card>

			{canCreate && (
				<CreatePeriodExceptionSheet
					periodId={Number(periodId)}
					open={createOpen}
					onOpenChange={setCreateOpen}
				/>
			)}
		</div>
	);
}
