import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { dropHandler, ZDropSchema } from "./drop.route";
import { dropMakeupHandler, ZDropMakeupSchema } from "./dropMakeup.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
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
	listMy: protectedProcedure.input(ZListMySchema).query(listMyHandler),
	listMyPast: protectedProcedure
		.input(ZListMyPastSchema)
		.query(listMyPastHandler),
	get: permissionProtectedProcedure("shift_occurrences.get")
		.input(ZGetSchema)
		.query(getHandler),
	pickup: permissionProtectedProcedure("shift_occurrences.pickup")
		.input(ZPickupSchema)
		.mutation(pickupHandler),
	drop: permissionProtectedProcedure("shift_occurrences.drop")
		.input(ZDropSchema)
		.mutation(dropHandler),
	dropMakeup: permissionProtectedProcedure("shift_occurrences.drop")
		.input(ZDropMakeupSchema)
		.mutation(dropMakeupHandler),
	listMakeupOptions: permissionProtectedProcedure("shift_occurrences.drop")
		.input(ZListMakeupOptionsSchema)
		.query(listMakeupOptionsHandler),
});
