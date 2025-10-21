import { permissionProtectedProcedure, router } from "../../trpc";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import { registerHandler, ZRegisterSchema } from "./register.route";
import { unregisterHandler, ZUnregisterSchema } from "./unregister.route";

export const shiftScheduleAssignmentsRouter = router({
	register: permissionProtectedProcedure("shiftScheduleAssignments.register")
		.input(ZRegisterSchema)
		.mutation(registerHandler),
	unregister: permissionProtectedProcedure(
		"shiftScheduleAssignments.unregister",
	)
		.input(ZUnregisterSchema)
		.mutation(unregisterHandler),
	create: permissionProtectedProcedure("shiftScheduleAssignments.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	delete: permissionProtectedProcedure("shiftScheduleAssignments.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
});
