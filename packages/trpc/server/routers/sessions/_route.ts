import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { listHandler, ZListSchema } from "./list.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";
import { tapInOutHandler, ZTapInOutSchema } from "./tap-in-out.route";

export const sessionsRouter = router({
	list: permissionProtectedProcedure("users.list")
		.input(ZListSchema)
		.query(listHandler),
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
	tapInOut: kioskProtectedProcedure
		.input(ZTapInOutSchema)
		.mutation(tapInOutHandler),
});
