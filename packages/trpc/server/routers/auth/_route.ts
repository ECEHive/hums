import {
	permissionProtectedProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import { impersonateHandler, ZImpersonateSchema } from "./impersonate.route";
import { loginHandler, ZLoginSchema } from "./login.route";
import { meHandler, ZMeSchema } from "./me.route";

export const authRouter = router({
	login: publicProcedure.input(ZLoginSchema).query(loginHandler),
	me: protectedProcedure.input(ZMeSchema).query(meHandler),
	impersonate: permissionProtectedProcedure("users.impersonate")
		.input(ZImpersonateSchema)
		.mutation(impersonateHandler),
});
