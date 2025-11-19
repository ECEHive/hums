import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { dropHandler, ZDropSchema } from "./drop.route";
import { dropMakeupHandler, ZDropMakeupSchema } from "./dropMakeup.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { listForUserHandler, ZListForUserSchema } from "./listForUser.route";
import {
	listMakeupOptionsHandler,
	ZListMakeupOptionsSchema,
} from "./listMakeupOptions.route";
import { listMyHandler, ZListMySchema } from "./listMy.route";
import { listMyPastHandler, ZListMyPastSchema } from "./listMyPast.route";
import { pickupHandler, ZPickupSchema } from "./pickup.route";

export const shiftOccurrencesRouter = router({
	list: permissionProtectedProcedure("shift_occurrences.list")
		.input(ZListSchema)
		.query(listHandler),
	listForUser: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZListForUserSchema)
		.query(listForUserHandler),
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	listMyPast: protectedProcedure
		.input(ZListMyPastSchema)
		.query(listMyPastHandler),
	get: permissionProtectedProcedure("shift_occurrences.get")
		.input(ZGetSchema)
		.query(getHandler),
	pickup: protectedProcedure.input(ZPickupSchema).mutation(pickupHandler),
	drop: protectedProcedure.input(ZDropSchema).mutation(dropHandler),
	dropMakeup: protectedProcedure
		.input(ZDropMakeupSchema)
		.mutation(dropMakeupHandler),
	listMakeupOptions: protectedProcedure
		.input(ZListMakeupOptionsSchema)
		.query(listMakeupOptionsHandler),
});
