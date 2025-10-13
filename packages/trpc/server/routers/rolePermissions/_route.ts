import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const rolePermissionsRouter = router({
	list: permissionProtectedProcedure("rolePermissions.list")
		.input(ZListSchema)
		.query(listHandler),
	create: permissionProtectedProcedure("rolePermissions.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	get: permissionProtectedProcedure("rolePermissions.get")
		.input(ZGetSchema)
		.query(getHandler),
	update: permissionProtectedProcedure("rolePermissions.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("rolePermissions.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
