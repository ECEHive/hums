import {
	permissionProtectedProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../../trpc";
import { assignTicketHandler, ZAssignTicketSchema } from "./assign.route";
import {
	getMyTicketHandler,
	getTicketHandler,
	ZGetMyTicketSchema,
	ZGetTicketSchema,
} from "./get.route";
import { listTicketsHandler, ZListTicketsSchema } from "./list.route";
import { listMyTicketsHandler, ZListMyTicketsSchema } from "./listMy.route";
import { submitTicketHandler, ZSubmitTicketSchema } from "./submit.route";
import {
	createTicketTypeHandler,
	ZCreateTicketTypeSchema,
} from "./types/create.route";
import {
	deleteTicketTypeHandler,
	ZDeleteTicketTypeSchema,
} from "./types/delete.route";
import { getTicketTypeHandler, ZGetTicketTypeSchema } from "./types/get.route";
import {
	listTicketTypesHandler,
	ZListTicketTypesSchema,
} from "./types/list.route";
import {
	reorderTicketTypesHandler,
	ZReorderTicketTypesSchema,
} from "./types/reorder.route";
import {
	updateTicketTypeHandler,
	ZUpdateTicketTypeSchema,
} from "./types/update.route";
import {
	updateTicketNotesHandler,
	ZUpdateTicketNotesSchema,
} from "./updateNotes.route";
import {
	updateTicketStatusHandler,
	ZUpdateTicketStatusSchema,
} from "./updateStatus.route";

export const ticketsRouter = router({
	// Ticket Types
	types: router({
		list: publicProcedure
			.input(ZListTicketTypesSchema)
			.query(listTicketTypesHandler),
		get: publicProcedure
			.input(ZGetTicketTypeSchema)
			.query(getTicketTypeHandler),
		create: permissionProtectedProcedure("tickets.types.manage")
			.input(ZCreateTicketTypeSchema)
			.mutation(createTicketTypeHandler),
		update: permissionProtectedProcedure("tickets.types.manage")
			.input(ZUpdateTicketTypeSchema)
			.mutation(updateTicketTypeHandler),
		delete: permissionProtectedProcedure("tickets.types.manage")
			.input(ZDeleteTicketTypeSchema)
			.mutation(deleteTicketTypeHandler),
		reorder: permissionProtectedProcedure("tickets.types.manage")
			.input(ZReorderTicketTypesSchema)
			.mutation(reorderTicketTypesHandler),
	}),

	// Ticket submission - public endpoint (auth check happens inside based on ticket type)
	submit: publicProcedure
		.input(ZSubmitTicketSchema)
		.mutation(submitTicketHandler),

	// My tickets (for logged in users)
	listMy: protectedProcedure
		.input(ZListMyTicketsSchema)
		.query(listMyTicketsHandler),
	getMy: protectedProcedure.input(ZGetMyTicketSchema).query(getMyTicketHandler),

	// Admin ticket management
	list: permissionProtectedProcedure("tickets.manage")
		.input(ZListTicketsSchema)
		.query(listTicketsHandler),
	get: permissionProtectedProcedure("tickets.manage")
		.input(ZGetTicketSchema)
		.query(getTicketHandler),
	updateStatus: permissionProtectedProcedure("tickets.manage")
		.input(ZUpdateTicketStatusSchema)
		.mutation(updateTicketStatusHandler),
	assign: permissionProtectedProcedure("tickets.manage")
		.input(ZAssignTicketSchema)
		.mutation(assignTicketHandler),
	updateNotes: permissionProtectedProcedure("tickets.manage")
		.input(ZUpdateTicketNotesSchema)
		.mutation(updateTicketNotesHandler),
});
