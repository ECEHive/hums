import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { bulkSetHandler, ZBulkSetSchema } from "./bulkSet.route";
import { canSetAvailabilityHandler } from "./canSetAvailability.route";
import { listHandler, ZListSchema } from "./list.route";
import { listForUserHandler, ZListForUserSchema } from "./listForUser.route";
import {
	setMyAvailabilityHandler,
	ZSetMyAvailabilitySchema,
} from "./setMyAvailability.route";

export const schedulerAvailabilityRouter = router({
	list: permissionProtectedProcedure("scheduling.availability.list")
		.input(ZListSchema)
		.query(listHandler),
	listForUser: protectedProcedure
		.input(ZListForUserSchema)
		.query(listForUserHandler),
	bulkSet: permissionProtectedProcedure("scheduling.availability.manage")
		.input(ZBulkSetSchema)
		.mutation(bulkSetHandler),
	canSetAvailability: protectedProcedure.query(canSetAvailabilityHandler),
	setMyAvailability: protectedProcedure
		.input(ZSetMyAvailabilitySchema)
		.mutation(setMyAvailabilityHandler),
});
