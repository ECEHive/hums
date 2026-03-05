import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({ id: z.number().min(1) });
export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const eventType = await prisma.instantEventType.findUnique({
		where: { id },
		include: {
			schedulerRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
			participantRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
			requiredRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
			_count: { select: { bookings: true } },
		},
	});

	return { eventType };
}
