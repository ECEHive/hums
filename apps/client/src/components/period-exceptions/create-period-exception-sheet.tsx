import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
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
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { getAppTimezoneDisplayLabel } from "@/lib/timezone";
import { formatDateTimeInput, parseDateTimeInput } from "./datetime";

type FormValues = {
	name: string;
	start: Date | null;
	end: Date | null;
};

const dateFieldSchema = z.preprocess(
	(value) => (value instanceof Date ? value : undefined),
	z.date({ required_error: "This field is required" }),
);

const formSchema = z
	.object({
		name: z
			.string()
			.min(1, "Name is required")
			.max(100, "Name must be at most 100 characters"),
		start: dateFieldSchema,
		end: dateFieldSchema,
	})
	.superRefine((data, ctx) => {
		if (data.start >= data.end) {
			ctx.addIssue({
				code: "custom",
				message: "End must be after start",
				path: ["end"],
			});
		}
	});

interface CreatePeriodExceptionSheetProps {
	periodId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreatePeriodExceptionSheet({
	periodId,
	open,
	onOpenChange,
}: CreatePeriodExceptionSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const formId = useId();
	const timezoneLabel = getAppTimezoneDisplayLabel();

	const createMutation = useMutation({
		mutationFn: async (input: { name: string; start: Date; end: Date }) =>
			trpc.periodExceptions.create.mutate({
				periodId,
				...input,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["periodExceptions"] });
		},
	});

	const form = useForm<FormValues>({
		defaultValues: {
			name: "",
			start: null,
			end: null,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			if (!value.start || !value.end) {
				return;
			}
			try {
				await createMutation.mutateAsync({
					name: value.name.trim(),
					start: value.start,
					end: value.end,
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
			<SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Create Period Exception</SheetTitle>
					<SheetDescription>
						Temporarily override the default period schedule for specific dates.
					</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
					noValidate
				>
					<div className="space-y-6 px-4 py-4">
						<form.Field
							name="name"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div className="space-y-2">
										<FieldLabel htmlFor={`${formId}-name`}>
											Name <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={`${formId}-name`}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="e.g. Winter Break"
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

						<div className="grid gap-4 sm:grid-cols-2">
							<form.Field
								name="start"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={`${formId}-start`}>
												Start <span className="text-destructive">*</span>
											</FieldLabel>
											<Input
												id={`${formId}-start`}
												type="datetime-local"
												value={formatDateTimeInput(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(event) => {
													const nextValue =
														parseDateTimeInput(event.target.value) ?? null;
													field.handleChange(nextValue);
												}}
												aria-invalid={isInvalid}
											/>
											<FieldDescription>
												Times use {timezoneLabel}.
											</FieldDescription>
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
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={`${formId}-end`}>
												End <span className="text-destructive">*</span>
											</FieldLabel>
											<Input
												id={`${formId}-end`}
												type="datetime-local"
												value={formatDateTimeInput(field.state.value)}
												onBlur={field.handleBlur}
												onChange={(event) => {
													const nextValue =
														parseDateTimeInput(event.target.value) ?? null;
													field.handleChange(nextValue);
												}}
												aria-invalid={isInvalid}
											/>
											<FieldDescription>
												Times use {timezoneLabel}.
											</FieldDescription>
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
						<p className="px-4 text-sm text-destructive">{serverError}</p>
					)}

					<SheetFooter className="px-4 pt-4">
						<Button
							variant="outline"
							type="button"
							onClick={() => handleSheetChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? <Spinner className="size-4" /> : "Create"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
