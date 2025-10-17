import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const shiftTypesRouter = router({
	list: permissionProtectedProcedure("shift_types.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("shift_types.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("shift_types.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("shift_types.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("shift_types.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
