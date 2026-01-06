import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBreadcrumbLabel } from "@/lib/routeMetadata";

interface BreadcrumbSegment {
	path: string;
	label: string;
	isLast: boolean;
}

/**
 * Dynamic breadcrumbs component that builds breadcrumb trail based on URL path
 * Examples:
 * - /app → "Home"
 * - /app/users → "Home > Users"
 * - /app/shifts/scheduling → "Home > Shifts > Scheduling"
 */
export function DynamicBreadcrumbs() {
	const location = useLocation();
	const pathname = location.pathname;

	// Build breadcrumb segments from URL path
	const breadcrumbSegments: BreadcrumbSegment[] = [];

	// Split pathname into parts (e.g., "/app/shifts/scheduling" → ["app", "shifts", "scheduling"])
	const pathParts = pathname.split("/").filter(Boolean);

	// Build cumulative paths and look up labels
	let currentPath = "";
	for (let i = 0; i < pathParts.length; i++) {
		currentPath += `/${pathParts[i]}`;
		const label = getBreadcrumbLabel(currentPath);

		if (label) {
			breadcrumbSegments.push({
				path: currentPath,
				label,
				isLast: i === pathParts.length - 1,
			});
		}
	}

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
