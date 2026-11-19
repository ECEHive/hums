import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkPermissions } from "@/lib/permissions";
import {
	type GatewayActionRow,
	GatewayActionsEditor,
	gatewayActionsError,
} from "./gateway-actions-editor";

// Actions are validated on their own field: TanStack Form never clears a
// schema error on a nested path like actions[0].controlPointId, which kept
// Create disabled after one failed check.
const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	isActive: z.boolean(),
	actions: z.array(z.custom<GatewayActionRow>()),
});

type FormValues = z.infer<typeof formSchema>;

type CreateGatewayDialogProps = {
	onUpdate?: () => void;
	onTokenCreated?: (token: { name: string; value: string }) => void;
};

export function CreateGatewayDialog({
	onUpdate,
	onTokenCreated,
}: CreateGatewayDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const { data: pointsData } = useQuery({
		queryKey: ["control", "points", "all"],
		queryFn: async () => await trpc.control.points.list.query({ limit: 100 }),
		enabled: open,
	});

	const controlPoints = pointsData?.points ?? [];

	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			description?: string;
			isActive?: boolean;
			actions: GatewayActionRow[];
		}) => trpc.control.gateways.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "gateways"] });
		},
	});

	const form = useForm({
		defaultValues: {
			name: "",
			description: "",
			isActive: true,
			actions: [] as FormValues["actions"],
		} as FormValues,
		validators: { onSubmit: formSchema },
		onSubmit: async ({ value }) => {
			setServerError(null);
			try {
				const result = await createMutation.mutateAsync({
					name: value.name,
					description: value.description || undefined,
					isActive: value.isActive,
					actions: value.actions,
				});
				setOpen(false);
				onUpdate?.();
				onTokenCreated?.({
					name: value.name,
					value: result.accessToken,
				});
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
			if (nextOpen) {
				form.reset();
				setServerError(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["control.gateways.create"]);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button hidden={!canCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					New Gateway
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Create Control Gateway</SheetTitle>
					<SheetDescription>
						Add a new control gateway for external system integration. An access
						token will be generated automatically.
					</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					className="space-y-4 px-4 sm:px-6 mt-4"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="name">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Name</FieldLabel>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="e.g., Front Door Gateway"
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Description</FieldLabel>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Optional description..."
									rows={2}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>

					<form.Field
						name="actions"
						validators={{
							onSubmit: ({ value }) => gatewayActionsError(value),
						}}
					>
						{(field) => (
							<GatewayActionsEditor
								actions={field.state.value}
								onChange={field.handleChange}
								controlPoints={controlPoints}
								error={field.state.meta.errors.join(" ")}
							/>
						)}
					</form.Field>

					<form.Field name="isActive">
						{(field) => (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>
								<label
									htmlFor={field.name}
									className="text-sm font-medium leading-none"
								>
									Active
								</label>
							</div>
						)}
					</form.Field>

					{serverError && (
						<p className="text-destructive text-sm">{serverError}</p>
					)}
				</form>
				<SheetFooter className="mt-4 px-4 sm:px-6">
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
					<Button
						form={formId}
						type="submit"
						disabled={isSubmitting || !canSubmit}
					>
						{isSubmitting ? <Spinner className="mr-2" /> : null}
						Create
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
