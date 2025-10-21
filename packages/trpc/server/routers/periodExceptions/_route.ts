import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const periodExceptionsRouter = router({
	list: permissionProtectedProcedure("periodExceptions.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("periodExceptions.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("periodExceptions.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("periodExceptions.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("periodExceptions.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
