import { agreementsRouter } from "./routers/agreements/_route";
import { apiTokensRouter } from "./routers/apiTokens/_route";
import { auditLogsRouter } from "./routers/auditLogs/_route";
import { authRouter } from "./routers/auth/_route";
import { configRouter } from "./routers/config/_route";
import { controlRouter } from "./routers/control/_route";
import { controlKioskRouter } from "./routers/controlKiosk/_route";
import { credentialsRouter } from "./routers/credentials/_route";
import { devicesRouter } from "./routers/devices/_route";
import { inventoryRouter } from "./routers/inventory/_route";
import { oneTimeLoginCodesRouter } from "./routers/oneTimeLoginCodes/_route";
import { overviewRouter } from "./routers/overview/_route";
import { permissionsRouter } from "./routers/permissions/_route";
import { rolesRouter } from "./routers/roles/_route";
import { suspensionsRouter } from "./routers/suspensions/_route";
import { ticketsRouter } from "./routers/tickets/_route";
import { usersRouter } from "./routers/users/_route";
import { router } from "./trpc";

export const appRouter = router({
	auth: authRouter,
	apiTokens: apiTokensRouter,
	auditLogs: auditLogsRouter,
	config: configRouter,
	control: controlRouter,
	controlKiosk: controlKioskRouter,
	credentials: credentialsRouter,
	// overview is kept here for frontend type compatibility until Phase 11
	// migrates the @ecehive/overview app to use the attendance plugin's types.
	// At runtime, the attendance plugin overrides this with its own registration.
	overview: overviewRouter,
	users: usersRouter,
	roles: rolesRouter,
	permissions: permissionsRouter,
	agreements: agreementsRouter,
	suspensions: suspensionsRouter,
	devices: devicesRouter,
	oneTimeLoginCodes: oneTimeLoginCodesRouter,
	inventory: inventoryRouter,
	tickets: ticketsRouter,
});

export type AppRouter = typeof appRouter;
