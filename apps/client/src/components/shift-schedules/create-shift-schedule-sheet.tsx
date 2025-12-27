import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { TimeInput } from "@/components/shared/time-input";
import {
	type ShiftType,
	ShiftTypeSelector,
} from "@/components/shift-types/shift-type-selector";
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
		slots: z.number().min(1, "Slots must be at least 1").max(100),
		dayOfWeek: z.number().min(0).max(6),
		startTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
		endTime: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
	})
	.superRefine((data, ctx) => {
		// Validate that startTime is before endTime
		const [startHours, startMinutes] = data.startTime.split(":").map(Number);
		const [endHours, endMinutes] = data.endTime.split(":").map(Number);

		const startSeconds = startHours * 3600 + startMinutes * 60;
		const endSeconds = endHours * 3600 + endMinutes * 60;

		if (startSeconds >= endSeconds) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Start time must be before end time",
				path: ["endTime"],
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

interface CreateShiftScheduleSheetProps {
	periodId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
}

export function CreateShiftScheduleSheet({
	periodId,
	open,
	onOpenChange,
	trigger,
}: CreateShiftScheduleSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | null>(
		null,
	);
	const formId = useId();

	const createShiftScheduleMutation = useMutation({
		mutationFn: async (input: {
			shiftTypeId: number;
			slots: number;
			dayOfWeek: number;
			startTime: string;
			endTime: string;
		}) => {
			return trpc.shiftSchedules.create.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftSchedules", { periodId }],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			shiftTypeId: 0,
			slots: 1,
			dayOfWeek: 1, // Default to Monday
			startTime: "",
			endTime: "",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				setServerError(null);
				await createShiftScheduleMutation.mutateAsync(value);
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
					<SheetTitle>Create New Shift Schedule</SheetTitle>
					<SheetDescription>
						Create a recurring shift schedule for a shift type.
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
											periodId={periodId}
											value={selectedShiftType}
											onChange={(shiftType) => {
												setSelectedShiftType(shiftType);
												field.handleChange(shiftType?.id ?? 0);
											}}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											Select the shift type for this schedule
										</FieldDescription>
									</div>
								);
							}}
						/>

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

						{/* Day of Week */}
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
											<SelectTrigger id={field.name} aria-invalid={isInvalid}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{DAYS_OF_WEEK.map((day) => (
													<SelectItem key={day.value} value={String(day.value)}>
														{day.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										<FieldDescription>
											The day of the week this schedule repeats
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
