import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarIcon, CheckCircleIcon, InfoIcon, Pencil } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { usePeriod } from "@/components/providers/period-provider";
import { CreatePeriodSheet } from "@/components/periods/create-period-sheet";
import { DeleteDialog } from "@/components/periods/delete-dialog";
import { EditPeriodSheet } from "@/components/periods/edit-period-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";
import { formatInAppTimezone } from "@/lib/timezone";

export const Route = createFileRoute("/shifts/period-details")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <PeriodDetail />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["periods.get"] as RequiredPermissions;

function PeriodDetail() {
	const { period: periodId } = usePeriod();
	const [createSheetOpen, setCreateSheetOpen] = React.useState(false);
	const [editSheetOpen, setEditSheetOpen] = React.useState(false);

	const { data: periodData, isLoading } = useQuery({
		queryKey: ["period", Number(periodId)],
		queryFn: async () => {
			return trpc.periods.get.query({ id: Number(periodId) });
		},
	});

	const currentUser = useCurrentUser();
	const canEdit =
		currentUser && checkPermissions(currentUser, ["periods.update"]);
	const canDelete =
		currentUser && checkPermissions(currentUser, ["periods.delete"]);

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (!periodData?.period) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Period Not Found</PageTitle>
				</PageHeader>
				<PageContent>
					<p className="text-muted-foreground">
						The requested period could not be found.
					</p>
				</PageContent>
			</Page>
		);
	}

	const period = periodData.period;

	// Convert period data for EditPeriodSheet
	const editablePeriod = {
		id: period.id,
		name: period.name,
		start: period.start.toISOString(),
		end: period.end.toISOString(),
		visibleStart: period.visibleStart.toISOString(),
		visibleEnd: period.visibleEnd.toISOString(),
		scheduleSignupStart: period.scheduleSignupStart.toISOString(),
		scheduleSignupEnd: period.scheduleSignupEnd.toISOString(),
		scheduleModifyStart: period.scheduleModifyStart.toISOString(),
		scheduleModifyEnd: period.scheduleModifyEnd.toISOString(),
		min: period.min,
		max: period.max,
		minMaxUnit: period.minMaxUnit,
		roles:
			period.roles?.map((role) => ({ id: role.id, name: role.name })) ?? [],
	};

	const unitLabels = {
		count: "shifts",
		hours: "hours",
		minutes: "minutes",
	} as const;

	const hasRequirements = period.min !== null || period.max !== null;
	const unitLabel = period.minMaxUnit
		? unitLabels[period.minMaxUnit as keyof typeof unitLabels]
		: null;

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>{period.name}</PageTitle>
					<p className="text-sm text-muted-foreground mt-1">
						Review the selected period's schedule windows and requirements.
					</p>
				</div>
				<PageActions>
					{canEdit && (
						<Button variant="outline" onClick={() => setEditSheetOpen(true)}>
							<Pencil className="h-4 w-4 mr-2" /> Edit
						</Button>
					)}
					{canDelete && (
						<DeleteDialog periodId={period.id} periodName={period.name} />
					)}
				</PageActions>
			</PageHeader>

			<PageContent>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<InfoIcon className="h-5 w-5" /> General Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Period Name
							</div>
							<div className="text-lg font-semibold">{period.name}</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Allowed Roles
							</div>
							{period.roles.length > 0 ? (
								<div className="flex flex-wrap gap-2 mt-2">
									{period.roles.map((role) => (
										<span
											key={role.id}
											className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
										>
											{role.name ?? "Unknown role"}
										</span>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground mt-1">
									All users can view and interact with this period.
								</p>
							)}
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground mb-3">
								Period Dates
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<div className="text-xs uppercase text-muted-foreground tracking-wide">
										Start
									</div>
									<div>{formatInAppTimezone(period.start)}</div>
								</div>
								<div>
									<div className="text-xs uppercase text-muted-foreground tracking-wide">
										End
									</div>
									<div>{formatInAppTimezone(period.end)}</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CalendarIcon className="h-5 w-5" /> Windows
						</CardTitle>
						<p className="text-sm text-muted-foreground">
							Visibility, signup, and modification access windows.
						</p>
					</CardHeader>
					<CardContent className="space-y-6">
						{[
							{
								title: "Visibility Window",
								description: "Controls when the period can be seen by users.",
								start: period.visibleStart,
								end: period.visibleEnd,
							},
							{
								title: "Signup Window",
								description: "Defines when users may schedule shifts.",
								start: period.scheduleSignupStart,
								end: period.scheduleSignupEnd,
							},
							{
								title: "Modification Window",
								description: "Determines when users may drop or makeup shifts.",
								start: period.scheduleModifyStart,
								end: period.scheduleModifyEnd,
							},
						].map((window) => (
							<div key={window.title} className="space-y-2">
								<div>
									<div className="text-sm font-semibold">{window.title}</div>
									<p className="text-xs text-muted-foreground">
										{window.description}
									</p>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div>
										<div className="text-xs uppercase text-muted-foreground tracking-wide">
											Start
										</div>
										<div>{formatInAppTimezone(window.start)}</div>
									</div>
									<div>
										<div className="text-xs uppercase text-muted-foreground tracking-wide">
											End
										</div>
										<div>{formatInAppTimezone(window.end)}</div>
									</div>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircleIcon className="h-5 w-5" /> Shift Requirements
						</CardTitle>
						<p className="text-sm text-muted-foreground">
							Minimum and maximum obligations for the period.
						</p>
					</CardHeader>
					<CardContent>
						{hasRequirements && unitLabel ? (
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<div className="text-xs uppercase text-muted-foreground tracking-wide">
										Minimum
									</div>
									<div>
										{period.min !== null
											? `${period.min} ${unitLabel}`
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-xs uppercase text-muted-foreground tracking-wide">
										Maximum
									</div>
									<div>
										{period.max !== null
											? `${period.max} ${unitLabel}`
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No shift requirements configured
							</div>
						)}
					</CardContent>
				</Card>

				<CreatePeriodSheet
					open={createSheetOpen}
					onOpenChange={setCreateSheetOpen}
				/>
				<EditPeriodSheet
					open={editSheetOpen}
					onOpenChange={setEditSheetOpen}
					period={editablePeriod}
				/>
			</PageContent>
		</Page>
	);
}
