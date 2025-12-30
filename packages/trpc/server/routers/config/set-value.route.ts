import { ConfigService } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import type { ZSetValueSchema } from "./schemas";

type SetValueInput = z.infer<typeof ZSetValueSchema>;

export async function setValueHandler({
	input,
}: {
	input: SetValueInput;
	ctx: TPermissionProtectedProcedureContext;
}): Promise<void> {
	try {
		await ConfigService.set(input.key, input.value);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error ? error.message : "Failed to set configuration",
		});
	}
}
