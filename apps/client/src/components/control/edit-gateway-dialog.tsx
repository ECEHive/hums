import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
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
import {
	type ControlPointOption,
	type GatewayActionRow,
	GatewayActionsEditor,
	type GatewayActionValue,
	gatewayActionsError,
} from "./gateway-actions-editor";

// Actions are validated on their own field; see create-gateway-dialog.tsx.
const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	isActive: z.boolean(),
	actions: z.array(z.custom<GatewayActionRow>()),
});

type FormValues = z.infer<typeof formSchema>;

type ControlGateway = {
	id: number;
	name: string;
	description: string | null;
	isActive: boolean;
};

type EditGatewayDialogProps = {
	gateway: ControlGateway;
	onUpdate?: () => void;
};

export function EditGatewayDialog({
	gateway,
	onUpdate,
}: EditGatewayDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="sm">
					<PencilIcon className="h-4 w-4" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Edit Control Gateway</SheetTitle>
					<SheetDescription>
						Update gateway settings and actions.
					</SheetDescription>
				</SheetHeader>
				{/* SheetContent unmounts when closed, so every open starts here. */}
				<EditGatewayBody
					gatewayId={gateway.id}
					onSaved={() => {
						setOpen(false);
						onUpdate?.();
					}}
				/>
			</SheetContent>
		</Sheet>
	);
}

function EditGatewayBody({
	gatewayId,
	onSaved,
}: {
	gatewayId: number;
	onSaved: () => void;
}): JSX.Element {
	const details = useQuery({
		queryKey: ["control", "gateways", gatewayId],
		queryFn: async () =>
			await trpc.control.gateways.get.query({ id: gatewayId }),
	});

	const { data: pointsData } = useQuery({
		queryKey: ["control", "points", "all"],
		queryFn: async () => await trpc.control.points.list.query({ limit: 100 }),
	});

	// Saving sends the full action list, so the form must never start from
	// anything but freshly loaded details: an empty or stale list would
	// overwrite the gateway's actions.
	if (details.isError) {
		return (
			<>
				<div className="px-4 sm:px-6 mt-4 space-y-2">
					<p className="text-destructive text-sm">
						Couldn&apos;t load this gateway: {details.error.message}
					</p>
					<Button variant="outline" size="sm" onClick={() => details.refetch()}>
						Retry
					</Button>
				</div>
				<SheetFooter className="mt-4 px-4 sm:px-6">
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</>
		);
	}

	if (!details.data || !details.isFetchedAfterMount) {
		return (
			<div className="flex justify-center py-8">
				<Spinner />
			</div>
		);
	}

	return (
		<EditGatewayForm
			gateway={details.data}
			controlPoints={pointsData?.points ?? []}
			onSaved={onSaved}
		/>
	);
}

type GatewayDetails = Awaited<
	ReturnType<typeof trpc.control.gateways.get.query>
>;

function EditGatewayForm({
	gateway,
	controlPoints,
	onSaved,
}: {
	gateway: GatewayDetails;
	controlPoints: ControlPointOption[];
	onSaved: () => void;
}): JSX.Element {
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			name?: string;
			description?: string | null;
			isActive?: boolean;
			actions?: GatewayActionRow[];
		}) => trpc.control.gateways.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["control", "gateways"],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			name: gateway.name,
			description: gateway.description ?? "",
			isActive: gateway.isActive,
			actions: gateway.actions.map((a) => ({
				controlPointId: a.controlPointId,
				action: a.action as GatewayActionValue,
			})),
		} as FormValues,
		validators: { onSubmit: formSchema },
		onSubmit: async ({ value }) => {
			setServerError(null);
			try {
				await updateMutation.mutateAsync({
					id: gateway.id,
					name: value.name,
					description: value.description || null,
					isActive: value.isActive,
					actions: value.actions,
				});
				onSaved();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	return (
		<>
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
					Save Changes
				</Button>
			</SheetFooter>
		</>
	);
}
