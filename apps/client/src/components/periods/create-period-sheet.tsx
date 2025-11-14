import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
// DateField removed in favor of DateRangeSelector
import DateRangeSelector from "@/components/date-range-selector";
import { usePeriod } from "@/components/period-provider";
import { normalizeRangeToDayBounds } from "@/components/periods/date-range-helpers";
import { Button } from "@/components/ui/button";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
	name: z
		.string()
		.min(1, "Name is required")
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
	start: z.date(),
	end: z.date(),
	visibleStart: z.date().nullable(),
	visibleEnd: z.date().nullable(),
	scheduleSignupStart: z.date().nullable(),
	scheduleSignupEnd: z.date().nullable(),
	scheduleModifyStart: z.date().nullable(),
	scheduleModifyEnd: z.date().nullable(),
});

interface CreatePeriodSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
}

export function CreatePeriodSheet({
	open,
	onOpenChange,
	trigger,
}: CreatePeriodSheetProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const formId = useId();

	// access period context so we can set the newly created period
	const { setPeriod } = usePeriod();

	const createPeriodMutation = useMutation({
		mutationFn: async (input: {
			name: string;
			start: Date;
			end: Date;
			visibleStart: Date | null;
			visibleEnd: Date | null;
			scheduleSignupStart: Date | null;
			scheduleSignupEnd: Date | null;
			scheduleModifyStart: Date | null;
			scheduleModifyEnd: Date | null;
		}) => {
			return trpc.periods.create.mutate(input);
		},
		onSuccess: (data) => {
			if (data.period) {
				// refresh the periods list
				queryClient.invalidateQueries({ queryKey: ["periods"] });
				// set the newly created period in context
				try {
					setPeriod(data.period.id);
				} catch (_) {
					// ignore if context not available
				}
				// navigate to the period details page
				navigate({
					to: "/shifts/period-details",
				});
			}
		},
	});

	const form = useForm({
		defaultValues: {
			name: "",
			start: null as Date | null,
			end: null as Date | null,
			visibleStart: null as Date | null,
			visibleEnd: null as Date | null,
			scheduleSignupStart: null as Date | null,
			scheduleSignupEnd: null as Date | null,
			scheduleModifyStart: null as Date | null,
			scheduleModifyEnd: null as Date | null,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			if (!value.start || !value.end) return;

			try {
				await createPeriodMutation.mutateAsync({
					name: value.name,
					start: value.start,
					end: value.end,
					visibleStart: value.visibleStart,
					visibleEnd: value.visibleEnd,
					scheduleSignupStart: value.scheduleSignupStart,
					scheduleSignupEnd: value.scheduleSignupEnd,
					scheduleModifyStart: value.scheduleModifyStart,
					scheduleModifyEnd: value.scheduleModifyEnd,
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

	const handleSheetChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				form.reset();
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
					<SheetTitle>Create New Period</SheetTitle>
					<SheetDescription>
						Create a new period to organize shift schedules.
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
						<form.Field
							name="name"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Name <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="e.g., Fall 2024"
											autoComplete="off"
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</div>
								);
							}}
						/>

						<div className="space-y-2">
							<FieldLabel>
								Period Dates <span className="text-destructive">*</span>
							</FieldLabel>
							<form.Field
								name="start"
								children={(startField) => {
									const start = form.getFieldValue("start");
									const end = form.getFieldValue("end");
									return (
										<form.Field
											name="end"
											children={(endField) => (
												<DateRangeSelector
													value={[start ?? undefined, end ?? undefined]}
													onChange={([s, e]) => {
														const [normalizedStart, normalizedEnd] =
															normalizeRangeToDayBounds(s, e);
														startField.handleChange(normalizedStart);
														endField.handleChange(normalizedEnd);
													}}
												/>
											)}
										/>
									);
								}}
							/>
							<form.Field
								name="start"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
							<form.Field
								name="end"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									const startDate = form.getFieldValue("start");
									return (
										<>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											{field.state.value &&
												startDate &&
												field.state.value <= startDate && (
													<FieldError
														errors={[
															{
																message: "End date must be after start date",
															},
														]}
													/>
												)}
										</>
									);
								}}
							/>
						</div>

						<div className="space-y-2">
							<div className="space-y-1">
								<h3 className="text-sm font-medium">
									Visibility Window{" "}
									<span className="text-muted-foreground text-xs font-normal">
										(optional)
									</span>
								</h3>
								<FieldDescription>
									Control when this period is visible to users.
								</FieldDescription>
							</div>
							<form.Field
								name="visibleStart"
								children={(startField) => {
									const start = form.getFieldValue("visibleStart");
									const end = form.getFieldValue("visibleEnd");
									return (
										<form.Field
											name="visibleEnd"
											children={(endField) => (
												<DateRangeSelector
													value={[start ?? undefined, end ?? undefined]}
													onChange={([s, e]) => {
														const [normalizedStart, normalizedEnd] =
															normalizeRangeToDayBounds(s, e);
														startField.handleChange(normalizedStart);
														endField.handleChange(normalizedEnd);
													}}
												/>
											)}
										/>
									);
								}}
							/>
						</div>

						<div className="space-y-2">
							<div className="space-y-1">
								<h3 className="text-sm font-medium">
									Signup Window{" "}
									<span className="text-muted-foreground text-xs font-normal">
										(optional)
									</span>
								</h3>
								<FieldDescription>
									Control when users can sign up for shifts.
								</FieldDescription>
							</div>
							<form.Field
								name="scheduleSignupStart"
								children={(startField) => {
									const start = form.getFieldValue("scheduleSignupStart");
									const end = form.getFieldValue("scheduleSignupEnd");
									return (
										<form.Field
											name="scheduleSignupEnd"
											children={(endField) => (
												<DateRangeSelector
													value={[start ?? undefined, end ?? undefined]}
													onChange={([s, e]) => {
														const [normalizedStart, normalizedEnd] =
															normalizeRangeToDayBounds(s, e);
														startField.handleChange(normalizedStart);
														endField.handleChange(normalizedEnd);
													}}
												/>
											)}
										/>
									);
								}}
							/>
						</div>

						<div className="space-y-2">
							<div className="space-y-1">
								<h3 className="text-sm font-medium">
									Modification Window{" "}
									<span className="text-muted-foreground text-xs font-normal">
										(optional)
									</span>
								</h3>
								<FieldDescription>
									Control when users can modify their shift assignments.
								</FieldDescription>
							</div>
							<form.Field
								name="scheduleModifyStart"
								children={(startField) => {
									const start = form.getFieldValue("scheduleModifyStart");
									const end = form.getFieldValue("scheduleModifyEnd");
									return (
										<form.Field
											name="scheduleModifyEnd"
											children={(endField) => (
												<DateRangeSelector
													value={[start ?? undefined, end ?? undefined]}
													onChange={([s, e]) => {
														const [normalizedStart, normalizedEnd] =
															normalizeRangeToDayBounds(s, e);
														startField.handleChange(normalizedStart);
														endField.handleChange(normalizedEnd);
													}}
												/>
											)}
										/>
									);
								}}
							/>
						</div>

						{serverError && (
							<p className="text-sm text-destructive">{serverError}</p>
						)}
					</div>

					<SheetFooter className="flex flex-row items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleSheetChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !canSubmit}>
							{isSubmitting ? <Spinner /> : "Create Period"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
