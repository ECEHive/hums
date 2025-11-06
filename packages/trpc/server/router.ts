import { authRouter } from "./routers/auth/_route";
import { kiosksRouter } from "./routers/kiosks/_route";
import { periodExceptionsRouter } from "./routers/periodExceptions/_route";
import { periodsRouter } from "./routers/periods/_route";
import { permissionsRouter } from "./routers/permissions/_route";
import { rolesRouter } from "./routers/roles/_route";
import { sessionsRouter } from "./routers/sessions/_route";
import { shiftOccurrencesRouter } from "./routers/shiftOccurrences/_route";
import { shiftSchedulesRouter } from "./routers/shiftSchedules/_route";
import { shiftTypesRouter } from "./routers/shiftTypes/_route";
import { usersRouter } from "./routers/users/_route";
import { router } from "./trpc";

export const appRouter = router({
	auth: authRouter,
	users: usersRouter,
	roles: rolesRouter,
	permissions: permissionsRouter,
	periods: periodsRouter,
	periodExceptions: periodExceptionsRouter,
	shiftTypes: shiftTypesRouter,
	shiftSchedules: shiftSchedulesRouter,
	shiftOccurrences: shiftOccurrencesRouter,
	sessions: sessionsRouter,
	kiosks: kiosksRouter,
});

export type AppRouter = typeof appRouter;
