import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { checkPermissions } from "@/lib/permissions";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	title: z
		.string()
		.min(1, "Title is required.")
		.max(500, "Title must be at most 500 characters."),
	content: z.string().min(1, "Content is required."),
	confirmationText: z
		.string()
		.min(1, "Confirmation text is required.")
		.max(500, "Confirmation text must be at most 500 characters."),
	isEnabled: z.boolean(),
});

type CreateDialogProps = {
	onUpdate?: () => void;
};

export function CreateDialog({ onUpdate }: CreateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const createAgreementMutation = useMutation({
		mutationFn: (input: {
			title: string;
			content: string;
			confirmationText: string;
			isEnabled: boolean;
		}) => {
			return trpc.agreements.create.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agreements"] });
		},
	});

	const form = useForm({
		defaultValues: {
			title: "",
			content: "",
			confirmationText: "I agree",
			isEnabled: true,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await createAgreementMutation.mutateAsync(value);
				setOpen(false);
				onUpdate?.();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["agreements.create"]);

	const handleDialogChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				form.reset();
				setServerError(null);
			}
		},
		[form],
	);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button disabled={!canCreate}>Create Agreement</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Create Agreement</DialogTitle>
					<DialogDescription>
						Create a new agreement for users to accept.
					</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="title">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Title</FieldLabel>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Code of Conduct"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="content">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Content</FieldLabel>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter the agreement text here..."
									rows={8}
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="confirmationText">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Confirmation Text</FieldLabel>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="I agree"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="isEnabled">
						{(field) => (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(!!checked)}
								/>
								<Label
									htmlFor={field.name}
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									Enabled (users must agree to this)
								</Label>
							</div>
						)}
					</form.Field>

					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}
				</form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline" type="button">
							Cancel
						</Button>
					</DialogClose>
					<Button form={formId} disabled={!canSubmit || isSubmitting}>
						{isSubmitting ? <Spinner /> : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
