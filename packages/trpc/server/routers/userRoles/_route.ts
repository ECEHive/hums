import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { createBulkHandler, ZCreateBulkSchema } from "./createBulk.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { deleteBulkHandler, ZDeleteBulkSchema } from "./deleteBulk.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const userRolesRouter = router({
	list: permissionProtectedProcedure("userRoles.list")
		.input(ZListSchema)
		.query(listHandler),
	create: permissionProtectedProcedure("userRoles.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	createBulk: permissionProtectedProcedure("userRoles.createBulk")
		.input(ZCreateBulkSchema)
		.mutation(createBulkHandler),
	get: permissionProtectedProcedure("userRoles.get")
		.input(ZGetSchema)
		.query(getHandler),
	update: permissionProtectedProcedure("userRoles.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("userRoles.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
	deleteBulk: permissionProtectedProcedure("userRoles.deleteBulk")
		.input(ZDeleteBulkSchema)
		.mutation(deleteBulkHandler),
});
