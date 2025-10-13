import { authRouter } from "./routers/auth/_route";
import { permissionsRouter } from "./routers/permissions/_route";
import { rolePermissionsRouter } from "./routers/rolePermissions/_route";
import { rolesRouter } from "./routers/roles/_route";
import { userRolesRouter } from "./routers/userRoles/_route";
import { usersRouter } from "./routers/users/_route";
import { router } from "./trpc";

export const appRouter = router({
	auth: authRouter,
	users: usersRouter,
	userRoles: userRolesRouter,
	roles: rolesRouter,
	rolePermissions: rolePermissionsRouter,
	permissions: permissionsRouter,
});

export type AppRouter = typeof appRouter;
