import { permissionProtectedProcedure, router } from "../../trpc";
import { bulkCreateHandler, ZBulkCreateSchema } from "./bulkCreate.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { registerHandler, ZRegisterSchema } from "./register.route";
import { unregisterHandler, ZUnregisterSchema } from "./unregister.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const shiftSchedulesRouter = router({
	list: permissionProtectedProcedure("shift_schedules.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("shift_schedules.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("shift_schedules.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	bulkCreate: permissionProtectedProcedure("shift_schedules.create")
		.input(ZBulkCreateSchema)
		.mutation(bulkCreateHandler),
	update: permissionProtectedProcedure("shift_schedules.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("shift_schedules.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
	register: permissionProtectedProcedure("shift_schedules.register")
		.input(ZRegisterSchema)
		.mutation(registerHandler),
	unregister: permissionProtectedProcedure("shift_schedules.unregister")
		.input(ZUnregisterSchema)
		.mutation(unregisterHandler),
});
