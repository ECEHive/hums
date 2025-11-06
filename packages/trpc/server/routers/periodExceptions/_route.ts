import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const periodExceptionsRouter = router({
	list: permissionProtectedProcedure("period_exceptions.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("period_exceptions.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("period_exceptions.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("period_exceptions.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("period_exceptions.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
