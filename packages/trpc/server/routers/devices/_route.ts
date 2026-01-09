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

export const devicesRouter = router({
	checkStatus: publicProcedure
		.input(ZCheckStatusSchema)
		.query(checkStatusHandler),
	list: permissionProtectedProcedure("devices.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("devices.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("devices.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("devices.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("devices.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
