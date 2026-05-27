import {
	router as createRouter,
	permissionProtectedProcedure,
} from "@ecehive/trpc/server";
import { listLogsHandler, ZListLogsSchema } from "./logs.handlers";

export const logsRouter = createRouter({
	list: permissionProtectedProcedure("control.logs.list")
		.input(ZListLogsSchema)
		.query(listLogsHandler),
});
