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
import {
	userScheduleSummaryHandler,
	ZUserScheduleSummarySchema,
} from "./userScheduleSummary.route";

export const reportsRouter = router({
	// User attendance report (original)
	generate: permissionProtectedProcedure("reports.generate")
		.input(ZGenerateSchema)
		.query(generateHandler),

	// Session activity report
	sessionActivity: permissionProtectedProcedure("reports.generate")
		.input(ZSessionActivitySchema)
		.query(sessionActivityHandler),

	// Shift coverage report
	shiftCoverage: permissionProtectedProcedure("reports.generate")
		.input(ZShiftCoverageSchema)
		.query(shiftCoverageHandler),

	// User schedule summary report
	userScheduleSummary: permissionProtectedProcedure("reports.generate")
		.input(ZUserScheduleSummarySchema)
		.query(userScheduleSummaryHandler),
});
