import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const webhookEndpointsRouter = router({
	create: permissionProtectedProcedure("webhookEndpoints.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("webhookEndpoints.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("webhookEndpoints.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
	list: permissionProtectedProcedure("webhookEndpoints.list")
		.input(ZListSchema)
		.query(listHandler),
});
