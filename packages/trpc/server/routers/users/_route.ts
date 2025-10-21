import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const usersRouter = router({
	list: permissionProtectedProcedure("users.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("users.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("users.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("users.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
});
