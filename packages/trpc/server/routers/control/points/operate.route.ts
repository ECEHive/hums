import { operateControlPointByUserId } from "@ecehive/features";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZOperatePointSchema = z.object({
	id: z.string().uuid(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
});

type OperatePointOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZOperatePointSchema>;
};

export async function operatePointHandler({ ctx, input }: OperatePointOptions) {
	const result = await operateControlPointByUserId({
		controlPointId: input.id,
		userId: ctx.user.id,
		isSystemUser: ctx.user.isSystemUser,
		username: ctx.user.username,
		action: input.action,
	});

	return {
		success: result.success,
		newState: result.newState,
		logId: result.logId,
	};
}
