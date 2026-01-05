import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ConnectionState = "connected" | "connecting" | "disconnected";

interface ConnectionStatusProps {
	state: ConnectionState;
	onReconnect?: () => void;
	className?: string;
}

/**
 * Small, discrete connection status indicator.
 * Shows live connection status with a reconnect button when disconnected.
 */
export function ConnectionStatus({
	state,
	onReconnect,
	className,
}: ConnectionStatusProps) {
	if (state === "connected") {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-1.5 text-xs text-muted-foreground",
							className,
						)}
					>
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
						</span>
						<span className="sr-only sm:not-sr-only">Live</span>
					</div>
				</TooltipTrigger>
				<TooltipContent>Connected - receiving live updates</TooltipContent>
			</Tooltip>
		);
	}

	if (state === "connecting") {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-1.5 text-xs text-muted-foreground",
							className,
						)}
					>
						<Wifi className="h-3 w-3 animate-pulse text-yellow-500" />
						<span className="sr-only sm:not-sr-only">Connecting...</span>
					</div>
				</TooltipTrigger>
				<TooltipContent>Connecting to server...</TooltipContent>
			</Tooltip>
		);
	}

	// Disconnected state
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className={cn(
						"flex items-center gap-1.5 text-xs text-muted-foreground",
						className,
					)}
				>
					<WifiOff className="h-3 w-3 text-destructive" />
					<span className="sr-only sm:not-sr-only text-destructive">
						Disconnected
					</span>
					{onReconnect && (
						<Button
							variant="ghost"
							size="sm"
							className="h-5 px-1.5 text-xs"
							onClick={onReconnect}
						>
							<RefreshCw className="h-3 w-3 mr-1" />
							Reconnect
						</Button>
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent>
				Connection lost - click reconnect to restore live updates
			</TooltipContent>
		</Tooltip>
	);
}
