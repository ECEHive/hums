import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { listHandler, ZListSchema } from "./list.route";
import { renameHandler, ZRenameSchema } from "./rename.route";
import {
	updatePermissionsHandler,
	ZUpdatePermissionsSchema,
} from "./updatePermissions.route";

export const apiTokensRouter = router({
	list: permissionProtectedProcedure("api_tokens.list")
		.input(ZListSchema)
		.query(listHandler),
	create: permissionProtectedProcedure("api_tokens.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	delete: permissionProtectedProcedure("api_tokens.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
	rename: permissionProtectedProcedure("api_tokens.create")
		.input(ZRenameSchema)
		.mutation(renameHandler),
	updatePermissions: permissionProtectedProcedure("api_tokens.create")
		.input(ZUpdatePermissionsSchema)
		.mutation(updatePermissionsHandler),
});
