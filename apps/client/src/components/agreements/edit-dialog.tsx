import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
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
import type { Agreement } from "./columns";

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

type EditDialogProps = {
	agreement: Agreement;
};

export function EditDialog({ agreement }: EditDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const updateAgreementMutation = useMutation({
		mutationFn: (input: {
			id: number;
			title: string;
			content: string;
			confirmationText: string;
			isEnabled: boolean;
		}) => {
			return trpc.agreements.update.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agreements"] });
		},
	});

	const form = useForm({
		defaultValues: {
			title: agreement.title,
			content: agreement.content,
			confirmationText: agreement.confirmationText,
			isEnabled: agreement.isEnabled,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateAgreementMutation.mutateAsync({
					id: agreement.id,
					...value,
				});
				setOpen(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	const user = useAuth().user;
	const canEdit = user && checkPermissions(user, ["agreements.update"]);

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
				<Button
					variant="ghost"
					size="icon"
					disabled={!canEdit}
					aria-label="Edit agreement"
				>
					<Pencil className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Edit Agreement</DialogTitle>
					<DialogDescription>
						Update the agreement details below.
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
						{isSubmitting ? <Spinner /> : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
