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
import { openHoursHandler, ZOpenHoursSchema } from "./openHours.route";

export const overviewRouter = router({
	// Public endpoints (available to anyone viewing the overview)
	activeSessionsCount: publicProcedure
		.input(ZActiveSessionsCountSchema)
		.query(activeSessionsCountHandler),
	busynessAnalytics: publicProcedure
		.input(ZBusynessAnalyticsSchema)
		.query(busynessAnalyticsHandler),
	openHours: publicProcedure.input(ZOpenHoursSchema).query(openHoursHandler),

	// Protected endpoints (require overview device access)
	currentStaffing: dashboardProtectedProcedure
		.input(ZCurrentStaffingSchema)
		.query(currentStaffingHandler),
});
