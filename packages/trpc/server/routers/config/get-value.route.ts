import { ConfigService } from "@ecehive/features";
import type { z } from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import type { ZGetValueSchema } from "./schemas";

type GetValueInput = z.infer<typeof ZGetValueSchema>;

export async function getValueHandler({
	input,
}: {
	input: GetValueInput;
	ctx: TPermissionProtectedProcedureContext;
}): Promise<unknown> {
	return await ConfigService.get(input.key);
}
