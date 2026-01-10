import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClockIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RequirePermissions, useCurrentUser } from "@/auth";
import { QuickLinksCard } from "@/components/app/quick-links-card";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/app/_app/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AppIndexLayout />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [];

function AppIndexLayout() {
	const user = useCurrentUser();
	const queryClient = useQueryClient();
	const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);

	const { data: sessionStats } = useQuery({
		queryKey: ["mySessionStats"],
		queryFn: async () => {
			return trpc.sessions.myStats.query({});
		},
	});

	const endSessionMutation = useMutation({
		mutationFn: async () => {
			return trpc.sessions.endMySession.mutate({});
		},
		onSuccess: () => {
			toast.success("Session ended successfully");
			queryClient.invalidateQueries({ queryKey: ["mySessionStats"] });
			setShowEndSessionDialog(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to end session");
			setShowEndSessionDialog(false);
		},
	});

	const handleEndSession = () => {
		endSessionMutation.mutate();
	};

	const canEndSession =
		sessionStats?.currentlyActive &&
		sessionStats?.activeSessionType === "regular";

	const initials = (user?.name || user?.email || "User")
		.split(" ")
		.map((s) => s[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div className="min-h-svh w-full p-4 md:p-6 pt-0 md:pt-0">
			<div className="container space-y-6">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<Card className="lg:col-span-2">
						<CardHeader>
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-foreground font-semibold">
									{/* Amanda wants profile pictures, that can go here eventually */}
									{initials}
								</div>

								<div>
									<h2 className="text-sm text-muted-foreground">
										Welcome back,
									</h2>
									<h1 className="text-2xl font-semibold">
										{user?.name || user?.email || "User"}
									</h1>
								</div>
							</div>
						</CardHeader>

						<CardContent>
							<p className="text-muted-foreground">
								Use this dashboard to navigate to different sections of the user
								management system.
							</p>
						</CardContent>
					</Card>

					<QuickLinksCard />
				</div>

				{/* Session Stats */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Current Status
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="text-2xl font-bold">
								{!sessionStats?.currentlyActive ? (
									<span className="text-muted-foreground">Inactive</span>
								) : sessionStats.activeSessionType === "staffing" ? (
									<span className="text-green-600">Staffing</span>
								) : (
									<span className="text-green-600">Active</span>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								{sessionStats?.currentlyActive
									? "in the space"
									: "not in the space"}
							</p>

							{canEndSession && (
								<Button
									onClick={() => setShowEndSessionDialog(true)}
									size="sm"
									variant="outline"
									className="w-full"
								>
									<LogOut className="mr-2 h-3 w-3" />
									End Session
								</Button>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Sessions
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{sessionStats?.totalSessions ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">sessions</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Hours</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{sessionStats?.totalHours ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">hours logged</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Average Session
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{sessionStats?.averageSessionHours ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">hours per session</p>
						</CardContent>
					</Card>
				</div>
			</div>

			<AlertDialog
				open={showEndSessionDialog}
				onOpenChange={setShowEndSessionDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>End Current Session?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to end your current session? This action
							cannot be undone and your session will be terminated immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={endSessionMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleEndSession}
							disabled={endSessionMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{endSessionMutation.isPending ? (
								<>
									<Spinner className="mr-2 h-3 w-3" />
									Ending...
								</>
							) : (
								"End Session"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
