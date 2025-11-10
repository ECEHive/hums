import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { agreeHandler, ZAgreeSchema } from "./agree.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { getHandler, ZGetSchema } from "./get.route";
import { getStatusHandler, ZGetStatusSchema } from "./getStatus.route";
import { kioskAgreeHandler, ZKioskAgreeSchema } from "./kioskAgree.route";
import { listHandler, ZListSchema } from "./list.route";
import { listAllHandler, ZListAllSchema } from "./listAll.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const agreementsRouter = router({
	// Admin endpoints
	list: permissionProtectedProcedure("agreements.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("agreements.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("agreements.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	update: permissionProtectedProcedure("agreements.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("agreements.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),

	// User endpoints
	listAll: protectedProcedure.input(ZListAllSchema).query(listAllHandler),
	getStatus: protectedProcedure.input(ZGetStatusSchema).query(getStatusHandler),
	agree: protectedProcedure.input(ZAgreeSchema).mutation(agreeHandler),

	// Kiosk endpoints
	kioskAgree: kioskProtectedProcedure
		.input(ZKioskAgreeSchema)
		.mutation(kioskAgreeHandler),
});
