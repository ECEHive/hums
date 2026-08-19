import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { cloneHandler, ZCloneSchema } from "./clone.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { getCurrentHandler, ZGetCurrentSchema } from "./getCurrent.route";
import { listHandler, ZListSchema } from "./list.route";
import { listVisibleHandler, ZListVisibleSchema } from "./listVisible.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const periodsRouter = router({
	list: permissionProtectedProcedure("periods.list")
		.input(ZListSchema)
		.query(listHandler),
	listVisible: protectedProcedure
		.input(ZListVisibleSchema)
		.query(listVisibleHandler),
	get: permissionProtectedProcedure("periods.get")
		.input(ZGetSchema)
		.query(getHandler),
	getCurrent: permissionProtectedProcedure("periods.list")
		.input(ZGetCurrentSchema)
		.query(getCurrentHandler),
	create: permissionProtectedProcedure("periods.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	clone: permissionProtectedProcedure("periods.create")
		.input(ZCloneSchema)
		.mutation(cloneHandler),
	update: permissionProtectedProcedure("periods.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("periods.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
