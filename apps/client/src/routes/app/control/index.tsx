import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PowerIcon, PowerOffIcon, ZapIcon } from "lucide-react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequiredPermissions as TRequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/control/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ControlOverview />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = {
	any: ["control.points.list", "control.points.operate"],
} as TRequiredPermissions;

function ControlOverview() {
	const { data: pointsData } = useQuery({
		queryKey: ["control", "points", "summary"],
		queryFn: async () =>
			await trpc.control.points.list.query({ limit: 100, isActive: true }),
	});

	// Exclude DOOR type from on/off counts
	const switchPoints =
		pointsData?.points?.filter((p) => p.controlClass !== "DOOR") ?? [];
	const activePoints = switchPoints.filter((p) => p.currentState);
	const inactivePoints = switchPoints.filter((p) => !p.currentState);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Equipment Control</PageTitle>
				<PageDescription>
					Control and monitor equipment throughout the facility
				</PageDescription>
			</PageHeader>
			<PageContent>
				<div className="grid gap-6 md:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Control Points
							</CardTitle>
							<ZapIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{pointsData?.total ?? 0}</div>
							<p className="text-xs text-muted-foreground">
								Active equipment connections
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Currently On
							</CardTitle>
							<PowerIcon className="h-4 w-4 text-green-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								{activePoints.length}
							</div>
							<p className="text-xs text-muted-foreground">
								Equipment currently powered on
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Currently Off
							</CardTitle>
							<PowerOffIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{inactivePoints.length}</div>
							<p className="text-xs text-muted-foreground">
								Equipment currently powered off
							</p>
						</CardContent>
					</Card>
				</div>

				<div className="mt-6">
					<h3 className="text-lg font-medium mb-4">Quick Actions</h3>
					<div className="flex flex-wrap gap-4">
						<Button asChild>
							<Link to="/app/control/points">View Control Points</Link>
						</Button>
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
