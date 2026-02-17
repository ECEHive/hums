import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

type Credential = {
	id: number;
	value: string;
	createdAt: Date;
	updatedAt: Date;
};

type CredentialsSheetProps = {
	user: {
		id: number;
		username: string;
		name: string;
	};
	trigger?: JSX.Element;
};

export function CredentialsSheet({
	user,
	trigger,
}: CredentialsSheetProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [credentials, setCredentials] = useState<Credential[]>([]);
	const [loading, setLoading] = useState(false);
	const [newValue, setNewValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const currentUser = useAuth().user;
	const canView =
		currentUser && checkPermissions(currentUser, ["credentials.list"]);
	const canEdit =
		currentUser && checkPermissions(currentUser, ["credentials.update"]);

	const fetchCredentials = useCallback(async () => {
		if (!canView) return;
		setLoading(true);
		setError(null);
		try {
			const result = await trpc.credentials.list.query({ userId: user.id });
			setCredentials(result.credentials as Credential[]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [user.id, canView]);

	useEffect(() => {
		if (open) {
			fetchCredentials();
		}
	}, [open, fetchCredentials]);

	const handleAdd = async () => {
		if (!newValue.trim()) return;
		setSaving(true);
		setError(null);
		try {
			await trpc.credentials.create.mutate({
				userId: user.id,
				value: newValue.trim(),
			});
			setNewValue("");
			await fetchCredentials();
			queryClient.invalidateQueries({ queryKey: ["users"] });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (credentialId: number) => {
		setDeletingId(credentialId);
		setError(null);
		try {
			await trpc.credentials.delete.mutate({ id: credentialId });
			await fetchCredentials();
			queryClient.invalidateQueries({ queryKey: ["users"] });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setDeletingId(null);
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setNewValue("");
			setError(null);
		}
	};

	if (!canView) return null;

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>
				{trigger ?? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`View credentials for ${user.username}`}
						title={`View credentials for ${user.username}`}
					>
						<KeyRoundIcon className="h-4 w-4" />
					</Button>
				)}
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Credentials</SheetTitle>
					<SheetDescription>
						Manage credentials for {user.name || user.username}.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
					{loading ? (
						<div className="flex justify-center py-8">
							<Spinner />
						</div>
					) : credentials.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4 text-center">
							No credentials found.
						</p>
					) : (
						<ul className="space-y-2">
							{credentials.map((cred) => (
								<li
									key={cred.id}
									className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
								>
									<div className="flex items-center gap-2 min-w-0">
										<Badge
											variant="secondary"
											className="font-mono text-xs truncate"
										>
											{cred.value}
										</Badge>
									</div>
									{canEdit && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="shrink-0 text-destructive hover:text-destructive"
											disabled={deletingId === cred.id}
											onClick={() => handleDelete(cred.id)}
											aria-label={`Delete credential ${cred.value}`}
										>
											{deletingId === cred.id ? (
												<Spinner />
											) : (
												<Trash2Icon className="h-4 w-4" />
											)}
										</Button>
									)}
								</li>
							))}
						</ul>
					)}

					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>

				<SheetFooter>
					{canEdit && (
						<div className="flex w-full gap-2">
							<Input
								placeholder="Add credential value"
								value={newValue}
								onChange={(e) => setNewValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAdd();
									}
								}}
								className="flex-1"
							/>
							<Button
								type="button"
								size="icon"
								disabled={saving || !newValue.trim()}
								onClick={handleAdd}
								aria-label="Add credential"
							>
								{saving ? <Spinner /> : <PlusIcon className="h-4 w-4" />}
							</Button>
						</div>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
