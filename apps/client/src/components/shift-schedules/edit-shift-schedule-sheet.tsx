import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState } from "react";
import { z } from "zod";
import { ShiftTypeSelector } from "@/components/shift-types/shift-type-selector";
import { TimeInput } from "@/components/time-input";
import { Button } from "@/components/ui/button";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

const formSchema = z
	.object({
		shiftTypeId: z.number().min(1, "Shift type is required"),
		slots: z.number().min(1, "At least 1 slot is required").max(100),
		dayOfWeek: z.number().min(0).max(6),
		startTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
		endTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
	})
	.refine((data) => data.startTime < data.endTime, {
		message: "Start time must be before end time",
		path: ["endTime"],
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

interface ShiftSchedule {
	id: number;
	periodId: number;
	shiftTypeId: number;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	createdAt: Date;
	updatedAt: Date;
}

interface EditShiftScheduleSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
	shiftSchedule: ShiftSchedule;
}

export function EditShiftScheduleSheet({
	open,
	onOpenChange,
	trigger,
	shiftSchedule,
}: EditShiftScheduleSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [selectedShiftType, setSelectedShiftType] = useState<{
		id: number;
		name: string;
		location: string;
	} | null>(null);
	const formId = useId();

	// Fetch the shift type details for the initial value
	const { data: shiftTypeData } = useQuery({
		queryKey: ["shiftType", shiftSchedule.shiftTypeId],
		queryFn: async () => {
			return trpc.shiftTypes.get.query({ id: shiftSchedule.shiftTypeId });
		},
		enabled: open,
	});

	// Initialize selected shift type when data loads
	useEffect(() => {
		if (open && shiftTypeData?.shiftType) {
			setSelectedShiftType({
				id: shiftTypeData.shiftType.id,
				name: shiftTypeData.shiftType.name,
				location: shiftTypeData.shiftType.location,
			});
		}
	}, [open, shiftTypeData]);

	const updateShiftScheduleMutation = useMutation({
		mutationFn: async (input: {
			id: number;
			shiftTypeId: number;
			slots: number;
			dayOfWeek: number;
			startTime: string;
			endTime: string;
		}) => {
			return trpc.shiftSchedules.update.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftSchedules", { periodId: shiftSchedule.periodId }],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			shiftTypeId: shiftSchedule.shiftTypeId,
			slots: shiftSchedule.slots,
			dayOfWeek: shiftSchedule.dayOfWeek,
			startTime: shiftSchedule.startTime,
			endTime: shiftSchedule.endTime,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateShiftScheduleMutation.mutateAsync({
					id: shiftSchedule.id,
					shiftTypeId: value.shiftTypeId,
					slots: value.slots,
					dayOfWeek: value.dayOfWeek,
					startTime: value.startTime,
					endTime: value.endTime,
				});

				handleSheetChange(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	// Reset form when shift schedule changes
	useEffect(() => {
		form.reset();
		setServerError(null);
	}, [shiftSchedule.id, form]);

	const handleSheetChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				form.reset();
				setSelectedShiftType(null);
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
					<SheetTitle>Edit Shift Schedule</SheetTitle>
					<SheetDescription>
						Update the details for this shift schedule.
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
						{/* Shift Type Selection */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold">Shift Details</h3>

							<form.Field
								name="shiftTypeId"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>
												Shift Type <span className="text-destructive">*</span>
											</FieldLabel>
											<ShiftTypeSelector
												periodId={shiftSchedule.periodId}
												value={selectedShiftType}
												onChange={(value) => {
													setSelectedShiftType(value);
													field.handleChange(value?.id ?? 0);
												}}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												The type of shift for this schedule
											</FieldDescription>
										</div>
									);
								}}
							/>

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
												min={1}
												max={100}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) =>
													field.handleChange(
														Number.parseInt(e.target.value, 10),
													)
												}
												placeholder="e.g., 2"
												aria-invalid={isInvalid}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												Number of people needed for this shift
											</FieldDescription>
										</div>
									);
								}}
							/>
						</div>

						{/* Schedule */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold">Schedule</h3>

							<form.Field
								name="dayOfWeek"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>
												Day of Week <span className="text-destructive">*</span>
											</FieldLabel>
											<Select
												value={String(field.state.value)}
												onValueChange={(value) =>
													field.handleChange(Number.parseInt(value, 10))
												}
											>
												<SelectTrigger id={field.name}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{DAYS_OF_WEEK.map((day) => (
														<SelectItem
															key={day.value}
															value={String(day.value)}
														>
															{day.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												The day this shift occurs
											</FieldDescription>
										</div>
									);
								}}
							/>

							<div className="grid grid-cols-2 gap-4">
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
													onBlur={field.handleBlur}
													onChange={(value) => field.handleChange(value)}
													aria-invalid={isInvalid}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</div>
										);
									}}
								/>

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
													onBlur={field.handleBlur}
													onChange={(value) => field.handleChange(value)}
													aria-invalid={isInvalid}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</div>
										);
									}}
								/>
							</div>
						</div>

						{serverError && (
							<div className="rounded-md bg-destructive/10 p-3">
								<p className="text-sm text-destructive">{serverError}</p>
							</div>
						)}
					</div>
				</form>

				<SheetFooter className="pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => handleSheetChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						form={formId}
						type="submit"
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? (
							<>
								<Spinner className="mr-2 size-4" />
								Saving...
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
