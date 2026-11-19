import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
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

export function RegenerateGatewayTokenDialog({
	gateway,
	onTokenCreated,
}: {
	gateway: { id: number; name: string };
	onTokenCreated: (token: { name: string; value: string }) => void;
}): JSX.Element {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async () =>
			trpc.control.gateways.regenerateToken.mutate({ id: gateway.id }),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["control", "gateways"] });
			setOpen(false);
			setError(null);
			onTokenCreated({ name: result.name, value: result.accessToken });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : String(err));
		},
	});

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setError(null);
			}}
		>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Regenerate token for ${gateway.name}`}
					title="Regenerate access token"
				>
					<KeyRoundIcon className="h-4 w-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Regenerate token for &ldquo;{gateway.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						The current token stops working immediately. Any kiosk using it will
						fail every scan until you give it the new token.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <p className="text-sm text-destructive px-6">{error}</p>}
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={mutation.isPending}
						onClick={(e) => {
							e.preventDefault();
							mutation.mutate();
						}}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{mutation.isPending ? "Regenerating..." : "Regenerate"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
