import type { EventBus, HumsEventMap } from "@ecehive/core";
import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "@ecehive/trpc/server";
import {
	adminCreatePastSessionHandler,
	ZAdminCreatePastSessionSchema,
} from "./adminCreatePastSession.route";
import {
	adminEndSessionHandler,
	ZAdminEndSessionSchema,
} from "./adminEndSession.route";
import {
	adminManageSessionHandler,
	ZAdminManageSessionSchema,
} from "./adminManageSession.route";
import {
	currentStaffingHandler,
	ZCurrentStaffingSchema,
} from "./currentStaffing.route";
import { endMySessionHandler, ZEndMySessionSchema } from "./endMySession.route";
import { listHandler, ZListSchema } from "./list.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { myStatsHandler, ZMyStatsSchema } from "./myStats.route";
import { statsHandler, ZStatsSchema } from "./stats.route";
import { tapInOutHandler, ZTapInOutSchema } from "./tap-in-out.route";

/**
 * Builds the sessions tRPC sub-router, wiring in the event bus so that
 * route handlers can emit domain events after successful transactions.
 */
export function buildSessionsRouter(events: EventBus<HumsEventMap>) {
	return router({
		list: permissionProtectedProcedure("sessions.list")
			.input(ZListSchema)
			.query(listHandler),
		stats: permissionProtectedProcedure("sessions.list")
			.input(ZStatsSchema)
			.query(statsHandler),
		currentStaffing: permissionProtectedProcedure("sessions.list")
			.input(ZCurrentStaffingSchema)
			.query(currentStaffingHandler),
		listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
		myStats: protectedProcedure.input(ZMyStatsSchema).query(myStatsHandler),
		endMySession: protectedProcedure
			.input(ZEndMySessionSchema)
			.mutation((opts) => endMySessionHandler({ ...opts, events })),
		tapInOut: kioskProtectedProcedure
			.input(ZTapInOutSchema)
			.mutation((opts) => tapInOutHandler({ ...opts, events })),
		adminManageSession: permissionProtectedProcedure("sessions.manage")
			.input(ZAdminManageSessionSchema)
			.mutation((opts) => adminManageSessionHandler({ ...opts, events })),
		adminEndSession: permissionProtectedProcedure("sessions.manage")
			.input(ZAdminEndSessionSchema)
			.mutation((opts) => adminEndSessionHandler({ ...opts, events })),
		adminCreatePastSession: permissionProtectedProcedure("sessions.manage")
			.input(ZAdminCreatePastSessionSchema)
			.mutation(adminCreatePastSessionHandler),
	});
}

export type SessionsRouter = ReturnType<typeof buildSessionsRouter>;
