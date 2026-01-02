import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import {
	adminEndSessionHandler,
	ZAdminEndSessionSchema,
} from "./adminEndSession.route";
import {
	adminManageSessionHandler,
	ZAdminManageSessionSchema,
} from "./adminManageSession.route";
import { endMySessionHandler, ZEndMySessionSchema } from "./endMySession.route";
import { listHandler, ZListSchema } from "./list.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";
import { statsHandler, ZStatsSchema } from "./stats.route";
import { tapInOutHandler, ZTapInOutSchema } from "./tap-in-out.route";

export const sessionsRouter = router({
	list: permissionProtectedProcedure("sessions.list")
		.input(ZListSchema)
		.query(listHandler),
	stats: permissionProtectedProcedure("sessions.list")
		.input(ZStatsSchema)
		.query(statsHandler),
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
	endMySession: protectedProcedure
		.input(ZEndMySessionSchema)
		.mutation(endMySessionHandler),
	tapInOut: kioskProtectedProcedure
		.input(ZTapInOutSchema)
		.mutation(tapInOutHandler),
	adminManageSession: permissionProtectedProcedure("sessions.manage")
		.input(ZAdminManageSessionSchema)
		.mutation(adminManageSessionHandler),
	adminEndSession: permissionProtectedProcedure("sessions.manage")
		.input(ZAdminEndSessionSchema)
		.mutation(adminEndSessionHandler),
});
