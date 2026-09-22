import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Loader2Icon,
	PencilIcon,
	RefreshCcwIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { DataTable, SearchInput } from "@/components/shared";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createWebhookEndpointColumns } from "@/components/webhooks/columns";
import type { WebhookEndpointRow } from "@/components/webhooks/types";
import { UpdateWebhookEndpointSheet } from "@/components/webhooks/update-webhook-endpoint-sheet";
import { usePersistedFilters } from "@/hooks/use-persisted-filters";
import { useDebounce } from "@/lib/debounce";
import { checkPermissions } from "@/lib/permissions";

export const permissions = ["webhooks.endpoints.list"];

enum WebhookStatusFilter {
	All = "all",
	Active = "active",
	Inactive = "inactive",
}

export const Route = createFileRoute("/app/_app/webhooks")({
	component: () =>
		RequirePermissions({
			permissions,
			forbiddenFallback: <MissingPermissions />,
			children: <WebhooksPage />,
		}),
});

function WebhooksPage() {
	const { user } = useAuth();
	const canCreate = user
		? checkPermissions(user, ["webhooks.endpoints.create"])
		: false;
	const canUpdate = user
		? checkPermissions(user, ["webhooks.endpoints.update"])
		: false;
	const canDelete = user
		? checkPermissions(user, ["webhooks.endpoints.delete"])
		: false;

	const { filters, setFilters } = usePersistedFilters<{ search: string }>({
		pageKey: "webhooks",
		defaultFilters: { search: "" },
	});

	const search = filters.search ?? "";
	const setSearch = (value: string) =>
		setFilters((prev) => ({ ...prev, search: value }));

	const [statusFilter, setStatusFilter] = useState<WebhookStatusFilter>(
		WebhookStatusFilter.All,
	);

	const debouncedSearch = useDebounce(search, 250);
	const queryClient = useQueryClient();

	const queryArgs = useMemo(() => {
		const trimmed = debouncedSearch.trim();
		return {
			search: trimmed.length ? trimmed : undefined,
			isActive:
				statusFilter === WebhookStatusFilter.All
					? undefined
					: statusFilter === WebhookStatusFilter.Active,
			limit: 100,
			offset: 0,
		};
	}, [debouncedSearch, statusFilter]);

	const { data, isLoading, isFetching, refetch } = useQuery({
		queryKey: ["webhookEndpoints", queryArgs],
		queryFn: () => trpc.webhookEndpoints.list.query(queryArgs),
		staleTime: 10_000,
	});

	const deleteMutation = useMutation({
		mutationFn: ({ id }: { id: number }) =>
			trpc.webhookEndpoints.delete.mutate({ id }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["webhookEndpoints"] });
		},
		onError: (err) => {
			console.error(err);
		},
	});

	const webhookEndpoints: WebhookEndpointRow[] = data?.webhookEndpoints ?? [];

	const handleDelete = useCallback(
		(tokenId: number) => deleteMutation.mutate({ id: tokenId }),
		[deleteMutation],
	);

	const columns = useMemo(
		() =>
			createWebhookEndpointColumns({
				renderActions: (webhookEndpoint) => (
					<>
						<UpdateWebhookEndpointButton
							webhookEndpoint={webhookEndpoint}
							disabled={!canUpdate}
						/>
						<DeleteWebhookEndpointButton
							webhookEndpoint={webhookEndpoint}
							onConfirm={() => handleDelete(webhookEndpoint.id)}
							disabled={!canDelete || deleteMutation.isPending}
						/>
					</>
				),
			}),
		[canDelete, deleteMutation.isPending, handleDelete],
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Webhooks</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
					<CreateWebhookEndpointDialog disabled={!canCreate} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search webhooks..."
								value={search}
								onChange={(value) => setSearch(value)}
							/>
						</TableSearchInput>
						<Select
							value={statusFilter}
							onValueChange={(value) =>
								setStatusFilter(value as WebhookStatusFilter)
							}
						>
							<SelectTrigger className="w-[130px]">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={WebhookStatusFilter.All}>
									All Status
								</SelectItem>
								<SelectItem value={WebhookStatusFilter.Active}>
									Active
								</SelectItem>
								<SelectItem value={WebhookStatusFilter.Inactive}>
									Inactive
								</SelectItem>
							</SelectContent>
						</Select>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={webhookEndpoints ?? []}
						isLoading={isLoading}
						emptyMessage="No webhook endpoints found"
						emptyDescription="Create a webhook endpoint to get started"
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}

