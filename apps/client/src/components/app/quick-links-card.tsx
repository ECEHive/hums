import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	ChevronRightIcon,
	FileBarChartIcon,
	HistoryIcon,
	ScrollTextIcon,
	StarIcon,
	UserPlusIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useCurrentUser } from "@/auth";
import { usePeriod } from "@/components/providers/period-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageHistory } from "@/hooks/use-page-history";
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions } from "@/lib/permissions";

type QuickLink = {
	title: string;
	to: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	weight: number;
	condition: (context: QuickLinkContext) => boolean;
};

type QuickLinkContext = {
	user: ReturnType<typeof useCurrentUser>;
	canAccessShifts: boolean;
	hasActivePeriod: boolean;
};

// Define quick links with weights (higher = more priority)
const QUICK_LINKS: QuickLink[] = [
	{
		title: "Audit Logs",
		to: "/app/audit-logs",
		icon: ScrollTextIcon,
		weight: 100,
		condition: ({ user }) => checkPermissions(user, ["audit_logs.list"]),
	},
	{
		title: "Shift Reports",
		to: "/app/shifts/reports",
		icon: FileBarChartIcon,
		weight: 90,
		condition: ({ user, hasActivePeriod }) =>
			hasActivePeriod && checkPermissions(user, ["reports.generate"]),
	},
	{
		title: "Register for Shifts",
		to: "/app/shifts/scheduling",
		icon: UserPlusIcon,
		weight: 80,
		condition: ({ canAccessShifts, hasActivePeriod }) =>
			canAccessShifts && hasActivePeriod,
	},
	{
		title: "My Attendance",
		to: "/app/shifts/attendance",
		icon: CalendarCheckIcon,
		weight: 70,
		condition: ({ canAccessShifts, hasActivePeriod }) =>
			canAccessShifts && hasActivePeriod,
	},
	{
		title: "Session History",
		to: "/app/me/sessions",
		icon: HistoryIcon,
		weight: 60,
		condition: () => true, // Always available to authenticated users
	},
];

const MAX_QUICK_LINKS = 5;

export function QuickLinksCard() {
	const user = useCurrentUser();
	const { canAccessShifts } = useShiftAccess();
	const { period: currentPeriod } = usePeriod();
	const { mostVisitedPage } = usePageHistory();

	// Check if there's an active period with visibility window
	const { data: periodData } = useQuery({
		queryKey: ["period", currentPeriod],
		queryFn: async () => {
			if (!currentPeriod) return null;
			return trpc.periods.get.query({ id: Number(currentPeriod) });
		},
		enabled: !!currentPeriod,
	});

	const hasActivePeriod = useMemo(() => {
		if (!periodData?.period) return false;
		const now = new Date();
		return (
			periodData.period.visibleStart <= now &&
			periodData.period.visibleEnd >= now
		);
	}, [periodData]);

	// Filter and sort quick links based on conditions and weight
	const visibleQuickLinks = useMemo(() => {
		const context: QuickLinkContext = {
			user,
			canAccessShifts,
			hasActivePeriod,
		};

		const baseLinks = QUICK_LINKS.filter((link) => link.condition(context));

		// Add most visited page if it meets the threshold
		// Require at least 5 visits to ensure it's genuinely frequently accessed
		// This provides consistency - once it appears, it stays as long as it's frequently visited
		if (mostVisitedPage && mostVisitedPage.count >= 5) {
			const isAlreadyIncluded = baseLinks.some(
				(link) => link.to === mostVisitedPage.path,
			);

			if (!isAlreadyIncluded) {
				// Get a friendly name from the path
				const pathParts = mostVisitedPage.path.split("/").filter(Boolean);
				const title =
					pathParts[pathParts.length - 1]
						?.split("-")
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join(" ") || "Frequent Page";

				baseLinks.push({
					title,
					to: mostVisitedPage.path,
					icon: StarIcon,
					weight: 85,
					condition: () => true,
				});
			}
		}

		return baseLinks
			.sort((a, b) => b.weight - a.weight)
			.slice(0, MAX_QUICK_LINKS);
	}, [user, canAccessShifts, hasActivePeriod, mostVisitedPage]);

	return (
		<Card className="col-span-1">
			<CardContent>
				<div className="flex flex-col space-y-2">
					{visibleQuickLinks.map((link) => (
						<Link key={link.to} to={link.to}>
							<Button
								variant="outline"
								className="w-full flex items-center justify-between"
							>
								<span className="flex items-center gap-2">
									<link.icon className="h-4 w-4" />
									{link.title}
								</span>
								<ChevronRightIcon className="h-4 w-4" />
							</Button>
						</Link>
					))}
					{visibleQuickLinks.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-4">
							No quick links available
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
