import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { columns } from "@/components/my-shifts/columns";
import { DataTable } from "@/components/my-shifts/data-table";
import { PeriodSelector } from "@/components/periods/period-selector";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/my-shifts")({
	component: MyShifts,
});

export const permissions: string[] = [];

function MyShifts() {
	const [selectedPeriodId, setSelectedPeriodId] = React.useState<number | null>(
		null,
	);
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const limit = pageSize;

	const { data: currentPeriodData } = useQuery({
		queryKey: ["currentPeriod"],
		queryFn: async () => {
			return trpc.periods.getCurrent.query();
		},
	});

	React.useEffect(() => {
		if (currentPeriodData?.period && selectedPeriodId === null) {
			setSelectedPeriodId(currentPeriodData.period.id);
		}
	}, [currentPeriodData, selectedPeriodId]);

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

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">My Shifts</h1>

			<div className="flex justify-between sm:items-center sm:flex-row flex-col gap-2">
				<PeriodSelector
					selectedPeriodId={selectedPeriodId}
					onPeriodChange={(id) => {
						setSelectedPeriodId(id);
						setPage(1);
					}}
				/>
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
