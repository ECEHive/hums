import { permissionProtectedProcedure, router } from "../../trpc";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";

export const permissionsRouter = router({
	list: permissionProtectedProcedure("permissions.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("permissions.get")
		.input(ZGetSchema)
		.query(getHandler),
});
