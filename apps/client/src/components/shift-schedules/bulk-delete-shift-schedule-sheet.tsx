import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import {
	type ShiftType,
	ShiftTypeMultiselect,
} from "@/components/shift-types/shift-type-multiselect";
// Note: this sheet performs bulk deletions and does not need time inputs
import { Button } from "@/components/ui/button";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
// Select component not required for multi-day picker; kept for other sheets
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
	// shift types are selected outside the form (multiselect)
	days: z.array(z.number().min(0).max(6)).min(1, "Select at least one day"),
});

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
];

interface BulkDeleteShiftScheduleSheetProps {
	periodId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
}

export function BulkDeleteShiftScheduleSheet({
	periodId,
	open,
	onOpenChange,
	trigger,
}: BulkDeleteShiftScheduleSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>([]);
	const [shiftTypeError, setShiftTypeError] = useState<string | null>(null);
	const formId = useId();

	const deleteMutation = useMutation({
		mutationFn: async (ids: number[]) => {
			for (const id of ids) {
				await trpc.shiftSchedules.delete.mutate({ id });
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftSchedules", { periodId }],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			days: [] as number[],
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				setServerError(null);
				setShiftTypeError(null);

				if (!selectedShiftTypes || selectedShiftTypes.length === 0) {
					setShiftTypeError("Select at least one shift type to delete");
					return;
				}

				// Fetch all schedules for the period (large limit) and filter client-side
				const all = await trpc.shiftSchedules.list.query({
					periodId,
					limit: 10000,
					offset: 0,
				});

				const shiftTypeIds = new Set(selectedShiftTypes.map((s) => s.id));
				const daysOfWeek = new Set(value.days);

				const toDelete = (all.shiftSchedules || []).filter(
					(s) => shiftTypeIds.has(s.shiftTypeId) && daysOfWeek.has(s.dayOfWeek),
				);

				if (toDelete.length === 0) {
					// nothing to do
					onOpenChange(false);
					return;
				}

				await deleteMutation.mutateAsync(toDelete.map((s) => s.id));

				onOpenChange(false);
			} catch (error) {
				console.error("Failed to delete shift schedules:", error);
				setServerError(
					error instanceof Error
						? error.message
						: "Failed to delete shift schedules",
				);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	const handleSheetChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				form.reset();
				setSelectedShiftTypes([]);
				setServerError(null);
			}
		},
		[form, onOpenChange],
	);

	return (
		<Sheet open={open} onOpenChange={handleSheetChange}>
			{trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
			<SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Bulk Delete Shift Schedules</SheetTitle>
					<SheetDescription>
						Delete existing shift schedules for selected shift types on selected
						days. This will only remove schedules that match both the selected
						shift types and selected days.
					</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					noValidate
				>
					<div className="space-y-6 px-4">
						{serverError && (
							<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{serverError}
							</div>
						)}

						{/* Shift Type Selection */}
						<div className="space-y-2">
							<FieldLabel>
								Shift Types <span className="text-destructive">*</span>
							</FieldLabel>
							<ShiftTypeMultiselect
								periodId={periodId}
								value={selectedShiftTypes}
								onChange={(next) => {
									setSelectedShiftTypes(next);
								}}
							/>
							{shiftTypeError && (
								<div className="text-destructive text-sm">{shiftTypeError}</div>
							)}
							<FieldDescription>
								Select one or more shift types to delete schedules for
							</FieldDescription>
						</div>

						{/* Day of Week (multiselect) */}
						<form.Field
							name="days"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								const selected: number[] = field.state.value || [];

								const toggleDay = (v: number) => {
									const next = selected.includes(v)
										? selected.filter((s) => s !== v)
										: [...selected, v];
									field.handleChange(next);
								};

								const display =
									selected.length > 0
										? selected
												.slice()
												.sort((a, b) => a - b)
												.map(
													(d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label,
												)
												.filter(Boolean)
												.join(", ")
										: "Select days...";

								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Day(s) of Week <span className="text-destructive">*</span>
										</FieldLabel>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full text-left flex justify-between items-center"
												>
													<span className="truncate block text-left w-full">
														{display}
													</span>
													<ChevronsUpDownIcon className="ml-2 size-4" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[220px] p-2">
												<div className="flex flex-col gap-1">
													{DAYS_OF_WEEK.map((day) => (
														<button
															key={day.value}
															type="button"
															onClick={() => toggleDay(day.value)}
															className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent"
														>
															<div className="flex items-center gap-2">
																{selected.includes(day.value) ? (
																	<CheckIcon className="size-4" />
																) : (
																	<span className="w-4" />
																)}
																<span>{day.label}</span>
															</div>
														</button>
													))}
												</div>
											</PopoverContent>
										</Popover>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											The days of the week to delete schedules for
										</FieldDescription>
									</div>
								);
							}}
						/>
					</div>
				</form>
				<SheetFooter className="px-4">
					<Button
						form={formId}
						type="submit"
						variant="destructive"
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? (
							<>
								<Spinner className="mr-2 size-4" />
								Deleting...
							</>
						) : (
							"Delete Shift Schedules"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
