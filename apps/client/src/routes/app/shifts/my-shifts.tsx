import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
} from "@/components/layout";
import {
	createColumns,
	type ShiftOccurrenceRow,
} from "@/components/my-shifts/columns";
import { usePeriod } from "@/components/providers/period-provider";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import DateRangeSelector from "@/components/shared/date-range-selector";
import { TablePagination } from "@/components/shared/table-pagination";
import {
	type ShiftType,
	ShiftTypeSelector,
} from "@/components/shift-types/shift-type-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CalendarSyncButton } from "@/components/user/calendar-sync-button";
import { usePersistedTableState } from "@/hooks/use-persisted-table-state";
import type { RequiredPermissions } from "@/lib/permissions";
import {
	formatDateInAppTimezone,
	formatTimeRange,
	toUtcDateFromLocalInput,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/shifts/my-shifts")({
	component: () => (
		<RequireShiftAccess>
			<MyShifts />
		</RequireShiftAccess>
	),
});

export const permissions = [] as RequiredPermissions;

function formatShiftSummary(occurrence: ShiftOccurrenceRow) {
	const dateLabel = formatDateInAppTimezone(occurrence.timestamp, {
		formatString: "ddd, MMM D",
	});
	const timeLabel = formatTimeRange(occurrence.startTime, occurrence.endTime, {
		referenceDate: occurrence.timestamp,
	});
	return `${dateLabel}, ${timeLabel}`;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message || "Something went wrong";
	}
	if (typeof error === "string") {
		return error;
	}
	return "Something went wrong";
}

function formatHourOption(hour: number) {
	const normalizedHour = ((hour % 24) + 24) % 24;
	const period = normalizedHour >= 12 ? "PM" : "AM";
	const displayHour = normalizedHour % 12 || 12;
	return `${displayHour}:00 ${period}`;
}

type MakeupFilters = {
	shiftType: ShiftType | null;
	dateRange: [Date | undefined, Date | undefined];
	startHour: number | null;
	restrictToSameType: boolean;
};

const DEFAULT_MAKEUP_FILTERS: MakeupFilters = {
	shiftType: null,
	dateRange: [undefined, undefined],
	startHour: null,
	restrictToSameType: true,
};

