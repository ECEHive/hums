import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { checkPermissions } from "@/lib/permissions";
import type { WebhookEndpointRow } from "./types";

type UpdateWebhookEndpointSheetProps = {
	webhookEndpoint: WebhookEndpointRow;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function UpdateWebhookEndpointSheet({
	webhookEndpoint,
	open,
	onOpenChange,
}: UpdateWebhookEndpointSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [name, setName] = useState(webhookEndpoint.name);
	const [url, setUrl] = useState(webhookEndpoint.url);
	const [secret, setSecret] = useState(webhookEndpoint.secret ?? "");
	const [sendActions, setSendActions] = useState(webhookEndpoint.sendActions);
	const [sendTickets, setSendTickets] = useState(
		webhookEndpoint.sendTickets ?? false,
	);
	const [isActive, setIsActive] = useState(webhookEndpoint.isActive);
	const sendActionsId = useId();
	const sendTicketsId = useId();

	const currentUser = useAuth().user;
	const canUpdateWebhookEndpoint =
		currentUser && checkPermissions(currentUser, ["webhooks.endpoints.update"]);

	useEffect(() => {
		if (!open) return;
		setName(webhookEndpoint.name);
		setUrl(webhookEndpoint.url);
		setSecret(webhookEndpoint.secret ?? "");
		setSendActions(webhookEndpoint.sendActions);
		setSendTickets(webhookEndpoint.sendTickets ?? false);
		setIsActive(webhookEndpoint.isActive);
		setServerError(null);
	}, [open, webhookEndpoint]);

	const updateMutation = useMutation({
		mutationFn: () =>
			trpc.webhookEndpoints.update.mutate({
				id: webhookEndpoint.id,
				name: name.trim(),
				url: url.trim(),
				secret: secret.trim() || undefined,
				sendActions,
				sendTickets,
				isActive,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["webhookEndpoints"] });
			onOpenChange(false);
		},
		onError: (error) => {
			setServerError(error instanceof Error ? error.message : String(error));
		},
	});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setServerError(null);
		updateMutation.mutate();
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
				<SheetHeader>
					<SheetTitle>Edit Webhook Endpoint</SheetTitle>
					<SheetDescription>
						Update the webhook endpoint configuration.
					</SheetDescription>
				</SheetHeader>
				<form className="space-y-6 px-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="webhook-name">Name</Label>
						<Input
							id="webhook-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="webhook-url">URL</Label>
						<Input
							id="webhook-url"
							type="url"
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="webhook-secret">Secret</Label>
						<Textarea
							id="webhook-secret"
							value={secret}
							onChange={(event) => setSecret(event.target.value)}
							rows={3}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={sendActionsId}>Send Actions</Label>
						<Textarea
							id={sendActionsId}
							value={sendActions.join(", ")}
							onChange={(event) =>
								setSendActions(
									event.target.value.split(",").map((action) => action.trim()),
								)
							}
							placeholder="Comma-separated list of actions to send"
						/>
					</div>
					<div className="flex items-start gap-2">
						<Checkbox
							id={sendTicketsId}
							checked={sendTickets}
							onCheckedChange={(checked) => setSendTickets(checked === true)}
						/>
						<div className="space-y-1">
							<Label htmlFor={sendTicketsId}>Send Tickets</Label>
							<p className="text-sm text-muted-foreground">
								Send all new tickets created to this endpoint.
							</p>
						</div>
					</div>
					<Label className="flex items-center gap-2">
						<Checkbox
							checked={isActive}
							onCheckedChange={(checked) => setIsActive(checked === true)}
						/>
						Active
					</Label>
					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}
					<SheetFooter>
						<Button
							type="submit"
							disabled={!canUpdateWebhookEndpoint || updateMutation.isPending}
						>
							{updateMutation.isPending ? "Saving..." : "Save changes"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
