import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertCircle,
	CalendarX,
	CheckCircle,
	Clock,
	Eye,
	LogOut,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
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
	FilterField,
	SearchInput,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";
import { formatDate, formatTime } from "@/lib/reports/utils";

export const Route = createFileRoute("/app/shifts/attendance-issues")({
	component: () => (
		<RequireShiftAccess>
			<AttendanceIssuesPage />
		</RequireShiftAccess>
	),
});

export const permissions = ["shift_attendances.excuse"] as RequiredPermissions;

type Issue = {
	id: number;
	userId: number;
	user: { id: number; name: string; username: string };
	status: string;
	isExcused: boolean;
	didArriveLate: boolean;
	didLeaveEarly: boolean;
	droppedNotes: string | null;
	excuseNotes: string | null;
	excusedBy: { id: number; name: string; username: string } | null;
	excusedAt: Date | null;
	timeIn: Date | null;
	timeOut: Date | null;
	isMakeup: boolean;
	shiftOccurrence: {
		id: number;
		timestamp: Date;
		shiftSchedule: {
			id: number;
			dayOfWeek: number;
			startTime: string;
			endTime: string;
			shiftType: { id: number; name: string };
		};
	};
};

function getIssueType(issue: Issue): string {
	if (issue.status === "dropped") return "Dropped";
	if (issue.status === "absent") return "Absent";
	if (issue.didArriveLate && issue.didLeaveEarly) return "Partial";
	if (issue.didArriveLate) return "Late";
	if (issue.didLeaveEarly) return "Left Early";
	return "Unknown";
}

function getIssueIcon(issue: Issue) {
	if (issue.status === "dropped") return <CalendarX className="h-4 w-4" />;
	if (issue.status === "absent") return <XCircle className="h-4 w-4" />;
	if (issue.didArriveLate) return <Clock className="h-4 w-4" />;
	if (issue.didLeaveEarly) return <LogOut className="h-4 w-4" />;
	return <AlertCircle className="h-4 w-4" />;
}

