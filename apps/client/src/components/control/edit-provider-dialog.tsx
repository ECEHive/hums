import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
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

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	baseUrl: z.string().url("Must be a valid URL"),
	accessToken: z.string().min(1, "Access token is required"),
	isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type ControlProvider = {
	id: number;
	name: string;
	providerType: string;
	isActive: boolean;
	config?: {
		baseUrl?: string;
		accessToken?: string;
	};
};

type EditProviderDialogProps = {
	provider: ControlProvider;
	onUpdate?: () => void;
};

export function EditProviderDialog({
	provider,
	onUpdate,
}: EditProviderDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	// Fetch full provider details when dialog opens
	const { data: providerDetails } = useQuery({
		queryKey: ["control", "providers", provider.id],
		queryFn: async () =>
			await trpc.control.providers.get.query({ id: provider.id }),
		enabled: open,
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			name?: string;
			config?: Record<string, unknown>;
			isActive?: boolean;
		}) => trpc.control.providers.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "providers"] });
		},
	});

	// Extract config
	const config = (providerDetails?.config ?? provider.config ?? {}) as {
		baseUrl?: string;
		accessToken?: string;
	};

	const form = useForm<FormValues>({
		defaultValues: {
			name: provider.name,
			baseUrl: config.baseUrl ?? "",
			accessToken: config.accessToken ?? "",
			isActive: provider.isActive,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateMutation.mutateAsync({
					id: provider.id,
					name: value.name,
					config: {
						baseUrl: value.baseUrl,
						accessToken: value.accessToken,
					},
					isActive: value.isActive,
				});
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
			if (nextOpen) {
				const cfg = (providerDetails?.config ?? provider.config ?? {}) as {
					baseUrl?: string;
					accessToken?: string;
				};
				form.reset({
					name: providerDetails?.name ?? provider.name,
					baseUrl: cfg.baseUrl ?? "",
					accessToken: cfg.accessToken ?? "",
					isActive: providerDetails?.isActive ?? provider.isActive,
				});
				setServerError(null);
			}
		},
		[form, provider, providerDetails],
	);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
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
					<SheetTitle>Edit Control Provider</SheetTitle>
					<SheetDescription>Update provider settings.</SheetDescription>
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
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<div className="border rounded-lg p-4 space-y-4">
						<h4 className="font-medium text-sm">Provider Configuration</h4>

						<form.Field name="baseUrl">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Base URL</FieldLabel>
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

						<form.Field name="accessToken">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Access Token</FieldLabel>
									<Input
										id={field.name}
										type="password"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
								</Field>
							)}
						</form.Field>
					</div>

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
			</SheetContent>
		</Sheet>
	);
}
