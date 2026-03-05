import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const instantEventTypesRouter = router({
	list: permissionProtectedProcedure("scheduling.event_types.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("scheduling.event_types.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("scheduling.event_types.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("scheduling.event_types.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("scheduling.event_types.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
