import { permissionProtectedProcedure, router } from "../../trpc";
import { dropHandler, ZDropSchema } from "./drop.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import { pickupHandler, ZPickupSchema } from "./pickup.route";

export const shiftOccurrencesRouter = router({
	list: permissionProtectedProcedure("shift_occurrences.list")
		.input(ZListSchema)
		.query(listHandler),
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
