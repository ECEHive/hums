import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import DateField from "@/components/ui/date-field";
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
				queryClient.invalidateQueries({ queryKey: ["periods"] });
				navigate({
					to: "/app/periods/$periodId",
					params: { periodId: String(data.period.id) },
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
					className="flex flex-1 flex-col"
				>
					<div className="grid flex-1 auto-rows-min gap-6 px-4">
						<form.Field
							name="name"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="grid gap-3">
										<FieldLabel htmlFor={field.name}>Name</FieldLabel>
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

						<div className="grid gap-4 md:grid-cols-2">
							<form.Field
								name="start"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="grid gap-3">
											<FieldLabel>Start Date</FieldLabel>
											<DateField isInvalid={isInvalid} field={field} />
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</div>
									);
								}}
							/>

							<form.Field
								name="end"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									const startDate = form.getFieldValue("start");
									return (
										<div className="grid gap-3">
											<FieldLabel>End Date</FieldLabel>
											<DateField
												label={null}
												field={field}
												isInvalid={isInvalid}
												disabledDate={(date: Date) =>
													startDate ? date <= startDate : false
												}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											{field.state.value &&
												startDate &&
												field.state.value <= startDate && (
													<FieldError
														errors={[
															{ message: "End date must be after start date" },
														]}
													/>
												)}
										</div>
									);
								}}
							/>
						</div>

						<div className="space-y-3">
							<h3 className="text-sm font-medium">Visibility Window</h3>
							<FieldDescription>
								Control when this period is visible to users.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="visibleStart"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Visible Start</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
								<form.Field
									name="visibleEnd"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Visible End</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
							</div>
						</div>

						<div className="space-y-3">
							<h3 className="text-sm font-medium">Signup Window</h3>
							<FieldDescription>
								Control when users can sign up for shifts.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="scheduleSignupStart"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Signup Start</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
								<form.Field
									name="scheduleSignupEnd"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Signup End</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
							</div>
						</div>

						<div className="space-y-3">
							<h3 className="text-sm font-medium">Modification Window</h3>
							<FieldDescription>
								Control when users can modify their shift assignments.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="scheduleModifyStart"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Modify Start</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
								<form.Field
									name="scheduleModifyEnd"
									children={(field) => (
										<div className="grid gap-3">
											<FieldLabel>Modify End</FieldLabel>
											<DateField field={field} />
										</div>
									)}
								/>
							</div>
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