function getIssueBadgeVariant(
	issue: Issue,
): "destructive" | "secondary" | "outline" {
	if (issue.status === "absent" || issue.status === "dropped")
		return "destructive";
	return "secondary";
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AttendanceIssuesPage() {
	const { period: selectedPeriodId } = usePeriod();
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();

	// Filter state
	const [issueType, setIssueType] = useState<
		"all" | "dropped" | "absent" | "late" | "left_early"
	>("all");
	const [unexcusedOnly, setUnexcusedOnly] = useState(true);

	// Dialog state
	const [excuseDialogOpen, setExcuseDialogOpen] = useState(false);
	const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
	const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
	const [excuseNotes, setExcuseNotes] = useState("");

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
	} = useTableState({ initialPageSize: 20 });

	const hasPermission =
		currentUser && checkPermissions(currentUser, permissions);

	const activeFiltersCount =
		(issueType !== "all" ? 1 : 0) + (unexcusedOnly ? 0 : 1);

	const { data: issuesData, isLoading } = useQuery({
		queryKey: [
			"attendanceIssues",
			selectedPeriodId,
			issueType,
			unexcusedOnly,
			debouncedSearch,
			page,
			pageSize,
		],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftAttendances.listIssues.query({
				periodId: selectedPeriodId,
				issueType,
				unexcusedOnly,
				search: debouncedSearch || undefined,
				limit: pageSize,
				offset,
			});
		},
		enabled: !!selectedPeriodId && hasPermission,
	});

	const grantExcuseMutation = useMutation({
		mutationFn: async ({
			attendanceId,
			notes,
		}: {
			attendanceId: number;
			notes?: string;
		}) => {
			return trpc.shiftAttendances.grantExcuse.mutate({ attendanceId, notes });
		},
		onSuccess: () => {
			toast.success("The attendance has been excused successfully.");
			queryClient.invalidateQueries({ queryKey: ["attendanceIssues"] });
			setExcuseDialogOpen(false);
			setSelectedIssue(null);
			setExcuseNotes("");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to grant excuse");
		},
	});

	const revokeExcuseMutation = useMutation({
		mutationFn: async (attendanceId: number) => {
			return trpc.shiftAttendances.revokeExcuse.mutate({ attendanceId });
		},
		onSuccess: () => {
			toast.success("The excuse has been revoked.");
			queryClient.invalidateQueries({ queryKey: ["attendanceIssues"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to revoke excuse");
		},
	});

	const issues = issuesData?.issues ?? [];
	const total = issuesData?.total ?? 0;

	const { totalPages } = usePaginationInfo({
		total,
		pageSize,
		offset,
		currentCount: issues.length,
	});

	const openExcuseDialog = (issue: Issue) => {
		setSelectedIssue(issue);
		setExcuseNotes("");
		setExcuseDialogOpen(true);
	};

	const openDetailsDialog = (issue: Issue) => {
		setSelectedIssue(issue);
		setDetailsDialogOpen(true);
	};

	const handleGrantExcuse = () => {
		if (!selectedIssue) return;
		grantExcuseMutation.mutate({
			attendanceId: selectedIssue.id,
			notes: excuseNotes || undefined,
		});
	};

	const resetFilters = () => {
		setIssueType("all");
		setUnexcusedOnly(true);
		resetToFirstPage();
	};

	const columns: ColumnDef<Issue>[] = [
		{
			accessorKey: "user",
			header: "User",
			cell: ({ row }) => (
				<div>
					<div className="font-medium">{row.original.user.name}</div>
					<div className="text-sm text-muted-foreground">
						@{row.original.user.username}
					</div>
				</div>
			),
		},
		{
			accessorKey: "shiftOccurrence",
			header: "Shift",
			cell: ({ row }) => {
				const occ = row.original.shiftOccurrence;
				const schedule = occ.shiftSchedule;
				return (
					<div>
						<div className="font-medium">{schedule.shiftType.name}</div>
						<div className="text-sm text-muted-foreground">
							{dayNames[schedule.dayOfWeek]} {formatTime(schedule.startTime)} -{" "}
							{formatTime(schedule.endTime)}
						</div>
						<div className="text-xs text-muted-foreground">
							{formatDate(new Date(occ.timestamp))}
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "issue",
			header: "Issue",
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					<Badge variant={getIssueBadgeVariant(row.original)}>
						<span className="flex items-center gap-1">
							{getIssueIcon(row.original)}
							{getIssueType(row.original)}
						</span>
					</Badge>
					{row.original.isMakeup && (
						<Badge variant="outline" className="text-xs">
							Makeup
						</Badge>
					)}
				</div>
			),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const issue = row.original;
				if (issue.isExcused) {
					return (
						<Badge>
							<CheckCircle className="h-3 w-3 mr-1" />
							Excused
						</Badge>
					);
				}
				return (
					<Badge variant="outline">
						<AlertCircle className="h-3 w-3 mr-1" />
						Unexcused
					</Badge>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const issue = row.original;
				return (
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => openDetailsDialog(issue)}
								>
									<Eye className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>View details</TooltipContent>
						</Tooltip>

						{issue.isExcused ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => revokeExcuseMutation.mutate(issue.id)}
										disabled={revokeExcuseMutation.isPending}
									>
										<XCircle className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Revoke excuse</TooltipContent>
							</Tooltip>
						) : (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => openExcuseDialog(issue)}
									>
										<ShieldCheck className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Grant excuse</TooltipContent>
							</Tooltip>
						)}
					</div>
				);
			},
		},
	];

	if (!hasPermission) {
		return <MissingPermissions />;
	}

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Attendance Issues</PageTitle>
				<PageActions>
					<div className="text-sm text-muted-foreground">
						Review and excuse attendance issues
					</div>
				</PageActions>
			</PageHeader>

			<PageContent>
				<Card>
					<CardHeader>
						<CardTitle>Attendance Issues</CardTitle>
						<CardDescription>
							Review dropped shifts, absences, late arrivals, and early
							departures. Grant excuses to give users full attendance credit.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<TableContainer>
							<TableToolbar>
								<TableSearchInput>
									<SearchInput
										placeholder="Search users..."
										value={search}
										onChange={(value) => {
											setSearch(value);
											resetToFirstPage();
										}}
									/>
								</TableSearchInput>

								<TableFilters
									activeFiltersCount={activeFiltersCount}
									hasActiveFilters={
										issueType !== "all" || unexcusedOnly === false
									}
									onReset={resetFilters}
								>
									<FilterField
										label="Issue Type"
										description="Filter by type of attendance issue"
									>
										<Select
											value={issueType}
											onValueChange={(value) => {
												setIssueType(
													value as
														| "all"
														| "dropped"
														| "absent"
														| "late"
														| "left_early",
												);
												resetToFirstPage();
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Issue type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Issues</SelectItem>
												<SelectItem value="dropped">Dropped</SelectItem>
												<SelectItem value="absent">Absent</SelectItem>
												<SelectItem value="late">Late</SelectItem>
												<SelectItem value="left_early">Left Early</SelectItem>
											</SelectContent>
										</Select>
									</FilterField>

									<FilterField
										label="Show Excused"
										description="Include already excused attendance records"
									>
										<div className="flex items-center gap-2">
											<Switch
												checked={!unexcusedOnly}
												onCheckedChange={(checked) => {
													setUnexcusedOnly(!checked);
													resetToFirstPage();
												}}
											/>
											<span className="text-sm text-muted-foreground">
												{unexcusedOnly
													? "Showing unexcused only"
													: "Showing all"}
											</span>
										</div>
									</FilterField>
								</TableFilters>
							</TableToolbar>

							<DataTable
								columns={columns}
								data={issues}
								isLoading={isLoading}
								emptyMessage="No attendance issues found"
								emptyDescription="All attendance records are in good standing"
							/>

							{total > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={issues.length}
									total={total}
									itemName="issues"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										resetToFirstPage();
									}}
									pageSizeOptions={[10, 20, 50, 100]}
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>

				{/* Details Dialog */}
				<Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>Attendance Details</DialogTitle>
							<DialogDescription>
								Full details for this attendance record
							</DialogDescription>
						</DialogHeader>

						{selectedIssue && (
							<div className="space-y-4">
								{/* User Info */}
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-1">
										User
									</h4>
									<div className="font-medium">{selectedIssue.user.name}</div>
									<div className="text-sm text-muted-foreground">
										@{selectedIssue.user.username}
									</div>
								</div>

								<Separator />

								{/* Shift Info */}
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-1">
										Shift
									</h4>
									<div className="font-medium">
										{selectedIssue.shiftOccurrence.shiftSchedule.shiftType.name}
									</div>
									<div className="text-sm text-muted-foreground">
										{
											dayNames[
												selectedIssue.shiftOccurrence.shiftSchedule.dayOfWeek
											]
										}{" "}
										{formatTime(
											selectedIssue.shiftOccurrence.shiftSchedule.startTime,
										)}{" "}
										-{" "}
										{formatTime(
											selectedIssue.shiftOccurrence.shiftSchedule.endTime,
										)}
									</div>
									<div className="text-sm text-muted-foreground">
										{formatDate(
											new Date(selectedIssue.shiftOccurrence.timestamp),
										)}
									</div>
									{selectedIssue.isMakeup && (
										<Badge variant="outline" className="mt-1">
											Makeup Shift
										</Badge>
									)}
								</div>

								<Separator />

								{/* Issue Info */}
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-1">
										Issue
									</h4>
									<div className="flex items-center gap-2">
										<Badge variant={getIssueBadgeVariant(selectedIssue)}>
											<span className="flex items-center gap-1">
												{getIssueIcon(selectedIssue)}
												{getIssueType(selectedIssue)}
											</span>
										</Badge>
										{selectedIssue.isExcused ? (
											<Badge>
												<CheckCircle className="h-3 w-3 mr-1" />
												Excused
											</Badge>
										) : (
											<Badge variant="outline">
												<AlertCircle className="h-3 w-3 mr-1" />
												Unexcused
											</Badge>
										)}
									</div>
								</div>

								{/* Time In/Out */}
								{(selectedIssue.timeIn || selectedIssue.timeOut) && (
									<>
										<Separator />
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-1">
												Check In/Out
											</h4>
											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">
														Time In:{" "}
													</span>
													{selectedIssue.timeIn
														? new Date(
																selectedIssue.timeIn,
															).toLocaleTimeString()
														: "—"}
												</div>
												<div>
													<span className="text-muted-foreground">
														Time Out:{" "}
													</span>
													{selectedIssue.timeOut
														? new Date(
																selectedIssue.timeOut,
															).toLocaleTimeString()
														: "—"}
												</div>
											</div>
											<div className="flex gap-2 mt-2">
												{selectedIssue.didArriveLate && (
													<Badge variant="secondary">
														<Clock className="h-3 w-3 mr-1" />
														Arrived Late
													</Badge>
												)}
												{selectedIssue.didLeaveEarly && (
													<Badge variant="secondary">
														<LogOut className="h-3 w-3 mr-1" />
														Left Early
													</Badge>
												)}
											</div>
										</div>
									</>
								)}

								{/* User's Notes (dropped reason) */}
								{selectedIssue.droppedNotes && (
									<>
										<Separator />
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-1">
												User's Reason
											</h4>
											<div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
												{selectedIssue.droppedNotes}
											</div>
										</div>
									</>
								)}

								{/* Excuse Info */}
								{selectedIssue.isExcused && (
									<>
										<Separator />
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-1">
												Excuse Information
											</h4>
											{selectedIssue.excusedBy && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Excused by:{" "}
													</span>
													{selectedIssue.excusedBy.name}
												</div>
											)}
											{selectedIssue.excusedAt && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Excused on:{" "}
													</span>
													{new Date(
														selectedIssue.excusedAt,
													).toLocaleDateString()}{" "}
													at{" "}
													{new Date(
														selectedIssue.excusedAt,
													).toLocaleTimeString()}
												</div>
											)}
											{selectedIssue.excuseNotes && (
												<div className="mt-2">
													<span className="text-sm text-muted-foreground">
														Notes:
													</span>
													<div className="rounded-md bg-muted p-3 text-sm mt-1 whitespace-pre-wrap">
														{selectedIssue.excuseNotes}
													</div>
												</div>
											)}
										</div>
									</>
								)}
							</div>
						)}

						<DialogFooter>
							{selectedIssue && !selectedIssue.isExcused && (
								<Button
									onClick={() => {
										setDetailsDialogOpen(false);
										openExcuseDialog(selectedIssue);
									}}
								>
									<ShieldCheck className="h-4 w-4 mr-2" />
									Grant Excuse
								</Button>
							)}
							<Button
								variant="outline"
								onClick={() => setDetailsDialogOpen(false)}
							>
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Excuse Dialog */}
				<Dialog open={excuseDialogOpen} onOpenChange={setExcuseDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Grant Excuse</DialogTitle>
							<DialogDescription>
								Granting an excuse will give this user full attendance credit
								for this shift.
							</DialogDescription>
						</DialogHeader>

						{selectedIssue && (
							<div className="space-y-4">
								<div className="rounded-lg border p-4 bg-muted/50">
									<div className="font-medium">{selectedIssue.user.name}</div>
									<div className="text-sm text-muted-foreground">
										{selectedIssue.shiftOccurrence.shiftSchedule.shiftType.name}{" "}
										on{" "}
										{formatDate(
											new Date(selectedIssue.shiftOccurrence.timestamp),
										)}
									</div>
									<div className="mt-2">
										<Badge variant={getIssueBadgeVariant(selectedIssue)}>
											{getIssueType(selectedIssue)}
										</Badge>
									</div>
									{selectedIssue.droppedNotes && (
										<div className="mt-2 text-sm">
											<span className="font-medium">User's reason: </span>
											<span className="text-muted-foreground">
												{selectedIssue.droppedNotes}
											</span>
										</div>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="excuse-notes">Notes (optional)</Label>
									<Textarea
										id="excuse-notes"
										placeholder="Reason for excusing this attendance..."
										value={excuseNotes}
										onChange={(e) => setExcuseNotes(e.target.value)}
									/>
								</div>
							</div>
						)}

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setExcuseDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleGrantExcuse}
								disabled={grantExcuseMutation.isPending}
							>
								{grantExcuseMutation.isPending ? (
									<Spinner className="h-4 w-4 mr-2" />
								) : (
									<ShieldCheck className="h-4 w-4 mr-2" />
								)}
								Grant Excuse
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</PageContent>
		</Page>
	);
}
