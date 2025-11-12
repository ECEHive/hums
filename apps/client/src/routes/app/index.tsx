import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronsRightIcon, ClockIcon } from "lucide-react";
import { RequirePermissions, useCurrentUser } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/")({
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

	const { data: sessionStats } = useQuery({
		queryKey: ["mySessionStats"],
		queryFn: async () => {
			return trpc.sessions.myStats.query({});
		},
	});

	const initials = (user?.name || user?.email || "User")
		.split(" ")
		.map((s) => s[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div className="min-h-svh w-full p-6">
			<div className="mx-auto max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Card className="md:col-span-2">
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

					<Card className="md:col-span-1">
						<CardContent>
							<div className="flex flex-col space-y-3">
								{checkPermissions(user, {
									any: [
										"shift_schedules.register",
										"shift_schedules.unregister",
									],
								}) && (
									<Link to="/shifts/scheduling">
										<Button
											variant="outline"
											className="w-full flex items-center justify-between"
										>
											<span>Schedule Shifts</span>
											<ChevronsRightIcon />
										</Button>
									</Link>
								)}
								{checkPermissions(user, {
									any: [
										"shift_schedules.register",
										"shift_schedules.unregister",
									],
								}) && (
									<Link to="/shifts/my-shifts">
										<Button
											variant="outline"
											className="w-full flex items-center justify-between"
										>
											<span>View My Shifts</span>
											<ChevronsRightIcon />
										</Button>
									</Link>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Session Stats */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Current Status
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{sessionStats?.currentlyActive ? (
									<span className="text-green-600">Active</span>
								) : (
									<span className="text-muted-foreground">Inactive</span>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								{sessionStats?.currentlyActive
									? "in the space"
									: "not in the space"}
							</p>
							{sessionStats?.currentlyActive &&
								sessionStats.activeSessionType && (
									<div className="mt-2">
										<Badge
											variant={
												sessionStats.activeSessionType === "staffing"
													? "default"
													: "secondary"
											}
										>
											{sessionStats.activeSessionType === "staffing"
												? "Staffing"
												: "Regular"}
										</Badge>
									</div>
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
		</div>
	);
}
