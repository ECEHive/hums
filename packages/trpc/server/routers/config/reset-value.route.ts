import { ConfigService } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import type { ZResetValueSchema } from "./schemas";

type ResetValueInput = z.infer<typeof ZResetValueSchema>;

export async function resetValueHandler({
	input,
}: {
	input: ResetValueInput;
	ctx: TPermissionProtectedProcedureContext;
}): Promise<void> {
	try {
		await ConfigService.reset(input.key);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error
					? error.message
					: "Failed to reset configuration",
		});
	}
}
