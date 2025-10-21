import { permissionProtectedProcedure, router } from "../../trpc";
import { bulkCreateHandler, ZBulkCreateSchema } from "./bulkCreate.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const shiftSchedulesRouter = router({
	list: permissionProtectedProcedure("shiftSchedules.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("shiftSchedules.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("shiftSchedules.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	bulkCreate: permissionProtectedProcedure("shiftSchedules.create")
		.input(ZBulkCreateSchema)
		.mutation(bulkCreateHandler),
	update: permissionProtectedProcedure("shiftSchedules.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("shiftSchedules.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
