import { permissionProtectedProcedure, router } from "../../trpc";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";

export const shiftOccurrencesRouter = router({
	list: permissionProtectedProcedure("shiftOccurrences.list")
		.input(ZListSchema)
		.query(listHandler),
	get: permissionProtectedProcedure("shiftOccurrences.get")
		.input(ZGetSchema)
		.query(getHandler),
});
