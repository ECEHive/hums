import { permissionProtectedProcedure, router } from "../../trpc";
import { generateHandler, ZGenerateSchema } from "./generate.route";
import {
	sessionActivityHandler,
	ZSessionActivitySchema,
} from "./sessionActivity.route";
import {
	shiftCoverageHandler,
	ZShiftCoverageSchema,
} from "./shiftCoverage.route";
import { shiftUsersHandler, ZShiftUsersSchema } from "./shiftUsers.route";
import {
	userScheduleSummaryHandler,
	ZUserScheduleSummarySchema,
} from "./userScheduleSummary.route";

export const reportsRouter = router({
	// User attendance report (original)
	generate: permissionProtectedProcedure("period.reports")
		.input(ZGenerateSchema)
		.query(generateHandler),

	// Session activity report
	sessionActivity: permissionProtectedProcedure("period.reports")
		.input(ZSessionActivitySchema)
		.query(sessionActivityHandler),

	// Shift coverage report
	shiftCoverage: permissionProtectedProcedure("period.reports")
		.input(ZShiftCoverageSchema)
		.query(shiftCoverageHandler),

	// User schedule summary report
	userScheduleSummary: permissionProtectedProcedure("period.reports")
		.input(ZUserScheduleSummarySchema)
		.query(userScheduleSummaryHandler),

	// Shift users report
	shiftUsers: permissionProtectedProcedure("period.reports")
		.input(ZShiftUsersSchema)
		.query(shiftUsersHandler),
});
