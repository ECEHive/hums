import type { PluginServerContext } from "@ecehive/core";
import { globalReportsRouter } from "./globalReports/_route";
import { overviewRouter } from "./overview/_route";
import { periodExceptionsRouter } from "./periodExceptions/_route";
import { periodsRouter } from "./periods/_route";
import { reportsRouter } from "./reports/_route";
import { shiftAttendancesRouter } from "./shiftAttendances/_route";
import { shiftOccurrencesRouter } from "./shiftOccurrences/_route";
import { shiftSchedulesRouter } from "./shiftSchedules/_route";
import { shiftTypesRouter } from "./shiftTypes/_route";

/**
 * Register all attendance plugin tRPC sub-routers with the HUMS tRPC registrar.
 */
export function registerAttendanceRouters(ctx: PluginServerContext): void {
	ctx.trpc.register("shiftSchedules", shiftSchedulesRouter);
	ctx.trpc.register("shiftTypes", shiftTypesRouter);
	ctx.trpc.register("shiftOccurrences", shiftOccurrencesRouter);
	ctx.trpc.register("shiftAttendances", shiftAttendancesRouter);
	ctx.trpc.register("periods", periodsRouter);
	ctx.trpc.register("periodExceptions", periodExceptionsRouter);
	ctx.trpc.register("reports", reportsRouter);
	ctx.trpc.register("globalReports", globalReportsRouter);
	ctx.trpc.register("overview", overviewRouter);
}
