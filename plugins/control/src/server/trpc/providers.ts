import {
	router as createRouter,
	permissionProtectedProcedure,
} from "@ecehive/trpc/server";
import {
	createProviderHandler,
	deleteProviderHandler,
	getProviderHandler,
	listProvidersHandler,
	updateProviderHandler,
	ZCreateProviderSchema,
	ZDeleteProviderSchema,
	ZGetProviderSchema,
	ZListProvidersSchema,
	ZUpdateProviderSchema,
} from "./providers.handlers";

export const providersRouter = createRouter({
	create: permissionProtectedProcedure("control.providers.create")
		.input(ZCreateProviderSchema)
		.mutation(createProviderHandler),
	delete: permissionProtectedProcedure("control.providers.delete")
		.input(ZDeleteProviderSchema)
		.mutation(deleteProviderHandler),
	get: permissionProtectedProcedure("control.providers.get")
		.input(ZGetProviderSchema)
		.query(getProviderHandler),
	list: permissionProtectedProcedure("control.providers.list")
		.input(ZListProvidersSchema)
		.query(listProvidersHandler),
	update: permissionProtectedProcedure("control.providers.update")
		.input(ZUpdateProviderSchema)
		.mutation(updateProviderHandler),
});
