import { permissionProtectedProcedure, router } from "../../trpc";
import { dropHandler, ZDropSchema } from "./drop.route";
import { listHandler, ZListSchema } from "./list.route";
import { pickupHandler, ZPickupSchema } from "./pickup.route";

export const shiftOccurrenceAssignmentsRouter = router({
	list: permissionProtectedProcedure("shiftOccurrenceAssignments.list")
		.input(ZListSchema)
		.query(listHandler),
	drop: permissionProtectedProcedure("shiftOccurrenceAssignments.drop")
		.input(ZDropSchema)
		.mutation(dropHandler),
	pickup: permissionProtectedProcedure("shiftOccurrenceAssignments.pickup")
		.input(ZPickupSchema)
		.mutation(pickupHandler),
});
