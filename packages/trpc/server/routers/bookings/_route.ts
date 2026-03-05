import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import {
	availableSlotsHandler,
	ZAvailableSlotsSchema,
} from "./availableSlots.route";
import { bookableEventTypesHandler } from "./bookableEventTypes.route";
import { cancelHandler, ZCancelSchema } from "./cancel.route";
import {
	cancelMyBookingHandler,
	ZCancelMyBookingSchema,
} from "./cancelMyBooking.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { listHandler, ZListSchema } from "./list.route";
import { myBookingsHandler, ZMyBookingsSchema } from "./myBookings.route";

export const bookingsRouter = router({
	list: permissionProtectedProcedure("scheduling.bookings.list")
		.input(ZListSchema)
		.query(listHandler),
	myBookings: protectedProcedure
		.input(ZMyBookingsSchema)
		.query(myBookingsHandler),
	bookableEventTypes: protectedProcedure.query(bookableEventTypesHandler),
	availableSlots: protectedProcedure
		.input(ZAvailableSlotsSchema)
		.query(availableSlotsHandler),
	create: protectedProcedure.input(ZCreateSchema).mutation(createHandler),
	cancel: permissionProtectedProcedure("scheduling.bookings.manage")
		.input(ZCancelSchema)
		.mutation(cancelHandler),
	cancelMyBooking: protectedProcedure
		.input(ZCancelMyBookingSchema)
		.mutation(cancelMyBookingHandler),
});
