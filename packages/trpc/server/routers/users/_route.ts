import { permissionProtectedProcedure, router } from "../../trpc";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";

export const usersRouter = router({
	list: permissionProtectedProcedure("users.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("users.get")
		.input(ZGetSchema)
		.query(getHandler),
});
