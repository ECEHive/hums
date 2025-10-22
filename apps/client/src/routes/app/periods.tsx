import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarIcon, Plus } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { CreatePeriodSheet } from "@/components/periods/create-period-sheet";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/periods")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Periods />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["periods.list"];

function Periods() {
	const navigate = useNavigate();
	const [sheetOpen, setSheetOpen] = React.useState(false);

	const currentUser = useCurrentUser();
	const canCreate =
		currentUser && checkPermissions(currentUser, ["periods.create"]);

	const { data: periodsData, isLoading } = useQuery({
		queryKey: ["periods", { limit: 100, offset: 0 }],
		queryFn: async () => {
			return trpc.periods.list.query({
				limit: 100,
				offset: 0,
			});
		},
	});

	// Redirect to most recent period if periods exist
	React.useEffect(() => {
		if (periodsData?.periods && periodsData.periods.length > 0) {
			// Find the most recent period (latest end date)
			const sortedPeriods = [...periodsData.periods].sort(
				(a, b) => new Date(b.end).getTime() - new Date(a.end).getTime(),
			);
			const latestPeriod = sortedPeriods[0];
			navigate({
				to: "/app/periods/$periodId",
				params: { periodId: String(latestPeriod.id) },
			});
		}
	}, [periodsData, navigate]);

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	// Show empty state if no periods exist
	if (!periodsData?.periods || periodsData.periods.length === 0) {
		return (
			<div className="container p-4">
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CalendarIcon />
						</EmptyMedia>
						<EmptyTitle>No Periods Yet</EmptyTitle>
						<EmptyDescription>
							You haven't created any periods yet. Get started by creating your
							first period to manage shift schedules.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<CreatePeriodSheet
							open={sheetOpen}
							onOpenChange={setSheetOpen}
							trigger={
								<Button disabled={!canCreate}>
									<Plus className="mr-2 h-4 w-4" />
									Create Period
								</Button>
							}
						/>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return null; // This won't be reached due to the redirect
}
