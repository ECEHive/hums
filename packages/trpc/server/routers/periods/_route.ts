import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { getCurrentHandler } from "./getCurrent.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const periodsRouter = router({
	list: permissionProtectedProcedure("periods.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("periods.get")
		.input(ZGetSchema)
		.query(getHandler),
	getCurrent:
		permissionProtectedProcedure("periods.list").query(getCurrentHandler),
	create: permissionProtectedProcedure("periods.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("periods.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("periods.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
