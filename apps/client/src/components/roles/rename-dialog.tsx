import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "../ui/spinner";

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Role name is required.")
		.max(50, "Role name must be at most 50 characters."),
});

type UpdateDialogProps = {
	role: {
		id: number;
		name: string;
	};
	onUpdate?: () => void;
};

export function RenameDialog({
	role,
	onUpdate,
}: UpdateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const updateRoleMutation = useMutation({
		mutationFn: ({ name }: { name: string }) => {
			return trpc.roles.update.mutate({ id: role.id, name });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["roles"] });
		},
	});

	const form = useForm({
		defaultValues: {
			name: role.name,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateRoleMutation.mutateAsync({ name: value.name });
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

	const currentUser = useAuth().user;
	const canRename =
		currentUser && checkPermissions(currentUser, ["roles.update"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" disabled={!canRename}>
					Rename
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Rename Role</DialogTitle>
					<DialogDescription>Press rename to save changes.</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
					noValidate
				>
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
										aria-invalid={isInvalid}
										placeholder="Role name"
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>

					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}

					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={isSubmitting || !canSubmit || !canRename}
						>
							{isSubmitting ? <Spinner /> : "Rename"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
