import { agreementsRouter } from "./routers/agreements/_route";
import { apiTokensRouter } from "./routers/apiTokens/_route";
import { auditLogsRouter } from "./routers/auditLogs/_route";
import { authRouter } from "./routers/auth/_route";
import { configRouter } from "./routers/config/_route";
import { kiosksRouter } from "./routers/kiosks/_route";
import { oneTimeLoginCodesRouter } from "./routers/oneTimeLoginCodes/_route";
import { periodExceptionsRouter } from "./routers/periodExceptions/_route";
import { periodsRouter } from "./routers/periods/_route";
import { permissionsRouter } from "./routers/permissions/_route";
import { reportsRouter } from "./routers/reports/_route";
import { rolesRouter } from "./routers/roles/_route";
import { sessionsRouter } from "./routers/sessions/_route";
import { shiftAttendancesRouter } from "./routers/shiftAttendances/_route";
import { shiftOccurrencesRouter } from "./routers/shiftOccurrences/_route";
import { shiftSchedulesRouter } from "./routers/shiftSchedules/_route";
import { shiftTypesRouter } from "./routers/shiftTypes/_route";
import { usersRouter } from "./routers/users/_route";
import { router } from "./trpc";

export const appRouter = router({
	auth: authRouter,
	apiTokens: apiTokensRouter,
	auditLogs: auditLogsRouter,
	config: configRouter,
	users: usersRouter,
	roles: rolesRouter,
	permissions: permissionsRouter,
	agreements: agreementsRouter,
	periods: periodsRouter,
	periodExceptions: periodExceptionsRouter,
	shiftTypes: shiftTypesRouter,
	shiftSchedules: shiftSchedulesRouter,
	shiftOccurrences: shiftOccurrencesRouter,
	shiftAttendances: shiftAttendancesRouter,
	sessions: sessionsRouter,
	kiosks: kiosksRouter,
	oneTimeLoginCodes: oneTimeLoginCodesRouter,
	reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
