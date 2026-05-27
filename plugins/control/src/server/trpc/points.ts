import {
	router as createRouter,
	permissionProtectedProcedure,
} from "@ecehive/trpc/server";
import {
	createPointHandler,
	deletePointHandler,
	getPointHandler,
	listPointsHandler,
	operatePointHandler,
	readStateHandler,
	updatePointHandler,
	ZCreatePointSchema,
	ZDeletePointSchema,
	ZGetPointSchema,
	ZListPointsSchema,
	ZOperatePointSchema,
	ZReadStateSchema,
	ZUpdatePointSchema,
} from "./points.handlers";

export const pointsRouter = createRouter({
	create: permissionProtectedProcedure("control.points.create")
		.input(ZCreatePointSchema)
		.mutation(createPointHandler),
	delete: permissionProtectedProcedure("control.points.delete")
		.input(ZDeletePointSchema)
		.mutation(deletePointHandler),
	get: permissionProtectedProcedure("control.points.get")
		.input(ZGetPointSchema)
		.query(getPointHandler),
	list: permissionProtectedProcedure("control.points.list")
		.input(ZListPointsSchema)
		.query(listPointsHandler),
	operate: permissionProtectedProcedure("control.points.operate")
		.input(ZOperatePointSchema)
		.mutation(operatePointHandler),
	readState: permissionProtectedProcedure("control.points.list")
		.input(ZReadStateSchema)
		.query(readStateHandler),
	update: permissionProtectedProcedure("control.points.update")
		.input(ZUpdatePointSchema)
		.mutation(updatePointHandler),
});