type CreateWebhookEndpointDialogProps = {
	disabled: boolean;
};

function CreateWebhookEndpointDialog({
	disabled,
}: CreateWebhookEndpointDialogProps) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [secret, setSecret] = useState<string | undefined>(undefined);
	const [sendActions, setSendActions] = useState<string[]>([]);
	const [sendTickets, setSendTickets] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const nameId = useId();
	const urlId = useId();
	const secretId = useId();
	const sendActionsId = useId();
	const sendTicketsId = useId();
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: () =>
			trpc.webhookEndpoints.create.mutate({
				name: name.trim(),
				url: url.trim(),
				secret: secret ? secret.trim() : undefined,
				sendActions: sendActions,
				sendTickets,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["webhookEndpoints"] });
			setName("");
			setUrl("");
			setSecret(undefined);
			setSendActions([]);
			setSendTickets(false);
			setError(null);
			setOpen(false);
		},
		onError: (err) => {
			setError(
				err instanceof Error
					? err.message
					: "Failed to create webhook endpoint",
			);
		},
	});

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);

		if (!name.trim()) {
			setError("Name is required");
			return;
		}

		if (!url.trim()) {
			setError("URL is required");
			return;
		}

		createMutation.mutate();
	};

	return (
		<>
			<Button onClick={() => setOpen(true)} disabled={disabled}>
				Create Webhook Endpoint
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Webhook Endpoint</DialogTitle>
						<DialogDescription>
							Please provide the details for the new webhook endpoint. The
							secret is optional, but recommended for security purposes.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleSubmit}>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={urlId}>URL</FieldLabel>
							<Input
								id={urlId}
								value={url}
								onChange={(event) => setUrl(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={secretId}>Secret</FieldLabel>
							<Input
								id={secretId}
								value={secret ?? ""}
								onChange={(event) => setSecret(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={sendActionsId}>Send Actions</FieldLabel>
							<FieldDescription>
								Comma-separated list of actions to send to the webhook endpoint.
								These actions come from the audit log.
							</FieldDescription>
							<Textarea
								id={sendActionsId}
								value={sendActions.join(", ")}
								onChange={(event) =>
									setSendActions(
										event.target.value.split(",").map((s) => s.trim()),
									)
								}
								placeholder="Comma-separated list of actions to send"
							/>
						</Field>
						<Field>
							<div className="flex items-start gap-2">
								<Checkbox
									id={sendTicketsId}
									checked={sendTickets}
									onCheckedChange={(checked) =>
										setSendTickets(checked === true)
									}
								/>
								<div className="space-y-1">
									<FieldLabel htmlFor={sendTicketsId}>Send Tickets</FieldLabel>
									<FieldDescription>
										Send all new tickets created to this endpoint.
									</FieldDescription>
								</div>
							</div>
						</Field>
						{error && <FieldError>{error}</FieldError>}
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								data-umami-event="cancel-create-token"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createMutation.isPending}>
								{createMutation.isPending ? <Spinner /> : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

type UpdateWebhookEndpointButtonProps = {
	webhookEndpoint: WebhookEndpointRow;
	disabled: boolean;
};

function UpdateWebhookEndpointButton({
	webhookEndpoint,
	disabled,
}: UpdateWebhookEndpointButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setOpen(true)}
				disabled={disabled}
				aria-label={`Edit webhook endpoint ${webhookEndpoint.name}`}
			>
				<PencilIcon className="size-4" />
			</Button>
			<UpdateWebhookEndpointSheet
				webhookEndpoint={webhookEndpoint}
				open={open}
				onOpenChange={setOpen}
			/>
		</>
	);
}

type DeleteWebhookEndpointButtonProps = {
	webhookEndpoint: WebhookEndpointRow;
	onConfirm: () => void;
	disabled: boolean;
};

function DeleteWebhookEndpointButton({
	webhookEndpoint,
	onConfirm,
	disabled,
}: DeleteWebhookEndpointButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setOpen(true)}
					disabled={disabled}
					aria-label={`Delete webhook endpoint ${webhookEndpoint.name}`}
				>
					<Trash2Icon className="size-4 text-destructive" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete webhook endpoint &ldquo;{webhookEndpoint.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This webhook endpoint will stop
						receiving actions immediately.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onClick={() => {
							onConfirm();
							setOpen(false);
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
