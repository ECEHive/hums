import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Field,
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
import { cn } from "@/lib/utils";

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

interface Period {
	id: number;
	name: string;
	start: string;
	end: string;
	visibleStart: string | null;
	visibleEnd: string | null;
	scheduleSignupStart: string | null;
	scheduleSignupEnd: string | null;
	scheduleModifyStart: string | null;
	scheduleModifyEnd: string | null;
}

interface EditPeriodSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
	period: Period;
}

export function EditPeriodSheet({
	open,
	onOpenChange,
	trigger,
	period,
}: EditPeriodSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const formId = useId();

	const updatePeriodMutation = useMutation({
		mutationFn: async (input: {
			id: number;
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
			return trpc.periods.update.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["periods"] });
			queryClient.invalidateQueries({ queryKey: ["period", period.id] });
		},
	});

	const form = useForm({
		defaultValues: {
			name: period.name,
			start: new Date(period.start) as Date | null,
			end: new Date(period.end) as Date | null,
			visibleStart: period.visibleStart
				? new Date(period.visibleStart)
				: (null as Date | null),
			visibleEnd: period.visibleEnd
				? new Date(period.visibleEnd)
				: (null as Date | null),
			scheduleSignupStart: period.scheduleSignupStart
				? new Date(period.scheduleSignupStart)
				: (null as Date | null),
			scheduleSignupEnd: period.scheduleSignupEnd
				? new Date(period.scheduleSignupEnd)
				: (null as Date | null),
			scheduleModifyStart: period.scheduleModifyStart
				? new Date(period.scheduleModifyStart)
				: (null as Date | null),
			scheduleModifyEnd: period.scheduleModifyEnd
				? new Date(period.scheduleModifyEnd)
				: (null as Date | null),
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			if (!value.start || !value.end) return;

			try {
				await updatePeriodMutation.mutateAsync({
					id: period.id,
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

	// Reset form when period changes
	useEffect(() => {
		form.reset();
		setServerError(null);
	}, [period.id, form]);

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
					<SheetTitle>Edit Period</SheetTitle>
					<SheetDescription>
						Update the period information and schedules.
					</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-6 py-4"
					noValidate
				>
					<div className="grid flex-1 auto-rows-min gap-6 px-4">
						<form.Field
							name="name"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
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
									</Field>
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
										<Field data-invalid={isInvalid}>
											<FieldLabel>Start Date</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
															isInvalid && "border-destructive",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
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
										<Field data-invalid={isInvalid}>
											<FieldLabel>End Date</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
															isInvalid && "border-destructive",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
														disabled={(date) =>
															startDate ? date <= startDate : false
														}
													/>
												</PopoverContent>
											</Popover>
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
										</Field>
									);
								}}
							/>
						</div>

						<div className="space-y-4">
							<h3 className="text-sm font-medium">Visibility Window</h3>
							<FieldDescription>
								Control when this period is visible to users.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="visibleStart"
									children={(field) => (
										<Field>
											<FieldLabel>Visible Start</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
								<form.Field
									name="visibleEnd"
									children={(field) => (
										<Field>
											<FieldLabel>Visible End</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
							</div>
						</div>

						<div className="space-y-4">
							<h3 className="text-sm font-medium">Signup Window</h3>
							<FieldDescription>
								Control when users can sign up for shifts.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="scheduleSignupStart"
									children={(field) => (
										<Field>
											<FieldLabel>Signup Start</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
								<form.Field
									name="scheduleSignupEnd"
									children={(field) => (
										<Field>
											<FieldLabel>Signup End</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
							</div>
						</div>

						<div className="space-y-4">
							<h3 className="text-sm font-medium">Modification Window</h3>
							<FieldDescription>
								Control when users can modify their shift assignments.
							</FieldDescription>
							<div className="grid gap-4 md:grid-cols-2">
								<form.Field
									name="scheduleModifyStart"
									children={(field) => (
										<Field>
											<FieldLabel>Modify Start</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
								<form.Field
									name="scheduleModifyEnd"
									children={(field) => (
										<Field>
											<FieldLabel>Modify End</FieldLabel>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal",
															!field.state.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.state.value ? (
															format(field.state.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.state.value || undefined}
														onSelect={(date) =>
															field.handleChange(date || null)
														}
													/>
												</PopoverContent>
											</Popover>
										</Field>
									)}
								/>
							</div>
						</div>
					</div>

					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}

					<SheetFooter className="flex flex-row items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleSheetChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !canSubmit}>
							{isSubmitting ? <Spinner /> : "Update Period"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
