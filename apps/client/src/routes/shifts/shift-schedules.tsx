import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarDays,
	Clock,
	LayoutList,
	ListPlus,
	ListX,
	Plus,
} from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { BulkCreateShiftScheduleSheet } from "@/components/shift-schedules/bulk-create-shift-schedule-sheet";
import { BulkDeleteShiftScheduleSheet } from "@/components/shift-schedules/bulk-delete-shift-schedule-sheet";
import { generateColumns as generateShiftScheduleColumns } from "@/components/shift-schedules/columns";
import { CreateShiftScheduleSheet } from "@/components/shift-schedules/create-shift-schedule-sheet";
import { DataTable as ShiftScheduleDataTable } from "@/components/shift-schedules/data-table";
import { EditShiftScheduleSheet } from "@/components/shift-schedules/edit-shift-schedule-sheet";
import { ShiftScheduleTimelineView } from "@/components/shift-schedules/shift-schedule-timeline-view";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/shift-schedules")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ShiftSchedulesPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["shift_schedules.list"] as RequiredPermissions;

function ShiftSchedulesPage() {
	const { period: periodId } = usePeriod();
	const [view, setView] = React.useState<"timeline" | "table">("timeline");
	const [page, setPage] = React.useState(1);
	const [createOpen, setCreateOpen] = React.useState(false);
	const [bulkCreateOpen, setBulkCreateOpen] = React.useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
	const [editOpen, setEditOpen] = React.useState(false);
	const [selectedId, setSelectedId] = React.useState<number | null>(null);
	const limit = 10;

	const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
		queryKey: ["shiftSchedules", { periodId: Number(periodId), page }],
		queryFn: async () => {
			const result = await trpc.shiftSchedules.list.query({
				periodId: Number(periodId),
				limit,
				offset: (page - 1) * limit,
			});

			// For table view we need shift type names
			const shiftTypes = await trpc.shiftTypes.list.query({
				periodId: Number(periodId),
				limit: 100,
			});
			const shiftTypeMap = new Map(
				shiftTypes.shiftTypes.map((st) => [st.id, st.name]),
			);

			return {
				...result,
				shiftSchedules: result.shiftSchedules.map((s) => ({
					...s,
					periodId: Number(periodId),
					shiftTypeName: shiftTypeMap.get(s.shiftTypeId) ?? "Unknown",
				})),
			};
		},
		enabled: view === "table",
	});

	const { data: selectedData } = useQuery({
		queryKey: ["shiftSchedule", selectedId],
		queryFn: async () => {
			if (!selectedId) return null;
			const res = await trpc.shiftSchedules.get.query({ id: selectedId });
			if (!res.shiftSchedule) return null;
			return {
				shiftSchedule: {
					id: res.shiftSchedule.id,
					periodId: Number(periodId),
					shiftTypeId: res.shiftSchedule.shiftTypeId,
					slots: res.shiftSchedule.slots,
					dayOfWeek: res.shiftSchedule.dayOfWeek,
					startTime: res.shiftSchedule.startTime,
					endTime: res.shiftSchedule.endTime,
					createdAt: res.shiftSchedule.createdAt,
					updatedAt: res.shiftSchedule.updatedAt,
				},
			};
		},
		enabled: !!selectedId,
	});

	const currentUser = useCurrentUser();
	const canCreate =
		currentUser && checkPermissions(currentUser, ["shift_schedules.create"]);
	const canDelete =
		currentUser && checkPermissions(currentUser, ["shift_schedules.delete"]);

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	if (view === "table" && schedulesLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Shift Schedules</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Shift Schedules
						</CardTitle>
						<div className="flex items-center gap-2">
							<div className="flex items-center border rounded-md">
								<Button
									variant={view === "timeline" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setView("timeline")}
									className="rounded-r-none"
								>
									<CalendarDays className="h-4 w-4" />
								</Button>
								<Button
									variant={view === "table" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setView("table")}
									className="rounded-l-none"
								>
									<LayoutList className="h-4 w-4" />
								</Button>
							</div>
							{canCreate && (
								<Tooltip>
									<TooltipTrigger>
										<Button
											variant="outline"
											onClick={() => setCreateOpen(true)}
										>
											<Plus className="h-4 w-4" />
											<span className="hidden lg:inline">Create</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Create a new shift schedule</TooltipContent>
								</Tooltip>
							)}
							{canCreate && (
								<Tooltip>
									<TooltipTrigger>
										<Button
											variant="outline"
											onClick={() => setBulkCreateOpen(true)}
										>
											<ListPlus className="h-4 w-4" />
											<span className="hidden lg:inline">Bulk Create</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Bulk create shift schedules</TooltipContent>
								</Tooltip>
							)}
							{canDelete && (
								<Tooltip>
									<TooltipTrigger>
										<Button
											variant="destructive"
											onClick={() => setBulkDeleteOpen(true)}
										>
											<ListX className="h-4 w-4" />
											<span className="hidden lg:inline">Bulk Delete</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Bulk delete shift schedules</TooltipContent>
								</Tooltip>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{view === "timeline" ? (
						<ShiftScheduleTimelineView
							periodId={Number(periodId)}
							onScheduleClick={(id) => {
								setSelectedId(id);
								setEditOpen(true);
							}}
						/>
					) : (
						<>
							<ShiftScheduleDataTable
								columns={generateShiftScheduleColumns(currentUser)}
								data={schedulesData?.shiftSchedules ?? []}
								isLoading={schedulesLoading}
							/>
							{schedulesData && schedulesData.total > limit && (
								<TablePagination
									page={page}
									totalPages={Math.ceil(schedulesData.total / limit)}
									onPageChange={setPage}
									className="mt-4"
								/>
							)}
						</>
					)}
				</CardContent>
			</Card>

			<BulkCreateShiftScheduleSheet
				periodId={Number(periodId)}
				open={bulkCreateOpen}
				onOpenChange={setBulkCreateOpen}
			/>

			<CreateShiftScheduleSheet
				periodId={Number(periodId)}
				open={createOpen}
				onOpenChange={setCreateOpen}
			/>

			<BulkDeleteShiftScheduleSheet
				periodId={Number(periodId)}
				open={bulkDeleteOpen}
				onOpenChange={setBulkDeleteOpen}
			/>

			{selectedData?.shiftSchedule && (
				<EditShiftScheduleSheet
					open={editOpen}
					onOpenChange={setEditOpen}
					shiftSchedule={selectedData.shiftSchedule}
				/>
			)}
		</div>
	);
}
