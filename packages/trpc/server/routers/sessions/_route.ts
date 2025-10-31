import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	router,
} from "../../trpc";
import { listHandler, ZListSchema } from "./list.route";
import { tapInOutHandler, ZTapInOutSchema } from "./tap-in-out.route";

export const sessionsRouter = router({
	list: permissionProtectedProcedure("users.list")
		.input(ZListSchema)
		.query(listHandler),
	tapInOut: kioskProtectedProcedure
		.input(ZTapInOutSchema)
		.mutation(tapInOutHandler),
});
