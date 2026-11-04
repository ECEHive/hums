import { permissionProtectedProcedure, router } from "../../trpc";
import {
	currentStaffingHandler,
	ZCurrentStaffingSchema,
} from "./currentStaffing.route";

export const staffingRouter = router({
	currentStaffing: permissionProtectedProcedure("shift_schedules.list")
		.input(ZCurrentStaffingSchema)
		.query(currentStaffingHandler),
});
