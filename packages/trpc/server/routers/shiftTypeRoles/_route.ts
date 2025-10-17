import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const shiftTypeRolesRouter = router({
	list: permissionProtectedProcedure("shiftTypeRoles.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("shiftTypeRoles.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("shiftTypeRoles.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("shiftTypeRoles.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("shiftTypeRoles.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
