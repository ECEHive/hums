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
import { TimeInput } from "@/components/time-input";
import { Button } from "@/components/ui/button";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

const formSchema = z
	.object({
		// shift types are selected outside the form (multiselect)
		slots: z.number().min(1, "Slots must be at least 1").max(100),
		days: z.array(z.number().min(0).max(6)).min(1, "Select at least one day"),
		startTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
		endTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
		duration: z
			.number()
			.min(1, "Duration must be at least 1 minute")
			.max(24 * 60, "Duration must be less than or equal to 1440 minutes"),
	})
	.superRefine((data, ctx) => {
		const parseToSeconds = (time: string) => {
			const parts = time.split(":").map(Number);
			const hours = parts[0] ?? 0;
			const minutes = parts[1] ?? 0;
			const seconds = parts[2] ?? 0;
			return hours * 3600 + minutes * 60 + seconds;
		};

		const startSeconds = parseToSeconds(data.startTime);
		const endSeconds = parseToSeconds(data.endTime);

		if (startSeconds >= endSeconds) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Start time must be before end time",
				path: ["endTime"],
			});
			// early return to avoid further duration checks when times are invalid
			return;
		}

		const totalSeconds = endSeconds - startSeconds;
		const durationSeconds = data.duration * 60;

		if (durationSeconds > totalSeconds) {
			ctx.addIssue({
				code: "custom",
				message: "Duration must be less than or equal to the total time window",
				path: ["duration"],
			});
		} else if (totalSeconds % durationSeconds !== 0) {
			ctx.addIssue({
				code: "custom",
				message:
					"Duration must divide evenly into the time window between start and end",
				path: ["duration"],
			});
		}
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

interface BulkCreateShiftScheduleSheetProps {
	periodId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
}

export function BulkCreateShiftScheduleSheet({
	periodId,
	open,
	onOpenChange,
	trigger,
}: BulkCreateShiftScheduleSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>([]);
	const [shiftTypeError, setShiftTypeError] = useState<string | null>(null);
	const formId = useId();

	const createBulkShiftScheduleMutation = useMutation({
		mutationFn: async (input: {
			shiftTypeIds: number[];
			slots: number;
			daysOfWeek: number[];
			startTime: string;
			endTime: string;
			duration: number;
		}) => {
			for (const shiftTypeId of input.shiftTypeIds) {
				for (const dayOfWeek of input.daysOfWeek) {
					for (let time = input.startTime; time < input.endTime; ) {
						// Calculate next end time based on duration
						const [hours, minutes] = time.split(":").map(Number);
						const totalMinutes = hours * 60 + minutes + input.duration;
						const nextHours = Math.floor(totalMinutes / 60);
						const nextMinutes = totalMinutes % 60;
						const nextTime = `${String(nextHours).padStart(2, "0")}:${String(
							nextMinutes,
						).padStart(2, "0")}`;

						await trpc.shiftSchedules.create.mutate({
							shiftTypeId,
							slots: input.slots,
							dayOfWeek,
							startTime: time,
							endTime: nextTime,
						});

						time = nextTime;
					}
				}
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
			slots: 2,
			days: [1, 2, 3, 4, 5], // Default to work week (Mon-Fri)
			startTime: "10:00",
			endTime: "18:00",
			duration: 30,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				setServerError(null);
				setShiftTypeError(null);

				if (!selectedShiftTypes || selectedShiftTypes.length === 0) {
					setShiftTypeError("Select at least one shift type");
					return;
				}

				// Create a schedule for each selected shift type and each selected day
				const promises: Promise<unknown>[] = [];
				promises.push(
					createBulkShiftScheduleMutation.mutateAsync({
						shiftTypeIds: selectedShiftTypes.map((st) => st.id),
						slots: value.slots,
						daysOfWeek: value.days,
						startTime: value.startTime,
						endTime: value.endTime,
						duration: value.duration,
					}),
				);

				const results = await Promise.allSettled(promises);
				const rejected = results.find((r) => r.status === "rejected");
				if (rejected) {
					const reason = (rejected as PromiseRejectedResult).reason;
					throw reason instanceof Error ? reason : new Error(String(reason));
				}

				onOpenChange(false);
			} catch (error) {
				console.error("Failed to create shift schedule:", error);
				setServerError(
					error instanceof Error
						? error.message
						: "Failed to create shift schedule",
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
					<SheetTitle>Bulk Generate New Shift Schedules</SheetTitle>
					<SheetDescription>
						Create multiple recurring shift schedules for multiple shift types.
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
								Select one or more shift types to create schedules for
							</FieldDescription>
						</div>

						{/* Slots */}
						<form.Field
							name="slots"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Slots <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="number"
											min="1"
											max="100"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(Number.parseInt(e.target.value, 10))
											}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											Number of available slots for this schedule
										</FieldDescription>
									</div>
								);
							}}
						/>

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
											The days of the week this schedule repeats
										</FieldDescription>
									</div>
								);
							}}
						/>

						{/* Start Time */}
						<form.Field
							name="startTime"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Start Time <span className="text-destructive">*</span>
										</FieldLabel>
										<TimeInput
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={field.handleChange}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											Start time in 24-hour format (HH:MM)
										</FieldDescription>
									</div>
								);
							}}
						/>

						{/* End Time */}
						<form.Field
							name="endTime"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											End Time <span className="text-destructive">*</span>
										</FieldLabel>
										<TimeInput
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={field.handleChange}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											End time in 24-hour format (HH:MM)
										</FieldDescription>
									</div>
								);
							}}
						/>

						{/* Shift duration, how long each shift to be generated in open hours is */}
						<form.Field
							name="duration"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Shift Duration (minutes){" "}
											<span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="number"
											min="1"
											step="5"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(Number.parseInt(e.target.value, 10))
											}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											Duration of each generated shift in minutes
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
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? (
							<>
								<Spinner className="mr-2 size-4" />
								Creating...
							</>
						) : (
							"Create Shift Schedule"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
