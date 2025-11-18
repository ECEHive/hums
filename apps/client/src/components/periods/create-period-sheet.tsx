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
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
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
import { toUtcDateFromLocalInput } from "@/lib/timezone";

const unitSchema = z.enum(["count", "minutes", "hours"]);

const formSchema = z
	.object({
		name: z
			.string()
			.min(1, "Name is required")
			.min(2, "Name must be at least 2 characters")
			.max(100, "Name must be at most 100 characters"),
		start: z.date(),
		end: z.date(),
		min: z.number().int().min(0).nullable(),
		max: z.number().int().min(0).nullable(),
		minMaxUnit: unitSchema.nullable(),
		visibleStart: z.date(),
		visibleEnd: z.date(),
		scheduleSignupStart: z.date(),
		scheduleSignupEnd: z.date(),
		scheduleModifyStart: z.date(),
		scheduleModifyEnd: z.date(),
		periodRoleIds: z.array(z.number().int().min(1)),
	})
	.superRefine((data, ctx) => {
		const hasMin = data.min !== null && data.min !== undefined;
		const hasMax = data.max !== null && data.max !== undefined;

		if ((hasMin || hasMax) && !data.minMaxUnit) {
			ctx.addIssue({
				code: "custom",
				message: "Select a unit when specifying min or max",
				path: ["minMaxUnit"],
			});
		}

		if (
			hasMin &&
			hasMax &&
			typeof data.min === "number" &&
			typeof data.max === "number" &&
			data.min > data.max
		) {
			ctx.addIssue({
				code: "custom",
				message: "Minimum requirement cannot exceed maximum",
				path: ["min"],
			});
		}
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
	const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
	const formId = useId();

	// access period context so we can set the newly created period
	const { setPeriod } = usePeriod();

	const createPeriodMutation = useMutation({
		mutationFn: async (input: {
			name: string;
			start: Date;
			end: Date;
			min: number | null;
			max: number | null;
			minMaxUnit: z.infer<typeof unitSchema> | null;
			visibleStart: Date;
			visibleEnd: Date;
			scheduleSignupStart: Date;
			scheduleSignupEnd: Date;
			scheduleModifyStart: Date;
			scheduleModifyEnd: Date;
			periodRoleIds: number[];
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
			min: null as number | null,
			max: null as number | null,
			minMaxUnit: null as z.infer<typeof unitSchema> | null,
			visibleStart: null as Date | null,
			visibleEnd: null as Date | null,
			scheduleSignupStart: null as Date | null,
			scheduleSignupEnd: null as Date | null,
			scheduleModifyStart: null as Date | null,
			scheduleModifyEnd: null as Date | null,
			periodRoleIds: [] as number[],
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			if (
				!value.start ||
				!value.end ||
				!value.visibleStart ||
				!value.visibleEnd ||
				!value.scheduleSignupStart ||
				!value.scheduleSignupEnd ||
				!value.scheduleModifyStart ||
				!value.scheduleModifyEnd
			)
				return;
			const startUtc = toUtcDateFromLocalInput(value.start);
			const endUtc = toUtcDateFromLocalInput(value.end);
			const visibleStartUtc = toUtcDateFromLocalInput(value.visibleStart);
			const visibleEndUtc = toUtcDateFromLocalInput(value.visibleEnd);
			const signupStartUtc = toUtcDateFromLocalInput(value.scheduleSignupStart);
			const signupEndUtc = toUtcDateFromLocalInput(value.scheduleSignupEnd);
			const modifyStartUtc = toUtcDateFromLocalInput(value.scheduleModifyStart);
			const modifyEndUtc = toUtcDateFromLocalInput(value.scheduleModifyEnd);
			if (
				!startUtc ||
				!endUtc ||
				!visibleStartUtc ||
				!visibleEndUtc ||
				!signupStartUtc ||
				!signupEndUtc ||
				!modifyStartUtc ||
				!modifyEndUtc
			)
				return;

			try {
				await createPeriodMutation.mutateAsync({
					name: value.name,
					start: startUtc,
					end: endUtc,
					min: value.min,
					max: value.max,
					minMaxUnit: value.minMaxUnit,
					visibleStart: visibleStartUtc,
					visibleEnd: visibleEndUtc,
					scheduleSignupStart: signupStartUtc,
					scheduleSignupEnd: signupEndUtc,
					scheduleModifyStart: modifyStartUtc,
					scheduleModifyEnd: modifyEndUtc,
					periodRoleIds: value.periodRoleIds ?? [],
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
				setSelectedRoles([]);
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
									Shift Requirements
									<span className="text-muted-foreground text-xs font-normal ml-1">
										(optional)
									</span>
								</h3>
								<FieldDescription>
									Specify a recommended minimum or enforced maximum number of
									shifts for this period.
								</FieldDescription>
							</div>
							<div className="grid gap-4 sm:grid-cols-3">
								<form.Field
									name="min"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<div className="space-y-1">
												<FieldLabel htmlFor={field.name}>Minimum</FieldLabel>
												<Input
													id={field.name}
													type="number"
													min={0}
													step={1}
													value={field.state.value ?? ""}
													onBlur={field.handleBlur}
													onChange={(e) => {
														const numericValue =
															e.target.value === ""
																? null
																: Number(e.target.value);
														field.handleChange(numericValue);
													}}
													placeholder="e.g. 4"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</div>
										);
									}}
								/>
								<form.Field
									name="max"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<div className="space-y-1">
												<FieldLabel htmlFor={field.name}>Maximum</FieldLabel>
												<Input
													id={field.name}
													type="number"
													min={0}
													step={1}
													value={field.state.value ?? ""}
													onBlur={field.handleBlur}
													onChange={(e) => {
														const numericValue =
															e.target.value === ""
																? null
																: Number(e.target.value);
														field.handleChange(numericValue);
													}}
													placeholder="e.g. 10"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</div>
										);
									}}
								/>
								<form.Field
									name="minMaxUnit"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<div className="space-y-1">
												<FieldLabel>Unit</FieldLabel>
												<Select
													value={field.state.value ?? ""}
													onValueChange={(value) =>
														field.handleChange(
															value as z.infer<typeof unitSchema>,
														)
													}
												>
													<SelectTrigger>
														<SelectValue placeholder="Unit" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="count">Shift count</SelectItem>
														<SelectItem value="hours">Hours</SelectItem>
														<SelectItem value="minutes">Minutes</SelectItem>
													</SelectContent>
												</Select>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</div>
										);
									}}
								/>
							</div>
						</div>

						<form.Field
							name="periodRoleIds"
							children={(field) => (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<FieldLabel>Allowed Roles</FieldLabel>
										<span className="text-xs text-muted-foreground">
											Optional
										</span>
									</div>
									<FieldDescription>
										Users must have at least one selected role to view or
										interact with this period. Leave empty to allow all users.
									</FieldDescription>
									<RoleMultiSelect
										value={selectedRoles}
										onChange={(roles) => {
											setSelectedRoles(roles);
											field.handleChange(roles.map((role) => role.id));
										}}
										placeholder="Search roles..."
									/>
								</div>
							)}
						/>

						<div className="space-y-2">
							<div className="space-y-1">
								<FieldLabel>
									Visibility Window <span className="text-destructive">*</span>
								</FieldLabel>
								<FieldDescription>
									Control when this period is visible to users. Includes
									specific start and end times.
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
														startField.handleChange(s ?? null);
														endField.handleChange(e ?? null);
													}}
													withTime
												/>
											)}
										/>
									);
								}}
							/>
							<form.Field
								name="visibleStart"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
							<form.Field
								name="visibleEnd"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
						</div>

						<div className="space-y-2">
							<div className="space-y-1">
								<FieldLabel>
									Signup Window <span className="text-destructive">*</span>
								</FieldLabel>
								<FieldDescription>
									Control when users can sign up for shifts. Includes specific
									start and end times.
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
														startField.handleChange(s ?? null);
														endField.handleChange(e ?? null);
													}}
													withTime
												/>
											)}
										/>
									);
								}}
							/>
							<form.Field
								name="scheduleSignupStart"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
							<form.Field
								name="scheduleSignupEnd"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
						</div>

						<div className="space-y-2">
							<div className="space-y-1">
								<FieldLabel>
									Modification Window{" "}
									<span className="text-destructive">*</span>
								</FieldLabel>
								<FieldDescription>
									Control when users can modify their shift assignments.
									Includes specific start and end times.
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
														startField.handleChange(s ?? null);
														endField.handleChange(e ?? null);
													}}
													withTime
												/>
											)}
										/>
									);
								}}
							/>
							<form.Field
								name="scheduleModifyStart"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
								}}
							/>
							<form.Field
								name="scheduleModifyEnd"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return isInvalid ? (
										<FieldError errors={field.state.meta.errors} />
									) : null;
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
