import { ConfigService } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { ZSetManySchema } from "./schemas";

type SetManyInput = z.infer<typeof ZSetManySchema>;

export async function setManyHandler({
	input,
}: {
	input: SetManyInput;
}): Promise<void> {
	try {
		await ConfigService.setMany(input.values);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error ? error.message : "Failed to set configurations",
		});
	}
}
