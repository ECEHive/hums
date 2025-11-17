import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	Loader2Icon,
	RefreshCcwIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { createTokenColumns } from "@/components/api-tokens/columns";
import { DataTable } from "@/components/api-tokens/data-table";
import type { ApiTokenRow } from "@/components/api-tokens/types";
import { MissingPermissions } from "@/components/missing-permissions";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/lib/debounce";
import { checkPermissions } from "@/lib/permissions";

export const permissions = ["apiTokens.list"];

export const Route = createFileRoute("/app/api-tokens")({
	component: () =>
		RequirePermissions({
			permissions,
			forbiddenFallback: <MissingPermissions />,
			children: <ApiTokensPage />,
		}),
});

type GeneratedToken = {
	name: string;
	value: string;
};

function ApiTokensPage() {
	const { user } = useAuth();
	const canCreate = user ? checkPermissions(user, ["apiTokens.create"]) : false;
	const canDelete = user ? checkPermissions(user, ["apiTokens.delete"]) : false;
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, 250);
	const [tokenToShow, setTokenToShow] = useState<GeneratedToken | null>(null);
	const queryClient = useQueryClient();

	const queryArgs = useMemo(() => {
		const trimmed = debouncedSearch.trim();
		return {
			search: trimmed.length ? trimmed : undefined,
			limit: 100,
			offset: 0,
		};
	}, [debouncedSearch]);

	const { data, isLoading, isFetching, refetch } = useQuery({
		queryKey: ["apiTokens", queryArgs],
		queryFn: () => trpc.apiTokens.list.query(queryArgs),
		staleTime: 10_000,
	});

	const deleteMutation = useMutation({
		mutationFn: ({ id }: { id: number }) =>
			trpc.apiTokens.delete.mutate({ id }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
			toast.success("Token removed");
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to delete");
		},
	});

	const tokens: ApiTokenRow[] = data?.tokens ?? [];

	const handleDelete = useCallback(
		(tokenId: number) => deleteMutation.mutate({ id: tokenId }),
		[deleteMutation],
	);

	const columns = useMemo(
		() =>
			createTokenColumns({
				renderActions: (token) => (
					<DeleteTokenButton
						token={token}
						onConfirm={() => handleDelete(token.id)}
						disabled={!canDelete || deleteMutation.isPending}
					/>
				),
			}),
		[canDelete, deleteMutation.isPending, handleDelete],
	);

	return (
		<div className="container space-y-4 p-4">
			<h1 className="text-2xl font-bold">API Tokens</h1>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<Input
					placeholder="Search tokens..."
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className="max-w-md"
				/>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="mr-2 size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="mr-2 size-4" />
						)}
						Refresh
					</Button>
					<CreateTokenDialog
						disabled={!canCreate}
						onTokenCreated={(payload) => setTokenToShow(payload)}
					/>
				</div>
			</div>

			<DataTable columns={columns} data={tokens} isLoading={isLoading} />

			<TokenRevealDialog
				token={tokenToShow}
				onClose={() => setTokenToShow(null)}
			/>
		</div>
	);
}

type CreateTokenDialogProps = {
	disabled: boolean;
	onTokenCreated: (token: GeneratedToken) => void;
};

function CreateTokenDialog({
	disabled,
	onTokenCreated,
}: CreateTokenDialogProps) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [error, setError] = useState<string | null>(null);
	const nameId = useId();
	const descriptionId = useId();
	const expiresId = useId();
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: () =>
			trpc.apiTokens.create.mutate({
				name: name.trim(),
				description: description.trim() || undefined,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
			}),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
			onTokenCreated({ name: name.trim(), value: result.token });
			setName("");
			setDescription("");
			setExpiresAt("");
			setError(null);
			setOpen(false);
			toast.success("Token created");
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to create token");
		},
	});

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);

		if (!name.trim()) {
			setError("Name is required");
			return;
		}

		if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
			setError("Expiration must be a valid date");
			return;
		}

		createMutation.mutate();
	};

	return (
		<>
			<Button onClick={() => setOpen(true)} disabled={disabled}>
				Create Token
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create API Token</DialogTitle>
						<DialogDescription>
							Provide a descriptive name. The token value is only shown once
							after creation.
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
							<FieldLabel htmlFor={descriptionId}>Description</FieldLabel>
							<Textarea
								id={descriptionId}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Optional context about how this token will be used"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={expiresId}>Expires At</FieldLabel>
							<Input
								id={expiresId}
								type="datetime-local"
								value={expiresAt}
								onChange={(event) => setExpiresAt(event.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Leave blank for tokens without an expiry.
							</p>
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

type DeleteTokenButtonProps = {
	token: ApiTokenRow;
	onConfirm: () => void;
	disabled: boolean;
};

function DeleteTokenButton({
	token,
	onConfirm,
	disabled,
}: DeleteTokenButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setOpen(true)}
					disabled={disabled}
				>
					<Trash2Icon className="size-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete token &ldquo;{token.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. Any integrations using this token will
						stop working immediately.
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

function TokenRevealDialog({
	token,
	onClose,
}: {
	token: GeneratedToken | null;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<Dialog
			open={token !== null}
			onOpenChange={(next) => {
				if (!next) {
					setCopied(false);
					onClose();
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New token ready</DialogTitle>
					<DialogDescription>
						Copy and store this value in a secure location. You will not be able
						to retrieve it again.
					</DialogDescription>
				</DialogHeader>
				{token && (
					<div className="space-y-3">
						<div className="rounded border bg-muted/60 p-3 font-mono text-sm break-all">
							{token.value}
						</div>
						<Button
							variant={copied ? "secondary" : "default"}
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(token.value);
									setCopied(true);
									toast.success("Copied token to clipboard");
								} catch (err) {
									console.error(err);
									toast.error("Unable to copy token");
								}
							}}
						>
							{copied ? "Copied" : "Copy token"}
						</Button>
					</div>
				)}
				<div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100">
					<AlertTriangleIcon className="size-4" />
					<span>
						Store this token securely. Lost tokens require regeneration.
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}
