import { permissionProtectedProcedure, router } from "../../trpc";
import {
	sessionsReportHandler,
	ZSessionsReportSchema,
} from "./sessionsReport.route";
import {
	userSessionsReportHandler,
	ZUserSessionsReportSchema,
} from "./userSessionsReport.route";
import { usersReportHandler, ZUsersReportSchema } from "./usersReport.route";

const PERMISSION = "global_reports.generate";

export const globalReportsRouter = router({
	// Users report - list all users with their information
	usersReport: permissionProtectedProcedure(PERMISSION)
		.input(ZUsersReportSchema)
		.query(usersReportHandler),

	// Sessions report - list all sessions with filtering
	sessionsReport: permissionProtectedProcedure(PERMISSION)
		.input(ZSessionsReportSchema)
		.query(sessionsReportHandler),

	// User sessions report - aggregate session data per user
	userSessionsReport: permissionProtectedProcedure(PERMISSION)
		.input(ZUserSessionsReportSchema)
		.query(userSessionsReportHandler),
});
