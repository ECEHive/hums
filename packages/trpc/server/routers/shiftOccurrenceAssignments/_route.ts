import { permissionProtectedProcedure, router } from "../../trpc";
import { listHandler, ZListSchema } from "./list.route";

export const shiftOccurrenceAssignmentsRouter = router({
	list: permissionProtectedProcedure("shiftOccurrenceAssignments.list")
		.input(ZListSchema)
		.query(listHandler),
});
