import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { grantExcuseHandler, ZGrantExcuseSchema } from "./grantExcuse.route";
import { listForUserHandler, ZListForUserSchema } from "./listForUser.route";
import { listIssuesHandler, ZListIssuesSchema } from "./listIssues.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { markReviewedHandler, ZMarkReviewedSchema } from "./markReviewed.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";
import { revokeExcuseHandler, ZRevokeExcuseSchema } from "./revokeExcuse.route";

export const shiftAttendancesRouter = router({
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	listForUser: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZListForUserSchema)
		.query(listForUserHandler),
	myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
	// Admin routes for managing attendance issues
	listIssues: permissionProtectedProcedure("shift_attendances.excuse")
		.input(ZListIssuesSchema)
		.query(listIssuesHandler),
	grantExcuse: permissionProtectedProcedure("shift_attendances.excuse")
		.input(ZGrantExcuseSchema)
		.mutation(grantExcuseHandler),
	revokeExcuse: permissionProtectedProcedure("shift_attendances.excuse")
		.input(ZRevokeExcuseSchema)
		.mutation(revokeExcuseHandler),
	markReviewed: permissionProtectedProcedure("shift_attendances.excuse")
		.input(ZMarkReviewedSchema)
		.mutation(markReviewedHandler),
});
