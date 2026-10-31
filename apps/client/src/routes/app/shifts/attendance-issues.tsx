import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertCircle,
	CalendarX,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Clock,
	Eye,
	LogOut,
	ShieldAlert,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
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
	DateRangeSelector,
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { usePersistedTableState } from "@/hooks/use-persisted-table-state";
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

/**
 * Excuse status values for attendance issues:
 * - pending: Issue has not been reviewed (reviewedAt is null, isExcused is false)
 * - excused: Issue has been excused (isExcused is true)
 * - unexcused: Issue has been reviewed and marked as unexcused (reviewedAt is set, isExcused is false)
 */
type ExcuseStatus = "pending" | "excused" | "unexcused";

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
	reviewedBy: { id: number; name: string; username: string } | null;
	reviewedAt: Date | null;
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

/**
 * Get the excuse status of an issue based on its review state.
 */
function getExcuseStatus(issue: Issue): ExcuseStatus {
	// Excused issues are always shown as excused
	if (issue.isExcused) return "excused";
	// Unreviewed dropped shifts are considered pending
	if (issue.status === "dropped" && !issue.reviewedAt) return "pending";
	// All other issues are considered unexcused, but can be still be excused from the unexcused list
	return "unexcused";
}

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

type AttendanceIssuesFilters = {
	issueType: "all" | "dropped" | "absent" | "late" | "left_early";
	excuseStatus: ExcuseStatus[];
	dateRange: [Date | undefined, Date | undefined];
};

const DEFAULT_FILTERS: AttendanceIssuesFilters = {
	issueType: "all",
	excuseStatus: ["pending"],
	dateRange: [undefined, undefined],
};

