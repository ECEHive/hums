import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { getHandler, ZGetSchema } from "./get.route";
import { getMyActiveHandler, ZGetMyActiveSchema } from "./getMyActive.route";
import { listHandler, ZListSchema } from "./list.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const suspensionsRouter = router({
	// Admin endpoints - require suspensions.list or suspensions.manage permissions
	list: permissionProtectedProcedure("suspensions.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("suspensions.list")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("suspensions.manage")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("suspensions.manage")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	// User endpoints - any authenticated user can view their own suspensions
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	getMyActive: protectedProcedure
		.input(ZGetMyActiveSchema)
		.query(getMyActiveHandler),
});
