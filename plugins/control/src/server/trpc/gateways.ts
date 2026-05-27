import {
	router as createRouter,
	permissionProtectedProcedure,
} from "@ecehive/trpc/server";
import {
	createGatewayHandler,
	deleteGatewayHandler,
	getGatewayHandler,
	listGatewaysHandler,
	updateGatewayHandler,
	ZCreateGatewaySchema,
	ZDeleteGatewaySchema,
	ZGetGatewaySchema,
	ZListGatewaysSchema,
	ZUpdateGatewaySchema,
} from "./gateways.handlers";

export const gatewaysRouter = createRouter({
	create: permissionProtectedProcedure("control.gateways.create")
		.input(ZCreateGatewaySchema)
		.mutation(createGatewayHandler),
	delete: permissionProtectedProcedure("control.gateways.delete")
		.input(ZDeleteGatewaySchema)
		.mutation(deleteGatewayHandler),
	get: permissionProtectedProcedure("control.gateways.get")
		.input(ZGetGatewaySchema)
		.query(getGatewayHandler),
	list: permissionProtectedProcedure("control.gateways.list")
		.input(ZListGatewaysSchema)
		.query(listGatewaysHandler),
	update: permissionProtectedProcedure("control.gateways.update")
		.input(ZUpdateGatewaySchema)
		.mutation(updateGatewayHandler),
});
