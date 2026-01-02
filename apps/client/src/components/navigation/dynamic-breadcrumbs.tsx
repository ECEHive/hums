import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Map of route IDs to human-readable labels
const routeLabels: Record<string, string> = {
	"/app": "Home",
	"/app/users": "Users",
	"/app/kiosks": "Kiosks",
	"/app/my-agreements": "My Agreements",
	"/app/my-sessions": "My Sessions",
	"/app/periods": "Periods",
	"/app/api-tokens": "API Tokens",
	"/app/audit-logs": "Audit Logs",
	"/shifts": "Shifts",
	"/shifts/": "Dashboard",
	"/shifts/shift-schedules": "Shift Schedules",
	"/shifts/scheduling": "Scheduling",
	"/shifts/shift-types": "Shift Types",
	"/shifts/period-exceptions": "Period Exceptions",
	"/shifts/period-details": "Period Details",
	"/shifts/manage-users": "Manage Users",
	"/shifts/my-shifts": "My Shifts",
	"/shifts/attendance": "Attendance",
	"/shifts/reports": "Reports",
};

interface BreadcrumbSegment {
	path: string;
	label: string;
	isLast: boolean;
}

export function DynamicBreadcrumbs() {
	const matches = useMatches();

	// Filter out root and get meaningful route segments
	const breadcrumbSegments: BreadcrumbSegment[] = [];

	matches.forEach((match, index) => {
		const routeId = match.routeId;

		// Skip root route
		if (routeId === "__root__") return;

		// Get the label for this route
		const label = routeLabels[routeId];
		if (!label) return;

		// Get the pathname from the match
		const path = match.pathname;

		breadcrumbSegments.push({
			path,
			label,
			isLast: index === matches.length - 1,
		});
	});

	// Don't render breadcrumbs if we don't have any segments
	if (breadcrumbSegments.length === 0) {
		return null;
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbSegments.map((segment) => (
					<div key={segment.path} className="contents">
						<BreadcrumbItem>
							{segment.isLast ? (
								<BreadcrumbPage>{segment.label}</BreadcrumbPage>
							) : (
								<BreadcrumbLink asChild>
									<Link to={segment.path}>{segment.label}</Link>
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
						{!segment.isLast && (
							<BreadcrumbSeparator>
								<ChevronRight className="h-4 w-4" />
							</BreadcrumbSeparator>
						)}
					</div>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
