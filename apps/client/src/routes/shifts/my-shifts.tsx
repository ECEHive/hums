import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { columns } from "@/components/my-shifts/columns";
import { DataTable } from "@/components/my-shifts/data-table";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/my-shifts")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <MyShifts />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = {
	any: ["shift_schedules.register", "shift_schedules.unregister"],
} as RequiredPermissions;

function MyShifts() {
	const { period: selectedPeriodId } = usePeriod();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const limit = pageSize;

	const offset = (page - 1) * limit;

	const { data: occurrencesData, isLoading: occurrencesLoading } = useQuery({
		queryKey: ["myShiftOccurrences", selectedPeriodId, page, limit],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftOccurrences.listMy.query({
				periodId: selectedPeriodId,
				limit,
				offset,
			});
		},
		enabled: !!selectedPeriodId,
	});

	const occurrences = occurrencesData?.occurrences ?? [];
	const total = occurrencesData?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<div className="container p-4 space-y-4">
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold">My Shifts</h1>
				<Link to="/shifts/attendance">
					<Button variant="outline">Shift History</Button>
				</Link>
			</div>

			<div className="flex justify-between sm:items-center sm:flex-row flex-col gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline">
							{pageSize} per page <ChevronDownIcon className="ml-2 size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{[10, 20, 50, 100].map((size) => (
							<DropdownMenuItem
								key={size}
								onClick={() => {
									setPageSize(size);
									setPage(1);
								}}
							>
								{size} per page
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{selectedPeriodId ? (
				<>
					<DataTable
						columns={columns}
						data={occurrences}
						isLoading={occurrencesLoading}
					/>
					{total > 0 && (
						<div className="flex flex-col justify-between items-center gap-2">
							<TablePagination
								page={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
							<p className="text-sm text-muted-foreground">
								Showing {offset + 1} - {offset + occurrences.length} of {total}
							</p>
						</div>
					)}
				</>
			) : (
				<div className="flex items-center justify-center py-12 border rounded-md">
					<p className="text-muted-foreground">
						Select a period to view your shifts
					</p>
				</div>
			)}
		</div>
	);
}
