import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronsRightIcon } from "lucide-react";
import { RequirePermissions, useCurrentUser } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
								Use the dashboard to sign up for shifts, view and manage
								upcoming shifts, and keep track of your attendance.
							</p>
						</CardContent>
					</Card>

					<Card className="md:col-span-1">
						<CardContent>
							<div className="space-y-3">
								<Link to="/app/scheduling">
									<Button
										variant="outline"
										className="w-full flex items-center justify-between"
									>
										<span>Start Scheduling</span>
										<ChevronsRightIcon />
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
