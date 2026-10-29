import z from "zod";
import { protectedProcedure, router } from "../../trpc";
import { getCurrentStaffing } from "../../utils/current-staffing";

export const staffingRouter = router({
	currentStaffing: protectedProcedure
		.input(z.object({}))
		.query(() => getCurrentStaffing()),
});
