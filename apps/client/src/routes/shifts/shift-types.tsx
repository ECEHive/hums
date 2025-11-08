import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { generateColumns } from "@/components/shift-types/columns";
import { CreateShiftTypeSheet } from "@/components/shift-types/create-shift-type-sheet";
import { DataTable } from "@/components/shift-types/data-table";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/shift-types")({
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
	const [page, setPage] = React.useState(1);
	const limit = 10;

	const { data, isLoading } = useQuery({
		queryKey: ["shiftTypes", { periodId: Number(periodId), page }],
		queryFn: async () =>
			trpc.shiftTypes.list.query({
				periodId: Number(periodId),
				limit,
				offset: (page - 1) * limit,
			}),
	});

	const currentUser = useCurrentUser();
	const canCreate =
		currentUser && checkPermissions(currentUser, ["shift_types.create"]);

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Shift Types</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Shift Types</CardTitle>
						<div>
							{canCreate && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCreateOpen(true)}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Shift Type
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={generateColumns(currentUser)}
						data={data?.shiftTypes ?? []}
						isLoading={isLoading}
					/>
					{data && data.total > limit && (
						<TablePagination
							page={page}
							totalPages={Math.ceil(data.total / limit)}
							onPageChange={setPage}
							className="mt-4"
						/>
					)}
				</CardContent>
			</Card>

			<CreateShiftTypeSheet
				periodId={Number(periodId)}
				open={createOpen}
				onOpenChange={setCreateOpen}
			/>
		</div>
	);
}
