import { trpc } from "@ecehive/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CalendarSyncButtonProps = {
	variant?: "default" | "outline" | "secondary" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
	className?: string;
};

export function CalendarSyncButton({
	variant = "outline",
	size = "default",
	className,
}: CalendarSyncButtonProps) {
	const [open, setOpen] = useState(false);
	const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const generateUrlMutation = useMutation({
		mutationFn: async () => {
			return trpc.users.generateIcalUrl.mutate({});
		},
		onSuccess: (data) => {
			setCalendarUrl(data.url);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to generate calendar URL");
		},
	});

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (newOpen && !calendarUrl) {
			generateUrlMutation.mutate();
		}
		if (!newOpen) {
			setCopied(false);
		}
	};

	const handleCopy = async () => {
		if (!calendarUrl) return;

		try {
			await navigator.clipboard.writeText(calendarUrl);
			setCopied(true);
			toast.success("Calendar URL copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy to clipboard");
		}
	};

	const handleOpenInCalendar = () => {
		if (!calendarUrl) return;

		// Try to open with webcal:// protocol which most calendar apps support
		const webcalUrl = calendarUrl.replace(/^https?:\/\//, "webcal://");
		window.open(webcalUrl, "_blank");
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button variant={variant} size={size} className={className}>
					<CalendarPlus className="h-4 w-4 mr-2" />
					Sync to Calendar
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Sync Shifts to External Calendar</DialogTitle>
					<DialogDescription>
						Add your HUMS shifts to your favorite calendar app. Copy the URL
						below and subscribe to it in your calendar application (Google
						Calendar, Apple Calendar, Outlook, etc.).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{generateUrlMutation.isPending ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							<span className="ml-2 text-muted-foreground">
								Generating calendar URL...
							</span>
						</div>
					) : calendarUrl ? (
						<>
							<div className="space-y-2">
								<Label htmlFor="calendar-url">Calendar URL</Label>
								<div className="flex gap-2">
									<Input
										id="calendar-url"
										value={calendarUrl}
										readOnly
										className="font-mono text-xs"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={handleCopy}
										className="flex-shrink-0"
									>
										{copied ? (
											<Check className="h-4 w-4 text-green-500" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>

							<div className="rounded-lg border bg-muted/50 p-4 space-y-3">
								<h4 className="font-medium text-sm">How to subscribe:</h4>
								<ul className="text-sm text-muted-foreground space-y-2">
									<li>
										<strong>Google Calendar:</strong> Settings → Add calendar →
										From URL → Paste the URL
									</li>
									<li>
										<strong>Apple Calendar:</strong> File → New Calendar
										Subscription → Paste the URL
									</li>
									<li>
										<strong>Outlook:</strong> Add calendar → Subscribe from web
										→ Paste the URL
									</li>
								</ul>
							</div>

							<p className="text-xs text-muted-foreground">
								This URL is unique to your account. Keep it private as anyone
								with access can view your shift schedule.
							</p>
						</>
					) : generateUrlMutation.isError ? (
						<div className="text-center py-8">
							<p className="text-destructive">
								Failed to generate calendar URL. Please try again.
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-4"
								onClick={() => generateUrlMutation.mutate()}
							>
								Retry
							</Button>
						</div>
					) : null}
				</div>

				<DialogFooter className="flex-col sm:flex-row gap-2">
					{calendarUrl && (
						<Button
							variant="outline"
							onClick={handleOpenInCalendar}
							className="w-full sm:w-auto"
						>
							<ExternalLink className="h-4 w-4 mr-2" />
							Open in Calendar App
						</Button>
					)}
					<Button
						variant="secondary"
						onClick={() => setOpen(false)}
						className="w-full sm:w-auto"
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
