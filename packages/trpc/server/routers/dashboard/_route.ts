import {
	dashboardProtectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import {
	activeSessionsCountHandler,
	ZActiveSessionsCountSchema,
} from "./activeSessionsCount.route";
import {
	busynessAnalyticsHandler,
	ZBusynessAnalyticsSchema,
} from "./busynessAnalytics.route";
import {
	currentStaffingHandler,
	ZCurrentStaffingSchema,
} from "./currentStaffing.route";

export const dashboardRouter = router({
	// Public endpoints (available to anyone viewing the dashboard)
	activeSessionsCount: publicProcedure
		.input(ZActiveSessionsCountSchema)
		.query(activeSessionsCountHandler),
	busynessAnalytics: publicProcedure
		.input(ZBusynessAnalyticsSchema)
		.query(busynessAnalyticsHandler),

	// Protected endpoints (require dashboard device access)
	currentStaffing: dashboardProtectedProcedure
		.input(ZCurrentStaffingSchema)
		.query(currentStaffingHandler),
});
