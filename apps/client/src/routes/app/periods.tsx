import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { DatePicker } from "@/components/periods/date-picker";
import { PeriodsDropdown } from "@/components/periods/periods-dropdown";

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
	return (
		// vertical inline
		<div className="container p-4 space-y-3">
			<PeriodsDropdown />
			<h1>Shift Period Dates</h1>
			<DatePicker label="Start Date" />
			<DatePicker label="End Date" />
		</div>
	);
}
