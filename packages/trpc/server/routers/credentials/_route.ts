import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { listHandler, ZListSchema } from "./list.route";

export const credentialsRouter = router({
	list: permissionProtectedProcedure("credentials.list")
		.input(ZListSchema)
		.query(listHandler),
	create: permissionProtectedProcedure("credentials.update")
		.input(ZCreateSchema)
		.mutation(createHandler),
	delete: permissionProtectedProcedure("credentials.update")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
