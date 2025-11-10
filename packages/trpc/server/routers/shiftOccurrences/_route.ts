import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { dropHandler, ZDropSchema } from "./drop.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
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
});
