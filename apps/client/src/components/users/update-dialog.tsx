import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	email: z.email("Email must be valid"),
	slackUsername: z.string(),
});

type UpdateDialogProps = {
	user: {
		id: number;
		username: string;
		name: string;
		email: string;
		slackUsername?: string;
	};
	onUpdate?: () => void;
};

export function UserUpdateDialog({
	user,
	onUpdate,
}: UpdateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const updateUserMutation = useMutation({
		mutationFn: ({ id, name, email, slackUsername }: { id: number; name: string; email: string; slackUsername?: string | null; }) => {
			// Pass through slackUsername as given:
			// - undefined -> omit (leave unchanged)
			// - null -> set column to NULL (clear)
			// - string -> set to that value (may be empty string)
			// Cast through unknown to satisfy generated trpc client types
			const payload = { id, name, email, slackUsername } as unknown as {
				id: number;
				name: string;
				email: string;
				slackUsername?: string | undefined;
			};
			return trpc.users.update.mutate(payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
		},
	});

	const form = useForm({
		defaultValues: {
			name: user.name,
			email: user.email,
			slackUsername: user.slackUsername ?? "",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const payload: {
					id: number;
					name: string;
					email: string;
					slackUsername?: string | null;
				} = { id: user.id, name: value.name, email: value.email };

				// If the slackUsername field is empty string, we interpret that as
				// an explicit clear request only if the original value was non-empty.
				// In that case, send `null` so the DB column is set to NULL. If the
				// original value was already empty/null, omit the field to avoid
				// unnecessary writes.
				const original = user.slackUsername ?? "";
				if (value.slackUsername === "") {
					if (original !== "") {
						payload.slackUsername = null;
					}
					// else omit
				} else {
					payload.slackUsername = value.slackUsername;
				}

				await updateUserMutation.mutateAsync(payload);
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
	const canUpdate =
		currentUser && checkPermissions(currentUser, ["users.update"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={!canUpdate}
					aria-label={`Edit user ${user.username}`}
					title={`Edit user ${user.username}`}
				>
					<PencilIcon className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Update {user.username}</DialogTitle>
					<DialogDescription>
						Edit user details and press save.
					</DialogDescription>
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
										placeholder="Enter full name"
										autoComplete="name"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>

					<form.Field
						name="email"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Email</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="user@example.com"
										autoComplete="email"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>

					<form.Field
						name="slackUsername"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Slack Username
										<span className="text-muted-foreground">(optional)</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="gburdell3"
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
							disabled={isSubmitting || !canSubmit || !canUpdate}
						>
							{isSubmitting ? <Spinner /> : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
