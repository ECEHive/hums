import {
	permissionProtectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import { checkStatusHandler, ZCheckStatusSchema } from "./checkStatus.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const kiosksRouter = router({
	checkStatus: publicProcedure
		.input(ZCheckStatusSchema)
		.query(checkStatusHandler),
	list: permissionProtectedProcedure("kiosks.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("kiosks.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("kiosks.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("kiosks.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("kiosks.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
