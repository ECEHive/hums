import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, Pencil, Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { CreatePeriodSheet } from "@/components/periods/create-period-sheet";
import { DeleteDialog } from "@/components/periods/delete-dialog";
import { EditPeriodSheet } from "@/components/periods/edit-period-sheet";
import { PeriodsSelector } from "@/components/periods/periods-selector";
import { generateColumns } from "@/components/shift-types/columns";
import { CreateShiftTypeSheet } from "@/components/shift-types/create-shift-type-sheet";
import { DataTable } from "@/components/shift-types/data-table";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/periods_/$periodId")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <PeriodDetail />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["periods.list"];

function PeriodDetail() {
	const { periodId } = Route.useParams();
	const [createSheetOpen, setCreateSheetOpen] = React.useState(false);
	const [editSheetOpen, setEditSheetOpen] = React.useState(false);
	const [createShiftTypeSheetOpen, setCreateShiftTypeSheetOpen] =
		React.useState(false);
	const [shiftTypesPage, setShiftTypesPage] = React.useState(1);
	const shiftTypesLimit = 10;

	const { data: periodData, isLoading } = useQuery({
		queryKey: ["period", Number(periodId)],
		queryFn: async () => {
			return trpc.periods.get.query({ id: Number(periodId) });
		},
	});

	const { data: shiftTypesData, isLoading: shiftTypesLoading } = useQuery({
		queryKey: [
			"shiftTypes",
			{ periodId: Number(periodId), page: shiftTypesPage },
		],
		queryFn: async () => {
			return trpc.shiftTypes.list.query({
				periodId: Number(periodId),
				limit: shiftTypesLimit,
				offset: (shiftTypesPage - 1) * shiftTypesLimit,
			});
		},
	});

	const currentUser = useCurrentUser();
	const canEdit =
		currentUser && checkPermissions(currentUser, ["periods.update"]);
	const canDelete =
		currentUser && checkPermissions(currentUser, ["periods.delete"]);
	const canCreateShiftTypes =
		currentUser && checkPermissions(currentUser, ["shift_types.create"]);

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (!periodData?.period) {
		return (
			<div className="container p-6">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-3xl font-bold">Period Not Found</h1>
				</div>
				<p className="text-muted-foreground">
					The requested period could not be found.
				</p>
			</div>
		);
	}

	const period = periodData.period;

	// Convert period data for EditPeriodSheet
	const editablePeriod = {
		id: period.id,
		name: period.name,
		start: period.start.toISOString(),
		end: period.end.toISOString(),
		visibleStart: period.visibleStart?.toISOString() ?? null,
		visibleEnd: period.visibleEnd?.toISOString() ?? null,
		scheduleSignupStart: period.scheduleSignupStart?.toISOString() ?? null,
		scheduleSignupEnd: period.scheduleSignupEnd?.toISOString() ?? null,
		scheduleModifyStart: period.scheduleModifyStart?.toISOString() ?? null,
		scheduleModifyEnd: period.scheduleModifyEnd?.toISOString() ?? null,
	};

	return (
		<div className="container p-6">
			<div className="flex items-center justify-between mb-6">
				<PeriodsSelector
					currentPeriodId={Number(periodId)}
					onCreateNew={() => setCreateSheetOpen(true)}
				/>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Period Information
						</CardTitle>
						<div className="flex items-center gap-2">
							{canEdit && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setEditSheetOpen(true)}
									aria-label="Edit period"
								>
									<Pencil className="h-4 w-4" />
								</Button>
							)}
							{canDelete && (
								<DeleteDialog periodId={period.id} periodName={period.name} />
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Name
						</div>
						<div className="text-lg">{period.name}</div>
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">Period Dates</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Start Date
								</div>
								<div>{format(period.start, "PPP p")}</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									End Date
								</div>
								<div>{format(period.end, "PPP p")}</div>
							</div>
						</div>
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">Visibility Window</div>
						{period.visibleStart || period.visibleEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Visible Start
									</div>
									<div>
										{period.visibleStart
											? format(period.visibleStart, "PPP p")
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Visible End
									</div>
									<div>
										{period.visibleEnd
											? format(period.visibleEnd, "PPP p")
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No visibility window configured
							</div>
						)}
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">
							Schedule Signup Window
						</div>
						{period.scheduleSignupStart || period.scheduleSignupEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Signup Start
									</div>
									<div>
										{period.scheduleSignupStart
											? format(period.scheduleSignupStart, "PPP p")
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Signup End
									</div>
									<div>
										{period.scheduleSignupEnd
											? format(period.scheduleSignupEnd, "PPP p")
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No signup window configured
							</div>
						)}
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">
							Schedule Modification Window
						</div>
						{period.scheduleModifyStart || period.scheduleModifyEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Modify Start
									</div>
									<div>
										{period.scheduleModifyStart
											? format(period.scheduleModifyStart, "PPP p")
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Modify End
									</div>
									<div>
										{period.scheduleModifyEnd
											? format(period.scheduleModifyEnd, "PPP p")
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No modification window configured
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<Card className="mt-6">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Shift Types</CardTitle>
						{canCreateShiftTypes && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setCreateShiftTypeSheetOpen(true)}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Shift Type
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={generateColumns(currentUser)}
						data={shiftTypesData?.shiftTypes ?? []}
						isLoading={shiftTypesLoading}
					/>
					{shiftTypesData && shiftTypesData.total > shiftTypesLimit && (
						<TablePagination
							page={shiftTypesPage}
							totalPages={Math.ceil(shiftTypesData.total / shiftTypesLimit)}
							onPageChange={setShiftTypesPage}
							className="mt-4"
						/>
					)}
				</CardContent>
			</Card>

			<CreatePeriodSheet
				open={createSheetOpen}
				onOpenChange={setCreateSheetOpen}
			/>
			<EditPeriodSheet
				open={editSheetOpen}
				onOpenChange={setEditSheetOpen}
				period={editablePeriod}
			/>
			<CreateShiftTypeSheet
				periodId={Number(periodId)}
				open={createShiftTypeSheetOpen}
				onOpenChange={setCreateShiftTypeSheetOpen}
			/>
		</div>
	);
}
