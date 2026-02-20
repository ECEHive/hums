/**
 * Control Router
 *
 * This router provides all endpoints for the equipment control system,
 * including providers, control points, and logs.
 */

import { permissionProtectedProcedure, router } from "../../trpc";
// Gateway routes
import {
	createGatewayHandler,
	ZCreateGatewaySchema,
} from "./gateways/create.route";
import {
	deleteGatewayHandler,
	ZDeleteGatewaySchema,
} from "./gateways/delete.route";
import { getGatewayHandler, ZGetGatewaySchema } from "./gateways/get.route";
import {
	listGatewaysHandler,
	ZListGatewaysSchema,
} from "./gateways/list.route";
import {
	updateGatewayHandler,
	ZUpdateGatewaySchema,
} from "./gateways/update.route";
// Log routes
import { listLogsHandler, ZListLogsSchema } from "./logs/list.route";
// Control point routes
import { createPointHandler, ZCreatePointSchema } from "./points/create.route";
import { deletePointHandler, ZDeletePointSchema } from "./points/delete.route";
import { getPointHandler, ZGetPointSchema } from "./points/get.route";
import { listPointsHandler, ZListPointsSchema } from "./points/list.route";
import {
	operatePointHandler,
	ZOperatePointSchema,
} from "./points/operate.route";
import { readStateHandler, ZReadStateSchema } from "./points/readState.route";
import { updatePointHandler, ZUpdatePointSchema } from "./points/update.route";
// Provider routes
import {
	createProviderHandler,
	ZCreateProviderSchema,
} from "./providers/create.route";
import {
	deleteProviderHandler,
	ZDeleteProviderSchema,
} from "./providers/delete.route";
import { getProviderHandler, ZGetProviderSchema } from "./providers/get.route";
import {
	listProvidersHandler,
	ZListProvidersSchema,
} from "./providers/list.route";
import {
	updateProviderHandler,
	ZUpdateProviderSchema,
} from "./providers/update.route";

export const controlRouter = router({
	// Control Provider Management
	providers: router({
		list: permissionProtectedProcedure("control.providers.list")
			.input(ZListProvidersSchema)
			.query(listProvidersHandler),
		get: permissionProtectedProcedure("control.providers.get")
			.input(ZGetProviderSchema)
			.query(getProviderHandler),
		create: permissionProtectedProcedure("control.providers.create")
			.input(ZCreateProviderSchema)
			.mutation(createProviderHandler),
		update: permissionProtectedProcedure("control.providers.update")
			.input(ZUpdateProviderSchema)
			.mutation(updateProviderHandler),
		delete: permissionProtectedProcedure("control.providers.delete")
			.input(ZDeleteProviderSchema)
			.mutation(deleteProviderHandler),
	}),

	// Control Point Management
	points: router({
		list: permissionProtectedProcedure("control.points.list")
			.input(ZListPointsSchema)
			.query(listPointsHandler),
		get: permissionProtectedProcedure("control.points.get")
			.input(ZGetPointSchema)
			.query(getPointHandler),
		create: permissionProtectedProcedure("control.points.create")
			.input(ZCreatePointSchema)
			.mutation(createPointHandler),
		update: permissionProtectedProcedure("control.points.update")
			.input(ZUpdatePointSchema)
			.mutation(updatePointHandler),
		delete: permissionProtectedProcedure("control.points.delete")
			.input(ZDeletePointSchema)
			.mutation(deletePointHandler),

		// Control operations
		operate: permissionProtectedProcedure("control.points.operate")
			.input(ZOperatePointSchema)
			.mutation(operatePointHandler),
		readState: permissionProtectedProcedure("control.points.list")
			.input(ZReadStateSchema)
			.query(readStateHandler),
	}),

	// Control Logs
	logs: router({
		list: permissionProtectedProcedure("control.logs.list")
			.input(ZListLogsSchema)
			.query(listLogsHandler),
	}),

	// Control Gateways
	gateways: router({
		list: permissionProtectedProcedure("control.gateways.list")
			.input(ZListGatewaysSchema)
			.query(listGatewaysHandler),
		get: permissionProtectedProcedure("control.gateways.get")
			.input(ZGetGatewaySchema)
			.query(getGatewayHandler),
		create: permissionProtectedProcedure("control.gateways.create")
			.input(ZCreateGatewaySchema)
			.mutation(createGatewayHandler),
		update: permissionProtectedProcedure("control.gateways.update")
			.input(ZUpdateGatewaySchema)
			.mutation(updateGatewayHandler),
		delete: permissionProtectedProcedure("control.gateways.delete")
			.input(ZDeleteGatewaySchema)
			.mutation(deleteGatewayHandler),
	}),
});
