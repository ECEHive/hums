import {
	permissionProtectedProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import { loginHandler, ZLoginSchema } from "./login.route";
import { meHandler, ZMeSchema } from "./me.route";
import { simulateHandler, ZSimulateSchema } from "./simulate.route";

export const authRouter = router({
	login: publicProcedure.input(ZLoginSchema).query(loginHandler),
	me: protectedProcedure.input(ZMeSchema).query(meHandler),
	simulate: permissionProtectedProcedure("users.simulate")
		.input(ZSimulateSchema)
		.mutation(simulateHandler),
});
