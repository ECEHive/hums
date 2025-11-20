import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	createColumns,
	type ShiftOccurrenceRow,
} from "@/components/my-shifts/columns";
import { DataTable } from "@/components/my-shifts/data-table";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { RequireShiftAccess } from "@/components/require-shift-access";
import { TablePagination } from "@/components/table-pagination";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
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
import type { RequiredPermissions } from "@/lib/permissions";
import { formatDateInAppTimezone, formatTimeRange } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shifts/my-shifts")({
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
	const [restrictToSameType, setRestrictToSameType] = React.useState(true);
	const [makeupPage, setMakeupPage] = React.useState(1);

	const limit = pageSize;
	const offset = (page - 1) * limit;
	const makeupLimit = 5;
	const makeupOffset = (makeupPage - 1) * makeupLimit;

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
			setRestrictToSameType(true);
			setSelectedMakeupOccurrenceId(null);
			setMakeupPage(1);
		},
		[canMakeupPermission],
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
	const { data: makeupOptionsData, isLoading: makeupOptionsLoading } = useQuery(
		{
			queryKey: [
				"makeupOptions",
				selectedPeriodId,
				makeupTarget?.id,
				restrictToSameType,
				makeupPage,
			],
			queryFn: async () => {
				if (!selectedPeriodId || !makeupTarget) return null;
				return trpc.shiftOccurrences.listMakeupOptions.query({
					periodId: selectedPeriodId,
					shiftTypeId: restrictToSameType
						? makeupTarget.shiftTypeId
						: undefined,
					limit: makeupLimit,
					offset: makeupOffset,
				});
			},
			enabled: makeupQueryEnabled,
		},
	);

	const makeupOccurrences = makeupOptionsData?.occurrences ?? [];
	const makeupTotal = makeupOptionsData?.total ?? 0;
	const makeupTotalPages = Math.max(1, Math.ceil(makeupTotal / makeupLimit));
	const modificationWindow = makeupOptionsData?.modificationWindow;
	const dropDialogOpen = Boolean(dropTarget);
	const dropSummary = dropTarget ? formatShiftSummary(dropTarget) : "";
	const makeupSummary = makeupTarget ? formatShiftSummary(makeupTarget) : "";
	const makeupWindowClosed = modificationWindow
		? !modificationWindow.isOpen
		: false;
	const canSubmitMakeup = Boolean(
		selectedMakeupOccurrenceId && !isSubmittingMakeup && !makeupWindowClosed,
	);

	const closeDropDialog = React.useCallback(() => {
		setDropTarget(null);
		setDropNotes("");
	}, []);

	const closeMakeupSheet = React.useCallback(() => {
		setMakeupTarget(null);
		setSelectedMakeupOccurrenceId(null);
		setMakeupPage(1);
		setDropMakeupNotes("");
	}, []);

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
		const trimmedNotes = dropNotes.trim();
		try {
			await trpc.shiftOccurrences.drop.mutate({
				shiftOccurrenceId: dropTarget.id,
				...(trimmedNotes ? { notes: trimmedNotes } : {}),
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
		const trimmedNotes = dropMakeupNotes.trim();
		try {
			await trpc.shiftOccurrences.dropMakeup.mutate({
				shiftOccurrenceId: makeupTarget.id,
				makeupShiftOccurrenceId: selectedMakeupOccurrenceId,
				...(trimmedNotes ? { notes: trimmedNotes } : {}),
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
			setRestrictToSameType(next);
			setMakeupPage(1);
			setSelectedMakeupOccurrenceId(null);
		},
		[],
	);

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<>
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
							columns={tableColumns}
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
									Showing {offset + 1} - {offset + occurrences.length} of{" "}
									{total}
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

			<Dialog open={dropDialogOpen} onOpenChange={handleDropDialogOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Drop this shift?</DialogTitle>
						<DialogDescription>
							Dropping removes you from this shift and marks your attendance as{" "}
							<strong>dropped</strong>.
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
								<Label htmlFor={dropNotesId}>Reason (optional)</Label>
								<Textarea
									id={dropNotesId}
									value={dropNotes}
									onChange={(event) => setDropNotes(event.target.value)}
									placeholder="Let the coordinators know why you're dropping this shift."
									maxLength={500}
								/>
								<p className="text-xs text-muted-foreground text-right">
									{dropNotes.length}/500 characters
								</p>
							</div>
							<p>This action cannot be undone.</p>
						</div>
					) : null}
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
							disabled={isDropping}
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
						<SheetTitle>Find a makeup shift</SheetTitle>
						<SheetDescription>
							Choose an open shift occurrence to cover for{" "}
							{makeupTarget?.shiftTypeName}.
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
							<Label htmlFor={dropMakeupNotesId}>Reason (optional)</Label>
							<Textarea
								id={dropMakeupNotesId}
								value={dropMakeupNotes}
								onChange={(event) => setDropMakeupNotes(event.target.value)}
								placeholder="Let the coordinators know why you're dropping and selecting this makeup shift."
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
		</>
	);
}
