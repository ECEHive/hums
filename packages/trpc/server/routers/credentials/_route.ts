import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { listHandler, ZListSchema } from "./list.route";

export const credentialsRouter = router({
	list: permissionProtectedProcedure("credentials.list")
		.input(ZListSchema)
		.query(listHandler),
	create: permissionProtectedProcedure("credentials.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	delete: permissionProtectedProcedure("credentials.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
