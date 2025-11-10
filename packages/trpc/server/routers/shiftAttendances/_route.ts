import { protectedProcedure, router } from "../../trpc";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";

export const shiftAttendancesRouter = router({
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
});