function AttendanceIssuesPage() {
	const { period: selectedPeriodId } = usePeriod();
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();

	// Combined filter and table state with persistence
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		filters,
		setFilters,
		resetToFirstPage,
	} = usePersistedTableState<AttendanceIssuesFilters>({
		pageKey: "attendance-issues",
		defaultFilters: DEFAULT_FILTERS,
		initialPageSize: 20,
	});

	// Extract filter values with defaults
	const issueType = filters?.issueType ?? DEFAULT_FILTERS.issueType;
	const excuseStatus = filters?.excuseStatus ?? DEFAULT_FILTERS.excuseStatus;
	// dateRange needs special handling: when restored from localStorage, dates are serialized as strings
	const rawDateRange = filters?.dateRange ?? DEFAULT_FILTERS.dateRange;
	const dateRange: [Date | undefined, Date | undefined] = [
		rawDateRange[0] ? new Date(rawDateRange[0]) : undefined,
		rawDateRange[1] ? new Date(rawDateRange[1]) : undefined,
	];

	// Helper to update individual filter fields
	const setIssueType = (value: AttendanceIssuesFilters["issueType"]) => {
		setFilters((prev) => ({ ...DEFAULT_FILTERS, ...prev, issueType: value }));
	};

	const setExcuseStatus = (value: ExcuseStatus[]) => {
		// Ensure at least one status is always selected
		if (value.length === 0) return;
		setFilters((prev) => ({
			...DEFAULT_FILTERS,
			...prev,
			excuseStatus: value,
		}));
	};

	const setDateRange = (value: [Date | undefined, Date | undefined]) => {
		setFilters((prev) => ({
			...DEFAULT_FILTERS,
			...prev,
			dateRange: value,
		}));
	};

	// Dialog state
	const [excuseDialogOpen, setExcuseDialogOpen] = useState(false);
	const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
	const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
	const [excuseNotes, setExcuseNotes] = useState("");
	// After handling an issue from the details dialog, move on to the next one
	// once the list has refreshed. requestedAt makes sure we use fresh data.
	const [advanceAfter, setAdvanceAfter] = useState<{
		id: number;
		index: number;
		requestedAt: number;
	} | null>(null);
	// When navigating across pages, which issue to select once the page loads
	const [selectOnLoad, setSelectOnLoad] = useState<"first" | "last" | null>(
		null,
	);
	// Set when "Grant Excuse" in the details dialog opens the notes dialog
	const grantFromDetailsRef = useRef<{ id: number; index: number } | null>(
		null,
	);

	const hasPermission =
		!!currentUser && checkPermissions(currentUser, permissions);

	// Count active filters (issueType !== all counts as 1, non-default excuseStatus counts as 1, date range counts as 1)
	const isDefaultExcuseStatus =
		excuseStatus.length === 1 && excuseStatus[0] === "pending";
	const hasDateFilter =
		dateRange[0] !== undefined || dateRange[1] !== undefined;
	const activeFiltersCount =
		(issueType !== "all" ? 1 : 0) +
		(isDefaultExcuseStatus ? 0 : 1) +
		(hasDateFilter ? 1 : 0);

	const {
		data: issuesData,
		isLoading,
		isFetching,
		dataUpdatedAt,
	} = useQuery({
		queryKey: [
			"attendanceIssues",
			selectedPeriodId,
			issueType,
			excuseStatus,
			dateRange,
			debouncedSearch,
			page,
			pageSize,
		],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftAttendances.listIssues.query({
				periodId: selectedPeriodId,
				issueType,
				excuseStatus,
				startDate: dateRange[0],
				endDate: dateRange[1],
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
			const fromDetails = grantFromDetailsRef.current;
			grantFromDetailsRef.current = null;
			if (fromDetails) {
				setAdvanceAfter({ ...fromDetails, requestedAt: Date.now() });
			} else {
				setSelectedIssue(null);
			}
			queryClient.invalidateQueries({ queryKey: ["attendanceIssues"] });
			setExcuseDialogOpen(false);
			setExcuseNotes("");
		},
		onError: (error) => {
			grantFromDetailsRef.current = null;
			setAdvanceAfter(null);
			toast.error(error.message || "Failed to grant excuse");
		},
	});

	const revokeExcuseMutation = useMutation({
		mutationFn: async (attendanceId: number) => {
			return trpc.shiftAttendances.revokeExcuse.mutate({ attendanceId });
		},
		onSuccess: () => {
			toast.success("The excuse has been revoked. Issue is now pending.");
			queryClient.invalidateQueries({ queryKey: ["attendanceIssues"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to revoke excuse");
		},
	});

	const markReviewedMutation = useMutation({
		mutationFn: async (attendanceId: number) => {
			return trpc.shiftAttendances.markReviewed.mutate({ attendanceId });
		},
		onSuccess: () => {
			toast.success("The issue has been marked as unexcused.");
			queryClient.invalidateQueries({ queryKey: ["attendanceIssues"] });
		},
		onError: (error) => {
			setAdvanceAfter(null);
			toast.error(error.message || "Failed to mark as reviewed");
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

	// Position of the open issue in the current page of results
	const selectedIndex = selectedIssue
		? issues.findIndex((i) => i.id === selectedIssue.id)
		: -1;
	const canGoPrevious = selectedIndex > 0 || page > 1;
	const canGoNext =
		(selectedIndex !== -1 && selectedIndex < issues.length - 1) ||
		page < totalPages;

	const goToIssue = (index: number) => {
		if (index >= 0 && index < issues.length) {
			setSelectedIssue(issues[index]);
		} else if (index >= issues.length && page < totalPages) {
			setSelectOnLoad("first");
			setPage(page + 1);
		} else if (index < 0 && page > 1) {
			setSelectOnLoad("last");
			setPage(page - 1);
		}
	};

	// Select the first/last issue after moving to another page
	useEffect(() => {
		if (!selectOnLoad || isFetching || issues.length === 0) return;
		setSelectedIssue(
			selectOnLoad === "first" ? issues[0] : issues[issues.length - 1],
		);
		setSelectOnLoad(null);
	}, [selectOnLoad, isFetching, issues]);

	// After handling an issue, show the next one from the refreshed list.
	// With the default "pending" filter the handled issue drops out of the
	// list, so the next issue slides into its spot.
	useEffect(() => {
		if (!advanceAfter || isFetching) return;
		if (dataUpdatedAt < advanceAfter.requestedAt) return;
		setAdvanceAfter(null);

		const { id, index } = advanceAfter;
		const next = issues[index]?.id === id ? issues[index + 1] : issues[index];
		if (next) {
			setSelectedIssue(next);
			setDetailsDialogOpen(true);
		} else if (issues[index]?.id === id && page < totalPages) {
			setSelectOnLoad("first");
			setPage(page + 1);
			setDetailsDialogOpen(true);
		} else {
			setSelectedIssue(null);
			setDetailsDialogOpen(false);
			toast.info("No more issues to review.");
		}
	}, [
		advanceAfter,
		isFetching,
		dataUpdatedAt,
		issues,
		page,
		totalPages,
		setPage,
	]);

	const openExcuseDialog = (issue: Issue) => {
		setSelectedIssue(issue);
		setExcuseNotes("");
		setExcuseDialogOpen(true);
	};

	const handleGrantExcuseClick = (
		issue: Issue,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		if (event.shiftKey) {
			grantExcuseMutation.mutate({ attendanceId: issue.id });
			return;
		}

		openExcuseDialog(issue);
	};

	const handleMarkUnexcusedClick = (
		issue: Issue,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		if (event.shiftKey) {
			markReviewedMutation.mutate(issue.id);
			return;
		}

		markReviewedMutation.mutate(issue.id);
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
		setFilters(DEFAULT_FILTERS);
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
			accessorKey: "excuseStatus",
			header: "Review Status",
			cell: ({ row }) => {
				const issue = row.original;
				const status = getExcuseStatus(issue);

				if (status === "excused") {
					return (
						<Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100">
							<CheckCircle className="h-3 w-3 mr-1" />
							Excused
						</Badge>
					);
				}
				if (status === "unexcused") {
					return (
						<Badge variant="destructive">
							<XCircle className="h-3 w-3 mr-1" />
							Unexcused
						</Badge>
					);
				}
				// pending
				return (
					<Badge
						variant="outline"
						className="border-amber-500 text-amber-600 dark:text-amber-400"
					>
						<AlertCircle className="h-3 w-3 mr-1" />
						Pending Review
					</Badge>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const issue = row.original;
				const status = getExcuseStatus(issue);
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

						{status === "excused" ? (
							// Excused: Can revoke
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
								<TooltipContent>
									Revoke excuse (returns to pending)
								</TooltipContent>
							</Tooltip>
						) : status === "pending" ? (
							// Pending: Can excuse or mark as unexcused
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											onClick={(event) => handleGrantExcuseClick(issue, event)}
										>
											<ShieldCheck className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										Grant excuse (Shift-click to bypass confirmation)
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											onClick={(event) =>
												handleMarkUnexcusedClick(issue, event)
											}
											disabled={markReviewedMutation.isPending}
										>
											<ShieldAlert className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Mark as unexcused</TooltipContent>
								</Tooltip>
							</>
						) : (
							// Unexcused: Can grant excuse
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={(event) => handleGrantExcuseClick(issue, event)}
									>
										<ShieldCheck className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									Grant excuse (Shift-click to bypass confirmation)
								</TooltipContent>
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
										issueType !== "all" ||
										!isDefaultExcuseStatus ||
										hasDateFilter
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
										label="Review Status"
										description="Filter by review/excuse status"
									>
										<ToggleGroup
											type="multiple"
											variant="outline"
											value={excuseStatus}
											onValueChange={(value) => {
												setExcuseStatus(value as ExcuseStatus[]);
												resetToFirstPage();
											}}
											className="justify-start"
										>
											<ToggleGroupItem value="pending" className="text-xs">
												<AlertCircle className="h-3 w-3 mr-1" />
												Pending
											</ToggleGroupItem>
											<ToggleGroupItem value="excused" className="text-xs">
												<CheckCircle className="h-3 w-3 mr-1" />
												Excused
											</ToggleGroupItem>
											<ToggleGroupItem value="unexcused" className="text-xs">
												<XCircle className="h-3 w-3 mr-1" />
												Unexcused
											</ToggleGroupItem>
										</ToggleGroup>
									</FilterField>

									<FilterField
										label="Date Range"
										description="Filter by shift occurrence date"
									>
										<DateRangeSelector
											value={dateRange}
											onChange={(
												value: [Date | undefined, Date | undefined],
											) => {
												setDateRange(value);
												resetToFirstPage();
											}}
										/>
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
					<DialogContent
						className="max-w-lg"
						onKeyDown={(event) => {
							if (event.key === "ArrowLeft" && canGoPrevious) {
								event.preventDefault();
								goToIssue(selectedIndex - 1);
							} else if (event.key === "ArrowRight" && canGoNext) {
								event.preventDefault();
								goToIssue(selectedIndex + 1);
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>Attendance Details</DialogTitle>
							<DialogDescription>
								Full details for this attendance record
							</DialogDescription>
						</DialogHeader>

						{/* Previous / next issue */}
						<div className="flex items-center justify-between">
							<Button
								variant="outline"
								size="sm"
								onClick={() => goToIssue(selectedIndex - 1)}
								disabled={!canGoPrevious || isFetching}
							>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Previous
							</Button>
							<span className="text-sm text-muted-foreground">
								{selectedIndex === -1
									? ""
									: `${offset + selectedIndex + 1} of ${total}`}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => goToIssue(selectedIndex + 1)}
								disabled={!canGoNext || isFetching}
							>
								Next
								<ChevronRight className="h-4 w-4 ml-1" />
							</Button>
						</div>

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
									<div className="flex items-center gap-2 flex-wrap">
										<Badge variant={getIssueBadgeVariant(selectedIssue)}>
											<span className="flex items-center gap-1">
												{getIssueIcon(selectedIssue)}
												{getIssueType(selectedIssue)}
											</span>
										</Badge>
										{(() => {
											const status = getExcuseStatus(selectedIssue);
											if (status === "excused") {
												return (
													<Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100">
														<CheckCircle className="h-3 w-3 mr-1" />
														Excused
													</Badge>
												);
											}
											if (status === "unexcused") {
												return (
													<Badge variant="destructive">
														<XCircle className="h-3 w-3 mr-1" />
														Unexcused
													</Badge>
												);
											}
											return (
												<Badge
													variant="outline"
													className="border-amber-500 text-amber-600 dark:text-amber-400"
												>
													<AlertCircle className="h-3 w-3 mr-1" />
													Pending Review
												</Badge>
											);
										})()}
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

								{/* Excuse Info - Show when excused */}
								{selectedIssue.isExcused && (
									<>
										<Separator />
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-1">
												Excuse Information
											</h4>
											{selectedIssue.reviewedBy && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Excused by:{" "}
													</span>
													{selectedIssue.reviewedBy.name}
												</div>
											)}
											{selectedIssue.reviewedAt && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Excused on:{" "}
													</span>
													{new Date(
														selectedIssue.reviewedAt,
													).toLocaleDateString()}{" "}
													at{" "}
													{new Date(
														selectedIssue.reviewedAt,
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

								{/* Review Info - Show when reviewed but not excused (unexcused) */}
								{!selectedIssue.isExcused && selectedIssue.reviewedAt && (
									<>
										<Separator />
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-1">
												Review Information
											</h4>
											{selectedIssue.reviewedBy && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Marked unexcused by:{" "}
													</span>
													{selectedIssue.reviewedBy.name}
												</div>
											)}
											{selectedIssue.reviewedAt && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Reviewed on:{" "}
													</span>
													{new Date(
														selectedIssue.reviewedAt,
													).toLocaleDateString()}{" "}
													at{" "}
													{new Date(
														selectedIssue.reviewedAt,
													).toLocaleTimeString()}
												</div>
											)}
										</div>
									</>
								)}
							</div>
						)}

						<DialogFooter>
							{selectedIssue &&
								getExcuseStatus(selectedIssue) === "pending" && (
									<>
										<Button
											variant="outline"
											onClick={(event) => {
												setAdvanceAfter({
													id: selectedIssue.id,
													index: selectedIndex,
													requestedAt: Date.now(),
												});
												handleMarkUnexcusedClick(selectedIssue, event);
											}}
											disabled={markReviewedMutation.isPending}
										>
											<ShieldAlert className="h-4 w-4 mr-2" />
											Mark Unexcused
										</Button>
										<Button
											onClick={(event) => {
												grantFromDetailsRef.current = {
													id: selectedIssue.id,
													index: selectedIndex,
												};
												setDetailsDialogOpen(false);
												handleGrantExcuseClick(selectedIssue, event);
											}}
										>
											<ShieldCheck className="h-4 w-4 mr-2" />
											Grant Excuse
										</Button>
									</>
								)}
							{selectedIssue &&
								getExcuseStatus(selectedIssue) === "unexcused" && (
									<Button
										onClick={(event) => {
											grantFromDetailsRef.current = {
												id: selectedIssue.id,
												index: selectedIndex,
											};
											setDetailsDialogOpen(false);
											handleGrantExcuseClick(selectedIssue, event);
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
				<Dialog
					open={excuseDialogOpen}
					onOpenChange={(open) => {
						setExcuseDialogOpen(open);
						// Cancelling after "Grant Excuse" in details goes back to details
						if (
							!open &&
							grantFromDetailsRef.current &&
							!grantExcuseMutation.isPending
						) {
							grantFromDetailsRef.current = null;
							setDetailsDialogOpen(true);
						}
					}}
				>
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
								onClick={() => {
									setExcuseDialogOpen(false);
									if (grantFromDetailsRef.current) {
										grantFromDetailsRef.current = null;
										setDetailsDialogOpen(true);
									}
								}}
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
