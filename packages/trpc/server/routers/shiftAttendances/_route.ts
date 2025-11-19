import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { listForUserHandler, ZListForUserSchema } from "./listForUser.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";

export const shiftAttendancesRouter = router({
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	listForUser: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZListForUserSchema)
		.query(listForUserHandler),
	myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
});
