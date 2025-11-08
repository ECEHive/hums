import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ShiftsIndex />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = {
	any: [
		"periods.list",
		"shift_types.list",
		"shift_schedules.list",
		"shift_schedules.register",
		"shift_schedules.unregister",
	],
} as RequiredPermissions;

function ShiftsIndex() {
	const { period: periodId } = usePeriod();

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<div className="container p-4 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Shifts</h1>
			</div>
		</div>
	);
}
