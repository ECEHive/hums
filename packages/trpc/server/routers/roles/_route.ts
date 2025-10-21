import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const rolesRouter = router({
	list: permissionProtectedProcedure("roles.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("roles.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("roles.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("roles.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("roles.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
