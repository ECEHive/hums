import z from "zod";
import type { TDashboardProtectedProcedureContext } from "../../trpc";
import { getCurrentStaffing } from "../../utils/current-staffing";

export const ZCurrentStaffingSchema = z.object({});
export type TCurrentStaffingSchema = z.infer<typeof ZCurrentStaffingSchema>;
export type TCurrentStaffingOptions = {
	ctx: TDashboardProtectedProcedureContext;
	input: TCurrentStaffingSchema;
};
export async function currentStaffingHandler(
	_options: TCurrentStaffingOptions,
) {
	return getCurrentStaffing();
}