function MyShifts() {
	const { period: selectedPeriodId } = usePeriod();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const restrictCheckboxId = React.useId();
	const dropNotesId = React.useId();
	const dropMakeupNotesId = React.useId();
	const [dropTarget, setDropTarget] = React.useState<ShiftOccurrenceRow | null>(
		null,
	);
	const [makeupTarget, setMakeupTarget] =
		React.useState<ShiftOccurrenceRow | null>(null);
	const [isDropping, setIsDropping] = React.useState(false);
	const [isSubmittingMakeup, setIsSubmittingMakeup] = React.useState(false);
	const [selectedMakeupOccurrenceId, setSelectedMakeupOccurrenceId] =
		React.useState<number | null>(null);
	const [dropNotes, setDropNotes] = React.useState("");
	const [dropMakeupNotes, setDropMakeupNotes] = React.useState("");
	const {
		page: makeupPage,
		setPage: setMakeupPage,
		pageSize: makeupPageSize,
		offset: makeupOffset,
		filters: makeupFilters,
		setFilters: setMakeupFilters,
		resetToFirstPage: resetMakeupToFirstPage,
	} = usePersistedTableState<MakeupFilters>({
		pageKey: "my-shifts-makeup-options",
		defaultFilters: DEFAULT_MAKEUP_FILTERS,
		initialPageSize: 5,
	});

	const limit = pageSize;
	const offset = (page - 1) * limit;
	const makeupLimit = makeupPageSize;
	const restrictToSameType = makeupFilters?.restrictToSameType ?? true;
	const selectedMakeupShiftType = makeupFilters?.shiftType ?? null;
	const makeupDateRange = makeupFilters?.dateRange ?? [undefined, undefined];
	const makeupStartHour = makeupFilters?.startHour ?? null;

	const canDropPermission = true;
	const canMakeupPermission = true;

	const handleDropClick = React.useCallback(
		(occurrence: ShiftOccurrenceRow) => {
			setDropNotes("");
			setDropTarget(occurrence);
		},
		[],
	);

	const handleMakeupClick = React.useCallback(
		(occurrence: ShiftOccurrenceRow) => {
			if (!canMakeupPermission) {
				toast.error("You do not have permission to makeup shifts.");
				return;
			}
			setDropMakeupNotes("");
			setMakeupTarget(occurrence);
			setMakeupFilters((current) => {
				const nextFilters = current ?? DEFAULT_MAKEUP_FILTERS;
				const shouldResetShiftType =
					nextFilters.restrictToSameType || nextFilters.shiftType === null;

				return {
					...nextFilters,
					shiftType: shouldResetShiftType
						? {
								id: occurrence.shiftTypeId,
								name: occurrence.shiftTypeName,
								location: occurrence.shiftTypeLocation ?? "",
							}
						: nextFilters.shiftType,
					restrictToSameType:
						nextFilters.shiftType === null
							? true
							: nextFilters.restrictToSameType,
				};
			});
			setSelectedMakeupOccurrenceId(null);
			resetMakeupToFirstPage();
		},
		[canMakeupPermission, resetMakeupToFirstPage, setMakeupFilters],
	);

	const tableColumns = React.useMemo(
		() =>
			createColumns({
				onDrop: handleDropClick,
				onMakeup: handleMakeupClick,
				canDropPermission,
				canMakeupPermission,
			}),
		[
			handleDropClick,
			handleMakeupClick,
			canDropPermission,
			canMakeupPermission,
		],
	);

	const {
		data: occurrencesData,
		isLoading: occurrencesLoading,
		refetch: refetchOccurrences,
	} = useQuery({
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

	const occurrences = (occurrencesData?.occurrences ??
		[]) as ShiftOccurrenceRow[];
	const total = occurrencesData?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	const isMakeupSheetOpen = Boolean(makeupTarget);
	const makeupQueryEnabled = Boolean(selectedPeriodId && makeupTarget);
	const makeupDateFrom = React.useMemo(
		() => toUtcDateFromLocalInput(makeupDateRange[0]),
		[makeupDateRange],
	);
	const makeupDateTo = React.useMemo(() => {
		const end = makeupDateRange[1];
		if (!end) return null;
		const inclusiveEnd = new Date(end);
		inclusiveEnd.setHours(23, 59, 59, 999);
		return toUtcDateFromLocalInput(inclusiveEnd);
	}, [makeupDateRange]);
	const { data: makeupOptionsData, isLoading: makeupOptionsLoading } = useQuery(
		{
			queryKey: [
				"makeupOptions",
				selectedPeriodId,
				makeupTarget?.id,
				selectedMakeupShiftType?.id,
				makeupDateFrom?.toISOString() ?? null,
				makeupDateTo?.toISOString() ?? null,
				makeupStartHour,
				makeupPage,
			],
			queryFn: async () => {
				if (!selectedPeriodId || !makeupTarget) return null;
				return trpc.shiftOccurrences.listMakeupOptions.query({
					periodId: selectedPeriodId,
					shiftTypeId: selectedMakeupShiftType?.id,
					dateFrom: makeupDateFrom ?? undefined,
					dateTo: makeupDateTo ?? undefined,
					startHourFrom: makeupStartHour ?? undefined,
					collapseSlots: true,
					limit: makeupLimit,
					offset: makeupOffset,
				});
			},
			enabled: makeupQueryEnabled,
		},
	);
	const { data: makeupStartHoursData } = useQuery({
		queryKey: [
			"makeupStartHours",
			selectedPeriodId,
			selectedMakeupShiftType?.id ?? null,
		],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftOccurrences.listMakeupStartHours.query({
				periodId: selectedPeriodId,
				shiftTypeId: selectedMakeupShiftType?.id,
			});
		},
		enabled: Boolean(selectedPeriodId),
	});
	const makeupHourOptions = React.useMemo(
		() =>
			(makeupStartHoursData?.startHours ?? []).map((hour) => ({
				value: hour,
				label: formatHourOption(hour),
			})),
		[makeupStartHoursData],
	);

	const makeupOccurrences = makeupOptionsData?.occurrences ?? [];
	const makeupTotal = makeupOptionsData?.total ?? 0;
	const makeupTotalPages = Math.max(1, Math.ceil(makeupTotal / makeupLimit));
	const hasSelectedHourOption =
		makeupStartHour === null ||
		makeupHourOptions.some((option) => option.value === makeupStartHour);
	const modificationWindow = makeupOptionsData?.modificationWindow;
	const dropDialogOpen = Boolean(dropTarget);
	const dropSummary = dropTarget ? formatShiftSummary(dropTarget) : "";
	const makeupSummary = makeupTarget ? formatShiftSummary(makeupTarget) : "";
	const makeupWindowClosed = modificationWindow
		? !modificationWindow.isOpen
		: false;
	const canSubmitMakeup = Boolean(
		selectedMakeupOccurrenceId &&
			!isSubmittingMakeup &&
			!makeupWindowClosed &&
			dropMakeupNotes.trim(),
	);

	React.useEffect(() => {
		if (hasSelectedHourOption) {
			return;
		}

		setMakeupFilters((current) => ({
			...(current ?? DEFAULT_MAKEUP_FILTERS),
			startHour: null,
		}));
		resetMakeupToFirstPage();
		setSelectedMakeupOccurrenceId(null);
	}, [
		hasSelectedHourOption,
		resetMakeupToFirstPage,
		setMakeupFilters,
		setSelectedMakeupOccurrenceId,
	]);

	const closeDropDialog = React.useCallback(() => {
		setDropTarget(null);
		setDropNotes("");
	}, []);

	const closeMakeupSheet = React.useCallback(() => {
		setMakeupTarget(null);
		setSelectedMakeupOccurrenceId(null);
		setMakeupPage(1);
		setDropMakeupNotes("");
	}, [setMakeupPage]);

	const handleDropDialogOpenChange = React.useCallback(
		(open: boolean) => {
			if (!open && !isDropping) {
				closeDropDialog();
			}
		},
		[isDropping, closeDropDialog],
	);

	const handleMakeupSheetOpenChange = React.useCallback(
		(open: boolean) => {
			if (!open && !isSubmittingMakeup) {
				closeMakeupSheet();
			}
		},
		[isSubmittingMakeup, closeMakeupSheet],
	);

	const handleConfirmDrop = React.useCallback(async () => {
		if (!dropTarget) return;
		setIsDropping(true);
		try {
			await trpc.shiftOccurrences.drop.mutate({
				shiftOccurrenceId: dropTarget.id,
				notes: dropNotes.trim(),
			});
			toast.success("Shift dropped");
			await refetchOccurrences();
			closeDropDialog();
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			setIsDropping(false);
		}
	}, [dropTarget, dropNotes, refetchOccurrences, closeDropDialog]);

	const handleDropMakeupConfirm = React.useCallback(async () => {
		if (!makeupTarget || !selectedMakeupOccurrenceId) return;
		setIsSubmittingMakeup(true);
		try {
			await trpc.shiftOccurrences.dropMakeup.mutate({
				shiftOccurrenceId: makeupTarget.id,
				makeupShiftOccurrenceId: selectedMakeupOccurrenceId,
				notes: dropMakeupNotes.trim(),
			});
			toast.success("Shift dropped and makeup scheduled");
			await refetchOccurrences();
			closeMakeupSheet();
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			setIsSubmittingMakeup(false);
		}
	}, [
		makeupTarget,
		selectedMakeupOccurrenceId,
		dropMakeupNotes,
		refetchOccurrences,
		closeMakeupSheet,
	]);

	const handleRestrictToggle = React.useCallback(
		(checked: boolean | "indeterminate") => {
			const next = checked === true;
			setMakeupFilters((current) => ({
				...(current ?? DEFAULT_MAKEUP_FILTERS),
				restrictToSameType: next,
				shiftType:
					next && makeupTarget
						? {
								id: makeupTarget.shiftTypeId,
								name: makeupTarget.shiftTypeName,
								location: makeupTarget.shiftTypeLocation ?? "",
							}
						: null,
			}));
			resetMakeupToFirstPage();
			setSelectedMakeupOccurrenceId(null);
		},
		[makeupTarget, resetMakeupToFirstPage, setMakeupFilters],
	);

	const handleMakeupShiftTypeChange = React.useCallback(
		(shiftType: ShiftType | null) => {
			setMakeupFilters((current) => ({
				...(current ?? DEFAULT_MAKEUP_FILTERS),
				shiftType,
				restrictToSameType: Boolean(
					makeupTarget && shiftType?.id === makeupTarget.shiftTypeId,
				),
			}));
			resetMakeupToFirstPage();
			setSelectedMakeupOccurrenceId(null);
		},
		[makeupTarget, resetMakeupToFirstPage, setMakeupFilters],
	);

	const handleMakeupDateRangeChange = React.useCallback(
		(range: [Date | undefined, Date | undefined]) => {
			setMakeupFilters((current) => ({
				...(current ?? DEFAULT_MAKEUP_FILTERS),
				dateRange: range,
			}));
			resetMakeupToFirstPage();
			setSelectedMakeupOccurrenceId(null);
		},
		[resetMakeupToFirstPage, setMakeupFilters],
	);

	const handleMakeupStartHourChange = React.useCallback(
		(value: string) => {
			const parsed = value === "all" ? null : Number(value);
			setMakeupFilters((current) => ({
				...(current ?? DEFAULT_MAKEUP_FILTERS),
				startHour: Number.isNaN(parsed) ? null : parsed,
			}));
			resetMakeupToFirstPage();
			setSelectedMakeupOccurrenceId(null);
		},
		[resetMakeupToFirstPage, setMakeupFilters],
	);

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Shifts</PageTitle>
				<PageActions>
					<CalendarSyncButton />
					<Link to="/app/shifts/attendance">
						<Button variant="outline">Shift History</Button>
					</Link>
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					{selectedPeriodId ? (
						<>
							<DataTable
								columns={tableColumns}
								data={occurrences}
								isLoading={occurrencesLoading}
							/>
							{total > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={occurrences.length}
									total={total}
									itemName="shifts"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										setPage(1);
									}}
									pageSizeOptions={[10, 20, 50, 100]}
								/>
							)}
						</>
					) : (
						<div className="flex items-center justify-center py-12 border rounded-md">
							<p className="text-muted-foreground">
								Select a period to view your shifts
							</p>
						</div>
					)}
				</TableContainer>

				<Dialog open={dropDialogOpen} onOpenChange={handleDropDialogOpenChange}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Drop this shift?</DialogTitle>
							<DialogDescription>
								This cannot be undone. Unexcused drops count against your
								attendance record.
							</DialogDescription>
						</DialogHeader>
						{dropTarget ? (
							<div className="space-y-4">
								<Alert>
									<AlertTitle>{dropTarget.shiftTypeName}</AlertTitle>
									<AlertDescription>
										<p>{dropSummary}</p>
									</AlertDescription>
								</Alert>
								<div className="space-y-2">
									<Label htmlFor={dropNotesId}>
										Reason <span className="text-destructive">*</span>
									</Label>
									<Textarea
										id={dropNotesId}
										value={dropNotes}
										onChange={(event) => setDropNotes(event.target.value)}
										placeholder="Why are you dropping this shift? This will be shown to staff."
										maxLength={500}
									/>
									<p className="text-xs text-muted-foreground text-right">
										{dropNotes.length}/500 characters
									</p>
								</div>
							</div>
						) : null}
						<Alert variant="destructive" className="mb-4">
							<AlertDescription>
								<strong>Warning:</strong> If not excused by staff, this drop
								will count against your attendance record.
							</AlertDescription>
						</Alert>
						<DialogFooter className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={closeDropDialog}
								disabled={isDropping}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={handleConfirmDrop}
								disabled={isDropping || !dropNotes.trim()}
							>
								{isDropping ? "Dropping…" : "Confirm Drop"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<Sheet
					open={isMakeupSheetOpen}
					onOpenChange={handleMakeupSheetOpenChange}
				>
					<SheetContent className="w-full overflow-y-auto sm:max-w-lg md:max-w-lg lg:max-w-xl">
						<SheetHeader>
							<SheetTitle>Drop with makeup</SheetTitle>
							<SheetDescription>
								Select a makeup shift to cover for {makeupTarget?.shiftTypeName}
								. Your drop will be excused if you attend the makeup.
							</SheetDescription>
						</SheetHeader>

						<div className="flex flex-col space-y-4 p-4">
							{makeupTarget ? (
								<div className="space-y-6">
									<div className="space-y-1">
										<p className="text-sm font-medium">Dropping</p>
										<Alert>
											<AlertTitle>{makeupTarget.shiftTypeName}</AlertTitle>
											<AlertDescription>{makeupSummary}</AlertDescription>
										</Alert>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id={restrictCheckboxId}
											checked={restrictToSameType}
											onCheckedChange={handleRestrictToggle}
										/>
										<Label htmlFor={restrictCheckboxId} className="text-sm">
											Show only {makeupTarget.shiftTypeName} shifts
										</Label>
									</div>
									<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
										<div className="space-y-2">
											<Label className="text-sm">Shift type</Label>
											<ShiftTypeSelector
												value={selectedMakeupShiftType}
												onChange={handleMakeupShiftTypeChange}
												periodId={selectedPeriodId}
												placeholder="All shift types"
											/>
										</div>
										<div className="space-y-2">
											<Label className="text-sm">Date</Label>
											<DateRangeSelector
												value={makeupDateRange}
												onChange={handleMakeupDateRangeChange}
											/>
										</div>
										<div className="space-y-2">
											<Label className="text-sm">Starting hour</Label>
											<Select
												value={
													makeupStartHour === null
														? "all"
														: String(makeupStartHour)
												}
												onValueChange={handleMakeupStartHourChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="All start hours" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all">All start hours</SelectItem>
													{makeupHourOptions.map((option) => (
														<SelectItem
															key={option.value}
															value={String(option.value)}
														>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
								</div>
							) : null}

							<div className="rounded-md border">
								<div className="max-h-64 min-h-[16rem] overflow-y-auto overflow-x-auto">
									{makeupOptionsLoading ? (
										<div className="flex min-h-[16rem] items-center justify-center">
											<Spinner className="size-6" />
										</div>
									) : makeupOccurrences.length === 0 ? (
										<div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
											No open shift occurrences match your filters.
										</div>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Shift</TableHead>
													<TableHead>Date</TableHead>
													<TableHead>Time</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{makeupOccurrences.map((occ) => {
													const isSelected =
														selectedMakeupOccurrenceId === occ.id;
													return (
														<TableRow
															key={occ.id}
															data-state={isSelected ? "selected" : undefined}
															className={cn(
																"cursor-pointer",
																isSelected && "bg-muted",
															)}
															onClick={() =>
																setSelectedMakeupOccurrenceId(occ.id)
															}
														>
															<TableCell>
																<div className="font-medium">
																	{occ.shiftTypeName}
																</div>
																<div className="text-xs text-muted-foreground">
																	{occ.shiftTypeLocation}
																</div>
															</TableCell>
															<TableCell>
																{formatDateInAppTimezone(occ.timestamp, {
																	formatString: "MMM D",
																})}
															</TableCell>
															<TableCell>
																{formatTimeRange(occ.startTime, occ.endTime, {
																	referenceDate: occ.timestamp,
																})}
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
									)}
								</div>
							</div>
							{makeupTotalPages > 1 && (
								<div className="mt-3 overflow-x-auto">
									<TablePagination
										className="justify-center"
										page={makeupPage}
										totalPages={makeupTotalPages}
										onPageChange={setMakeupPage}
									/>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor={dropMakeupNotesId}>
									Reason <span className="text-destructive">*</span>
								</Label>
								<Textarea
									id={dropMakeupNotesId}
									value={dropMakeupNotes}
									onChange={(event) => setDropMakeupNotes(event.target.value)}
									placeholder="Why are you dropping this shift? This will be shown to staff."
									maxLength={500}
								/>
								<p className="text-xs text-muted-foreground text-right">
									{dropMakeupNotes.length}/500 characters
								</p>
							</div>
						</div>

						<SheetFooter className="gap-2 sm:flex-row">
							<Button
								variant="outline"
								onClick={closeMakeupSheet}
								disabled={isSubmittingMakeup}
							>
								Cancel
							</Button>
							<Button
								variant="default"
								onClick={handleDropMakeupConfirm}
								disabled={!canSubmitMakeup}
							>
								{isSubmittingMakeup ? "Scheduling…" : "Confirm Makeup"}
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			</PageContent>
		</Page>
	);
}
