import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Pencil } from "lucide-react";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
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
			<div className="container p-4 space-y-4">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-3xl font-bold">Period Not Found</h1>
				</div>
				<p className="text-muted-foreground">
					The requested period could not be found.
				</p>
			</div>
		);
	}

	const period = periodData.period;

	// Convert period data for EditPeriodSheet
	const editablePeriod = {
		id: period.id,
		name: period.name,
		start: period.start.toISOString(),
		end: period.end.toISOString(),
		visibleStart: period.visibleStart?.toISOString() ?? null,
		visibleEnd: period.visibleEnd?.toISOString() ?? null,
		scheduleSignupStart: period.scheduleSignupStart?.toISOString() ?? null,
		scheduleSignupEnd: period.scheduleSignupEnd?.toISOString() ?? null,
		scheduleModifyStart: period.scheduleModifyStart?.toISOString() ?? null,
		scheduleModifyEnd: period.scheduleModifyEnd?.toISOString() ?? null,
		min: period.min,
		max: period.max,
		minMaxUnit: period.minMaxUnit,
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
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Period Detail</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Period Information
						</CardTitle>
						<div className="flex items-center gap-2">
							{canEdit && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setEditSheetOpen(true)}
									aria-label="Edit period"
								>
									<Pencil className="h-4 w-4" />
								</Button>
							)}
							{canDelete && (
								<DeleteDialog periodId={period.id} periodName={period.name} />
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Name
						</div>
						<div className="text-lg">{period.name}</div>
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">Period Dates</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Start Date
								</div>
								<div>{formatInAppTimezone(period.start)}</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									End Date
								</div>
								<div>{formatInAppTimezone(period.end)}</div>
							</div>
						</div>
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">Visibility Window</div>
						{period.visibleStart || period.visibleEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Visible Start
									</div>
									<div>
										{period.visibleStart
											? formatInAppTimezone(period.visibleStart)
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Visible End
									</div>
									<div>
										{period.visibleEnd
											? formatInAppTimezone(period.visibleEnd)
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No visibility window configured
							</div>
						)}
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">
							Schedule Signup Window
						</div>
						{period.scheduleSignupStart || period.scheduleSignupEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Signup Start
									</div>
									<div>
										{period.scheduleSignupStart
											? formatInAppTimezone(period.scheduleSignupStart)
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Signup End
									</div>
									<div>
										{period.scheduleSignupEnd
											? formatInAppTimezone(period.scheduleSignupEnd)
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No signup window configured
							</div>
						)}
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">
							Schedule Modification Window
						</div>
						{period.scheduleModifyStart || period.scheduleModifyEnd ? (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Modify Start
									</div>
									<div>
										{period.scheduleModifyStart
											? formatInAppTimezone(period.scheduleModifyStart)
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Modify End
									</div>
									<div>
										{period.scheduleModifyEnd
											? formatInAppTimezone(period.scheduleModifyEnd)
											: "Not set"}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No modification window configured
							</div>
						)}
					</div>

					<div>
						<div className="text-sm font-semibold mb-3">Shift Requirements</div>
						{hasRequirements && unitLabel ? (
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Minimum
									</div>
									<div>
										{period.min !== null
											? `${period.min} ${unitLabel}`
											: "Not set"}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
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
					</div>
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
		</div>
	);
}
